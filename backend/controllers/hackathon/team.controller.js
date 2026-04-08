import HackathonTeam from "../../models/hackathon/team.model.js";
import Hackathon from "../../models/hackathon/hackathons.model.js";
import client from "../../utils/redis.js";
import HackathonChannel from "../../models/hackathon/Hackathonchannel.model.js";
// Post api/teams/
export const createTeam = async (req, res, next) => {
   try {
      const { hackathonId, name, description, isLocked, requiredskill } = req.body;
      const hack = await Hackathon.findById(hackathonId);
      if (!hack) {
         return res.status(402).json({ success: true, message: "hackathon not found" });
      }
      // user cannot have two teams in the same hackathon
      const existingteam = await HackathonTeam.find({
         hackathon: hackathonId,
         "members.user": req.user.id
      })
      if (existingteam) {
         return res.status(403).json({ success: false, message: "already in a team" });
      }
      const team = await HackathonTeam.create({
         name,
         hackathon: hackathonId,
         leader: req.user.id,
         isLocked,
         members: [{ user: req.user.id, role: "leader" }],
         description,
         requiredSkills: requiredskill || []
      })
      await team.populate("members.user", "avatar name role");
      await team.save();
      return res.status(402).json({ success: true, data: team });
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
      if (lookingforMembers) filter.lookingforMembers = lookingforMembers;
      const teams = await HackathonTeam.find(filter).populate("leader", "name avtar skills").populate("members.user", "avatar skills name");
      res.status(200).json({ success: true, teams });
   } catch (error) {
      next(error);
   }
}
//get api/team/:Id
export const getTeam = async (req, res, next) => {
   try {
      const { Id } = req.params;
      const team = await HackathonTeam.findById(Id).
         populate("leader", "skills avatar name").
         populate("members.user", "name avatar skills").
         populate("invites.to", "name avatar skills").
         populate("joinRequests.from", "name avatar skills").
         populate("hackathon", "maxTeamSize title status minteamSize");

      if (!team) {
         return res.status(403).json({ success: false, message: "team doesn't exist" });
      }
      return res.status(200).json({
         success: true,
         team
      })
   } catch (error) {
      next(error)
   }
}

// api/teams/:Id
export const updateteam = async (req, res) => {
   try {
      const { Id } = req.params;
      const team = await HackathonTeam.findById(req.params.Id);
      if (!team) {
         return res.status(403).json({ success: true, message: "Team not found" });
      }
      if (team.leader.toString() !== req.user.id.toString()) {
         return res.status(403).json({ success: true, message: "Not authorised to edit" });
      }
      const allowed = ["name", "description", "requiredSkills", "lookingForMembers"];
      allowed.forEach((f) => {
         if (req.body[f] !== undefined) team[f] = req.body[f];
      })
      await team.save();
      return res.status(200).json({ success: true, team });
   } catch (error) {
      next(error);
   }
}

// Delete  api/teams/:Id
export const DeleteTeam = async (req, res) => {
   try {
      const team = await HackathonTeam.findById(req.params.Id);
      if (!team) {
         return res.status(403).json({ success: false, message: "team Doesn't exists" });
      }
      if (team.leader.toString() !== req.user.id.toString()) {
         return res.status(403).json({ success: false, message: "Only Leader can delete team" });
      }
      await team.deleteOne();
      return res.status(200).json({ success: true, message: "Team deleted succesfully" });
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
      const team = await HackathonTeam.findById(Id).populate("hackathon");
      if (!team) {
         return res.status(403).json({ success: false, message: "team Doesn't exists" });
      }
      if (team.leader.toString() !== req.user.id.toString()) {
         return res.status(403).json({ success: false, message: "Only leader can invite anyone" });
      }
      if (!team.isLocked) {
         return res.status(403).json({ success: true, message: "Team is locked" })
      }
      if (!team.members.length >= team.hackathon.MaxTeamSize.length) {
         return res.status(403).json({ success: false, message: "Member cannot exceed the limit of the users" });
      }

      // check if the user is already a member of the team
      const isMember = team.members.some((f) => f.user.toString() == userId.toString())
      if (isMember) {
         return res.status(403).json({ success: true, message: "Already a Member" });
      }

      const IsAlreadyInvited = team.invites.some((f) => f.to.toString() == userId.toString() && f.status == "pending");
      if (IsAlreadyInvited) {
         return res.status(403).json({ success: false, message: "Already Invited Member" });
      }

      team.invites.push({ to: userId });
      await team.save();

      const io = req.app.get("io");
      io.to(`user:${userId}`).emit("Invite:received", {
         teamId: team._id,
         teamname: team.name,
         hackathon: team.hackathon.title,
         from: req.user.name,
      })
      return res.status(200).json({ success: true, message: "Invite send" });
   } catch (error) {
      next(error);
   }
}

