import HackathonTeam from "../../models/hackathon/team.model.js";
import Hackathon from "../../models/hackathon/hackathons.model.js";
import redisClient from "../../utils/redis.js";
import HackathonChannel from "../../models/hackathon/Hackathonchannel.model.js";

// Post api/teams/
export const createTeam = async (req, res, next) => {
   try {
      const { hackathonId, name, description, isLocked, requiredskill } = req.body;
      const hack = await Hackathon.findById(hackathonId);
      if (!hack) {
         // FIX: was 402 (Payment Required) — should be 404
         return res.status(404).json({ success: false, message: "hackathon not found" });
      }
      // user cannot have two teams in the same hackathon
      // FIX: .find() returns an array — use .findOne() for truthiness check
      const existingteam = await HackathonTeam.findOne({
         hackathon: hackathonId,
         "members.user": req.user.id
      });
      if (existingteam) {
         return res.status(400).json({ success: false, message: "already in a team" });
      }
      const team = await HackathonTeam.create({
         name,
         hackathon: hackathonId,
         leader: req.user.id,
         isLocked,
         members: [{ user: req.user.id, role: "leader" }],
         description,
         requiredSkills: requiredskill || []
      });
      await team.populate("members.user", "avatar name role");
      // FIX: was 402 — should be 201 (Created)
      return res.status(201).json({ success: true, data: team });
   }
   catch (error) {
      next(error);
   }
}

// Get api/team?hackathon=Id&lookingformember
export const getTeams = async (req, res, next) => {
   try {
      const { hackathon, lookingforMembers } = req.query;
      const filter = {};
      if (hackathon) filter.hackathon = hackathon;
      if (lookingforMembers) filter.lookingForMembers = lookingforMembers === "true";
      // FIX: typo 'avtar' -> 'avatar'
      const teams = await HackathonTeam.find(filter).populate("leader", "name avatar skills").populate("members.user", "avatar skills name");
      res.status(200).json({ success: true, teams });
   } catch (error) {
      next(error);
   }
}

// get api/team/:Id
export const getTeam = async (req, res, next) => {
   try {
      const { Id } = req.params;
      const team = await HackathonTeam.findById(Id).
         populate("leader", "skills avatar name").
         populate("members.user", "name avatar skills").
         populate("invites.to", "name avatar skills").
         populate("joinRequests.from", "name avatar skills").
         populate("hackathon", "MaxTeamSize title status");

      if (!team) {
         return res.status(404).json({ success: false, message: "team doesn't exist" });
      }
      return res.status(200).json({
         success: true,
         team
      });
   } catch (error) {
      next(error);
   }
}

// api/teams/:Id
// FIX: was missing 'next' param — called next(error) without it in scope
export const updateteam = async (req, res, next) => {
   try {
      const team = await HackathonTeam.findById(req.params.Id);
      if (!team) {
         return res.status(404).json({ success: false, message: "Team not found" });
      }
      if (team.leader.toString() !== req.user.id.toString()) {
         return res.status(403).json({ success: false, message: "Not authorised to edit" });
      }
      const allowed = ["name", "description", "requiredSkills", "lookingForMembers"];
      allowed.forEach((f) => {
         if (req.body[f] !== undefined) team[f] = req.body[f];
      });
      await team.save();
      return res.status(200).json({ success: true, team });
   } catch (error) {
      next(error);
   }
}

// Delete  api/teams/:Id
// FIX: was missing 'next' param — called next(error) without it in scope
export const DeleteTeam = async (req, res, next) => {
   try {
      const team = await HackathonTeam.findById(req.params.Id);
      if (!team) {
         return res.status(404).json({ success: false, message: "team Doesn't exists" });
      }
      if (team.leader.toString() !== req.user.id.toString()) {
         return res.status(403).json({ success: false, message: "Only Leader can delete team" });
      }
      await team.deleteOne();
      return res.status(200).json({ success: true, message: "Team deleted successfully" });
   } catch (error) {
      next(error);
   }
}

// Invite (leader -> user)
// post /api/team/:Id/invite
export const Invite = async (req, res, next) => {
   try {
      const { Id } = req.params;
      const { userId } = req.body;
      const team = await HackathonTeam.findById(Id).populate("hackathon", "title MaxTeamSize");
      if (!team) {
         return res.status(404).json({ success: false, message: "team Doesn't exists" });
      }
      if (team.leader.toString() !== req.user.id.toString()) {
         return res.status(403).json({ success: false, message: "Only leader can invite anyone" });
      }
      // FIX: logic was inverted — should block when team IS locked
      if (team.isLocked) {
         return res.status(400).json({ success: false, message: "Team is locked" });
      }
      // FIX: was `!team.members.length >= ...` — operator precedence bug, ! applies to length first
      if (team.members.length >= team.hackathon.MaxTeamSize) {
         return res.status(400).json({ success: false, message: "Team is at max capacity" });
      }

      // check if the user is already a member of the team
      const isMember = team.members.some((f) => f.user.toString() == userId.toString());
      if (isMember) {
         return res.status(400).json({ success: false, message: "Already a Member" });
      }

      const IsAlreadyInvited = team.invites.some((f) => f.to.toString() == userId.toString() && f.status == "pending");
      if (IsAlreadyInvited) {
         return res.status(400).json({ success: false, message: "Already Invited Member" });
      }

      team.invites.push({ to: userId });
      await team.save();

      const io = req.app.get("io");
      if (io) {
         io.to(`user:${userId}`).emit("Invite:received", {
            teamId: team._id,
            teamname: team.name,
            hackathon: team.hackathon.title,
            from: req.user.name,
         });
      }
      return res.status(200).json({ success: true, message: "Invite sent" });
   } catch (error) {
      next(error);
   }
}

