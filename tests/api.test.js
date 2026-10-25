'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kccitm-test-'));
process.env.DB_FILE = path.join(dir, 'test.db');
delete process.env.RAZORPAY_KEY_ID;
delete process.env.ADMIN_PASSWORD;

const db = require('../src/db');
const { ensureSeeded } = require('../src/seed');
const { createApp } = require('../server');
const { amountInWords, gradeFor } = require('../src/util');

let server;
let base;

before(async () => {
  db.get();
  ensureSeeded();
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

// Minimal cookie-aware client.
function client() {
  let cookie = '';
  return async (method, url, body, { csrf = true } = {}) => {
    const res = await fetch(base + url, {
      method,
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(csrf ? { 'X-Requested-With': 'fetch' } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const data = res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text();
    return { status: res.status, data };
  };
}

async function login(username, password) {
  const c = client();
  const r = await c('POST', '/api/auth/login', { username, password });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return c;
}

test('utility helpers', () => {
  assert.equal(amountInWords(102800), 'Rupees One Lakh Two Thousand Eight Hundred Only');
  assert.equal(amountInWords(15), 'Rupees Fifteen Only');
  assert.equal(gradeFor(91, 100).grade, 'A+');
  assert.equal(gradeFor(39.5, 100).grade, 'F');
  assert.equal(gradeFor(45, 100).point, 5);
});

test('public site data and security headers', async () => {
  const res = await fetch(`${base}/api/site`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-security-policy'), /default-src 'self'/);
  const s = await res.json();
  assert.equal(s.programs.length, 9);
  assert.ok(s.notices.every((n) => n.audience === 'public'));
  assert.equal(s.demo, true);
});

test('login rejects bad credentials and protects portals', async () => {
  const c = client();
  assert.equal((await c('POST', '/api/auth/login', { username: 'admin', password: 'wrong' })).status, 401);
  assert.equal((await c('GET', '/api/student/dashboard')).status, 401);
  const student = await login('24KCCCSE001', 'Student@123');
  assert.equal((await student('GET', '/api/admin/dashboard')).status, 403);
  assert.equal((await student('GET', '/api/faculty/classes')).status, 403);
});

test('state-changing requests require the CSRF header', async () => {
  const c = client();
  const r = await c('POST', '/api/auth/login', { username: 'admin', password: 'Admin@123' }, { csrf: false });
  assert.equal(r.status, 403);
});

test('student dashboard, attendance, results and admit card', async () => {
  const c = await login('24KCCCSE001', 'Student@123');
  const d = await c('GET', '/api/student/dashboard');
  assert.equal(d.status, 200);
  assert.equal(d.data.profile.current_semester % 2, new Date().getMonth() >= 6 ? 1 : 0);
  const att = await c('GET', '/api/student/attendance');
  assert.ok(att.data.summary.subjects.length > 0);
  assert.ok(att.data.summary.percent > 0 && att.data.summary.percent <= 100);
  const res = await c('GET', '/api/student/results');
  assert.ok(res.data.results.length >= 1);
  for (const r of res.data.results) assert.ok(r.subjects.every((s) => s.grade));
  const ac = await c('GET', '/api/student/admit-card');
  assert.equal(typeof ac.data.eligible, 'boolean');
});

test('fee payment flow issues a receipt and prevents double payment', async () => {
  const c = await login('admin', 'Admin@123');
  const defaulters = await c('GET', '/api/admin/fees/defaulters');
  const target = defaulters.data[0];
  assert.ok(target && target.due > 0);
  const { data: before } = await c('GET', `/api/admin/students/${target.id}`);

  // Quick Pay as the student (enrollment + DOB).
  const anon = client();
  const lookup = await anon('POST', '/api/quick-pay/lookup', { enrollment_no: before.profile.enrollment_no, dob: before.profile.dob });
  assert.equal(lookup.status, 200);
  assert.equal(lookup.data.due, target.due);
  const order = await anon('POST', '/api/quick-pay/order', { enrollment_no: before.profile.enrollment_no, dob: before.profile.dob });
  assert.equal(order.data.amount, target.due);
  assert.equal(order.data.gateway, 'demo');
  // A second pending order for the same dues, as if paid from another tab.
  const order2 = await anon('POST', '/api/quick-pay/order', { enrollment_no: before.profile.enrollment_no, dob: before.profile.dob });

  const done = await anon('POST', `/api/payments/${order.data.txn_id}/demo-complete`, { outcome: 'success' });
  assert.equal(done.data.status, 'success');
  assert.match(done.data.receipt_no, /^KCC\/\d{4}\/\d{6}$/);

  const dup = await anon('POST', `/api/payments/${order2.data.txn_id}/demo-complete`, { outcome: 'success' });
  assert.equal(dup.status, 409);

  const receipt = await anon('GET', `/api/payments/${order.data.txn_id}/receipt`);
  assert.equal(receipt.data.amount, target.due);
  assert.match(receipt.data.amount_words, /^Rupees .* Only$/);

  const { data: afterPay } = await c('GET', `/api/admin/students/${target.id}`);
  assert.equal(afterPay.fees.totals.due, 0);

  const wrongDob = await anon('POST', '/api/quick-pay/lookup', { enrollment_no: before.profile.enrollment_no, dob: '1990-01-01' });
  assert.equal(wrongDob.status, 404);
});

test('students cannot read other students\' receipts', async () => {
  const admin = await login('admin', 'Admin@123');
  const pays = await admin('GET', '/api/admin/payments?status=success');
  const student = await login('24KCCCSE001', 'Student@123');
  const me = await student('GET', '/api/auth/me');
  const other = pays.data.find((p) => p.enrollment_no !== me.data.username);
  assert.equal((await student('GET', `/api/payments/${other.txn_id}/receipt`)).status, 403);
});

test('faculty marks attendance and internal marks for their own class only', async () => {
  const f = await login('KCCF001', 'Faculty@123');
  const classes = await f('GET', '/api/faculty/classes');
  assert.ok(classes.data.length > 0);
  const cls = classes.data[0];
  const roster = await f('GET', `/api/faculty/classes/${cls.id}/roster?date=2020-01-06&period=6`);
  const records = roster.data.students.map((s, i) => ({ student_id: s.id, status: i === 0 ? 'A' : 'P' }));
  const saved = await f('POST', '/api/faculty/attendance', { allocation_id: cls.id, date: '2020-01-06', period: 6, topic: 'Test', records });
  assert.equal(saved.status, 200);
  const again = await f('GET', `/api/faculty/classes/${cls.id}/roster?date=2020-01-06&period=6`);
  assert.equal(again.data.students[0].status, 'A');

  const future = await f('POST', '/api/faculty/attendance', { allocation_id: cls.id, date: '2999-01-01', records });
  assert.equal(future.status, 400);

  const tooHigh = await f('POST', `/api/faculty/classes/${cls.id}/marks`, { marks: [{ student_id: roster.data.students[0].id, internal: cls.max_internal + 1 }] });
  assert.equal(tooHigh.status, 400);

  const otherFaculty = await login('KCCF002', 'Faculty@123');
  assert.equal((await otherFaculty('GET', `/api/faculty/classes/${cls.id}/roster`)).status, 404);
});

test('admin enters marks and publishes results', async () => {
  const c = await login('admin', 'Admin@123');
  const meta = await c('GET', '/api/admin/meta');
  const program = meta.data.programs.find((p) => p.code === 'MBA');
  const students = await c('GET', `/api/admin/students?program=${program.id}`);
  const sem = Math.min(...students.data.map((s) => s.current_semester));
  const subs = await c('GET', `/api/admin/subjects?program=${program.id}&semester=${sem}`);
  for (const s of subs.data) {
    const m = await c('GET', `/api/admin/marks?subject=${s.id}&section=A`);
    const marks = m.data.students.map((st) => ({ student_id: st.id, internal: Math.min(s.max_internal, 25), external: Math.min(s.max_external, 60) }));
    assert.equal((await c('POST', '/api/admin/marks', { subject_id: s.id, marks })).status, 200);
  }
  const pub = await c('POST', '/api/admin/results/publish', { program_id: program.id, semester: sem });
  assert.equal(pub.status, 200);
  assert.ok(pub.data.published > 0);
  const results = await c('GET', `/api/admin/results?program=${program.id}&semester=${sem}`);
  const classIds = new Set(students.data.filter((s) => s.current_semester === sem).map((s) => s.enrollment_no));
  const mine = results.data.filter((r) => classIds.has(r.enrollment_no));
  assert.equal(mine.length, classIds.size);
  assert.ok(mine.every((r) => r.sgpa > 0 && r.status === 'PASS'));
});

test('admin creates a student who must change the temporary password', async () => {
  const c = await login('admin', 'Admin@123');
  const meta = await c('GET', '/api/admin/meta');
  const r = await c('POST', '/api/admin/students', {
    name: 'Test Student', email: 'test.student@example.com', phone: '9876543210', enrollment_no: 'TEST0001', roll_no: '9999999999',
    program_id: meta.data.programs[0].id, batch_year: 2026, current_semester: 1, section: 'A', dob: '2008-05-01',
  });
  assert.equal(r.status, 201);
  const temp = r.data.message.match(/Temporary password: (\S+)/)[1];
  const s = await login('TEST0001', temp);
  assert.equal((await s('GET', '/api/auth/me')).data.must_change_password, true);
  const weak = await s('POST', '/api/auth/change-password', { current: temp, next: 'short' });
  assert.equal(weak.status, 400);
  assert.equal((await s('POST', '/api/auth/change-password', { current: temp, next: 'NewPass2026' })).status, 200);
  await login('TEST0001', 'NewPass2026');
});

test('public enquiry validation', async () => {
  const c = client();
  assert.equal((await c('POST', '/api/enquiries', { name: 'A', email: 'bad', phone: '123' })).status, 400);
  const ok = await c('POST', '/api/enquiries', { name: 'Applicant', email: 'a@example.com', phone: '9876543210', program: 'MBA' });
  assert.equal(ok.status, 201);
});
