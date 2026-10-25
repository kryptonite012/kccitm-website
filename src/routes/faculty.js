'use strict';
const express = require('express');
const { q } = require('../db');
const { wrap, validate, fail, today, round2 } = require('../util');
const { requireRole, audit } = require('../auth');
const svc = require('../services');

const router = express.Router();
router.use(requireRole('faculty'));

const ALLOC_SQL = `
  SELECT a.id, a.section, a.faculty_id, sub.id AS subject_id, sub.code, sub.name, sub.semester, sub.type, sub.credits,
         sub.max_internal, sub.max_external, p.id AS program_id, p.code AS program_code, p.name AS program_name,
         (SELECT COUNT(*) FROM students s WHERE s.program_id = sub.program_id AND s.current_semester = sub.semester
             AND s.section = a.section AND s.status = 'active') AS strength,
         (SELECT COUNT(*) FROM attendance_sessions x WHERE x.subject_id = sub.id AND x.section = a.section) AS lectures
    FROM allocations a JOIN subjects sub ON sub.id = a.subject_id JOIN programs p ON p.id = sub.program_id`;

function allocation(req, id) {
  const a = q.get(`${ALLOC_SQL} WHERE a.id = ? AND a.faculty_id = ?`, Number(id), req.user.id);
  if (!a) fail(404, 'Class not found');
  return a;
}

function roster(a) {
  return q.all(
    `SELECT u.id, u.name, s.roll_no, s.enrollment_no FROM students s JOIN users u ON u.id = s.user_id
      WHERE s.program_id = ? AND s.current_semester = ? AND s.section = ? AND s.status = 'active' ORDER BY s.roll_no`,
    a.program_id, a.semester, a.section,
  );
}

router.get('/dashboard', wrap((req, res) => {
  const profile = q.get(
    `SELECT u.name, u.email, u.phone, f.*, d.name AS department FROM users u JOIN faculty f ON f.user_id = u.id
       LEFT JOIN departments d ON d.id = f.department_id WHERE u.id = ?`, req.user.id);
  const classes = q.all(`${ALLOC_SQL} WHERE a.faculty_id = ? ORDER BY sub.semester, sub.code`, req.user.id);
  const day = new Date().getDay();
  const todayClasses = q.all(
    `SELECT t.*, sub.code, sub.name, p.code AS program_code FROM timetable t JOIN subjects sub ON sub.id = t.subject_id
       JOIN programs p ON p.id = t.program_id
       JOIN allocations a ON a.subject_id = t.subject_id AND a.section = t.section
      WHERE a.faculty_id = ? AND t.day = ? ORDER BY t.period`, req.user.id, day);
  const toGrade = q.get(
    `SELECT COUNT(*) AS n FROM submissions sm JOIN assignments a ON a.id = sm.assignment_id
      WHERE a.faculty_id = ? AND sm.marks IS NULL`, req.user.id).n;
  res.json({ profile, classes, today: todayClasses, toGrade, notices: svc.noticesFor('faculty', 5) });
}));

router.get('/classes', wrap((req, res) => {
  res.json(q.all(`${ALLOC_SQL} WHERE a.faculty_id = ? ORDER BY sub.semester, sub.code`, req.user.id));
}));

router.get('/timetable', wrap((req, res) => {
  res.json(q.all(
    `SELECT t.day, t.period, t.start_time, t.end_time, t.room, t.section, sub.code, sub.name, p.code AS program_code
       FROM timetable t JOIN subjects sub ON sub.id = t.subject_id JOIN programs p ON p.id = t.program_id
       JOIN allocations a ON a.subject_id = t.subject_id AND a.section = t.section
      WHERE a.faculty_id = ? ORDER BY t.day, t.period`, req.user.id));
}));

router.get('/classes/:id/roster', wrap((req, res) => {
  const a = allocation(req, req.params.id);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date)) ? req.query.date : today();
  const period = Number(req.query.period) || 1;
  const session = q.get('SELECT * FROM attendance_sessions WHERE subject_id = ? AND section = ? AND date = ? AND period = ?',
    a.subject_id, a.section, date, period);
  const marked = new Map();
  if (session) for (const r of q.all('SELECT student_id, status FROM attendance_records WHERE session_id = ?', session.id)) marked.set(r.student_id, r.status);
  res.json({ class: a, date, period, session, students: roster(a).map((s) => ({ ...s, status: marked.get(s.id) || null })) });
}));

