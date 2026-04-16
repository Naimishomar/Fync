import Contest from '../../models/coding/contest.model.js';
import Problem from '../../models/coding/problem.model.js';

export const getUpcomingContests = async (req, res) => {
  try {
    const contests = await Contest.find({ 
      endTime: { $gt: new Date() } 
    }).sort({ startTime: 1 }).populate('problems', 'title difficulty');
    res.json(contests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getContestDetails = async (req, res) => {
  try {
    const contest = await Contest.findById(req.params.id)
      .populate('problems')
      .populate('participants.user', 'username avatar');
    if (!contest) return res.status(404).json({ message: 'Contest not found' });
    res.json(contest);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createContest = async (req, res) => {
  try {
    const { title, description, problemIds, startTime, endTime, prizePool } = req.body;
    const contest = new Contest({
      title,
      description,
      problems: problemIds,
      startTime,
      endTime,
      prizePool
    });
    await contest.save();
    res.status(201).json(contest);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const registerForContest = async (req, res) => {
  try {
    const contest = await Contest.findById(req.params.id);
    if (!contest) return res.status(404).json({ message: 'Contest not found' });
    
    const alreadyRegistered = contest.participants.find(p => p.user.toString() === req.userId);
    if (alreadyRegistered) return res.status(400).json({ message: 'Already registered' });

    contest.participants.push({ user: req.userId });
    await contest.save();
    res.json({ message: 'Registered successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
