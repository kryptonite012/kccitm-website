'use strict';
const config = require('./config');
const { q } = require('./db');
const { gradeFor, round2, academicYearFor, fail, randomId } = require('./util');

function studentProfile(userId) {
  const s = q.get(
    `SELECT u.id, u.username, u.name, u.email, u.phone, s.*, p.code AS program_code, p.name AS program_name,
            p.degree, p.total_semesters, d.name AS department
       FROM users u JOIN students s ON s.user_id = u.id
       JOIN programs p ON p.id = s.program_id
       LEFT JOIN departments d ON d.id = p.department_id
      WHERE u.id = ?`,
    userId,
  );
  if (!s) fail(404, 'Student not found');
  return s;
}

// Status 'L' (duty leave) counts as present.
function attendanceSummary(student) {
  const subjects = q.all(
    `SELECT sub.id, sub.code, sub.name, sub.type,
            COUNT(r.session_id) AS total,
            COALESCE(SUM(CASE WHEN r.status IN ('P','L') THEN 1 ELSE 0 END), 0) AS present
       FROM subjects sub
       LEFT JOIN attendance_sessions a ON a.subject_id = sub.id AND a.section = ?
       LEFT JOIN attendance_records r ON r.session_id = a.id AND r.student_id = ?
      WHERE sub.program_id = ? AND sub.semester = ?
      GROUP BY sub.id ORDER BY sub.code`,
    student.section, student.user_id, student.program_id, student.current_semester,
  ).map((r) => ({ ...r, percent: r.total ? round2((r.present / r.total) * 100) : null }));
  const total = subjects.reduce((a, s) => a + s.total, 0);
  const present = subjects.reduce((a, s) => a + s.present, 0);
  return {
    subjects,
    total,
    present,
    percent: total ? round2((present / total) * 100) : null,
    minimum: config.minAttendance,
  };
}

function attendanceLog(student, subjectId) {
  return q.all(
    `SELECT a.date, a.period, a.topic, r.status, sub.code, sub.name
       FROM attendance_records r JOIN attendance_sessions a ON a.id = r.session_id
       JOIN subjects sub ON sub.id = a.subject_id
      WHERE r.student_id = ? ${subjectId ? 'AND a.subject_id = ?' : ''}
      ORDER BY a.date DESC, a.period DESC LIMIT 200`,
    ...(subjectId ? [student.user_id, subjectId] : [student.user_id]),
  );
}

function feeSummary(studentId) {
  const heads = q.all(
    `SELECT f.*, COALESCE((SELECT SUM(pi.amount) FROM payment_items pi JOIN payments p ON p.id = pi.payment_id
                            WHERE pi.fee_head_id = f.id AND p.status = 'success'), 0) AS paid
       FROM fee_heads f WHERE f.student_id = ? ORDER BY f.semester DESC, f.id`,
    studentId,
  ).map((h) => ({ ...h, payable: h.amount - h.concession, due: Math.max(0, h.amount - h.concession - h.paid) }));
  const sum = (k) => heads.reduce((a, h) => a + h[k], 0);
  const payments = q.all(
    `SELECT id, txn_id, receipt_no, amount, mode, gateway, status, created_at, paid_at
       FROM payments WHERE student_id = ? ORDER BY id DESC`,
    studentId,
  );
  return {
    heads,
    totals: { amount: sum('amount'), concession: sum('concession'), paid: sum('paid'), due: sum('due') },
    payments,
  };
}

function receipt(paymentId) {
  const p = q.get(
    `SELECT p.*, u.name, s.enrollment_no, s.roll_no, s.current_semester, s.section, pr.name AS program_name
       FROM payments p JOIN users u ON u.id = p.student_id
       JOIN students s ON s.user_id = p.student_id JOIN programs pr ON pr.id = s.program_id
      WHERE p.id = ?`,
    paymentId,
  );
  if (!p) fail(404, 'Payment not found');
  p.items = q.all(
    `SELECT f.head, f.semester, f.academic_year, pi.amount
       FROM payment_items pi JOIN fee_heads f ON f.id = pi.fee_head_id WHERE pi.payment_id = ?`,
    paymentId,
  );
  return p;
}

