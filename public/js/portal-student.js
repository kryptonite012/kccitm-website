import { api, html, raw, inr, fmtDate, fmtDateTime, toast, modal, onSubmit, checkout, DAYS, todayISO } from './lib.js';
import { stat, pctBar, toneFor, statusBadge, table, docHeader, noticeList } from './ui.js';

const PERIOD_TIMES = [['09:00', '09:50'], ['09:50', '10:40'], ['10:50', '11:40'], ['11:40', '12:30'], ['13:20', '14:10'], ['14:10', '15:00']];

function timetableGrid(rows) {
  const byKey = new Map(rows.map((r) => [`${r.day}-${r.period}`, r]));
  const today = new Date().getDay();
  return html`<div class="table-wrap"><table class="tt">
    <thead><tr><th>Day</th>${PERIOD_TIMES.map(([s, e], i) => html`<th>P${i + 1}<br><span class="tiny">${s}–${e}</span></th>`)}</tr></thead>
    <tbody>${[1, 2, 3, 4, 5, 6].map((d) => html`<tr><th>${DAYS[d].slice(0, 3)}</th>${PERIOD_TIMES.map((_, i) => {
      const c = byKey.get(`${d}-${i + 1}`);
      if (!c) return html`<td class="muted">—</td>`;
      return html`<td class="${c.type === 'lab' ? 'lab' : ''} ${d === today ? 'now' : ''}"><span class="code">${c.code}</span>${c.name}<br><span class="tiny muted">${c.room || ''}${c.faculty ? ` · ${c.faculty}` : ''}</span></td>`;
    })}</tr>`)}</tbody></table></div>`;
}

async function payDues(ids, institute) {
  const order = await api('/student/fees/pay', { method: 'POST', body: { fee_head_ids: ids } });
  const r = await checkout(order, institute);
  return r.status === 'success';
}

export const menu = [
  { group: 'Overview' }, 'dashboard', 'profile',
  { group: 'Academics' }, 'attendance', 'timetable', 'assignments', 'results', 'admit-card',
  { group: 'Finance' }, 'fees',
  { group: 'Campus' }, 'notices', 'library', 'placements', 'leave', 'helpdesk',
];

