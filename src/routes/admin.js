'use strict';
const crypto = require('node:crypto');
const express = require('express');
const { q } = require('../db');
const { wrap, validate, fail, today, academicYearFor, round2 } = require('../util');
const { requireRole, hashPassword, audit } = require('../auth');
const svc = require('../services');

const router = express.Router();
router.use(requireRole('admin'));

const tempPassword = () => `Kcc@${crypto.randomInt(100000, 999999)}`;

function toCsv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s; // avoid spreadsheet formula injection
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

function sendCsv(res, name, rows) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}-${today()}.csv"`);
  res.send(toCsv(rows));
}

// ── Dashboard ──
router.get('/dashboard', wrap((_req, res) => {
  const count = (sql, ...p) => q.get(sql, ...p).n;
  const collection = q.all(
    `SELECT strftime('%Y-%m', paid_at) AS month, SUM(amount) AS total FROM payments
      WHERE status = 'success' AND paid_at >= date('now', 'start of month', '-5 months') GROUP BY month ORDER BY month`,
  );
  const outstanding = q.get(
    `SELECT COALESCE(SUM(f.amount - f.concession), 0) - COALESCE((SELECT SUM(pi.amount) FROM payment_items pi JOIN payments p ON p.id = pi.payment_id WHERE p.status = 'success'), 0) AS n FROM fee_heads f`,
  ).n;
  const byProgram = q.all(
    `SELECT p.code, COUNT(s.user_id) AS students FROM programs p LEFT JOIN students s ON s.program_id = p.id AND s.status = 'active'
      GROUP BY p.id ORDER BY p.id`,
  );
  const att = q.get("SELECT COUNT(*) AS total, SUM(CASE WHEN status IN ('P','L') THEN 1 ELSE 0 END) AS present FROM attendance_records");
  res.json({
    counts: {
      students: count("SELECT COUNT(*) AS n FROM students WHERE status = 'active'"),
      faculty: count('SELECT COUNT(*) AS n FROM faculty'),
      programs: count('SELECT COUNT(*) AS n FROM programs'),
      newEnquiries: count("SELECT COUNT(*) AS n FROM enquiries WHERE status = 'new'"),
      openGrievances: count("SELECT COUNT(*) AS n FROM grievances WHERE status <> 'resolved'"),
      pendingLeaves: count("SELECT COUNT(*) AS n FROM leave_requests WHERE status = 'pending'"),
      openDrives: count("SELECT COUNT(*) AS n FROM placement_drives WHERE status = 'open'"),
    },
    fees: {
      collected: count("SELECT COALESCE(SUM(amount), 0) AS n FROM payments WHERE status = 'success'"),
      today: count("SELECT COALESCE(SUM(amount), 0) AS n FROM payments WHERE status = 'success' AND date(paid_at) = date('now')"),
      outstanding,
    },
    attendance: att.total ? round2((att.present / att.total) * 100) : null,
    collection,
    byProgram,
    recentPayments: q.all(
      `SELECT p.txn_id, p.receipt_no, p.amount, p.mode, p.paid_at, u.name, s.enrollment_no FROM payments p
         JOIN users u ON u.id = p.student_id JOIN students s ON s.user_id = p.student_id
        WHERE p.status = 'success' ORDER BY p.paid_at DESC LIMIT 8`),
  });
}));

router.get('/meta', wrap((_req, res) => {
  res.json({
    departments: q.all('SELECT * FROM departments ORDER BY name'),
    programs: q.all('SELECT id, code, name, degree, total_semesters, department_id, intake, eligibility, description FROM programs ORDER BY id'),
    faculty: q.all('SELECT u.id, u.name, f.employee_id, f.department_id FROM faculty f JOIN users u ON u.id = f.user_id WHERE u.active = 1 ORDER BY u.name'),
    academicYear: academicYearFor(),
  });
}));

router.put('/programs/:id', wrap((req, res) => {
  const d = validate(req.body, {
    intake: { type: 'int', min: 0, max: 2000, label: 'Intake' },
    eligibility: { max: 500 },
    description: { max: 1000 },
  });
  const r = q.run('UPDATE programs SET intake = ?, eligibility = ?, description = ? WHERE id = ?', d.intake, d.eligibility, d.description, Number(req.params.id));
  if (!r.changes) fail(404, 'Programme not found');
  res.json({ ok: true, message: 'Programme updated' });
}));

// ── Students ──
const STUDENT_FIELDS = {
  name: { required: true, max: 80, label: 'Name' },
  email: { type: 'email', required: true, label: 'Email' },
  phone: { type: 'phone', required: true, label: 'Mobile' },
  enrollment_no: { required: true, max: 30, label: 'Enrollment number' },
  roll_no: { required: true, max: 30, label: 'Roll number' },
  program_id: { type: 'int', required: true, label: 'Programme' },
  batch_year: { type: 'int', required: true, min: 2000, max: 2100, label: 'Batch' },
  current_semester: { type: 'int', required: true, min: 1, max: 10, label: 'Semester' },
  section: { required: true, max: 3, label: 'Section' },
  dob: { type: 'date', required: true, label: 'Date of birth' },
  gender: { type: 'enum', values: ['Male', 'Female', 'Other'] },
  father_name: { max: 80 },
  mother_name: { max: 80 },
  address: { max: 250 },
  category: { max: 20 },
  blood_group: { max: 5 },
  hostel: { type: 'bool', default: false },
  transport: { type: 'bool', default: false },
  status: { type: 'enum', values: ['active', 'passed-out', 'left', 'suspended'], default: 'active' },
};

