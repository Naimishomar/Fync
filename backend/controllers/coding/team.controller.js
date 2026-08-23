import { customAlphabet } from 'nanoid';
import CodingTeam from '../../models/coding/codingTeam.model.js';

// No 0/O/1/I: the code gets read aloud across a table.
const makeCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

// The group challenge is 2v2, so a team is the leader plus one partner.
const TEAM_SIZE = 2;

const roster = (team) => [team.leader, ...team.members].map(String);

export const createTeam = async (req, res) => {
  try {
    const userId = req.user.id;
    const name = req.body?.name?.trim();
    if (!name) return res.status(400).json({ success: false, message: 'Team name is required.' });

    // Being on two teams at once would let someone queue both sides of a match.
    const already = await CodingTeam.findOne({ contest: null, $or: [{ leader: userId }, { members: userId }] });
    if (already) {
      return res.status(409).json({ success: false, message: `You are already on "${already.name}". Leave it first.`, team: already });
    }

    const team = await CodingTeam.create({ name, leader: userId, members: [], inviteCode: makeCode() });
    res.status(201).json({ success: true, team });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const joinTeam = async (req, res) => {
  try {
    const userId = req.user.id;
    const code = req.body?.code?.trim().toUpperCase();
    if (!code) return res.status(400).json({ success: false, message: 'Invite code is required.' });

    const already = await CodingTeam.findOne({ contest: null, $or: [{ leader: userId }, { members: userId }] });
    if (already) {
      return res.status(409).json({ success: false, message: `You are already on "${already.name}".`, team: already });
    }

    // Conditional update rather than read-then-write: two people racing on the
    // last seat would both read size 1 and both be added.
    const team = await CodingTeam.findOneAndUpdate(
      { inviteCode: code, leader: { $ne: userId }, $expr: { $lt: [{ $size: '$members' }, TEAM_SIZE - 1] } },
      { $addToSet: { members: userId } },
      { new: true },
    ).populate('leader members', 'username avatar');

    if (!team) {
      const exists = await CodingTeam.findOne({ inviteCode: code });
      return res.status(exists ? 409 : 404).json({
        success: false,
        message: exists ? 'That team is already full.' : 'No team with that code.',
      });
    }

    res.json({ success: true, team });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyTeam = async (req, res) => {
  try {
    const team = await CodingTeam.findOne({ $or: [{ leader: req.user.id }, { members: req.user.id }] })
      .sort({ createdAt: -1 });
    if (!team) return res.json({ success: true, team: null, ready: false });

    // Seat count is read off the raw ids. populate drops references whose user
    // document is gone, so a deleted account would silently make a full team
    // look like it still has a free seat.
    const ready = roster(team).length === TEAM_SIZE;
    await team.populate('leader members', 'username avatar');
    res.json({ success: true, team, ready });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const leaveTeam = async (req, res) => {
  try {
    const userId = req.user.id;
    const team = await CodingTeam.findOne({ $or: [{ leader: userId }, { members: userId }] });
    if (!team) return res.status(404).json({ success: false, message: 'You are not on a team.' });

    // The leader leaving dissolves the team rather than orphaning the partner
    // on a team they cannot queue with.
    if (String(team.leader) === String(userId)) {
      await team.deleteOne();
      return res.json({ success: true, message: 'Team disbanded.' });
    }

    team.members = team.members.filter((m) => String(m) !== String(userId));
    await team.save();
    res.json({ success: true, message: 'Left the team.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
