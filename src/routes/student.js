'use strict';
const express = require('express');
const config = require('../config');
const { q } = require('../db');
const { wrap, validate, fail, today } = require('../util');
const { requireRole } = require('../auth');
const svc = require('../services');
const { startPayment } = require('./payments');

const router = express.Router();
router.use(requireRole('student'));
router.use((req, _res, next) => {
  req.student = svc.studentProfile(req.user.id);
  next();
});

function timetable(s) {
  return q.all(
    `SELECT t.day, t.period, t.start_time, t.end_time, t.room, sub.code, sub.name, sub.type, u.name AS faculty
       FROM timetable t LEFT JOIN subjects sub ON sub.id = t.subject_id
       LEFT JOIN allocations a ON a.subject_id = t.subject_id AND a.section = t.section
       LEFT JOIN users u ON u.id = a.faculty_id
      WHERE t.program_id = ? AND t.semester = ? AND t.section = ? ORDER BY t.day, t.period`,
    s.program_id, s.current_semester, s.section,
  );
}

function assignments(s) {
  return q.all(
    `SELECT a.id, a.title, a.description, a.due_date, a.max_marks, sub.code, sub.name AS subject, u.name AS faculty,
            sm.content, sm.submitted_at, sm.marks, sm.feedback
       FROM assignments a JOIN subjects sub ON sub.id = a.subject_id
       LEFT JOIN users u ON u.id = a.faculty_id
       LEFT JOIN submissions sm ON sm.assignment_id = a.id AND sm.student_id = ?
      WHERE sub.program_id = ? AND sub.semester = ? AND a.section = ? ORDER BY a.due_date DESC`,
    s.user_id, s.program_id, s.current_semester, s.section,
  );
}

router.get('/dashboard', wrap((req, res) => {
  const s = req.student;
  const att = svc.attendanceSummary(s);
  const fees = svc.feeSummary(s.user_id);
  const results = q.all('SELECT semester, sgpa, cgpa, status FROM results WHERE student_id = ? ORDER BY semester', s.user_id);
  const day = new Date().getDay(); // 0 = Sunday
  const tt = timetable(s);
  res.json({
    profile: s,
    attendance: { percent: att.percent, minimum: att.minimum, subjects: att.subjects },
    fees: fees.totals,
    results,
    today: tt.filter((t) => t.day === day),
    pendingAssignments: assignments(s).filter((a) => !a.submitted_at && a.due_date >= today()).length,
    notices: svc.noticesFor('students', 5),
    exams: svc.admitCard(s).exams.filter((e) => e.date >= today()).slice(0, 5),
    library: q.get('SELECT COUNT(*) AS n FROM book_issues WHERE student_id = ? AND returned_on IS NULL', s.user_id).n,
  });
}));

router.get('/profile', wrap((req, res) => res.json(req.student)));

router.put('/profile', wrap((req, res) => {
  const d = validate(req.body, {
    email: { type: 'email', required: true, label: 'Email' },
    phone: { type: 'phone', required: true, label: 'Mobile number' },
    address: { max: 250, label: 'Address' },
    blood_group: { max: 5 },
  });
  q.tx(() => {
    q.run('UPDATE users SET email = ?, phone = ? WHERE id = ?', d.email, d.phone, req.user.id);
    q.run('UPDATE students SET address = ?, blood_group = ? WHERE user_id = ?', d.address, d.blood_group, req.user.id);
  });
  res.json({ ok: true, message: 'Profile updated' });
}));

router.get('/attendance', wrap((req, res) => {
  const subject = req.query.subject ? Number(req.query.subject) : null;
  res.json({ summary: svc.attendanceSummary(req.student), log: svc.attendanceLog(req.student, subject) });
}));

router.get('/timetable', wrap((req, res) => res.json(timetable(req.student))));

router.get('/results', wrap((req, res) => res.json({ profile: req.student, results: svc.studentResults(req.student), institute: config.institute })));

router.get('/fees', wrap((req, res) => res.json({ ...svc.feeSummary(req.user.id), paymentMode: config.paymentMode })));

router.post('/fees/pay', wrap(async (req, res) => {
  const ids = Array.isArray(req.body && req.body.fee_head_ids) ? req.body.fee_head_ids.map(Number) : null;
  res.json(await startPayment(req.user.id, ids, req.body && req.body.mode));
}));

