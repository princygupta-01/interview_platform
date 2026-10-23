const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Session = require('../models/Session');
const Problem = require('../models/Problem');
const { sanitizeProblemForRole } = require('../utils/sanitize');

const router = express.Router();

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

router.post('/create', requireAuth, async (req, res) => {
  try {
    const { title, description, testCases } = req.body;

    if (!title || !description) {
      return res.status(400).json({ message: 'Title and description are required' });
    }

    const problem = await Problem.create({
      title,
      description,
      createdBy: req.userId,
      testCases: Array.isArray(testCases) ? testCases : [],
    });

    const roomId = crypto.randomBytes(6).toString('hex');

    const session = await Session.create({
      roomId,
      createdBy: req.userId,
      problem: problem._id,
      title,
    });

    res.status(201).json({ roomId: session.roomId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/mine', requireAuth, async (req, res) => {
  try {
    const sessions = await Session.find({
      $or: [{ createdBy: req.userId }, { candidate: req.userId }],
    })
      .populate('problem', 'title')
      .sort({ createdAt: -1 })
      .limit(50);

    const formatted = sessions.map((s) => ({
      roomId: s.roomId,
      title: s.problem?.title || s.title,
      status: s.status,
      role: String(s.createdBy) === String(req.userId) ? 'interviewer' : 'candidate',
      createdAt: s.createdAt,
    }));

    res.json({ sessions: formatted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/:roomId/complete', requireAuth, async (req, res) => {
  try {
    const session = await Session.findOne({ roomId: req.params.roomId });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (String(session.createdBy) !== String(req.userId)) {
      return res.status(403).json({ message: 'Only the interviewer can end this session' });
    }

    session.status = 'completed';
    session.endedAt = new Date();
    await session.save();

    res.json({ message: 'Session marked as completed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:roomId', requireAuth, async (req, res) => {
  try {
    const session = await Session.findOne({ roomId: req.params.roomId }).populate('problem');
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const isInterviewer = String(session.createdBy) === String(req.userId);
    const isCandidate = session.candidate && String(session.candidate) === String(req.userId);

    if (!isInterviewer && !isCandidate) {
      return res.status(403).json({ message: 'Not authorized to view this session' });
    }

    const role = isInterviewer ? 'interviewer' : 'candidate';
    const sanitizedProblem = sanitizeProblemForRole(session.problem, role);

    res.json({ session: { ...session.toObject(), problem: sanitizedProblem } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;