// Marks a pending payment successful and issues a receipt number.
function completePayment(paymentId, gatewayPaymentId) {
  return q.tx(() => {
    const p = q.get('SELECT * FROM payments WHERE id = ?', paymentId);
    if (!p) fail(404, 'Payment not found');
    if (p.status === 'success') return p;
    if (p.status !== 'pending') fail(400, 'This payment can no longer be completed');
    // Guard against paying more than what is still due (e.g. a second tab paid already).
    for (const item of q.all('SELECT * FROM payment_items WHERE payment_id = ?', paymentId)) {
      const due = q.get(
        `SELECT f.amount - f.concession - COALESCE((SELECT SUM(pi.amount) FROM payment_items pi JOIN payments x ON x.id = pi.payment_id
             WHERE pi.fee_head_id = f.id AND x.status = 'success'), 0) AS due FROM fee_heads f WHERE f.id = ?`,
        item.fee_head_id,
      ).due;
      if (item.amount > due) {
        q.run("UPDATE payments SET status = 'failed', remarks = 'Dues already cleared' WHERE id = ?", paymentId);
        fail(409, 'These dues have already been paid');
      }
    }
    const year = new Date().getFullYear();
    const seq = q.get("SELECT COUNT(*) AS n FROM payments WHERE receipt_no LIKE ?", `KCC/${year}/%`).n + 1;
    const receiptNo = `KCC/${year}/${String(seq).padStart(6, '0')}`;
    q.run(
      "UPDATE payments SET status = 'success', receipt_no = ?, gateway_payment_id = ?, paid_at = datetime('now') WHERE id = ?",
      receiptNo, gatewayPaymentId || null, paymentId,
    );
    return q.get('SELECT * FROM payments WHERE id = ?', paymentId);
  });
}

// Creates a pending payment for the selected fee heads (or all dues).
function createPayment(studentId, feeHeadIds, { mode, gateway, recordedBy, remarks } = {}) {
  const summary = feeSummary(studentId);
  const selected = summary.heads.filter((h) => h.due > 0 && (!feeHeadIds || !feeHeadIds.length || feeHeadIds.includes(h.id)));
  if (!selected.length) fail(400, 'There are no pending dues to pay');
  const amount = selected.reduce((a, h) => a + h.due, 0);
  const txnId = randomId('KCCTXN', 8);
  return q.tx(() => {
    const r = q.run(
      'INSERT INTO payments (txn_id, student_id, amount, mode, gateway, recorded_by, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)',
      txnId, studentId, amount, mode || 'Online', gateway || config.paymentMode, recordedBy || null, remarks || null,
    );
    const id = Number(r.lastInsertRowid);
    for (const h of selected) q.run('INSERT INTO payment_items (payment_id, fee_head_id, amount) VALUES (?, ?, ?)', id, h.id, h.due);
    return q.get('SELECT * FROM payments WHERE id = ?', id);
  });
}

function semesterMarks(studentId, semester, programId) {
  return q.all(
    `SELECT sub.id AS subject_id, sub.code, sub.name, sub.credits, sub.type, sub.max_internal, sub.max_external,
            m.internal, m.external
       FROM subjects sub LEFT JOIN marks m ON m.subject_id = sub.id AND m.student_id = ?
      WHERE sub.program_id = ? AND sub.semester = ? ORDER BY sub.code`,
    studentId, programId, semester,
  ).map((r) => {
    const max = r.max_internal + r.max_external;
    const complete = r.internal !== null && r.external !== null;
    const total = complete ? r.internal + r.external : null;
    const g = complete ? gradeFor(total, max) : null;
    return { ...r, max, total, grade: g ? g.grade : null, grade_point: g ? g.point : null };
  });
}

function computeSgpa(rows) {
  const credits = rows.reduce((a, r) => a + r.credits, 0);
  const points = rows.reduce((a, r) => a + r.credits * (r.grade_point || 0), 0);
  return { credits, sgpa: credits ? round2(points / credits) : 0, backs: rows.filter((r) => r.grade === 'F').map((r) => r.code) };
}