router.get('/admit-card', wrap((req, res) => res.json({ profile: req.student, ...svc.admitCard(req.student), institute: config.institute })));

router.get('/assignments', wrap((req, res) => res.json(assignments(req.student))));

router.post('/assignments/:id/submit', wrap((req, res) => {
  const d = validate(req.body, { content: { required: true, max: 5000, label: 'Submission' } });
  const a = assignments(req.student).find((x) => x.id === Number(req.params.id));
  if (!a) fail(404, 'Assignment not found');
  if (a.marks !== null && a.marks !== undefined) fail(400, 'This assignment has already been graded');
  q.run(
    `INSERT INTO submissions (assignment_id, student_id, content) VALUES (?, ?, ?)
     ON CONFLICT (assignment_id, student_id) DO UPDATE SET content = excluded.content, submitted_at = datetime('now')`,
    a.id, req.user.id, d.content,
  );
  res.json({ ok: true, message: a.due_date < today() ? 'Submitted (late)' : 'Assignment submitted' });
}));

router.get('/notices', wrap((_req, res) => res.json(svc.noticesFor('students'))));

router.get('/leaves', wrap((req, res) => {
  res.json(q.all('SELECT * FROM leave_requests WHERE student_id = ? ORDER BY id DESC', req.user.id));
}));

router.post('/leaves', wrap((req, res) => {
  const d = validate(req.body, {
    from_date: { type: 'date', required: true, label: 'From date' },
    to_date: { type: 'date', required: true, label: 'To date' },
    reason: { required: true, max: 500, label: 'Reason' },
  });
  if (d.to_date < d.from_date) fail(400, 'To date cannot be before from date');
  q.run('INSERT INTO leave_requests (student_id, from_date, to_date, reason) VALUES (?, ?, ?, ?)', req.user.id, d.from_date, d.to_date, d.reason);
  res.status(201).json({ ok: true, message: 'Leave application submitted' });
}));

router.get('/library', wrap((req, res) => {
  const term = String(req.query.q || '').trim().slice(0, 60);
  const issued = q.all(
    `SELECT i.*, b.title, b.author, b.accession_no,
            CASE WHEN i.returned_on IS NULL AND i.due_on < date('now')
                 THEN CAST(julianday('now') - julianday(i.due_on) AS INTEGER) * 2 ELSE i.fine END AS fine_now
       FROM book_issues i JOIN books b ON b.id = i.book_id WHERE i.student_id = ? ORDER BY i.issued_on DESC`,
    req.user.id,
  );
  const catalog = q.all(
    `SELECT b.*, b.copies - (SELECT COUNT(*) FROM book_issues i WHERE i.book_id = b.id AND i.returned_on IS NULL) AS available
       FROM books b WHERE b.title LIKE ? OR b.author LIKE ? OR b.category LIKE ? ORDER BY b.title LIMIT 50`,
    `%${term}%`, `%${term}%`, `%${term}%`,
  );
  res.json({ issued, catalog });
}));

router.get('/placements', wrap((req, res) => {
  const cgpa = (q.get('SELECT cgpa FROM results WHERE student_id = ? ORDER BY semester DESC LIMIT 1', req.user.id) || {}).cgpa || 0;
  const drives = q.all(
    `SELECT d.*, a.status AS application_status FROM placement_drives d
       LEFT JOIN drive_applications a ON a.drive_id = d.id AND a.student_id = ? ORDER BY d.last_date DESC`,
    req.user.id,
  ).map((d) => ({ ...d, eligible: cgpa >= d.min_cgpa }));
  res.json({ cgpa, drives });
}));

router.post('/placements/:id/apply', wrap((req, res) => {
  const d = q.get('SELECT * FROM placement_drives WHERE id = ?', Number(req.params.id));
  if (!d) fail(404, 'Drive not found');
  if (d.status !== 'open' || d.last_date < today()) fail(400, 'Applications for this drive are closed');
  const cgpa = (q.get('SELECT cgpa FROM results WHERE student_id = ? ORDER BY semester DESC LIMIT 1', req.user.id) || {}).cgpa || 0;
  if (cgpa < d.min_cgpa) fail(400, `Minimum CGPA of ${d.min_cgpa} is required`);
  q.run('INSERT OR IGNORE INTO drive_applications (drive_id, student_id) VALUES (?, ?)', d.id, req.user.id);
  res.json({ ok: true, message: `Applied to ${d.company}` });
}));

module.exports = router;