// patch api/team/:Id/invites/respond
// FIX: was missing 'next' param; also findById(req.params) -> findById(req.params.Id)
export const RespondtoInvite = async (req, res, next) => {
   try {
      const { action } = req.body; // accept | decline
      // FIX: was findById(req.params) (the params object) — must use req.params.Id
      const team = await HackathonTeam.findById(req.params.Id).populate("hackathon", "title MaxTeamSize");
      if (!team) {
         return res.status(404).json({ success: false, message: "team Doesn't exists" });
      }
      // check if you are invited or not
      const invite = team.invites.find((f) => f.to.toString() == req.user.id.toString() && f.status === "pending");

      if (!invite) {
         return res.status(404).json({ success: false, message: "No pending Invites found" });
      }

      invite.status = action === "accept" ? "accepted" : "declined";

      if (action === "accept") {
         if (team.members.length >= team.hackathon.MaxTeamSize) {
            return res.status(400).json({ success: false, message: "Max team size reached" });
         }
         // check if the user is already in a team for this hackathon
         // FIX: was using req.user.Id (capital I) — should be req.user.id
         const AlreadyInteam = await HackathonTeam.findOne({
            hackathon: team.hackathon._id,
            "members.user": req.user.id
         });
         if (AlreadyInteam) {
            return res.status(400).json({ success: false, message: "you are already in a team for this hackathon" });
         }
         // FIX: was req.user.Id (capital I)
         team.members.push({ user: req.user.id, role: "member" });

         // Lock if member count hit the limit
         if (team.members.length >= team.hackathon.MaxTeamSize) {
            team.isLocked = true;
            team.lookingForMembers = false;
         }
         const io = req.app.get("io");
         if (io) {
            // Notify the team leader
            io.to(`user:${team.leader}`).emit("invite:accepted", {
               teamId: team._id,
               name: req.user.name,
               avatar: req.user.avatar
            });

            // Notify the hackathon channel
            // FIX: room prefix was `hackathon:` — clients join `hack:`
            io.to(`hack:${team.hackathon._id}`).emit("team:member_joined", {
               teamId: team._id,
               teamName: team.name,
               user: { userId: req.user.id, name: req.user.name }
            });
         }
      } else {
         const io = req.app.get("io");
         if (io) {
            io.to(`user:${team.leader}`).emit("invite:declined", {
               teamId: team._id,
               name: req.user.name
            });
         }
      }
      await team.save();
      return res.status(200).json({ success: true, team });
   } catch (error) {
      next(error);
   }
}


// POST api/team/:Id/request  - user request to join open team
export const requesttoJoin = async (req, res, next) => {
   try {
      const team = await HackathonTeam.findById(req.params.Id).populate("hackathon", "title MaxTeamSize");
      if (!team) {
         return res.status(404).json({ success: false, message: "team Doesn't exists" });
      }
      if (!team.lookingForMembers) {
         return res.status(400).json({ success: false, message: "Not looking for members anymore" });
      }
      if (team.isLocked) {
         return res.status(400).json({ success: false, message: "team is locked" });
      }
      // already in a team — FIX: was using req.user.Id (capital I), .find() returns array so use .findOne()
      const AlreadyinTeam = await HackathonTeam.findOne({
         hackathon: team.hackathon._id,
         "members.user": req.user.id,
      });
      if (AlreadyinTeam) {
         return res.status(400).json({ success: false, message: "you are already in a team" });
      }
      // FIX: was req.user.Id (capital I)
      const alreadyrequested = team.joinRequests.some((f) => f.from.toString() == req.user.id.toString() && f.status == "pending");
      if (alreadyrequested) {
         return res.status(400).json({ success: false, message: "Your request is already pending" });
      }
      // FIX: was req.user.Id (capital I); FIX: was req.message.body -> req.body.message
      team.joinRequests.push({ from: req.user.id, message: req.body.message });
      await team.save();

      // notify the leader
      const io = req.app.get("io");
      if (io) {
         io.to(`user:${team.leader}`).emit("joinrequest:received", {
            user: req.user.id,
            name: req.user.name,
            avatar: req.user.avatar,
            skills: req.user.skills,
            message: req.body.message
         });
      }
      return res.status(200).json({ success: true, message: "request sent successfully" });
   }
   catch (error) {
      next(error);
   }
}

