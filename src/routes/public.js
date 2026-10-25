'use strict';
const express = require('express');
const config = require('../config');
const { q } = require('../db');
const { wrap, validate, fail } = require('../util');
const { rateLimit, verifyPassword, createSession, destroySession, hashPassword, requireRole, audit } = require('../auth');
const svc = require('../services');

const router = express.Router();

router.get('/site', wrap((_req, res) => {
  const programs = q.all(
    `SELECT p.id, p.code, p.name, p.degree, p.duration_years, p.intake, p.eligibility, p.description, p.icon, d.name AS department
       FROM programs p LEFT JOIN departments d ON d.id = p.department_id ORDER BY p.degree, p.id`,
  );
  const stats = {
    students: q.get("SELECT COUNT(*) AS n FROM students WHERE status = 'active'").n,
    faculty: q.get('SELECT COUNT(*) AS n FROM faculty').n,
    programs: programs.length,
    recruiters: q.get('SELECT COUNT(DISTINCT company) AS n FROM placement_drives').n,
    books: q.get('SELECT COALESCE(SUM(copies),0) AS n FROM books').n,
  };
  const placements = q.get(
    `SELECT MAX(d.package_lpa) AS highest, ROUND(AVG(d.package_lpa), 2) AS average, COUNT(*) AS offers
       FROM drive_applications a JOIN placement_drives d ON d.id = a.drive_id WHERE a.status = 'selected'`,
  );
  const recruiters = q.all('SELECT DISTINCT company FROM placement_drives ORDER BY company').map((r) => r.company);
  res.json({
    institute: config.institute,
    programs,
    stats,
    placements,
    recruiters,
    notices: svc.noticesFor('public', 12),
    news: q.all('SELECT * FROM news ORDER BY date DESC LIMIT 6'),
    events: q.all("SELECT * FROM events WHERE COALESCE(end_date, start_date) >= date('now') ORDER BY start_date LIMIT 6"),
    paymentMode: config.paymentMode,
    demo: !!q.get("SELECT 1 FROM settings WHERE key = 'demo' AND value = '1'"),
  });
}));

router.get('/notices', wrap((_req, res) => res.json(svc.noticesFor('public', 100))));

router.get('/faculty-directory', wrap((_req, res) => {
  res.json(q.all(
    `SELECT u.name, f.designation, f.qualification, f.specialization, d.name AS department
       FROM faculty f JOIN users u ON u.id = f.user_id LEFT JOIN departments d ON d.id = f.department_id
      WHERE u.active = 1 ORDER BY d.name, f.designation, u.name`,
  ));
}));

const formLimiter = rateLimit({ windowMs: 15 * 60e3, max: 10 });
// Students often share one campus IP (NAT), so Quick Pay gets a roomier budget.
const payLimiter = rateLimit({ windowMs: 15 * 60e3, max: 120 });

router.post('/enquiries', formLimiter, wrap((req, res) => {
  const type = req.body && req.body.type === 'contact' ? 'contact' : 'admission';
  const d = validate(req.body, {
    name: { required: true, max: 80, label: 'Name' },
    email: { type: 'email', required: true, label: 'Email' },
    phone: { type: 'phone', required: type === 'admission', label: 'Mobile number' },
    program: { max: 80 },
    city: { max: 60 },
    message: { max: 2000, required: type === 'contact', label: 'Message' },
  });
  q.run('INSERT INTO enquiries (type, name, email, phone, program, city, message) VALUES (?, ?, ?, ?, ?, ?, ?)',
    type, d.name, d.email, d.phone, d.program, d.city, d.message);
  res.status(201).json({ ok: true, message: type === 'admission'
    ? 'Thank you! Our admission counsellor will contact you within 24 hours.'
    : 'Thank you for reaching out. We will get back to you shortly.' });
}));