// patch api/team/:Id/invites/respond
export const RespondtoInvite = async (req, res) => {
   try {
      const { action } = req.body; // accept | decline 
      const team = await HackathonTeam.findById(req.params).populate("hackathon");
      if (!team) {
         return res.status(403).json({ success: false, message: "team Doesn't exists" });
      }
      // check if you are invited or not
      const invite = team.invites.find((f) => f.to.toString() == req.user.id.toString() && f.status === "pending");

      if (!invite) {
         return res.status(403).json({ success: true, message: "No pending Invites found" });
      }

      invite.status = action === "accept" ? "accepted" : "declined";

      if (action === "accept") {
         if (team.members.length >= team.hackathon.MaxTeamSize) {
            return res.status(403).json({ success: true, message: "Max team size reached" });
         }
         // check if the user is already in a hackathon or not
         const AlreadyInteam = await HackathonTeam.findOne({
            hackathon: team.hackathon.Id,
            "member.user": req.user.Id
         })
         if (AlreadyInteam) {
            return res.status(403).json({ success: true, message: "you are already in a team for this hackathon" });
         }
         team.members.push({ user: req.user.Id, role: "member" });

         // Lock if member exceeded the limit after adding the 
         if (team.members.length >= team.hackathon.maxTeamSize) {
            team.isLocked = true;
            team.lookingForMembers = false;
         }
         const io = req.app.get("io");
         // Notify the team leader
         io.to(`user:${team.leader}`).emit("invite:accepted", {
            teamId: team._id,
            name: req.user.name,
            avatar: req.user.avatar
         })

         // notify the hackathon channel
         io.to(`hackathon:${team.hackathon}`).emit("team:member_joined", {
            teamId: team._id,
            teamName: team.name,
            user: { userId: req.user.Id, name: req.user.name }
         })
      } else {
         const io = req.app.get("io");
         io.to(`user:${team.leader}`).emit("invite:declined", {
            teamId: team._id,
            name: req.user.name
         })
      }
      await team.save();
      return res.status(200).json({ success: true, team });
   } catch (error) {
      next(error);
   }
}


//POST api/team/:Id/request  - user request to join open team

export const requesttoJoin = async (req, res, next) => {
   try {
      const team = await HackathonTeam.findById(req.params.Id).populate("hackathon");
      if (!team) {
         return res.status(403).json({ success: false, message: "team Doesn't exists" });
      }
      if (!team.lookingForMembers) {
         return res.status(403).json({ success: false, message: "Not looking for members anymore" })
      }
      if (team.isLocked) {
         return res.status(403).json({ success: true, message: "team is locked" });
      }
      // already in a team;
      const AlreadyinTeam = await HackathonTeam.find({
         hackathon: team.hackathon,
         "members.user": req.user.Id,
      })
      if (AlreadyinTeam) {
         return res.status(200).json({ success: true, message: "you are already in a team" });
      }
      const alreadyrequested = team.joinRequests.some((f) => f.from.toString() == req.user.Id.toString() && f.status == "pending");
      if (alreadyrequested) {
         return res.status(200).json({ success: true, message: "Your request is pending" });
      }
      team.joinRequests.push({ from: req.user.Id, message: req.body.message });
      await team.save();

      // notify the leader 
      const io = req.app.get("io");
      io.to(`user:${team.leader}`).emit("joinrequest:received", {
         user: req.user.Id,
         name: req.user.name,
         avatar: req.user.avatar,
         skills: req.user.skills,
         message: req.message.body
      })
      return res.status(200).json({ success: true, message: "request sent successfully" });
   }
   catch (error) {
      next(error);
   }
}
// Post api/team/:id/request/respond - leader accepts or decline join request