router.post('/attendance', wrap((req, res) => {
  const d = validate(req.body, {
    allocation_id: { type: 'int', required: true },
    date: { type: 'date', required: true, label: 'Date' },
    period: { type: 'int', min: 1, max: 10, default: 1 },
    topic: { max: 200 },
  });
  if (d.date > today()) fail(400, 'Attendance cannot be marked for a future date');
  const a = allocation(req, d.allocation_id);
  const valid = new Set(roster(a).map((s) => s.id));
  const records = Array.isArray(req.body.records) ? req.body.records : [];
  if (!records.length) fail(400, 'No attendance records submitted');
  q.tx(() => {
    q.run(
      `INSERT INTO attendance_sessions (subject_id, section, faculty_id, date, period, topic) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (subject_id, section, date, period) DO UPDATE SET topic = excluded.topic, faculty_id = excluded.faculty_id`,
      a.subject_id, a.section, req.user.id, d.date, d.period, d.topic,
    );
    const sid = q.get('SELECT id FROM attendance_sessions WHERE subject_id = ? AND section = ? AND date = ? AND period = ?',
      a.subject_id, a.section, d.date, d.period).id;
    for (const r of records) {
      const studentId = Number(r.student_id);
      if (!valid.has(studentId) || !['P', 'A', 'L'].includes(r.status)) continue;
      q.run(`INSERT INTO attendance_records (session_id, student_id, status) VALUES (?, ?, ?)
             ON CONFLICT (session_id, student_id) DO UPDATE SET status = excluded.status`, sid, studentId, r.status);
    }
  });
  audit(req, 'attendance_marked', { allocation: a.id, date: d.date, period: d.period });
  const present = records.filter((r) => r.status !== 'A').length;
  res.json({ ok: true, message: `Attendance saved: ${present}/${records.length} present` });
}));

router.get('/classes/:id/attendance-report', wrap((req, res) => {
  const a = allocation(req, req.params.id);
  const rows = q.all(
    `SELECT u.id, u.name, s.roll_no, COUNT(r.session_id) AS total,
            COALESCE(SUM(CASE WHEN r.status IN ('P','L') THEN 1 ELSE 0 END), 0) AS present
       FROM students s JOIN users u ON u.id = s.user_id
       LEFT JOIN attendance_records r ON r.student_id = u.id
            AND r.session_id IN (SELECT id FROM attendance_sessions WHERE subject_id = ? AND section = ?)
      WHERE s.program_id = ? AND s.current_semester = ? AND s.section = ? AND s.status = 'active'
      GROUP BY u.id ORDER BY s.roll_no`,
    a.subject_id, a.section, a.program_id, a.semester, a.section,
  ).map((r) => ({ ...r, percent: r.total ? round2((r.present / r.total) * 100) : null }));
  const sessions = q.all('SELECT date, period, topic FROM attendance_sessions WHERE subject_id = ? AND section = ? ORDER BY date DESC, period DESC',
    a.subject_id, a.section);
  res.json({ class: a, students: rows, sessions });
}));

router.get('/classes/:id/marks', wrap((req, res) => {
  const a = allocation(req, req.params.id);
  const marks = new Map(q.all('SELECT * FROM marks WHERE subject_id = ?', a.subject_id).map((m) => [m.student_id, m]));
  const published = !!q.get(
    `SELECT 1 FROM results r JOIN students s ON s.user_id = r.student_id WHERE s.program_id = ? AND r.semester = ? AND s.section = ? LIMIT 1`,
    a.program_id, a.semester, a.section);
  res.json({
    class: a,
    published,
    students: roster(a).map((s) => ({ ...s, internal: marks.get(s.id)?.internal ?? null, external: marks.get(s.id)?.external ?? null })),
  });
}));