export const routes = {
  dashboard: {
    title: 'Dashboard', icon: '🏠',
    async render(el, { user }) {
      const d = await api('/student/dashboard');
      const p = d.profile;
      const last = d.results[d.results.length - 1];
      el.innerHTML = html`
        <div class="card"><div class="profile-head">
          <div class="avatar">${p.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>
          <div><h2 style="margin:0">Welcome, ${p.name.split(' ')[0]} 👋</h2>
          <div class="muted small">${p.program_name} · Semester ${p.current_semester} · Section ${p.section} · Enrollment ${p.enrollment_no}</div></div>
        </div></div>
        ${d.attendance.percent !== null && d.attendance.percent < d.attendance.minimum
          ? html`<div class="alert alert-danger">⚠️ Your attendance (${d.attendance.percent}%) is below the required ${d.attendance.minimum}%. You may be debarred from examinations.</div>` : ''}
        ${d.fees.due > 0 ? html`<div class="alert alert-warn">💳 You have pending fees of <strong>${inr(d.fees.due)}</strong>. <a href="#/fees">Pay now →</a></div>` : ''}
        <div class="stats">
          ${stat('Attendance', d.attendance.percent !== null ? `${d.attendance.percent}%` : '—', `Minimum required ${d.attendance.minimum}%`, toneFor(d.attendance.percent, d.attendance.minimum))}
          ${stat('CGPA', last ? last.cgpa.toFixed(2) : '—', last ? `SGPA ${last.sgpa.toFixed(2)} in Sem ${last.semester}` : 'No results yet', 'info')}
          ${stat('Fee Due', inr(d.fees.due), `Paid ${inr(d.fees.paid)}`, d.fees.due > 0 ? 'warn' : 'good')}
          ${stat('Assignments', d.pendingAssignments, 'Pending submissions', d.pendingAssignments ? 'warn' : 'good')}
          ${stat('Library', d.library, 'Books issued')}
        </div>
        <div class="cols">
          <div>
            <div class="card"><div class="card-head"><h2>📅 Today's Classes · ${DAYS[new Date().getDay()]}</h2><a href="#/timetable" class="small">Full timetable →</a></div>
              ${d.today.length ? table([
                { label: 'Time', render: (r) => `${r.start_time}–${r.end_time}` },
                { label: 'Subject', render: (r) => html`<strong>${r.code}</strong> ${r.name}` },
                { label: 'Faculty', key: 'faculty' }, { label: 'Room', key: 'room' }], d.today) : html`<div class="empty">No classes today 🎉</div>`}
            </div>
            <div class="card"><div class="card-head"><h2>📊 Subject-wise Attendance</h2><a href="#/attendance" class="small">Details →</a></div>
              ${table([{ label: 'Subject', render: (r) => html`<strong>${r.code}</strong> ${r.name}` }, { label: 'Attended', render: (r) => `${r.present}/${r.total}` }, { label: '%', render: (r) => pctBar(r.percent, d.attendance.minimum) }], d.attendance.subjects)}
            </div>
          </div>
          <div>
            <div class="card"><div class="card-head"><h2>📢 Notices</h2><a href="#/notices" class="small">All →</a></div>${noticeList(d.notices)}</div>
            <div class="card"><h2>📝 Upcoming Exams</h2>
              ${d.exams.length ? html`<ul class="list">${d.exams.map((e) => html`<li><div class="title">${e.code} · ${e.name}</div><div class="meta">${e.exam_type} · ${fmtDate(e.date)} · ${e.start_time}–${e.end_time}</div></li>`)}</ul>` : html`<div class="empty">No upcoming exams</div>`}
            </div>
          </div>
        </div>`;
    },
  },

  profile: {
    title: 'My Profile', icon: '👤',
    async render(el) {
      const p = await api('/student/profile');
      const kv = (k, v) => html`<div><div class="k">${k}</div><div class="v">${v || '—'}</div></div>`;
      el.innerHTML = html`
        <div class="card"><div class="profile-head" style="margin-bottom:1rem">
          <div class="avatar">${p.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>
          <div><h2 style="margin:0">${p.name}</h2><div class="muted small">${p.program_name} (${p.degree}) · ${p.department}</div></div></div>
          <div class="kv">
            ${kv('Enrollment No.', p.enrollment_no)}${kv('Roll No.', p.roll_no)}${kv('Batch', `${p.batch_year}–${p.batch_year + Math.ceil(p.total_semesters / 2)}`)}
            ${kv('Semester / Section', `${p.current_semester} / ${p.section}`)}${kv('Date of Birth', fmtDate(p.dob))}${kv('Gender', p.gender)}
            ${kv("Father's Name", p.father_name)}${kv("Mother's Name", p.mother_name)}${kv('Category', p.category)}
            ${kv('Hostel', p.hostel ? 'Yes' : 'No')}${kv('Transport', p.transport ? 'Yes' : 'No')}${kv('Status', p.status)}
          </div></div>
        <div class="card"><h2>Contact details</h2>
          <form id="pf"><div class="grid-2">
            <label>Email<input type="email" name="email" value="${p.email || ''}" required></label>
            <label>Mobile<input name="phone" value="${p.phone || ''}" required></label></div>
            <div class="grid-2"><label>Address<input name="address" value="${p.address || ''}"></label>
            <label>Blood group<input name="blood_group" value="${p.blood_group || ''}" maxlength="5"></label></div>
            <button class="btn btn-primary" type="submit">Save changes</button>
          </form></div>`;
      onSubmit(el.querySelector('#pf'), async (d) => toast((await api('/student/profile', { method: 'PUT', body: d })).message));
    },
  },

  attendance: {
    title: 'Attendance', icon: '✅',
    async render(el, { params }) {
      const subject = params.get('subject') || '';
      const d = await api(`/student/attendance${subject ? `?subject=${subject}` : ''}`);
      const s = d.summary;
      // Lectures that can be missed (or must be attended) to stay at the minimum.
      const advice = (r) => {
        if (!r.total) return '—';
        const m = s.minimum / 100;
        if (r.present / r.total >= m) return html`<span class="badge badge-success">Can skip ${Math.floor(r.present / m - r.total)}</span>`;
        return html`<span class="badge badge-danger">Attend next ${Math.ceil((m * r.total - r.present) / (1 - m))}</span>`;
      };
      el.innerHTML = html`
        <div class="stats">
          ${stat('Overall Attendance', s.percent !== null ? `${s.percent}%` : '—', `${s.present} of ${s.total} lectures`, toneFor(s.percent, s.minimum))}
          ${stat('Minimum Required', `${s.minimum}%`, 'As per AKTU ordinance', 'info')}
          ${stat('Lectures Missed', s.total - s.present, 'This semester', 'warn')}
        </div>
        <div class="card"><h2>Subject-wise summary</h2>
          ${table([
            { label: 'Code', key: 'code' }, { label: 'Subject', key: 'name' }, { label: 'Type', render: (r) => r.type === 'lab' ? 'Lab' : 'Theory' },
            { label: 'Present', key: 'present', num: true }, { label: 'Total', key: 'total', num: true },
            { label: 'Percentage', render: (r) => pctBar(r.percent, s.minimum) }, { label: 'Advice', render: advice },
            { label: '', render: (r) => html`<a class="btn btn-ghost btn-sm" href="#/attendance?subject=${r.id}">Log</a>` }], s.subjects)}
        </div>
        <div class="card"><div class="card-head"><h2>Daily log ${subject ? '(filtered)' : '(latest 200)'}</h2>${subject ? html`<a class="small" href="#/attendance">Show all</a>` : ''}</div>
          ${table([{ label: 'Date', render: (r) => fmtDate(r.date) }, { label: 'Period', key: 'period' }, { label: 'Subject', render: (r) => `${r.code} · ${r.name}` },
            { label: 'Topic', key: 'topic' }, { label: 'Status', render: (r) => statusBadge(r.status) }], d.log)}
          <p class="tiny muted mt">P = Present · A = Absent · L = Duty leave (counted as present)</p>
        </div>`;
    },
  },

  timetable: {
    title: 'Timetable', icon: '🗓️',
    async render(el) {
      const rows = await api('/student/timetable');
      el.innerHTML = html`<div class="card"><h2>Weekly class schedule</h2>${rows.length ? timetableGrid(rows) : html`<div class="empty">Timetable not published yet</div>`}
        <p class="tiny muted mt">Lunch break 12:30 – 13:20 · Highlighted column is today · Shaded cells are lab sessions</p></div>`;
    },
  },

  assignments: {
    title: 'Assignments', icon: '📝',
    async render(el) {
      const rows = await api('/student/assignments');
      const today = todayISO();
      el.innerHTML = html`<div class="card"><h2>Assignments</h2>${table([
        { label: 'Subject', render: (r) => html`<strong>${r.code}</strong><br><span class="tiny muted">${r.subject}</span>` },
        { label: 'Title', render: (r) => html`${r.title}<br><span class="tiny muted">${r.faculty}</span>` },
        { label: 'Due', render: (r) => html`${fmtDate(r.due_date)} ${!r.submitted_at && r.due_date < today ? raw('<span class="badge badge-danger">Overdue</span>') : ''}` },
        { label: 'Status', render: (r) => (r.marks !== null ? html`<span class="badge badge-success">Graded ${r.marks}/${r.max_marks}</span>` : r.submitted_at ? html`<span class="badge badge-info">Submitted</span>` : html`<span class="badge badge-warn">Pending</span>`) },
        { label: '', render: (r) => html`<button class="btn btn-ghost btn-sm" data-open="${r.id}">${r.submitted_at ? 'View' : 'Submit'}</button>` },
      ], rows, { empty: 'No assignments yet' })}</div>`;
      el.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => {
        const a = rows.find((r) => r.id === Number(b.dataset.open));
        const m = modal(html`<h3>${a.title}</h3><p class="small muted">${a.code} · ${a.subject} · Due ${fmtDate(a.due_date)} · Max ${a.max_marks} marks</p>
          <p class="small">${a.description || ''}</p>
          ${a.marks !== null ? html`<div class="alert alert-success">Marks: ${a.marks}/${a.max_marks}${a.feedback ? ` · ${a.feedback}` : ''}</div>` : ''}
          <form id="sub"><label>Your answer or link to your file (Google Drive / OneDrive)
            <textarea name="content" required ${a.marks !== null ? 'disabled' : ''}>${a.content || ''}</textarea></label>
            ${a.marks === null ? html`<button class="btn btn-primary" type="submit">${a.submitted_at ? 'Resubmit' : 'Submit'}</button>` : ''}</form>`.toString());
        onSubmit(m.el.querySelector('#sub'), async (d) => {
          toast((await api(`/student/assignments/${a.id}/submit`, { method: 'POST', body: d })).message);
          m.close();
          routes.assignments.render(el);
        });
      }));
    },
  },

  results: {
    title: 'Results & Marksheet', icon: '🎓',
    async render(el) {
      const d = await api('/student/results');
      const p = d.profile;
      if (!d.results.length) {
        el.innerHTML = html`<div class="card"><div class="empty">No results have been published yet.</div></div>`;
        return;
      }
      const last = d.results[d.results.length - 1];
      el.innerHTML = html`
        <div class="stats no-print">
          ${stat('CGPA', last.cgpa.toFixed(2), `After semester ${last.semester}`, 'info')}
          ${stat('Last SGPA', last.sgpa.toFixed(2), `Semester ${last.semester}`)}
          ${stat('Credits Earned', d.results.reduce((a, r) => a + r.credits, 0), 'Total')}
          ${stat('Backlogs', d.results.filter((r) => r.status !== 'PASS').length, 'Semesters with back papers', d.results.some((r) => r.status !== 'PASS') ? 'bad' : 'good')}
        </div>
        <div class="card no-print"><div class="card-head"><h2>Semester results</h2>
          <div><label class="mb0" style="display:inline-block">Semester <select id="semSel" style="display:inline-block;width:auto">
            ${d.results.map((r) => html`<option value="${r.semester}" ${r === last ? 'selected' : ''}>Semester ${r.semester}</option>`)}</select></label>
          <button class="btn btn-primary btn-sm" id="printBtn" type="button">🖨️ Print Marksheet</button></div></div>
          ${table([{ label: 'Semester', key: 'semester' }, { label: 'Session', key: 'academic_year' }, { label: 'Credits', key: 'credits', num: true },
            { label: 'SGPA', render: (r) => r.sgpa.toFixed(2), num: true }, { label: 'CGPA', render: (r) => r.cgpa.toFixed(2), num: true },
            { label: 'Result', render: (r) => statusBadge(r.status) }, { label: 'Declared', render: (r) => fmtDate(r.published_at) }], d.results)}
        </div>
        <div id="sheet"></div>`;
      const show = (sem) => {
        const r = d.results.find((x) => x.semester === Number(sem));
        el.querySelector('#sheet').innerHTML = html`<div class="doc">
          ${docHeader(d.institute, `Statement of Grades · Semester ${r.semester}`)}
          <div class="kv" style="margin-bottom:1rem">
            <div><div class="k">Name</div><div class="v">${p.name}</div></div>
            <div><div class="k">Enrollment / Roll No.</div><div class="v">${p.enrollment_no} / ${p.roll_no}</div></div>
            <div><div class="k">Programme</div><div class="v">${p.degree} – ${p.program_name}</div></div>
            <div><div class="k">Session</div><div class="v">${r.academic_year}</div></div>
            <div><div class="k">Father's Name</div><div class="v">${p.father_name || '—'}</div></div>
          </div>
          ${table([{ label: 'Code', key: 'code' }, { label: 'Subject', key: 'name' }, { label: 'Credits', key: 'credits', num: true },
            { label: 'Internal', render: (s) => `${s.internal}/${s.max_internal}`, num: true }, { label: 'External', render: (s) => `${s.external}/${s.max_external}`, num: true },
            { label: 'Total', render: (s) => `${s.total}/${s.max}`, num: true }, { label: 'Grade', render: (s) => html`<strong>${s.grade}</strong>` }, { label: 'GP', key: 'grade_point', num: true }], r.subjects)}
          <div class="kv mt">
            <div><div class="k">SGPA</div><div class="v">${r.sgpa.toFixed(2)}</div></div>
            <div><div class="k">CGPA</div><div class="v">${r.cgpa.toFixed(2)}</div></div>
            <div><div class="k">Result</div><div class="v">${r.status}</div></div>
            <div><div class="k">Date of Declaration</div><div class="v">${fmtDate(r.published_at)}</div></div>
          </div>
          <p class="tiny muted mt">Grading: A+ (90–100) 10 · A (80–89) 9 · B+ (70–79) 8 · B (60–69) 7 · C (50–59) 6 · D (45–49) 5 · E (40–44) 4 · F (&lt;40) 0. This is a computer-generated institute statement; the official grade sheet is issued by ${d.institute.university}.</p>
          <div class="sign-row"><div>Prepared by</div><div>Controller of Examinations</div><div>Director</div></div>
        </div>`;
      };
      show(last.semester);
      el.querySelector('#semSel').addEventListener('change', (e) => show(e.target.value));
      el.querySelector('#printBtn').addEventListener('click', () => window.print());
    },
  },

  'admit-card': {
    title: 'Admit Card', icon: '🪪',
    async render(el) {
      const d = await api('/student/admit-card');
      const p = d.profile;
      if (!d.eligible) {
        el.innerHTML = html`<div class="card"><h2>Admit card not available</h2>
          <div class="alert alert-danger">You are currently not eligible to download the admit card:</div>
          <ul>${d.reasons.map((r) => html`<li>${r}</li>`)}</ul>
          <p class="small muted">Clear the above requirements or contact the examination cell. ${d.semesterDue > 0 ? raw('<a href="#/fees">Pay pending fees →</a>') : ''}</p></div>`;
        return;
      }
      el.innerHTML = html`<div class="no-print actions" style="justify-content:flex-start;margin:0 0 1rem"><button class="btn btn-primary" id="pr" type="button">🖨️ Print / Save as PDF</button></div>
        <div class="doc">${docHeader(d.institute, `Admit Card · ${d.exams[0].exam_type} Examination`)}
          <div class="kv" style="margin-bottom:1rem">
            <div><div class="k">Candidate Name</div><div class="v">${p.name}</div></div>
            <div><div class="k">Enrollment / Roll No.</div><div class="v">${p.enrollment_no} / ${p.roll_no}</div></div>
            <div><div class="k">Programme</div><div class="v">${p.degree} – ${p.program_name}</div></div>
            <div><div class="k">Semester / Section</div><div class="v">${p.current_semester} / ${p.section}</div></div>
            <div><div class="k">Father's Name</div><div class="v">${p.father_name || '—'}</div></div>
            <div><div class="k">Attendance</div><div class="v">${d.attendance ?? '—'}%</div></div>
          </div>
          ${table([{ label: 'Date', render: (e) => fmtDate(e.date) }, { label: 'Day', render: (e) => DAYS[new Date(`${e.date}T00:00:00`).getDay()] },
            { label: 'Time', render: (e) => `${e.start_time} – ${e.end_time}` }, { label: 'Code', key: 'code' }, { label: 'Subject', key: 'name' }, { label: 'Venue', key: 'venue' }], d.exams)}
          <ol class="tiny muted mt"><li>Carry this admit card and your college ID card to every examination.</li>
            <li>Report to the examination hall 20 minutes before the start time.</li>
            <li>Mobile phones, smart watches and programmable calculators are strictly prohibited.</li></ol>
          <div class="sign-row"><div>Candidate's Signature</div><div>Controller of Examinations</div></div>
        </div>`;
      el.querySelector('#pr').addEventListener('click', () => window.print());
    },
  },

  fees: {
    title: 'Fees & Payments', icon: '💳',
    async render(el, { user }) {
      const d = await api('/student/fees');
      const dueHeads = d.heads.filter((h) => h.due > 0);
      el.innerHTML = html`
        <div class="stats">
          ${stat('Total Fee', inr(d.totals.amount), `Concession ${inr(d.totals.concession)}`)}
          ${stat('Paid', inr(d.totals.paid), `${d.payments.filter((p) => p.status === 'success').length} payments`, 'good')}
          ${stat('Outstanding', inr(d.totals.due), dueHeads.length ? `${dueHeads.length} fee heads pending` : 'All clear', d.totals.due ? 'bad' : 'good')}
        </div>
        ${dueHeads.length ? html`<div class="card"><div class="card-head"><h2>Pending dues</h2>
          <button class="btn btn-primary" id="payAll" type="button">Pay ${inr(d.totals.due)} now</button></div>
          <form id="payForm">${table([
            { label: '', render: (h) => html`<input type="checkbox" name="h" value="${h.id}" checked aria-label="Select">` },
            { label: 'Fee head', key: 'head' }, { label: 'Semester', key: 'semester' }, { label: 'Session', key: 'academic_year' },
            { label: 'Due date', render: (h) => html`${fmtDate(h.due_date)} ${h.due_date < todayISO() ? raw('<span class="badge badge-danger">Overdue</span>') : ''}` },
            { label: 'Payable', render: (h) => inr(h.payable), num: true }, { label: 'Paid', render: (h) => inr(h.paid), num: true }, { label: 'Due', render: (h) => html`<strong>${inr(h.due)}</strong>`, num: true }], dueHeads)}
          <div class="actions"><span class="muted small" id="selTotal"></span><button class="btn btn-gold" type="submit">Pay selected</button></div></form>
          <p class="tiny muted">${d.paymentMode === 'demo' ? 'Payments are running in sandbox mode.' : 'Payments are processed securely by Razorpay (UPI, cards, net banking, wallets).'} Receipts are generated instantly.</p>
        </div>` : html`<div class="alert alert-success">✅ No pending dues. Thank you!</div>`}
        <div class="card"><h2>Payment history</h2>${table([
          { label: 'Date', render: (p) => fmtDateTime(p.paid_at || p.created_at) }, { label: 'Transaction ID', key: 'txn_id' }, { label: 'Receipt No.', key: 'receipt_no' },
          { label: 'Mode', key: 'mode' }, { label: 'Amount', render: (p) => inr(p.amount), num: true }, { label: 'Status', render: (p) => statusBadge(p.status) },
          { label: '', render: (p) => (p.status === 'success' ? html`<a class="btn btn-ghost btn-sm" href="/receipt?txn=${p.txn_id}" target="_blank" rel="noopener">Receipt</a>` : '') }], d.payments, { empty: 'No payments yet' })}</div>
        <div class="card"><h2>Complete fee ledger</h2>${table([
          { label: 'Semester', key: 'semester' }, { label: 'Fee head', key: 'head' }, { label: 'Amount', render: (h) => inr(h.amount), num: true },
          { label: 'Concession', render: (h) => inr(h.concession), num: true }, { label: 'Paid', render: (h) => inr(h.paid), num: true },
          { label: 'Balance', render: (h) => inr(h.due), num: true }, { label: '', render: (h) => statusBadge(h.due ? 'pending' : 'paid') }], d.heads)}</div>`;
      const reload = () => routes.fees.render(el, { user });
      const form = el.querySelector('#payForm');
      if (form) {
        const update = () => {
          const ids = [...form.querySelectorAll('[name=h]:checked')].map((c) => Number(c.value));
          const sum = dueHeads.filter((h) => ids.includes(h.id)).reduce((a, h) => a + h.due, 0);
          el.querySelector('#selTotal').textContent = `Selected: ${inr(sum)}`;
        };
        form.addEventListener('change', update);
        update();
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const ids = [...form.querySelectorAll('[name=h]:checked')].map((c) => Number(c.value));
          if (!ids.length) return toast('Select at least one fee head', 'error');
          try { if (await payDues(ids, user.institute.name)) reload(); } catch (err) { toast(err.message, 'error'); }
        });
        el.querySelector('#payAll').addEventListener('click', async () => {
          try { if (await payDues(null, user.institute.name)) reload(); } catch (err) { toast(err.message, 'error'); }
        });
      }
    },
  },

  notices: {
    title: 'Notice Board', icon: '📢',
    async render(el) {
      el.innerHTML = html`<div class="card">${noticeList(await api('/student/notices'))}</div>`;
    },
  },

  library: {
    title: 'Library', icon: '📚',
    async render(el, { params }) {
      const term = params.get('q') || '';
      const d = await api(`/student/library?q=${encodeURIComponent(term)}`);
      const active = d.issued.filter((i) => !i.returned_on);
      el.innerHTML = html`
        <div class="stats">${stat('Books Issued', active.length, 'Max 4 at a time')}${stat('Overdue', active.filter((i) => i.due_on < todayISO()).length, 'Fine ₹2 per day', active.some((i) => i.due_on < todayISO()) ? 'bad' : 'good')}
          ${stat('Fine Payable', inr(active.reduce((a, i) => a + i.fine_now, 0)), 'Pay at library counter', 'warn')}</div>
        <div class="card"><h2>My books</h2>${table([{ label: 'Accession', key: 'accession_no' }, { label: 'Title', render: (i) => html`<strong>${i.title}</strong><br><span class="tiny muted">${i.author}</span>` },
          { label: 'Issued', render: (i) => fmtDate(i.issued_on) }, { label: 'Due', render: (i) => fmtDate(i.due_on) },
          { label: 'Status', render: (i) => (i.returned_on ? html`<span class="badge">Returned ${fmtDate(i.returned_on)}</span>` : i.due_on < todayISO() ? html`<span class="badge badge-danger">Overdue · ${inr(i.fine_now)}</span>` : html`<span class="badge badge-success">Issued</span>`) }],
        d.issued, { empty: 'No books issued' })}</div>
        <div class="card"><div class="card-head"><h2>Search catalogue (OPAC)</h2>
          <form id="sf" class="toolbar" style="margin:0"><input name="q" placeholder="Title, author or subject" value="${term}" style="margin:0;min-width:240px"><button class="btn btn-primary" type="submit">Search</button></form></div>
          ${table([{ label: 'Title', render: (b) => html`<strong>${b.title}</strong>` }, { label: 'Author', key: 'author' }, { label: 'Publisher', key: 'publisher' },
            { label: 'Category', key: 'category' }, { label: 'Availability', render: (b) => (b.available > 0 ? html`<span class="badge badge-success">${b.available} of ${b.copies} available</span>` : html`<span class="badge badge-danger">All issued</span>`) }], d.catalog)}</div>`;
      el.querySelector('#sf').addEventListener('submit', (e) => {
        e.preventDefault();
        location.hash = `#/library?q=${encodeURIComponent(e.target.q.value)}`;
      });
    },
  },

  placements: {
    title: 'Placements', icon: '💼',
    async render(el) {
      const d = await api('/student/placements');
      el.innerHTML = html`<div class="alert alert-info">Your current CGPA: <strong>${d.cgpa ? d.cgpa.toFixed(2) : 'N/A'}</strong>. Apply to drives you are eligible for before the last date.</div>
        <div class="card"><h2>Placement drives</h2>${table([
          { label: 'Company', render: (r) => html`<strong>${r.company}</strong><br><span class="tiny muted">${r.role}</span>` },
          { label: 'Package', render: (r) => (r.package_lpa ? `${r.package_lpa} LPA` : '—') }, { label: 'Location', key: 'location' },
          { label: 'Eligibility', render: (r) => html`<span class="small">${r.eligibility}</span><br><span class="tiny muted">Min CGPA ${r.min_cgpa}</span>` },
          { label: 'Apply by', render: (r) => fmtDate(r.last_date) },
          { label: '', render: (r) => (r.application_status ? statusBadge(r.application_status)
            : r.status === 'open' && r.last_date >= todayISO() ? (r.eligible ? html`<button class="btn btn-primary btn-sm" data-apply="${r.id}">Apply</button>` : html`<span class="badge">Not eligible</span>`)
              : html`<span class="badge">Closed</span>`) }], d.drives)}</div>`;
      el.querySelectorAll('[data-apply]').forEach((b) => b.addEventListener('click', async () => {
        try {
          toast((await api(`/student/placements/${b.dataset.apply}/apply`, { method: 'POST' })).message);
          routes.placements.render(el);
        } catch (err) { toast(err.message, 'error'); }
      }));
    },
  },

  leave: {
    title: 'Leave Application', icon: '🏖️',
    async render(el) {
      const rows = await api('/student/leaves');
      el.innerHTML = html`<div class="cols"><div class="card"><h2>My applications</h2>${table([
        { label: 'From', render: (r) => fmtDate(r.from_date) }, { label: 'To', render: (r) => fmtDate(r.to_date) }, { label: 'Reason', key: 'reason' },
        { label: 'Status', render: (r) => statusBadge(r.status) }, { label: 'Remark', key: 'remark' }], rows, { empty: 'No leave applications' })}</div>
        <div class="card"><h2>Apply for leave</h2><form id="lf">
          <div class="grid-2"><label>From<input type="date" name="from_date" required></label><label>To<input type="date" name="to_date" required></label></div>
          <label>Reason<textarea name="reason" required maxlength="500"></textarea></label>
          <button class="btn btn-primary" type="submit">Submit application</button></form></div></div>`;
      onSubmit(el.querySelector('#lf'), async (d) => {
        toast((await api('/student/leaves', { method: 'POST', body: d })).message);
        routes.leave.render(el);
      });
    },
  },

  helpdesk: {
    title: 'Helpdesk & Grievance', icon: '🛟',
    render: (el) => helpdesk(el),
  },
};