// Post api/team/:id/request/respond - leader accepts or declines join request
export const respondToJoinRequest = async (req, res, next) => {
   try {
      const { action, requestId } = req.body;
      // FIX: was using undefined `Team` variable — should be HackathonTeam
      const team = await HackathonTeam.findById(req.params.Id).populate("hackathon", "title MaxTeamSize");
      if (!team)
         return res.status(404).json({ success: false, message: "Team not found" });
      // FIX: was req.user._id — should be req.user.id to match auth middleware
      if (team.leader.toString() !== req.user.id.toString())
         return res.status(403).json({ success: false, message: "Only leader can respond" });
      const request = team.joinRequests.id(requestId);
      if (!request || request.status !== "pending") {
         return res.status(404).json({ success: false, message: "No pending request found" });
      }
      request.status = action === "accept" ? "accepted" : "declined";
      if (action == "accept") {
         // first check for team space
         if (team.members.length >= team.hackathon.MaxTeamSize) {
            return res.status(400).json({ success: false, message: "Cannot accept more members" });
         }
         // push user into members array
         team.members.push({ user: request.from, role: "member" });
         // lock if max limit reached
         // FIX: was setting isLocked = false when full — should be true
         if (team.members.length >= team.hackathon.MaxTeamSize) {
            team.lookingForMembers = false;
            team.isLocked = true;
         }

         const io = req.app.get("io");
         if (io) {
            // FIX: was `team.from` (doesn't exist) — should be `request.from`
            io.to(`user:${request.from}`).emit("joinrequest:accepted", {
               team: team._id,
               teamname: team.name
            });
         }
      } else {
         const io = req.app.get("io");
         if (io) {
            // FIX: was `team.from` — should be `request.from`
            io.to(`user:${request.from}`).emit("joinrequest:declined", {
               team: team._id,
               teamname: team.name
            });
         }
      }
      await team.save();
      // FIX: typo 'succes' -> 'success'
      res.status(200).json({ success: true, message: "request responded" });
   } catch (error) {
      next(error);
   }
}


// Skill matching
// get api/teams/match/:hackathonId
export const matchTeams = async (req, res, next) => {
   try {
      const cacheKey = `match:${req.params.hackathonId}:${req.user.id}`;
      const cached = await redisClient.get(cacheKey);
      if (cached)
         return res.status(200).json({ success: true, fromCache: true, teams: JSON.parse(cached) });

      const userSkills = new Set(req.user.skills || []);

      // FIX: was using undefined `Team` variable — should be HackathonTeam
      const openTeams = await HackathonTeam.find({
         hackathon: req.params.hackathonId,
         lookingForMembers: true,
         isLocked: false,
      })
         .populate("leader", "name avatar skills")
         .populate("members.user", "name avatar");

      const scored = openTeams
         // exclude teams the user is already in
         // FIX: was using req.user._id — use req.user.id
         .filter((t) => !t.members.some((m) => m.user._id.toString() === req.user.id.toString()))
         .map((team) => {
            const required = new Set(team.requiredSkills || []);
            if (required.size === 0) return { team, score: 0 };

            const intersection = [...userSkills].filter((s) => required.has(s)).length;
            const union = new Set([...userSkills, ...required]).size;
            const score = union > 0 ? parseFloat((intersection / union).toFixed(3)) : 0;

            return { team, score };
         })
         .sort((a, b) => b.score - a.score)
         .slice(0, 10); // top 10 matches

      // Cache for 5 minutes
      await redisClient.setEx(cacheKey, 300, JSON.stringify(scored));

      res.status(200).json({ success: true, fromCache: false, teams: scored });
   } catch (err) { next(err); }
};

// POST api/teams/:Id/leave - member leaves team
export const LeaveMember = async (req, res, next) => {
   try {
      // FIX: was calling Hackathon.findById instead of HackathonTeam.findById
      const team = await HackathonTeam.findById(req.params.Id);
      if (!team) {
         return res.status(404).json({ success: false, message: "team doesn't exist" });
      }
      // FIX: was using req.user.Id (capital I)
      if (team.leader.toString() === req.user.id.toString()) {
         return res.status(403).json({ success: false, message: "Leader cannot leave the team" });
      }
      // FIX: was using req.user.Id (capital I); FIX: `role` was used without `m.` prefix
      const isMember = team.members.find((m) => m.user.toString() === req.user.id.toString() && m.role === "member");
      if (!isMember) {
         return res.status(400).json({ success: false, message: "You are not in this team" });
      }
      // FIX: was using req.user.Id (capital I)
      team.members = team.members.filter((m) => m.user.toString() !== req.user.id.toString());
      if (team.isLocked) team.isLocked = false;
      team.lookingForMembers = true;
      await team.save();
      return res.status(200).json({ success: true, message: "Successfully left the team", data: team });
   } catch (error) {
      next(error);
   }
}