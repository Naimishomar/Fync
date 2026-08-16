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
      .populate('problems', 'title difficulty tags') // Only basic info for now
      .populate('participants.user', 'username avatar');
    
    if (!contest) return res.status(404).json({ message: 'Contest not found' });

    const currentUserId = req.user?.id || req.user?._id;

    // Find current user's participant record
    const participant = contest.participants.find(p => String(p.user?._id || p.user) === String(currentUserId));
    const hasEntered = participant && participant.enteredAt;

    // Redact problem content if not entered
    if (!hasEntered) {
      contest.problems = contest.problems.map(p => ({
        _id: p._id,
        title: p.title,
        difficulty: p.difficulty,
        isLocked: true // Signal to frontend that content is redacted
      }));
    }

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
    
    // Check if contest has already ended
    if (new Date() > new Date(contest.endTime)) {
      return res.status(400).json({ message: 'Contest has already ended' });
    }

    const currentUserId = req.user?.id || req.user?._id;

    const alreadyRegistered = contest.participants.find(p => String(p.user?._id || p.user) === String(currentUserId));
    if (alreadyRegistered) return res.status(400).json({ message: 'Already registered' });

    contest.participants.push({ user: currentUserId });
    await contest.save();
    res.json({ message: 'Registered successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const enterContest = async (req, res) => {
  try {
    const contest = await Contest.findById(req.params.id).populate('problems');
    if (!contest) return res.status(404).json({ message: 'Contest not found' });

    const currentUserId = req.user?.id || req.user?._id;

    // Verify registration
    const participant = contest.participants.find(p => String(p.user?._id || p.user) === String(currentUserId));
    if (!participant) return res.status(403).json({ message: 'Not registered for this contest' });

    // Check timing
    const now = new Date();
    if (now < new Date(contest.startTime)) return res.status(400).json({ message: 'Contest has not started yet' });
    if (now > new Date(contest.endTime)) return res.status(400).json({ message: 'Contest has already ended' });

    // Set enteredAt if not already set
    if (!participant.enteredAt) {
      participant.enteredAt = now;
      await contest.save();
    }

    res.json({ 
      message: 'Entered contest successfully',
      problems: contest.problems 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getArchivedContests = async (req, res) => {
  try {
    const contests = await Contest.find({ 
      $or: [
        { endTime: { $lte: new Date() } },
        { status: 'Completed' }
      ]
    }).sort({ endTime: -1 }).populate('problems', 'title difficulty');
    res.json(contests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