function studentResults(student) {
  const published = q.all('SELECT * FROM results WHERE student_id = ? ORDER BY semester', student.user_id);
  return published.map((r) => ({ ...r, subjects: semesterMarks(student.user_id, r.semester, student.program_id) }));
}

// Publishes results for every student of a program/semester whose marks are complete.
function publishResults(programId, semester) {
  const students = q.all(
    `SELECT s.user_id, s.program_id FROM students s
      WHERE s.program_id = ? AND s.status = 'active'
        AND EXISTS (SELECT 1 FROM marks m JOIN subjects sub ON sub.id = m.subject_id
                     WHERE m.student_id = s.user_id AND sub.program_id = ? AND sub.semester = ?)`,
    programId, programId, semester,
  );
  const year = academicYearFor();
  let published = 0;
  const incomplete = [];
  q.tx(() => {
    for (const s of students) {
      const rows = semesterMarks(s.user_id, semester, s.program_id);
      if (!rows.length || rows.some((r) => r.total === null)) {
        incomplete.push(s.user_id);
        continue;
      }
      const { credits, sgpa, backs } = computeSgpa(rows);
      const prev = q.all('SELECT sgpa, credits FROM results WHERE student_id = ? AND semester <> ?', s.user_id, semester);
      const allCredits = prev.reduce((a, r) => a + r.credits, credits);
      const allPoints = prev.reduce((a, r) => a + r.sgpa * r.credits, sgpa * credits);
      const cgpa = allCredits ? round2(allPoints / allCredits) : 0;
      const status = backs.length ? `BACK (${backs.join(', ')})` : 'PASS';
      q.run(
        `INSERT INTO results (student_id, semester, academic_year, sgpa, cgpa, credits, status) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (student_id, semester) DO UPDATE SET sgpa = excluded.sgpa, cgpa = excluded.cgpa,
           credits = excluded.credits, status = excluded.status, published_at = datetime('now')`,
        s.user_id, semester, year, sgpa, cgpa, credits, status,
      );
      published++;
    }
  });
  return { published, incomplete: incomplete.length };
}

function admitCard(student) {
  const att = attendanceSummary(student);
  const fees = feeSummary(student.user_id);
  const semDue = fees.heads.filter((h) => h.semester === student.current_semester).reduce((a, h) => a + h.due, 0);
  const exams = q.all(
    `SELECT e.*, sub.code, sub.name FROM exam_schedule e JOIN subjects sub ON sub.id = e.subject_id
      WHERE sub.program_id = ? AND sub.semester = ? ORDER BY e.date, e.start_time`,
    student.program_id, student.current_semester,
  );
  const reasons = [];
  if (!exams.length) reasons.push('The examination schedule has not been released yet.');
  if (att.percent !== null && att.percent < config.minAttendance) reasons.push(`Overall attendance is ${att.percent}% (minimum ${config.minAttendance}% required).`);
  if (semDue > 0) reasons.push(`Semester fee of ₹${semDue.toLocaleString('en-IN')} is pending.`);
  return { eligible: reasons.length === 0, reasons, exams, attendance: att.percent, semesterDue: semDue };
}

function noticesFor(audience, limit = 50) {
  const allowed = audience === 'public' ? ['public'] : ['public', 'all', audience];
  return q.all(
    `SELECT n.id, n.title, n.body, n.category, n.audience, n.pinned, n.link, n.published_at, u.name AS author
       FROM notices n LEFT JOIN users u ON u.id = n.created_by
      WHERE n.audience IN (${allowed.map(() => '?').join(',')})
      ORDER BY n.pinned DESC, n.published_at DESC LIMIT ?`,
    ...allowed, limit,
  );
}

module.exports = {
  studentProfile, attendanceSummary, attendanceLog, feeSummary, receipt, completePayment, createPayment,
  semesterMarks, computeSgpa, studentResults, publishResults, admitCard, noticesFor,
};