const STUDENT_LIST_SQL = `
  SELECT u.id, u.name, u.email, u.phone, u.active, s.enrollment_no, s.roll_no, s.batch_year, s.current_semester, s.section,
         s.status, s.dob, s.hostel, s.transport, p.code AS program_code, p.id AS program_id
    FROM students s JOIN users u ON u.id = s.user_id JOIN programs p ON p.id = s.program_id`;

function studentFilter(query) {
  const where = [];
  const params = [];
  if (query.q) {
    where.push('(u.name LIKE ? OR s.enrollment_no LIKE ? OR s.roll_no LIKE ? OR u.phone LIKE ?)');
    const t = `%${String(query.q).slice(0, 60)}%`;
    params.push(t, t, t, t);
  }
  if (query.program) { where.push('s.program_id = ?'); params.push(Number(query.program)); }
  if (query.semester) { where.push('s.current_semester = ?'); params.push(Number(query.semester)); }
  if (query.section) { where.push('s.section = ?'); params.push(String(query.section)); }
  if (query.status) { where.push('s.status = ?'); params.push(String(query.status)); }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

router.get('/students', wrap((req, res) => {
  const f = studentFilter(req.query);
  const rows = q.all(`${STUDENT_LIST_SQL} ${f.sql} ORDER BY p.id, s.current_semester, s.section, s.roll_no LIMIT 2000`, ...f.params);
  if (req.query.format === 'csv') return sendCsv(res, 'students', rows);
  res.json(rows);
}));

router.get('/students/:id', wrap((req, res) => {
  const s = svc.studentProfile(Number(req.params.id));
  res.json({
    profile: s,
    attendance: svc.attendanceSummary(s),
    fees: svc.feeSummary(s.user_id),
    results: q.all('SELECT * FROM results WHERE student_id = ? ORDER BY semester', s.user_id),
  });
}));

router.post('/students', wrap((req, res) => {
  const d = validate(req.body, STUDENT_FIELDS);
  if (!q.get('SELECT 1 FROM programs WHERE id = ?', d.program_id)) fail(400, 'Invalid programme');
  if (q.get('SELECT 1 FROM users WHERE username = ?', d.enrollment_no)) fail(409, 'A user with this enrollment number already exists');
  if (q.get('SELECT 1 FROM students WHERE roll_no = ?', d.roll_no)) fail(409, 'Roll number already in use');
  const password = tempPassword();
  const id = q.tx(() => {
    const r = q.run("INSERT INTO users (role, username, password_hash, name, email, phone, must_change_password) VALUES ('student', ?, ?, ?, ?, ?, 1)",
      d.enrollment_no, hashPassword(password), d.name, d.email, d.phone);
    const uid = Number(r.lastInsertRowid);
    q.run(`INSERT INTO students (user_id, enrollment_no, roll_no, program_id, batch_year, current_semester, section, dob, gender,
             father_name, mother_name, address, category, blood_group, hostel, transport, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    uid, d.enrollment_no, d.roll_no, d.program_id, d.batch_year, d.current_semester, d.section.toUpperCase(), d.dob, d.gender,
    d.father_name, d.mother_name, d.address, d.category, d.blood_group, d.hostel ? 1 : 0, d.transport ? 1 : 0, d.status);
    return uid;
  });
  audit(req, 'student_created', { id, enrollment: d.enrollment_no });
  res.status(201).json({ ok: true, id, message: `Student created. Login ID: ${d.enrollment_no} · Temporary password: ${password}` });
}));

router.put('/students/:id', wrap((req, res) => {
  const id = Number(req.params.id);
  svc.studentProfile(id);
  const d = validate(req.body, STUDENT_FIELDS);
  const clash = q.get('SELECT user_id FROM students WHERE (enrollment_no = ? OR roll_no = ?) AND user_id <> ?', d.enrollment_no, d.roll_no, id);
  if (clash) fail(409, 'Enrollment or roll number already belongs to another student');
  q.tx(() => {
    q.run('UPDATE users SET name = ?, email = ?, phone = ?, username = ?, active = ? WHERE id = ?',
      d.name, d.email, d.phone, d.enrollment_no, d.status === 'active' ? 1 : 0, id);
    q.run(`UPDATE students SET enrollment_no = ?, roll_no = ?, program_id = ?, batch_year = ?, current_semester = ?, section = ?, dob = ?,
             gender = ?, father_name = ?, mother_name = ?, address = ?, category = ?, blood_group = ?, hostel = ?, transport = ?, status = ?
           WHERE user_id = ?`,
    d.enrollment_no, d.roll_no, d.program_id, d.batch_year, d.current_semester, d.section.toUpperCase(), d.dob, d.gender,
    d.father_name, d.mother_name, d.address, d.category, d.blood_group, d.hostel ? 1 : 0, d.transport ? 1 : 0, d.status, id);
  });
  audit(req, 'student_updated', { id });
  res.json({ ok: true, message: 'Student updated' });
}));

router.post('/users/:id/reset-password', wrap((req, res) => {
  const u = q.get("SELECT id, username, role FROM users WHERE id = ? AND role <> 'admin'", Number(req.params.id));
  if (!u) fail(404, 'User not found');
  const password = tempPassword();
  q.run('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?', hashPassword(password), u.id);
  q.run('DELETE FROM sessions WHERE user_id = ?', u.id);
  audit(req, 'password_reset', { id: u.id });
  res.json({ ok: true, message: `Password reset. Login ID: ${u.username} · Temporary password: ${password}` });
}));

router.post('/students/promote', wrap((req, res) => {
  const d = validate(req.body, {
    program_id: { type: 'int', required: true, label: 'Programme' },
    semester: { type: 'int', required: true, min: 1, max: 10, label: 'Semester' },
  });
  const p = q.get('SELECT * FROM programs WHERE id = ?', d.program_id);
  if (!p) fail(400, 'Invalid programme');
  const r = d.semester >= p.total_semesters
    ? q.run("UPDATE students SET status = 'passed-out' WHERE program_id = ? AND current_semester = ? AND status = 'active'", d.program_id, d.semester)
    : q.run("UPDATE students SET current_semester = current_semester + 1 WHERE program_id = ? AND current_semester = ? AND status = 'active'", d.program_id, d.semester);
  audit(req, 'students_promoted', d);
  res.json({ ok: true, message: d.semester >= p.total_semesters ? `${r.changes} students marked as passed out` : `${r.changes} students promoted to semester ${d.semester + 1}` });
}));

// ── Faculty ──
router.get('/faculty', wrap((_req, res) => {
  res.json(q.all(
    `SELECT u.id, u.name, u.email, u.phone, u.active, f.employee_id, f.designation, f.qualification, f.specialization, f.joined_on,
            f.department_id, d.code AS department,
            (SELECT COUNT(*) FROM allocations a WHERE a.faculty_id = u.id) AS classes
       FROM faculty f JOIN users u ON u.id = f.user_id LEFT JOIN departments d ON d.id = f.department_id ORDER BY u.name`));
}));

const FACULTY_FIELDS = {
  name: { required: true, max: 80, label: 'Name' },
  email: { type: 'email', required: true, label: 'Email' },
  phone: { type: 'phone', required: true, label: 'Mobile' },
  employee_id: { required: true, max: 30, label: 'Employee ID' },
  department_id: { type: 'int', required: true, label: 'Department' },
  designation: { max: 60 },
  qualification: { max: 120 },
  specialization: { max: 120 },
  joined_on: { type: 'date' },
  active: { type: 'bool', default: true },
};

router.post('/faculty', wrap((req, res) => {
  const d = validate(req.body, FACULTY_FIELDS);
  if (q.get('SELECT 1 FROM users WHERE username = ?', d.employee_id)) fail(409, 'Employee ID already exists');
  const password = tempPassword();
  q.tx(() => {
    const r = q.run("INSERT INTO users (role, username, password_hash, name, email, phone, must_change_password) VALUES ('faculty', ?, ?, ?, ?, ?, 1)",
      d.employee_id, hashPassword(password), d.name, d.email, d.phone);
    q.run('INSERT INTO faculty (user_id, employee_id, department_id, designation, qualification, specialization, joined_on) VALUES (?, ?, ?, ?, ?, ?, ?)',
      Number(r.lastInsertRowid), d.employee_id, d.department_id, d.designation, d.qualification, d.specialization, d.joined_on);
  });
  audit(req, 'faculty_created', { employee: d.employee_id });
  res.status(201).json({ ok: true, message: `Faculty created. Login ID: ${d.employee_id} · Temporary password: ${password}` });
}));

router.put('/faculty/:id', wrap((req, res) => {
  const id = Number(req.params.id);
  if (!q.get('SELECT 1 FROM faculty WHERE user_id = ?', id)) fail(404, 'Faculty not found');
  const d = validate(req.body, FACULTY_FIELDS);
  if (q.get('SELECT 1 FROM users WHERE username = ? AND id <> ?', d.employee_id, id)) fail(409, 'Employee ID already exists');
  q.tx(() => {
    q.run('UPDATE users SET name = ?, email = ?, phone = ?, username = ?, active = ? WHERE id = ?', d.name, d.email, d.phone, d.employee_id, d.active ? 1 : 0, id);
    q.run('UPDATE faculty SET employee_id = ?, department_id = ?, designation = ?, qualification = ?, specialization = ?, joined_on = ? WHERE user_id = ?',
      d.employee_id, d.department_id, d.designation, d.qualification, d.specialization, d.joined_on, id);
  });
  res.json({ ok: true, message: 'Faculty updated' });
}));

// ── Subjects, allocations, timetable ──
router.get('/subjects', wrap((req, res) => {
  const params = [];
  let where = '';
  if (req.query.program) { where += ' AND s.program_id = ?'; params.push(Number(req.query.program)); }
  if (req.query.semester) { where += ' AND s.semester = ?'; params.push(Number(req.query.semester)); }
  res.json(q.all(
    `SELECT s.*, p.code AS program_code,
            (SELECT json_group_array(json_object('id', a.id, 'section', a.section, 'faculty', u.name))
               FROM allocations a JOIN users u ON u.id = a.faculty_id WHERE a.subject_id = s.id) AS allocations
       FROM subjects s JOIN programs p ON p.id = s.program_id WHERE 1 = 1 ${where} ORDER BY p.id, s.semester, s.code`, ...params,
  ).map((s) => ({ ...s, allocations: JSON.parse(s.allocations) })));
}));

router.post('/subjects', wrap((req, res) => {
  const d = validate(req.body, {
    code: { required: true, max: 15, label: 'Code' },
    name: { required: true, max: 120, label: 'Name' },
    program_id: { type: 'int', required: true, label: 'Programme' },
    semester: { type: 'int', required: true, min: 1, max: 10, label: 'Semester' },
    credits: { type: 'int', min: 0, max: 10, default: 3 },
    type: { type: 'enum', values: ['theory', 'lab'], default: 'theory' },
    max_internal: { type: 'int', min: 0, max: 100, default: 30 },
    max_external: { type: 'int', min: 0, max: 200, default: 70 },
  });
  if (q.get('SELECT 1 FROM subjects WHERE code = ? AND program_id = ?', d.code, d.program_id)) fail(409, 'Subject code already exists for this programme');
  q.run('INSERT INTO subjects (code, name, program_id, semester, credits, type, max_internal, max_external) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    d.code.toUpperCase(), d.name, d.program_id, d.semester, d.credits, d.type, d.max_internal, d.max_external);
  res.status(201).json({ ok: true, message: 'Subject added' });
}));

router.delete('/subjects/:id', wrap((req, res) => {
  const id = Number(req.params.id);
  if (q.get('SELECT 1 FROM marks WHERE subject_id = ? LIMIT 1', id)) fail(400, 'Cannot delete a subject that already has marks recorded');
  q.run('DELETE FROM subjects WHERE id = ?', id);
  res.json({ ok: true, message: 'Subject deleted' });
}));

router.post('/allocations', wrap((req, res) => {
  const d = validate(req.body, {
    subject_id: { type: 'int', required: true, label: 'Subject' },
    faculty_id: { type: 'int', required: true, label: 'Faculty' },
    section: { required: true, max: 3, label: 'Section' },
  });
  if (!q.get('SELECT 1 FROM faculty WHERE user_id = ?', d.faculty_id)) fail(400, 'Invalid faculty');
  q.run(`INSERT INTO allocations (subject_id, faculty_id, section) VALUES (?, ?, ?)
         ON CONFLICT (subject_id, section) DO UPDATE SET faculty_id = excluded.faculty_id`, d.subject_id, d.faculty_id, d.section.toUpperCase());
  res.json({ ok: true, message: 'Faculty assigned' });
}));

router.delete('/allocations/:id', wrap((req, res) => {
  q.run('DELETE FROM allocations WHERE id = ?', Number(req.params.id));
  res.json({ ok: true, message: 'Allocation removed' });
}));

router.get('/timetable', wrap((req, res) => {
  res.json(q.all(
    `SELECT t.*, s.code, s.name FROM timetable t LEFT JOIN subjects s ON s.id = t.subject_id
      WHERE t.program_id = ? AND t.semester = ? AND t.section = ? ORDER BY t.day, t.period`,
    Number(req.query.program), Number(req.query.semester), String(req.query.section || 'A')));
}));

router.post('/timetable', wrap((req, res) => {
  const d = validate(req.body, {
    program_id: { type: 'int', required: true },
    semester: { type: 'int', required: true, min: 1, max: 10 },
    section: { required: true, max: 3 },
    day: { type: 'int', required: true, min: 1, max: 6, label: 'Day' },
    period: { type: 'int', required: true, min: 1, max: 10, label: 'Period' },
    start_time: { required: true, max: 5, label: 'Start time' },
    end_time: { required: true, max: 5, label: 'End time' },
    subject_id: { type: 'int' },
    room: { max: 20 },
  });
  if (!d.subject_id) {
    q.run('DELETE FROM timetable WHERE program_id = ? AND semester = ? AND section = ? AND day = ? AND period = ?', d.program_id, d.semester, d.section, d.day, d.period);
    return res.json({ ok: true, message: 'Slot cleared' });
  }
  q.run(`INSERT INTO timetable (program_id, semester, section, day, period, start_time, end_time, subject_id, room) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (program_id, semester, section, day, period) DO UPDATE SET start_time = excluded.start_time, end_time = excluded.end_time,
           subject_id = excluded.subject_id, room = excluded.room`,
  d.program_id, d.semester, d.section.toUpperCase(), d.day, d.period, d.start_time, d.end_time, d.subject_id, d.room);
  res.json({ ok: true, message: 'Timetable updated' });
}));

// ── Fees & payments ──
router.post('/fees/generate', wrap((req, res) => {
  const d = validate(req.body, {
    program_id: { type: 'int', required: true, label: 'Programme' },
    semester: { type: 'int', required: true, min: 1, max: 10, label: 'Semester' },
    academic_year: { required: true, max: 9, label: 'Academic year' },
    due_date: { type: 'date', required: true, label: 'Due date' },
  });
  const heads = (Array.isArray(req.body.heads) ? req.body.heads : [])
    .map((h) => ({ head: String(h.head || '').trim().slice(0, 60), amount: Number(h.amount), applies: h.applies || 'all' }))
    .filter((h) => h.head && Number.isInteger(h.amount) && h.amount > 0);
  if (!heads.length) fail(400, 'Add at least one fee head with an amount');
  const students = q.all("SELECT user_id, hostel, transport FROM students WHERE program_id = ? AND current_semester = ? AND status = 'active'", d.program_id, d.semester);
  let created = 0;
  q.tx(() => {
    for (const s of students) {
      for (const h of heads) {
        if ((h.applies === 'hostel' && !s.hostel) || (h.applies === 'transport' && !s.transport)) continue;
        const r = q.run('INSERT OR IGNORE INTO fee_heads (student_id, semester, academic_year, head, amount, due_date) VALUES (?, ?, ?, ?, ?, ?)',
          s.user_id, d.semester, d.academic_year, h.head, h.amount, d.due_date);
        created += r.changes;
      }
    }
  });
  audit(req, 'fees_generated', { ...d, heads });
  res.json({ ok: true, message: `Created ${created} fee entries for ${students.length} students` });
}));

router.put('/fee-heads/:id', wrap((req, res) => {
  const f = q.get('SELECT * FROM fee_heads WHERE id = ?', Number(req.params.id));
  if (!f) fail(404, 'Fee entry not found');
  const d = validate(req.body, {
    amount: { type: 'int', required: true, min: 0, label: 'Amount' },
    concession: { type: 'int', min: 0, default: 0, label: 'Concession' },
    due_date: { type: 'date' },
  });
  if (d.concession > d.amount) fail(400, 'Concession cannot exceed the fee amount');
  q.run('UPDATE fee_heads SET amount = ?, concession = ?, due_date = COALESCE(?, due_date) WHERE id = ?', d.amount, d.concession, d.due_date, f.id);
  audit(req, 'fee_head_updated', { id: f.id, ...d });
  res.json({ ok: true, message: 'Fee entry updated' });
}));

router.get('/payments', wrap((req, res) => {
  const where = [];
  const params = [];
  if (req.query.status) { where.push('p.status = ?'); params.push(String(req.query.status)); }
  if (req.query.from) { where.push('date(p.created_at) >= ?'); params.push(String(req.query.from)); }
  if (req.query.to) { where.push('date(p.created_at) <= ?'); params.push(String(req.query.to)); }
  if (req.query.q) { where.push('(u.name LIKE ? OR s.enrollment_no LIKE ? OR p.txn_id LIKE ? OR p.receipt_no LIKE ?)'); const t = `%${String(req.query.q).slice(0, 60)}%`; params.push(t, t, t, t); }
  const rows = q.all(
    `SELECT p.id, p.txn_id, p.receipt_no, u.name, s.enrollment_no, pr.code AS program, p.amount, p.mode, p.gateway, p.status,
            p.created_at, p.paid_at, p.remarks
       FROM payments p JOIN users u ON u.id = p.student_id JOIN students s ON s.user_id = p.student_id JOIN programs pr ON pr.id = s.program_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY p.id DESC LIMIT 1000`, ...params);
  if (req.query.format === 'csv') return sendCsv(res, 'payments', rows);
  res.json(rows);
}));

router.post('/payments/offline', wrap((req, res) => {
  const d = validate(req.body, {
    student_id: { type: 'int', required: true },
    mode: { type: 'enum', required: true, values: ['Cash', 'Cheque', 'Demand Draft', 'NEFT/RTGS', 'UPI (Counter)'], label: 'Mode' },
    reference: { max: 60 },
  });
  const ids = Array.isArray(req.body.fee_head_ids) ? req.body.fee_head_ids.map(Number) : null;
  const p = svc.createPayment(d.student_id, ids, { mode: d.mode, gateway: 'counter', recordedBy: req.user.id, remarks: d.reference });
  const done = svc.completePayment(p.id, d.reference);
  audit(req, 'offline_payment', { txn: done.txn_id, amount: done.amount });
  res.json({ ok: true, txn_id: done.txn_id, message: `Payment recorded. Receipt ${done.receipt_no}` });
}));

router.get('/fees/defaulters', wrap((req, res) => {
  const rows = q.all(
    `WITH dues AS (
       SELECT f.student_id, f.due_date, f.amount - f.concession - COALESCE((SELECT SUM(pi.amount) FROM payment_items pi
                JOIN payments x ON x.id = pi.payment_id WHERE pi.fee_head_id = f.id AND x.status = 'success'), 0) AS due
         FROM fee_heads f)
     SELECT u.id, u.name, u.phone, s.enrollment_no, p.code AS program, s.current_semester AS semester, s.section,
            SUM(d.due) AS due, MIN(d.due_date) AS earliest_due
       FROM dues d JOIN users u ON u.id = d.student_id JOIN students s ON s.user_id = d.student_id JOIN programs p ON p.id = s.program_id
      WHERE s.status = 'active' AND d.due > 0 GROUP BY u.id ORDER BY due DESC`);
  if (req.query.format === 'csv') return sendCsv(res, 'fee-defaulters', rows);
  res.json(rows);
}));

// ── Examinations & results ──
router.get('/exams', wrap((_req, res) => {
  res.json(q.all(
    `SELECT e.*, s.code, s.name, s.semester, p.code AS program_code FROM exam_schedule e JOIN subjects s ON s.id = e.subject_id
       JOIN programs p ON p.id = s.program_id ORDER BY e.date, e.start_time`));
}));

router.post('/exams', wrap((req, res) => {
  const d = validate(req.body, {
    subject_id: { type: 'int', required: true, label: 'Subject' },
    exam_type: { type: 'enum', values: ['End Semester', 'Mid Term', 'Practical', 'Back Paper'], default: 'End Semester' },
    date: { type: 'date', required: true, label: 'Date' },
    start_time: { required: true, max: 5, label: 'Start time' },
    end_time: { required: true, max: 5, label: 'End time' },
    venue: { max: 60 },
  });
  q.run('INSERT INTO exam_schedule (subject_id, exam_type, date, start_time, end_time, venue) VALUES (?, ?, ?, ?, ?, ?)',
    d.subject_id, d.exam_type, d.date, d.start_time, d.end_time, d.venue);
  res.status(201).json({ ok: true, message: 'Exam scheduled' });
}));

router.delete('/exams/:id', wrap((req, res) => {
  q.run('DELETE FROM exam_schedule WHERE id = ?', Number(req.params.id));
  res.json({ ok: true, message: 'Exam removed' });
}));

router.get('/marks', wrap((req, res) => {
  const sub = q.get('SELECT * FROM subjects WHERE id = ?', Number(req.query.subject));
  if (!sub) fail(404, 'Subject not found');
  const section = String(req.query.section || 'A');
  res.json({
    subject: sub,
    students: q.all(
      `SELECT u.id, u.name, s.roll_no, m.internal, m.external FROM students s JOIN users u ON u.id = s.user_id
         LEFT JOIN marks m ON m.student_id = u.id AND m.subject_id = ?
        WHERE s.program_id = ? AND s.current_semester = ? AND s.section = ? AND s.status = 'active' ORDER BY s.roll_no`,
      sub.id, sub.program_id, sub.semester, section),
  });
}));

router.post('/marks', wrap((req, res) => {
  const sub = q.get('SELECT * FROM subjects WHERE id = ?', Number(req.body && req.body.subject_id));
  if (!sub) fail(404, 'Subject not found');
  const rows = Array.isArray(req.body.marks) ? req.body.marks : [];
  const num = (v, max, label) => {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > max) fail(400, `${label} marks must be between 0 and ${max}`);
    return n;
  };
  let saved = 0;
  q.tx(() => {
    for (const r of rows) {
      const internal = num(r.internal, sub.max_internal, 'Internal');
      const external = num(r.external, sub.max_external, 'External');
      if (internal === null && external === null) continue;
      if (!q.get('SELECT 1 FROM students WHERE user_id = ? AND program_id = ?', Number(r.student_id), sub.program_id)) continue;
      q.run(`INSERT INTO marks (student_id, subject_id, internal, external, updated_by) VALUES (?, ?, ?, ?, ?)
             ON CONFLICT (student_id, subject_id) DO UPDATE SET internal = COALESCE(excluded.internal, internal),
               external = COALESCE(excluded.external, external), updated_by = excluded.updated_by, updated_at = datetime('now')`,
      Number(r.student_id), sub.id, internal, external, req.user.id);
      saved++;
    }
  });
  audit(req, 'marks_saved', { subject: sub.id, count: saved });
  res.json({ ok: true, message: `Marks saved for ${saved} students` });
}));

router.post('/results/publish', wrap((req, res) => {
  const d = validate(req.body, {
    program_id: { type: 'int', required: true, label: 'Programme' },
    semester: { type: 'int', required: true, min: 1, max: 10, label: 'Semester' },
  });
  const r = svc.publishResults(d.program_id, d.semester);
  audit(req, 'results_published', { ...d, ...r });
  res.json({ ok: true, ...r, message: `Results published for ${r.published} students${r.incomplete ? ` · ${r.incomplete} skipped (marks incomplete)` : ''}` });
}));

router.get('/results', wrap((req, res) => {
  res.json(q.all(
    `SELECT r.*, u.name, s.enrollment_no, s.roll_no FROM results r JOIN users u ON u.id = r.student_id JOIN students s ON s.user_id = r.student_id
      WHERE s.program_id = ? AND r.semester = ? ORDER BY r.sgpa DESC`, Number(req.query.program), Number(req.query.semester)));
}));

// ── Website content: notices, events, news ──
const CONTENT = {
  notices: {
    fields: {
      title: { required: true, max: 200, label: 'Title' },
      body: { required: true, max: 5000, label: 'Description' },
      category: { type: 'enum', values: ['General', 'Academic', 'Examination', 'Admission', 'Placement', 'Event', 'Fees'], default: 'General' },
      audience: { type: 'enum', values: ['public', 'students', 'faculty', 'all'], default: 'public' },
      pinned: { type: 'bool', default: false },
      link: { max: 300 },
    },
    order: 'pinned DESC, published_at DESC',
  },
  events: {
    fields: {
      title: { required: true, max: 200, label: 'Title' },
      description: { max: 3000 },
      category: { type: 'enum', values: ['Event', 'Fest', 'Workshop', 'Seminar', 'Placement Drive', 'Examination', 'Sports', 'Holiday'], default: 'Event' },
      start_date: { type: 'date', required: true, label: 'Start date' },
      end_date: { type: 'date' },
      venue: { max: 120 },
    },
    order: 'start_date DESC',
  },
  news: {
    fields: {
      title: { required: true, max: 200, label: 'Headline' },
      summary: { required: true, max: 1000, label: 'Summary' },
      date: { type: 'date', required: true, label: 'Date' },
    },
    order: 'date DESC',
  },
};

// Notice links are rendered on the public site, so only allow web URLs.
const checkLink = (d) => {
  if (d.link && !/^https?:\/\//i.test(d.link)) fail(400, 'Link must start with http:// or https://');
};

for (const [table, cfg] of Object.entries(CONTENT)) {
  const cols = Object.keys(cfg.fields);
  const prep = (d) => cols.map((c) => (cfg.fields[c].type === 'bool' ? (d[c] ? 1 : 0) : d[c]));
  router.get(`/${table}`, wrap((_req, res) => res.json(q.all(`SELECT * FROM ${table} ORDER BY ${cfg.order} LIMIT 500`))));
  router.post(`/${table}`, wrap((req, res) => {
    const d = validate(req.body, cfg.fields);
    checkLink(d);
    if (table === 'notices') {
      q.run(`INSERT INTO notices (${cols.join(', ')}, created_by) VALUES (${cols.map(() => '?').join(', ')}, ?)`, ...prep(d), req.user.id);
    } else {
      q.run(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, ...prep(d));
    }
    res.status(201).json({ ok: true, message: 'Published' });
  }));
  router.put(`/${table}/:id`, wrap((req, res) => {
    const d = validate(req.body, cfg.fields);
    checkLink(d);
    const r = q.run(`UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, ...prep(d), Number(req.params.id));
    if (!r.changes) fail(404, 'Not found');
    res.json({ ok: true, message: 'Updated' });
  }));
  router.delete(`/${table}/:id`, wrap((req, res) => {
    q.run(`DELETE FROM ${table} WHERE id = ?`, Number(req.params.id));
    res.json({ ok: true, message: 'Deleted' });
  }));
}

// ── Enquiries, grievances, leave requests ──
router.get('/enquiries', wrap((req, res) => {
  const rows = q.all(`SELECT * FROM enquiries ${req.query.type ? 'WHERE type = ?' : ''} ORDER BY id DESC LIMIT 1000`, ...(req.query.type ? [String(req.query.type)] : []));
  if (req.query.format === 'csv') return sendCsv(res, 'enquiries', rows);
  res.json(rows);
}));

router.put('/enquiries/:id', wrap((req, res) => {
  const d = validate(req.body, { status: { type: 'enum', required: true, values: ['new', 'contacted', 'closed'] } });
  q.run('UPDATE enquiries SET status = ? WHERE id = ?', d.status, Number(req.params.id));
  res.json({ ok: true, message: 'Status updated' });
}));

router.get('/grievances', wrap((_req, res) => {
  res.json(q.all(
    `SELECT g.*, u.name, u.role, u.username FROM grievances g JOIN users u ON u.id = g.user_id
      ORDER BY CASE g.status WHEN 'open' THEN 0 WHEN 'in-progress' THEN 1 ELSE 2 END, g.id DESC`));
}));

router.put('/grievances/:id', wrap((req, res) => {
  const d = validate(req.body, {
    status: { type: 'enum', required: true, values: ['open', 'in-progress', 'resolved'] },
    response: { max: 3000 },
  });
  q.run("UPDATE grievances SET status = ?, response = ?, updated_at = datetime('now') WHERE id = ?", d.status, d.response, Number(req.params.id));
  res.json({ ok: true, message: 'Ticket updated' });
}));

router.get('/leaves', wrap((_req, res) => {
  res.json(q.all(
    `SELECT l.*, u.name, s.enrollment_no, p.code AS program, s.current_semester AS semester, s.section
       FROM leave_requests l JOIN users u ON u.id = l.student_id JOIN students s ON s.user_id = l.student_id JOIN programs p ON p.id = s.program_id
      ORDER BY CASE l.status WHEN 'pending' THEN 0 ELSE 1 END, l.id DESC`));
}));

router.put('/leaves/:id', wrap((req, res) => {
  const d = validate(req.body, {
    status: { type: 'enum', required: true, values: ['approved', 'rejected'] },
    remark: { max: 500 },
  });
  q.run('UPDATE leave_requests SET status = ?, remark = ?, reviewed_by = ? WHERE id = ?', d.status, d.remark, req.user.id, Number(req.params.id));
  res.json({ ok: true, message: `Leave ${d.status}` });
}));

// ── Library ──
router.get('/books', wrap((req, res) => {
  const t = `%${String(req.query.q || '').slice(0, 60)}%`;
  res.json({
    books: q.all(
      `SELECT b.*, b.copies - (SELECT COUNT(*) FROM book_issues i WHERE i.book_id = b.id AND i.returned_on IS NULL) AS available
         FROM books b WHERE b.title LIKE ? OR b.author LIKE ? OR b.accession_no LIKE ? ORDER BY b.title LIMIT 300`, t, t, t),
    issues: q.all(
      `SELECT i.*, b.title, b.accession_no, u.name, s.enrollment_no FROM book_issues i JOIN books b ON b.id = i.book_id
         JOIN users u ON u.id = i.student_id JOIN students s ON s.user_id = i.student_id
        WHERE i.returned_on IS NULL ORDER BY i.due_on`),
  });
}));

router.post('/books', wrap((req, res) => {
  const d = validate(req.body, {
    accession_no: { required: true, max: 30, label: 'Accession number' },
    title: { required: true, max: 200, label: 'Title' },
    author: { required: true, max: 120, label: 'Author' },
    publisher: { max: 120 },
    category: { max: 60 },
    copies: { type: 'int', min: 1, max: 500, default: 1 },
  });
  if (q.get('SELECT 1 FROM books WHERE accession_no = ?', d.accession_no)) fail(409, 'Accession number already exists');
  q.run('INSERT INTO books (accession_no, title, author, publisher, category, copies) VALUES (?, ?, ?, ?, ?, ?)',
    d.accession_no, d.title, d.author, d.publisher, d.category, d.copies);
  res.status(201).json({ ok: true, message: 'Book added' });
}));

router.post('/books/issue', wrap((req, res) => {
  const d = validate(req.body, {
    accession_no: { required: true, max: 30, label: 'Accession number' },
    enrollment_no: { required: true, max: 30, label: 'Enrollment number' },
    days: { type: 'int', min: 1, max: 60, default: 14 },
  });
  const b = q.get(`SELECT b.*, b.copies - (SELECT COUNT(*) FROM book_issues i WHERE i.book_id = b.id AND i.returned_on IS NULL) AS available
                     FROM books b WHERE accession_no = ?`, d.accession_no);
  if (!b) fail(404, 'Book not found');
  if (b.available < 1) fail(400, 'No copies available');
  const s = q.get('SELECT user_id FROM students WHERE enrollment_no = ?', d.enrollment_no);
  if (!s) fail(404, 'Student not found');
  if (q.get('SELECT COUNT(*) AS n FROM book_issues WHERE student_id = ? AND returned_on IS NULL', s.user_id).n >= 4) fail(400, 'Student already has 4 books issued');
  q.run("INSERT INTO book_issues (book_id, student_id, issued_on, due_on) VALUES (?, ?, date('now'), date('now', ?))", b.id, s.user_id, `+${d.days} days`);
  res.json({ ok: true, message: `Issued "${b.title}"` });
}));

router.post('/books/return/:issueId', wrap((req, res) => {
  const i = q.get('SELECT * FROM book_issues WHERE id = ? AND returned_on IS NULL', Number(req.params.issueId));
  if (!i) fail(404, 'Issue record not found');
  const lateDays = Math.max(0, Math.floor((Date.parse(today()) - Date.parse(i.due_on)) / 864e5));
  q.run("UPDATE book_issues SET returned_on = date('now'), fine = ? WHERE id = ?", lateDays * 2, i.id);
  res.json({ ok: true, message: lateDays ? `Returned. Late fine: ₹${lateDays * 2}` : 'Returned on time' });
}));

// ── Placements ──
router.get('/drives', wrap((_req, res) => {
  res.json(q.all(
    `SELECT d.*, (SELECT COUNT(*) FROM drive_applications a WHERE a.drive_id = d.id) AS applicants,
            (SELECT COUNT(*) FROM drive_applications a WHERE a.drive_id = d.id AND a.status = 'selected') AS selected
       FROM placement_drives d ORDER BY d.last_date DESC`));
}));

const DRIVE_FIELDS = {
  company: { required: true, max: 100, label: 'Company' },
  role: { required: true, max: 100, label: 'Role' },
  package_lpa: { type: 'number', min: 0, max: 200, label: 'Package' },
  location: { max: 100 },
  drive_date: { type: 'date' },
  last_date: { type: 'date', required: true, label: 'Last date to apply' },
  eligibility: { max: 300 },
  min_cgpa: { type: 'number', min: 0, max: 10, default: 0 },
  description: { max: 3000 },
  status: { type: 'enum', values: ['open', 'closed'], default: 'open' },
};

router.post('/drives', wrap((req, res) => {
  const d = validate(req.body, DRIVE_FIELDS);
  const cols = Object.keys(DRIVE_FIELDS);
  q.run(`INSERT INTO placement_drives (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, ...cols.map((c) => d[c]));
  res.status(201).json({ ok: true, message: 'Drive published' });
}));

router.put('/drives/:id', wrap((req, res) => {
  const d = validate(req.body, DRIVE_FIELDS);
  const cols = Object.keys(DRIVE_FIELDS);
  q.run(`UPDATE placement_drives SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, ...cols.map((c) => d[c]), Number(req.params.id));
  res.json({ ok: true, message: 'Drive updated' });
}));

router.get('/drives/:id/applications', wrap((req, res) => {
  const rows = q.all(
    `SELECT a.*, u.name, u.email, u.phone, s.enrollment_no, p.code AS program,
            (SELECT cgpa FROM results r WHERE r.student_id = a.student_id ORDER BY semester DESC LIMIT 1) AS cgpa
       FROM drive_applications a JOIN users u ON u.id = a.student_id JOIN students s ON s.user_id = a.student_id
       JOIN programs p ON p.id = s.program_id WHERE a.drive_id = ? ORDER BY u.name`, Number(req.params.id));
  if (req.query.format === 'csv') return sendCsv(res, 'applicants', rows);
  res.json(rows);
}));

router.put('/drives/:id/applications/:studentId', wrap((req, res) => {
  const d = validate(req.body, { status: { type: 'enum', required: true, values: ['applied', 'shortlisted', 'selected', 'rejected'] } });
  q.run('UPDATE drive_applications SET status = ? WHERE drive_id = ? AND student_id = ?', d.status, Number(req.params.id), Number(req.params.studentId));
  res.json({ ok: true, message: 'Status updated' });
}));

router.get('/audit', wrap((_req, res) => {
  res.json(q.all('SELECT a.*, u.name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 300'));
}));

module.exports = router;