// Faculty enter internal (sessional) marks; external marks are entered by the examination cell.
router.post('/classes/:id/marks', wrap((req, res) => {
  const a = allocation(req, req.params.id);
  const valid = new Set(roster(a).map((s) => s.id));
  const rows = Array.isArray(req.body && req.body.marks) ? req.body.marks : [];
  let saved = 0;
  q.tx(() => {
    for (const r of rows) {
      const sid = Number(r.student_id);
      if (!valid.has(sid)) continue;
      if (r.internal === '' || r.internal === null || r.internal === undefined) continue;
      const v = Number(r.internal);
      if (!Number.isFinite(v) || v < 0 || v > a.max_internal) fail(400, `Internal marks must be between 0 and ${a.max_internal}`);
      q.run(`INSERT INTO marks (student_id, subject_id, internal, updated_by) VALUES (?, ?, ?, ?)
             ON CONFLICT (student_id, subject_id) DO UPDATE SET internal = excluded.internal, updated_by = excluded.updated_by, updated_at = datetime('now')`,
      sid, a.subject_id, v, req.user.id);
      saved++;
    }
  });
  audit(req, 'internal_marks_saved', { allocation: a.id, count: saved });
  res.json({ ok: true, message: `Saved internal marks for ${saved} students` });
}));

router.get('/assignments', wrap((req, res) => {
  res.json(q.all(
    `SELECT a.*, sub.code, sub.name AS subject, sub.semester, p.code AS program_code,
            (SELECT COUNT(*) FROM submissions sm WHERE sm.assignment_id = a.id) AS submissions,
            (SELECT COUNT(*) FROM submissions sm WHERE sm.assignment_id = a.id AND sm.marks IS NULL) AS ungraded
       FROM assignments a JOIN subjects sub ON sub.id = a.subject_id JOIN programs p ON p.id = sub.program_id
      WHERE a.faculty_id = ? ORDER BY a.due_date DESC`, req.user.id));
}));

router.post('/assignments', wrap((req, res) => {
  const d = validate(req.body, {
    allocation_id: { type: 'int', required: true, label: 'Class' },
    title: { required: true, max: 150, label: 'Title' },
    description: { max: 3000 },
    due_date: { type: 'date', required: true, label: 'Due date' },
    max_marks: { type: 'int', min: 1, max: 100, default: 10 },
  });
  const a = allocation(req, d.allocation_id);
  q.run('INSERT INTO assignments (subject_id, section, faculty_id, title, description, due_date, max_marks) VALUES (?, ?, ?, ?, ?, ?, ?)',
    a.subject_id, a.section, req.user.id, d.title, d.description, d.due_date, d.max_marks);
  res.status(201).json({ ok: true, message: 'Assignment published' });
}));

function ownAssignment(req) {
  const a = q.get('SELECT * FROM assignments WHERE id = ? AND faculty_id = ?', Number(req.params.id), req.user.id);
  if (!a) fail(404, 'Assignment not found');
  return a;
}

router.get('/assignments/:id/submissions', wrap((req, res) => {
  const a = ownAssignment(req);
  res.json({ assignment: a, submissions: q.all(
    `SELECT sm.*, u.name, s.roll_no FROM submissions sm JOIN users u ON u.id = sm.student_id
       JOIN students s ON s.user_id = sm.student_id WHERE sm.assignment_id = ? ORDER BY s.roll_no`, a.id) });
}));

router.post('/assignments/:id/grade', wrap((req, res) => {
  const a = ownAssignment(req);
  const d = validate(req.body, {
    student_id: { type: 'int', required: true },
    marks: { type: 'number', required: true, min: 0, max: a.max_marks, label: 'Marks' },
    feedback: { max: 1000 },
  });
  const r = q.run('UPDATE submissions SET marks = ?, feedback = ? WHERE assignment_id = ? AND student_id = ?', d.marks, d.feedback, a.id, d.student_id);
  if (!r.changes) fail(404, 'Submission not found');
  res.json({ ok: true, message: 'Graded' });
}));

router.delete('/assignments/:id', wrap((req, res) => {
  const a = ownAssignment(req);
  q.run('DELETE FROM assignments WHERE id = ?', a.id);
  res.json({ ok: true, message: 'Assignment deleted' });
}));

router.get('/notices', wrap((_req, res) => res.json(svc.noticesFor('faculty'))));

router.post('/notices', wrap((req, res) => {
  const d = validate(req.body, {
    title: { required: true, max: 200, label: 'Title' },
    body: { required: true, max: 5000, label: 'Notice text' },
  });
  q.run("INSERT INTO notices (title, body, category, audience, created_by) VALUES (?, ?, 'Academic', 'students', ?)", d.title, d.body, req.user.id);
  res.status(201).json({ ok: true, message: 'Notice posted to students' });
}));

module.exports = router;
