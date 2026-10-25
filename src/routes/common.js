'use strict';
const express = require('express');
const { q } = require('../db');
const { wrap, validate } = require('../util');
const { requireRole } = require('../auth');

// Grievance / helpdesk tickets raised by students and faculty.
const router = express.Router();
router.use(requireRole('student', 'faculty'));

router.get('/grievances', wrap((req, res) => {
  res.json(q.all('SELECT * FROM grievances WHERE user_id = ? ORDER BY id DESC', req.user.id));
}));

router.post('/grievances', wrap((req, res) => {
  const d = validate(req.body, {
    category: { type: 'enum', required: true, values: ['Academic', 'Examination', 'Fees & Accounts', 'Hostel', 'Transport', 'Infrastructure', 'Anti-Ragging', 'Other'], label: 'Category' },
    subject: { required: true, max: 150, label: 'Subject' },
    description: { required: true, max: 3000, label: 'Description' },
  });
  q.run('INSERT INTO grievances (user_id, category, subject, description) VALUES (?, ?, ?, ?)', req.user.id, d.category, d.subject, d.description);
  res.status(201).json({ ok: true, message: 'Your ticket has been raised. You will be notified here once it is addressed.' });
}));

module.exports = router;