export const respondToJoinRequest = async (req, res, next) => {
   try {
      const { action, requestId } = req.body;
      const team = await Team.findById(req.params.id).populate("hackathon");
      if (!team)
         return res.status(404).json({ success: false, message: "Team not found" });
      if (team.leader.toString() !== req.user._id.toString())
         return res.status(403).json({ success: false, message: "Only leader can respond" });
      const request = team.joinRequests.id(requestId);
      if (!request || request.status !== "pending") {
         return res.status(403).json({ success: true, message: "No request found" });
      }
      request.status = action === "accept" ? "accepted" : "declined";
      if (action == "accept") {
         // first check for the team space
         if (team.members.length >= team.hackathon.maxTeamSize) {
            return res.status(403).json({ success: false, message: "Cannot accept more members" })
         }
         // now push the user into the members array
         team.members.push({ user: request.from, role: "member" });
         // now check if the maxlimit reached so that islocked can be set to false
         if (team.members.length >= team.hackathon.maxTeamSize) {
            team.lookingForMembers = false,
               team.isLocked = false
         }

         const io = req.app.get("io");
         io.to(`user:${team.from}`).emit("joinrequest:accepted", {
            team: team._id,
            teamname: team.name
         })
      }
      else {
         const io = req.app.get("io");
         io.to(`user:${team.from}`).emit("Joinrequest:declined", {
            team: team._id,
            teamname: team.name
         })
      }
      await team.save();
      res.status(200).json({ succes: true, message: "user added" });
   } catch (error) {
      next(error);
   }
}


// Skil matching 
// get api/teams/match/:hackathonId
export const matchTeams = async (req, res, next) => {
   try {
      const cacheKey = `match:${req.params.hackathonId}:${req.user._id}`;
      const cached = await redisClient.get(cacheKey);
      if (cached)
         return res.status(200).json({ success: true, fromCache: true, teams: JSON.parse(cached) });

      const userSkills = new Set(req.user.skills || []);

      const openTeams = await Team.find({
         hackathon: req.params.hackathonId,
         lookingForMembers: true,
         isLocked: false,
      })
         .populate("leader", "name avatar skills")
         .populate("members.user", "name avatar");

      const scored = openTeams
         // exclude teams the user is already in
         .filter((t) => !t.members.some((m) => m.user._id.toString() === req.user._id.toString()))
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
      await redisClient.setex(cacheKey, 300, JSON.stringify(scored));

      res.status(200).json({ success: true, fromCache: false, teams: scored });
   } catch (err) { next(err); }
};

// POST api/teams/:Id/leave - member leaves team

export const LeaveMember = async (req, res, next) => {
   try {
      const team = await Hackathon.findById(req.params.id);
      if (!team) {
         return res.status(403).json({ succes: false, message: "team does't exist" });
      }
      if (team.leader.toString() === req.user.Id.toString()) {
         return res.status(403).json({ succes: true, message: "Leader cannot leave" });
      }
      const isMember = team.members.find((m) => m.user.toString() === req.user.Id.toString() && role === "member")
      if (!isMember) {
         return res.status(200).json({ success: true, message: "you not in this team" });
      }
      team.members = team.members.filter((m) => m.user.toString() !== req.user.Id.toString());
      if (team.isLocked) team.isLocked = false;
      team.lookingForMembers = true;
      await team.save();
      return res.status(200).json({ success: true, message: "Team left", data: team });
   } catch (error) {
      next(error);
   }
} 