// Quick Pay: lets a student see and pay dues with enrollment number + date of birth, without logging in.
router.post('/quick-pay/lookup', payLimiter, wrap((req, res) => {
  const d = validate(req.body, {
    enrollment_no: { required: true, max: 30, label: 'Enrollment number' },
    dob: { type: 'date', required: true, label: 'Date of birth' },
  });
  const s = q.get(
    `SELECT s.user_id FROM students s JOIN users u ON u.id = s.user_id
      WHERE s.enrollment_no = ? COLLATE NOCASE AND s.dob = ? AND u.active = 1`,
    d.enrollment_no, d.dob,
  );
  if (!s) fail(404, 'No student found with these details. Please check and try again.');
  const p = svc.studentProfile(s.user_id);
  const fees = svc.feeSummary(s.user_id);
  res.json({
    student: { name: p.name, enrollment_no: p.enrollment_no, program: p.program_name, semester: p.current_semester },
    heads: fees.heads.filter((h) => h.due > 0).map(({ id, head, semester, academic_year, due, due_date }) => ({ id, head, semester, academic_year, due, due_date })),
    due: fees.totals.due,
  });
}));

router.post('/quick-pay/order', payLimiter, wrap(async (req, res) => {
  const d = validate(req.body, {
    enrollment_no: { required: true, max: 30 },
    dob: { type: 'date', required: true },
  });
  const s = q.get('SELECT user_id FROM students WHERE enrollment_no = ? COLLATE NOCASE AND dob = ?', d.enrollment_no, d.dob);
  if (!s) fail(404, 'Student not found');
  const ids = Array.isArray(req.body.fee_head_ids) ? req.body.fee_head_ids.map(Number) : null;
  const payments = require('./payments');
  res.json(await payments.startPayment(s.user_id, ids, req.body.mode));
}));

// ── Authentication ──
const loginLimiter = rateLimit({ windowMs: 15 * 60e3, max: 20, key: (req) => `${req.ip}:${String(req.body && req.body.username).toLowerCase()}` });

router.post('/auth/login', loginLimiter, wrap((req, res) => {
  const d = validate(req.body, {
    username: { required: true, max: 60, label: 'User ID' },
    password: { required: true, max: 128, label: 'Password' },
  });
  const user = q.get('SELECT * FROM users WHERE username = ? AND active = 1', d.username);
  if (!user || !verifyPassword(d.password, user.password_hash)) {
    audit(req, 'login_failed', { username: d.username });
    fail(401, 'Invalid user ID or password');
  }
  createSession(res, user.id, req.ip);
  q.run("UPDATE users SET last_login = datetime('now') WHERE id = ?", user.id);
  req.user = user;
  audit(req, 'login');
  res.json({ role: user.role, name: user.name, must_change_password: !!user.must_change_password });
}));

router.post('/auth/logout', wrap((req, res) => {
  destroySession(req, res);
  res.json({ ok: true });
}));

router.get('/auth/me', requireRole(), wrap((req, res) => {
  const { id, role, username, name, email, phone, must_change_password } = req.user;
  res.json({ id, role, username, name, email, phone, must_change_password: !!must_change_password, paymentMode: config.paymentMode, institute: config.institute });
}));

router.post('/auth/change-password', requireRole(), wrap((req, res) => {
  const d = validate(req.body, {
    current: { required: true, max: 128, label: 'Current password' },
    next: { required: true, min: 8, max: 128, label: 'New password' },
  });
  if (!/[A-Za-z]/.test(d.next) || !/\d/.test(d.next)) fail(400, 'New password must contain letters and numbers');
  const u = q.get('SELECT password_hash FROM users WHERE id = ?', req.user.id);
  if (!verifyPassword(d.current, u.password_hash)) fail(400, 'Current password is incorrect');
  q.run('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?', hashPassword(d.next), req.user.id);
  // Sign out every other device; the current session stays valid.
  q.run('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?', req.user.id, req.user.token_hash);
  audit(req, 'password_changed');
  res.json({ ok: true, message: 'Password updated successfully' });
}));

module.exports = router;