export async function helpdesk(el) {
  const rows = await api('/support/grievances');
  el.innerHTML = html`<div class="cols"><div class="card"><h2>My tickets</h2>${table([
    { label: '#', key: 'id' }, { label: 'Subject', render: (r) => html`<strong>${r.subject}</strong><br><span class="tiny muted">${r.category} · ${fmtDate(r.created_at)}</span>` },
    { label: 'Status', render: (r) => statusBadge(r.status) }, { label: 'Response', render: (r) => r.response || html`<span class="muted small">Awaiting response</span>` }], rows, { empty: 'No tickets raised' })}</div>
    <div class="card"><h2>Raise a ticket</h2><form id="gf">
      <label>Category<select name="category" required>${['Academic', 'Examination', 'Fees & Accounts', 'Hostel', 'Transport', 'Infrastructure', 'Anti-Ragging', 'Other'].map((c) => html`<option>${c}</option>`)}</select></label>
      <label>Subject<input name="subject" required maxlength="150"></label>
      <label>Description<textarea name="description" required maxlength="3000"></textarea></label>
      <button class="btn btn-primary" type="submit">Submit</button>
      <p class="tiny muted mt">Anti-ragging helpline (national): 1800-180-5522. Your identity is kept confidential.</p></form></div></div>`;
  onSubmit(el.querySelector('#gf'), async (d) => {
    toast((await api('/support/grievances', { method: 'POST', body: d })).message);
    helpdesk(el);
  });
}
