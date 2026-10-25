import { api, html, raw, inr, fmtDate, fmtDateTime, toast, toastError, modal, onSubmit, confirmDialog, downloadUrl, DAYS, todayISO } from './lib.js';
import { stat, pctBar, statusBadge, table, semesterOptions } from './ui.js';

const PERIOD_TIMES = [['09:00', '09:50'], ['09:50', '10:40'], ['10:50', '11:40'], ['11:40', '12:30'], ['13:20', '14:10'], ['14:10', '15:00']];
let META = null;
const meta = async () => (META ||= await api('/admin/meta'));

const programOptions = (selected, { any = false } = {}) => html`${any ? html`<option value="">All programmes</option>` : ''}${META.programs.map((p) => html`<option value="${p.id}" ${String(p.id) === String(selected) ? 'selected' : ''}>${p.code} – ${p.name}</option>`)}`;

// Builds form inputs from a compact field spec.
function fields(spec, v = {}) {
  return spec.map((f) => {
    if (f.row) return html`<div class="grid-${f.row.length}">${fields(f.row, v)}</div>`;
    const val = v[f.name] ?? f.value ?? '';
    const req = f.required ? 'required' : '';
    let input;
    if (f.type === 'select') {
      input = html`<select name="${f.name}" ${req}>${f.options.map((o) => {
        const [value, label] = Array.isArray(o) ? o : [o, o];
        return html`<option value="${value}" ${String(value) === String(val) ? 'selected' : ''}>${label}</option>`;
      })}</select>`;
    } else if (f.type === 'textarea') {
      input = html`<textarea name="${f.name}" ${req} maxlength="${f.max || 5000}">${val}</textarea>`;
    } else if (f.type === 'checkbox') {
      return html`<label class="check"><input type="checkbox" name="${f.name}" ${val ? 'checked' : ''}>${f.label}</label>`;
    } else {
      input = html`<input type="${f.type || 'text'}" name="${f.name}" value="${val}" ${req} ${f.step ? raw(`step="${f.step}"`) : ''} ${f.max && f.type !== 'number' ? raw(`maxlength="${f.max}"`) : ''}>`;
    }
    return html`<label>${f.label}${input}</label>`;
  });
}

function formModal(title, spec, values, submit, { wide = true } = {}) {
  const m = modal(html`<h3>${title}</h3><form id="fm">${fields(spec, values)}<div class="actions"><button class="btn btn-primary" type="submit">Save</button></div></form>`.toString(), { wide });
  onSubmit(m.el.querySelector('#fm'), async (d) => {
    const r = await submit(d);
    toast(r.message || 'Saved');
    m.close();
  });
  return m;
}

const reload = (el, name, ctx) => routes[name].render(el, ctx || { params: new URLSearchParams(location.hash.split('?')[1] || '') });

// Shows a server message containing temporary credentials in a modal so it can be copied.
function credentials(msg) {
  modal(html`<h3>Done</h3><p>${msg}</p><p class="tiny muted">Share these credentials securely. The user must change the password at first login.</p>`.toString());
}

export const menu = [
  { group: 'Overview' }, 'dashboard',
  { group: 'People' }, 'students', 'faculty',
  { group: 'Academics' }, 'academics', 'timetable', 'exams',
  { group: 'Finance' }, 'fees',
  { group: 'Campus' }, 'library', 'placements', 'content',
  { group: 'Front Office' }, 'admissions', 'requests',
  { group: 'System' }, 'audit',
];

const STUDENT_SPEC = () => [
  { row: [{ name: 'name', label: 'Full name', required: true }, { name: 'dob', label: 'Date of birth', type: 'date', required: true }] },
  { row: [{ name: 'email', label: 'Email', type: 'email', required: true }, { name: 'phone', label: 'Mobile', required: true }] },
  { row: [{ name: 'enrollment_no', label: 'Enrollment no. (login ID)', required: true }, { name: 'roll_no', label: 'University roll no.', required: true }] },
  { row: [{ name: 'program_id', label: 'Programme', type: 'select', options: META.programs.map((p) => [p.id, `${p.code} – ${p.name}`]), required: true },
    { name: 'batch_year', label: 'Batch (admission year)', type: 'number', required: true, value: new Date().getFullYear() }] },
  { row: [{ name: 'current_semester', label: 'Current semester', type: 'number', required: true, value: 1 }, { name: 'section', label: 'Section', required: true, value: 'A' },
    { name: 'status', label: 'Status', type: 'select', options: ['active', 'passed-out', 'left', 'suspended'] }] },
  { row: [{ name: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Other'] }, { name: 'category', label: 'Category', type: 'select', options: ['General', 'OBC', 'SC', 'ST', 'EWS'] },
    { name: 'blood_group', label: 'Blood group' }] },
  { row: [{ name: 'father_name', label: "Father's name" }, { name: 'mother_name', label: "Mother's name" }] },
  { name: 'address', label: 'Address' },
  { row: [{ name: 'hostel', label: 'Hostel resident', type: 'checkbox' }, { name: 'transport', label: 'Uses college transport', type: 'checkbox' }] },
];

const FACULTY_SPEC = () => [
  { row: [{ name: 'name', label: 'Full name (with title)', required: true }, { name: 'employee_id', label: 'Employee ID (login ID)', required: true }] },
  { row: [{ name: 'email', label: 'Email', type: 'email', required: true }, { name: 'phone', label: 'Mobile', required: true }] },
  { row: [{ name: 'department_id', label: 'Department', type: 'select', options: META.departments.map((d) => [d.id, d.name]), required: true },
    { name: 'designation', label: 'Designation', type: 'select', options: ['Professor & Head', 'Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer', 'Lab Instructor'] }] },
  { row: [{ name: 'qualification', label: 'Qualification' }, { name: 'specialization', label: 'Specialization' }, { name: 'joined_on', label: 'Date of joining', type: 'date' }] },
  { name: 'active', label: 'Active (can log in)', type: 'checkbox', value: true },
];

async function studentDetail(id, onChange) {
  const d = await api(`/admin/students/${id}`);
  const p = d.profile;
  const m = modal(html`<h3>${p.name} <span class="badge">${p.enrollment_no}</span></h3>
    <p class="small muted">${p.program_name} · Semester ${p.current_semester}-${p.section} · ${p.phone} · ${p.email}</p>
    <div class="tabs"><button class="active" data-t="att">Attendance</button><button data-t="fee">Fees</button><button data-t="res">Results</button></div>
    <div data-p="att">${table([{ label: 'Subject', render: (s) => `${s.code} ${s.name}` }, { label: 'Attended', render: (s) => `${s.present}/${s.total}` }, { label: '%', render: (s) => pctBar(s.percent) }], d.attendance.subjects)}
      <p class="small mt">Overall: <strong>${d.attendance.percent ?? '—'}%</strong></p></div>
    <div data-p="fee" class="hidden">
      <p class="small">Total ${inr(d.fees.totals.amount)} · Concession ${inr(d.fees.totals.concession)} · Paid ${inr(d.fees.totals.paid)} · <strong>Due ${inr(d.fees.totals.due)}</strong></p>
      ${table([{ label: 'Sem', key: 'semester' }, { label: 'Head', key: 'head' }, { label: 'Amount', render: (h) => inr(h.amount), num: true }, { label: 'Concession', render: (h) => inr(h.concession), num: true },
        { label: 'Paid', render: (h) => inr(h.paid), num: true }, { label: 'Due', render: (h) => inr(h.due), num: true },
        { label: '', render: (h) => html`<button class="btn btn-ghost btn-sm" type="button" data-edit-head="${h.id}">Edit</button>` }], d.fees.heads, { empty: 'No fees generated' })}
      ${d.fees.totals.due > 0 ? html`<form id="off" class="toolbar mt"><label>Mode<select name="mode">${['Cash', 'Cheque', 'Demand Draft', 'NEFT/RTGS', 'UPI (Counter)'].map((x) => html`<option>${x}</option>`)}</select></label>
        <label class="grow">Reference / cheque no.<input name="reference"></label><button class="btn btn-gold" type="submit">Record ${inr(d.fees.totals.due)} payment</button></form>` : ''}
      <h4 class="mt">Payments</h4>${table([{ label: 'Date', render: (x) => fmtDateTime(x.paid_at || x.created_at) }, { label: 'Receipt', key: 'receipt_no' }, { label: 'Mode', key: 'mode' },
        { label: 'Amount', render: (x) => inr(x.amount), num: true }, { label: 'Status', render: (x) => statusBadge(x.status) },
        { label: '', render: (x) => (x.status === 'success' ? html`<a href="/receipt?txn=${x.txn_id}" target="_blank" rel="noopener">Receipt</a>` : '') }], d.fees.payments, { empty: 'No payments' })}
    </div>
    <div data-p="res" class="hidden">${table([{ label: 'Semester', key: 'semester' }, { label: 'SGPA', key: 'sgpa', num: true }, { label: 'CGPA', key: 'cgpa', num: true }, { label: 'Result', render: (r) => statusBadge(r.status) }], d.results, { empty: 'No results published' })}</div>
    <div class="actions"><button class="btn btn-ghost" data-reset type="button">Reset password</button><button class="btn btn-primary" data-edit type="button">Edit details</button></div>`.toString(), { wide: true });
  m.el.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => {
    m.el.querySelectorAll('[data-t]').forEach((x) => x.classList.toggle('active', x === b));
    m.el.querySelectorAll('[data-p]').forEach((x) => x.classList.toggle('hidden', x.dataset.p !== b.dataset.t));
  }));
  m.el.querySelector('[data-reset]').onclick = async () => {
    if (!(await confirmDialog(`Reset the password for ${p.name}?`))) return;
    credentials((await api(`/admin/users/${id}/reset-password`, { method: 'POST' })).message);
  };
  m.el.querySelector('[data-edit]').onclick = () => {
    m.close();
    formModal(`Edit ${p.name}`, STUDENT_SPEC(), p, (body) => api(`/admin/students/${id}`, { method: 'PUT', body }).then((r) => { onChange(); return r; }));
  };
  m.el.querySelectorAll('[data-edit-head]').forEach((b) => b.addEventListener('click', () => {
    const h = d.fees.heads.find((x) => x.id === Number(b.dataset.editHead));
    m.close();
    formModal(`${h.head} · Semester ${h.semester}`, [{ row: [{ name: 'amount', label: 'Amount (₹)', type: 'number', required: true }, { name: 'concession', label: 'Concession / scholarship (₹)', type: 'number' }] },
      { name: 'due_date', label: 'Due date', type: 'date' }], h, (body) => api(`/admin/fee-heads/${h.id}`, { method: 'PUT', body }), { wide: false });
  }));
  const off = m.el.querySelector('#off');
  if (off) {
    onSubmit(off, async (f) => {
      const r = await api('/admin/payments/offline', { method: 'POST', body: { student_id: id, ...f } });
      toast(r.message);
      m.close();
      window.open(`/receipt?txn=${encodeURIComponent(r.txn_id)}`, '_blank', 'noopener');
      onChange();
    });
  }
}

export const routes = {
  dashboard: {
    title: 'Admin Dashboard', icon: '🏠',
    async render(el) {
      const d = await api('/admin/dashboard');
      const c = d.counts;
      const max = Math.max(1, ...d.collection.map((x) => x.total));
      const maxP = Math.max(1, ...d.byProgram.map((x) => x.students));
      el.innerHTML = html`
        <div class="stats">
          ${stat('Active Students', c.students.toLocaleString('en-IN'), `${c.programs} programmes`)}
          ${stat('Faculty', c.faculty, 'Teaching staff', 'info')}
          ${stat('Fee Collected', inr(d.fees.collected), `Today ${inr(d.fees.today)}`, 'good')}
          ${stat('Outstanding Dues', inr(d.fees.outstanding), 'Across all students', 'bad')}
          ${stat('Avg. Attendance', d.attendance !== null ? `${d.attendance}%` : '—', 'All classes', 'warn')}
        </div>
        <div class="stats">
          ${stat('New Enquiries', c.newEnquiries, raw('<a href="#/admissions">View admissions →</a>'), 'warn')}
          ${stat('Open Tickets', c.openGrievances, raw('<a href="#/requests">Helpdesk →</a>'), c.openGrievances ? 'bad' : 'good')}
          ${stat('Leave Requests', c.pendingLeaves, raw('<a href="#/requests?tab=leaves">Review →</a>'), 'info')}
          ${stat('Open Drives', c.openDrives, raw('<a href="#/placements">Placements →</a>'), 'good')}
        </div>
        <div class="cols-even">
          <div class="card"><h2>💰 Fee collection (last 6 months)</h2>
            ${d.collection.length ? html`<div class="chart">${d.collection.map((x) => html`<div class="col"><em>${(x.total / 100000).toFixed(1)}L</em><span class="b" style="height:${(x.total / max) * 100}%"></span>
              <small>${fmtDate(`${x.month}-01`, { month: 'short', year: '2-digit' })}</small></div>`)}</div>` : html`<div class="empty">No collections yet</div>`}</div>
          <div class="card"><h2>🎓 Students by programme</h2>
            <div class="chart">${d.byProgram.map((x) => html`<div class="col"><em>${x.students}</em><span class="b" style="height:${(x.students / maxP) * 100}%"></span><small>${x.code.replace('BT-', '')}</small></div>`)}</div></div>
        </div>
        <div class="card"><div class="card-head"><h2>Recent payments</h2><a href="#/fees?tab=payments" class="small">All payments →</a></div>
          ${table([{ label: 'Paid at', render: (p) => fmtDateTime(p.paid_at) }, { label: 'Student', render: (p) => html`${p.name}<br><span class="tiny muted">${p.enrollment_no}</span>` },
            { label: 'Receipt', key: 'receipt_no' }, { label: 'Mode', key: 'mode' }, { label: 'Amount', render: (p) => inr(p.amount), num: true },
            { label: '', render: (p) => html`<a href="/receipt?txn=${p.txn_id}" target="_blank" rel="noopener" class="small">View</a>` }], d.recentPayments)}</div>`;
    },
  },

  students: {
    title: 'Students', icon: '🎓',
    async render(el, { params }) {
      await meta();
      const qs = new URLSearchParams();
      for (const k of ['q', 'program', 'semester', 'section', 'status']) if (params.get(k)) qs.set(k, params.get(k));
      const rows = await api(`/admin/students?${qs}`);
      el.innerHTML = html`<div class="card">
        <form id="flt" class="toolbar">
          <label class="grow">Search<input name="q" value="${params.get('q') || ''}" placeholder="Name, enrollment, roll no. or mobile"></label>
          <label>Programme<select name="program">${programOptions(params.get('program'), { any: true })}</select></label>
          <label>Semester<select name="semester"><option value="">All</option>${semesterOptions(8, params.get('semester'))}</select></label>
          <label>Status<select name="status"><option value="">All</option>${['active', 'passed-out', 'left', 'suspended'].map((s) => html`<option ${params.get('status') === s ? 'selected' : ''}>${s}</option>`)}</select></label>
          <button class="btn btn-ghost" type="submit">Filter</button>
        </form>
        <div class="toolbar"><button class="btn btn-primary" id="add" type="button">+ Add student</button>
          <button class="btn btn-ghost" id="csv" type="button">⬇ Export CSV</button><button class="btn btn-ghost" id="promote" type="button">⏫ Promote semester</button>
          <span class="muted small" style="margin-left:auto">${rows.length} students</span></div>
        ${table([{ label: 'Enrollment', key: 'enrollment_no' }, { label: 'Name', render: (s) => html`<strong>${s.name}</strong><br><span class="tiny muted">${s.phone}</span>` },
          { label: 'Programme', key: 'program_code' }, { label: 'Sem/Sec', render: (s) => `${s.current_semester}-${s.section}` }, { label: 'Batch', key: 'batch_year' },
          { label: 'Status', render: (s) => statusBadge(s.status) },
          { label: '', render: (s) => html`<button class="btn btn-ghost btn-sm" data-id="${s.id}" type="button">Open</button>` }], rows.slice(0, 500))}
        ${rows.length > 500 ? html`<p class="tiny muted mt">Showing first 500 – refine filters or export CSV for the full list.</p>` : ''}</div>`;
      const refresh = () => reload(el, 'students', { params });
      el.querySelector('#flt').addEventListener('submit', (e) => {
        e.preventDefault();
        const f = new URLSearchParams([...new FormData(e.target)].filter(([, v]) => v));
        location.hash = `#/students?${f}`;
      });
      el.querySelector('#add').onclick = () => formModal('Add student', STUDENT_SPEC(), {}, async (body) => { const r = await api('/admin/students', { method: 'POST', body }); credentials(r.message); refresh(); return r; });
      el.querySelector('#csv').onclick = () => downloadUrl(`/admin/students?${qs}&format=csv`);
      el.querySelector('#promote').onclick = () => formModal('Promote students to next semester', [
        { row: [{ name: 'program_id', label: 'Programme', type: 'select', options: META.programs.map((p) => [p.id, p.code]) }, { name: 'semester', label: 'Current semester', type: 'number', required: true }] }], {},
      async (body) => { const r = await api('/admin/students/promote', { method: 'POST', body }); refresh(); return r; }, { wide: false });
      el.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => studentDetail(Number(b.dataset.id), refresh).catch(toastError)));
    },
  },

  faculty: {
    title: 'Faculty', icon: '👩‍🏫',
    async render(el) {
      await meta();
      const rows = await api('/admin/faculty');
      el.innerHTML = html`<div class="card"><div class="toolbar"><button class="btn btn-primary" id="add" type="button">+ Add faculty</button><span class="muted small" style="margin-left:auto">${rows.length} members</span></div>
        ${table([{ label: 'Emp ID', key: 'employee_id' }, { label: 'Name', render: (f) => html`<strong>${f.name}</strong><br><span class="tiny muted">${f.email}</span>` },
          { label: 'Department', key: 'department' }, { label: 'Designation', key: 'designation' }, { label: 'Qualification', key: 'qualification' }, { label: 'Classes', key: 'classes', num: true },
          { label: 'Status', render: (f) => (f.active ? html`<span class="badge badge-success">Active</span>` : html`<span class="badge">Inactive</span>`) },
          { label: '', render: (f) => html`<button class="btn btn-ghost btn-sm" data-edit="${f.id}" type="button">Edit</button> <button class="btn btn-ghost btn-sm" data-reset="${f.id}" type="button">Reset pwd</button>` }], rows)}</div>`;
      const refresh = () => reload(el, 'faculty');
      el.querySelector('#add').onclick = () => formModal('Add faculty', FACULTY_SPEC(), {}, async (body) => { const r = await api('/admin/faculty', { method: 'POST', body }); credentials(r.message); refresh(); return r; });
      el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => {
        const f = rows.find((x) => x.id === Number(b.dataset.edit));
        formModal(`Edit ${f.name}`, FACULTY_SPEC(), f, async (body) => { const r = await api(`/admin/faculty/${f.id}`, { method: 'PUT', body }); refresh(); return r; });
      }));
      el.querySelectorAll('[data-reset]').forEach((b) => b.addEventListener('click', async () => {
        if (!(await confirmDialog('Reset this faculty member\'s password?'))) return;
        credentials((await api(`/admin/users/${b.dataset.reset}/reset-password`, { method: 'POST' })).message);
      }));
    },
  },

  academics: {
    title: 'Programmes & Subjects', icon: '📘',
    async render(el, { params }) {
      await meta();
      const program = params.get('program') || META.programs[0].id;
      const semester = params.get('semester') || 1;
      const subs = await api(`/admin/subjects?program=${program}&semester=${semester}`);
      const prog = META.programs.find((p) => String(p.id) === String(program));
      el.innerHTML = html`<div class="card"><form id="flt" class="toolbar" style="margin:0">
          <label class="grow">Programme<select name="program">${programOptions(program)}</select></label>
          <label>Semester<select name="semester">${semesterOptions(prog.total_semesters, semester)}</select></label>
          <button class="btn btn-ghost" type="submit">Show</button><button class="btn btn-ghost" id="editProg" type="button">Edit programme info</button></form></div>
        <div class="card"><div class="card-head"><h2>${prog.code} · Semester ${semester} subjects</h2><button class="btn btn-primary btn-sm" id="addSub" type="button">+ Add subject</button></div>
        ${table([{ label: 'Code', key: 'code' }, { label: 'Subject', key: 'name' }, { label: 'Type', key: 'type' }, { label: 'Credits', key: 'credits', num: true },
          { label: 'Int/Ext', render: (s) => `${s.max_internal}/${s.max_external}` },
          { label: 'Faculty (section)', render: (s) => (s.allocations.length ? s.allocations.map((a) => html`<span class="badge badge-info">${a.section}: ${a.faculty}</span> `) : html`<span class="badge badge-warn">Not assigned</span>`) },
          { label: '', render: (s) => html`<button class="btn btn-ghost btn-sm" data-assign="${s.id}" type="button">Assign</button> <button class="btn btn-ghost btn-sm" data-del="${s.id}" type="button">Delete</button>` }], subs, { empty: 'No subjects in this semester' })}</div>`;
      const refresh = () => reload(el, 'academics', { params });
      el.querySelector('#flt').addEventListener('submit', (e) => { e.preventDefault(); location.hash = `#/academics?program=${e.target.program.value}&semester=${e.target.semester.value}`; });
      el.querySelector('#editProg').onclick = () => formModal(`${prog.code} – ${prog.name}`, [{ name: 'intake', label: 'Annual intake (seats)', type: 'number' },
        { name: 'eligibility', label: 'Eligibility', type: 'textarea' }, { name: 'description', label: 'Description (shown on website)', type: 'textarea' }], prog,
      async (body) => { const r = await api(`/admin/programs/${prog.id}`, { method: 'PUT', body }); META = null; return r; });
      el.querySelector('#addSub').onclick = () => formModal('Add subject', [
        { row: [{ name: 'code', label: 'Subject code', required: true }, { name: 'name', label: 'Subject name', required: true }] },
        { row: [{ name: 'type', label: 'Type', type: 'select', options: [['theory', 'Theory'], ['lab', 'Lab / Practical']] }, { name: 'credits', label: 'Credits', type: 'number', value: 3 }] },
        { row: [{ name: 'max_internal', label: 'Max internal', type: 'number', value: 30 }, { name: 'max_external', label: 'Max external', type: 'number', value: 70 }] }], {},
      async (body) => { const r = await api('/admin/subjects', { method: 'POST', body: { ...body, program_id: program, semester } }); refresh(); return r; });
      el.querySelectorAll('[data-assign]').forEach((b) => b.addEventListener('click', () => formModal('Assign faculty', [
        { row: [{ name: 'faculty_id', label: 'Faculty', type: 'select', options: META.faculty.map((f) => [f.id, `${f.name} (${f.employee_id})`]) }, { name: 'section', label: 'Section', value: 'A', required: true }] }], {},
      async (body) => { const r = await api('/admin/allocations', { method: 'POST', body: { ...body, subject_id: Number(b.dataset.assign) } }); refresh(); return r; }, { wide: false })));
      el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
        if (!(await confirmDialog('Delete this subject?', { danger: true, ok: 'Delete' }))) return;
        try { toast((await api(`/admin/subjects/${b.dataset.del}`, { method: 'DELETE' })).message); refresh(); } catch (err) { toastError(err); }
      }));
    },
  },

  timetable: {
    title: 'Timetable', icon: '🗓️',
    async render(el, { params }) {
      await meta();
      const program = params.get('program') || META.programs[0].id;
      const semester = params.get('semester') || 1;
      const section = params.get('section') || 'A';
      const [slots, subs] = await Promise.all([api(`/admin/timetable?program=${program}&semester=${semester}&section=${section}`), api(`/admin/subjects?program=${program}&semester=${semester}`)]);
      const by = new Map(slots.map((s) => [`${s.day}-${s.period}`, s]));
      el.innerHTML = html`<div class="card"><form id="flt" class="toolbar" style="margin:0">
        <label class="grow">Programme<select name="program">${programOptions(program)}</select></label>
        <label>Semester<select name="semester">${semesterOptions(8, semester)}</select></label>
        <label>Section<input name="section" value="${section}" maxlength="3" style="width:80px"></label>
        <button class="btn btn-ghost" type="submit">Load</button></form></div>
        <div class="card"><p class="small muted">Click any cell to set or clear the subject for that period.</p><div class="table-wrap"><table class="tt">
        <thead><tr><th>Day</th>${PERIOD_TIMES.map(([s, e], i) => html`<th>P${i + 1}<br><span class="tiny">${s}–${e}</span></th>`)}</tr></thead>
        <tbody>${[1, 2, 3, 4, 5, 6].map((d) => html`<tr><th>${DAYS[d].slice(0, 3)}</th>${PERIOD_TIMES.map((_, i) => {
          const s = by.get(`${d}-${i + 1}`);
          return html`<td data-slot="${d}-${i + 1}" style="cursor:pointer">${s ? html`<span class="code">${s.code}</span>${s.name}<br><span class="tiny muted">${s.room || ''}</span>` : html`<span class="muted">+ add</span>`}</td>`;
        })}</tr>`)}</tbody></table></div></div>`;
      el.querySelector('#flt').addEventListener('submit', (e) => { e.preventDefault(); const f = e.target; location.hash = `#/timetable?program=${f.program.value}&semester=${f.semester.value}&section=${f.section.value.toUpperCase()}`; });
      el.querySelectorAll('[data-slot]').forEach((td) => td.addEventListener('click', () => {
        const [day, period] = td.dataset.slot.split('-').map(Number);
        const cur = by.get(td.dataset.slot) || {};
        formModal(`${DAYS[day]} · Period ${period}`, [{ name: 'subject_id', label: 'Subject', type: 'select', options: [['', '— Free period —'], ...subs.map((s) => [s.id, `${s.code} ${s.name}`])] },
          { row: [{ name: 'start_time', label: 'Start', type: 'time', value: PERIOD_TIMES[period - 1][0] }, { name: 'end_time', label: 'End', type: 'time', value: PERIOD_TIMES[period - 1][1] }, { name: 'room', label: 'Room' }] }],
        cur, async (body) => { const r = await api('/admin/timetable', { method: 'POST', body: { ...body, program_id: program, semester, section, day, period } }); reload(el, 'timetable', { params }); return r; }, { wide: false });
      }));
    },
  },

  exams: {
    title: 'Examinations & Results', icon: '📝',
    async render(el, { params }) {
      await meta();
      const tab = params.get('tab') || 'schedule';
      const tabs = html`<div class="tabs">${[['schedule', 'Exam schedule'], ['marks', 'Marks entry'], ['results', 'Publish results']].map(([k, l]) => html`<button class="${tab === k ? 'active' : ''}" data-tab="${k}">${l}</button>`)}</div>`;
      const program = params.get('program') || META.programs[0].id;
      const semester = params.get('semester') || 1;
      const picker = (extra = '') => html`<form id="flt" class="toolbar"><label class="grow">Programme<select name="program">${programOptions(program)}</select></label>
        <label>Semester<select name="semester">${semesterOptions(8, semester)}</select></label>${extra}<button class="btn btn-ghost" type="submit">Load</button></form>`;
      let body = '';
      if (tab === 'schedule') {
        const [rows, subs] = await Promise.all([api('/admin/exams'), api(`/admin/subjects?program=${program}&semester=${semester}`)]);
        body = html`<div class="cols"><div class="card"><h2>Scheduled papers</h2>${table([{ label: 'Date', render: (e) => fmtDate(e.date) }, { label: 'Time', render: (e) => `${e.start_time}–${e.end_time}` },
          { label: 'Class', render: (e) => `${e.program_code} S${e.semester}` }, { label: 'Paper', render: (e) => `${e.code} ${e.name}` }, { label: 'Type', key: 'exam_type' }, { label: 'Venue', key: 'venue' },
          { label: '', render: (e) => html`<button class="btn btn-ghost btn-sm" data-del="${e.id}" type="button">✕</button>` }], rows)}</div>
          <div class="card"><h2>Schedule a paper</h2>${picker()}<form id="ef">
            <label>Subject<select name="subject_id" required>${subs.map((s) => html`<option value="${s.id}">${s.code} ${s.name}</option>`)}</select></label>
            <label>Exam type<select name="exam_type">${['End Semester', 'Mid Term', 'Practical', 'Back Paper'].map((t) => html`<option>${t}</option>`)}</select></label>
            <label>Date<input type="date" name="date" required min="${todayISO()}"></label>
            <div class="grid-2"><label>Start<input type="time" name="start_time" value="10:00" required></label><label>End<input type="time" name="end_time" value="13:00" required></label></div>
            <label>Venue<input name="venue" placeholder="Block A – Exam Hall"></label>
            <button class="btn btn-primary" type="submit">Add to schedule</button></form></div></div>`;
      } else if (tab === 'marks') {
        const subs = await api(`/admin/subjects?program=${program}&semester=${semester}`);
        const subject = params.get('subject') || (subs[0] && subs[0].id);
        const section = params.get('section') || 'A';
        const d = subject ? await api(`/admin/marks?subject=${subject}&section=${section}`) : null;
        body = html`<div class="card">${picker(html`<label>Subject<select name="subject">${subs.map((s) => html`<option value="${s.id}" ${String(s.id) === String(subject) ? 'selected' : ''}>${s.code} ${s.name}</option>`)}</select></label>
          <label>Section<input name="section" value="${section}" style="width:70px"></label>`)}
          ${d ? html`<form id="mf">${table([{ label: 'Roll No.', key: 'roll_no' }, { label: 'Name', key: 'name' },
            { label: `Internal /${d.subject.max_internal}`, render: (s) => html`<input class="marks-input" type="number" step="0.5" min="0" max="${d.subject.max_internal}" data-i="${s.id}" value="${s.internal ?? ''}">` },
            { label: `External /${d.subject.max_external}`, render: (s) => html`<input class="marks-input" type="number" step="0.5" min="0" max="${d.subject.max_external}" data-e="${s.id}" value="${s.external ?? ''}">` }], d.students)}
            <div class="actions"><button class="btn btn-primary" type="submit">Save marks</button></div></form>` : html`<div class="empty">No subjects</div>`}</div>`;
        el.dataset.marks = JSON.stringify({ subject, ids: d ? d.students.map((s) => s.id) : [] });
      } else {
        const rows = await api(`/admin/results?program=${program}&semester=${semester}`);
        body = html`<div class="card">${picker()}
          <div class="alert alert-info">Publishing computes SGPA/CGPA (AKTU 10-point scale) for every student of the selected programme whose internal and external marks are complete for this semester. Re-publishing updates existing results.</div>
          <div class="actions" style="justify-content:flex-start"><button class="btn btn-primary" id="pub" type="button">Publish / re-publish results</button></div>
          <h2 class="mt">Published results (${rows.length})</h2>${table([{ label: 'Rank', key: 'rank', num: true }, { label: 'Enrollment', key: 'enrollment_no' }, { label: 'Name', key: 'name' },
            { label: 'SGPA', key: 'sgpa', num: true }, { label: 'CGPA', key: 'cgpa', num: true }, { label: 'Result', render: (r) => statusBadge(r.status) }, { label: 'Declared', render: (r) => fmtDate(r.published_at) }],
          rows.map((r, i) => ({ ...r, rank: i + 1 })), { empty: 'Not published yet' })}</div>`;
      }
      el.innerHTML = html`${tabs}${body}`;
      el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { location.hash = `#/exams?tab=${b.dataset.tab}&program=${program}&semester=${semester}`; }));
      const flt = el.querySelector('#flt');
      if (flt) flt.addEventListener('submit', (e) => {
        e.preventDefault();
        const f = new URLSearchParams([...new FormData(e.target)].filter(([, v]) => v));
        f.set('tab', tab);
        location.hash = `#/exams?${f}`;
      });
      const refresh = () => reload(el, 'exams', { params });
      const ef = el.querySelector('#ef');
      if (ef) onSubmit(ef, async (d) => { toast((await api('/admin/exams', { method: 'POST', body: d })).message); refresh(); });
      el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => { toast((await api(`/admin/exams/${b.dataset.del}`, { method: 'DELETE' })).message); refresh(); }));
      const mf = el.querySelector('#mf');
      if (mf) onSubmit(mf, async () => {
        const { subject, ids } = JSON.parse(el.dataset.marks);
        const marks = ids.map((id) => ({ student_id: id, internal: el.querySelector(`[data-i="${id}"]`).value, external: el.querySelector(`[data-e="${id}"]`).value }));
        toast((await api('/admin/marks', { method: 'POST', body: { subject_id: Number(subject), marks } })).message);
      });
      const pub = el.querySelector('#pub');
      if (pub) pub.onclick = async () => {
        if (!(await confirmDialog(`Publish results for ${META.programs.find((p) => String(p.id) === String(program)).code} semester ${semester}? Students will see them immediately.`, { ok: 'Publish' }))) return;
        try { toast((await api('/admin/results/publish', { method: 'POST', body: { program_id: program, semester } })).message); refresh(); } catch (err) { toastError(err); }
      };
    },
  },

  fees: {
    title: 'Fees & Accounts', icon: '💰',
    async render(el, { params }) {
      await meta();
      const tab = params.get('tab') || 'payments';
      const tabs = html`<div class="tabs">${[['payments', 'Transactions'], ['defaulters', 'Defaulters'], ['generate', 'Generate semester fees']].map(([k, l]) => html`<button class="${tab === k ? 'active' : ''}" data-tab="${k}">${l}</button>`)}</div>`;
      let body;
      const qs = new URLSearchParams();
      for (const k of ['q', 'status', 'from', 'to']) if (params.get(k)) qs.set(k, params.get(k));
      if (tab === 'payments') {
        const rows = await api(`/admin/payments?${qs}`);
        const ok = rows.filter((r) => r.status === 'success');
        body = html`<div class="card"><form id="flt" class="toolbar">
          <label class="grow">Search<input name="q" value="${params.get('q') || ''}" placeholder="Name, enrollment, txn or receipt no."></label>
          <label>Status<select name="status"><option value="">All</option>${['success', 'pending', 'failed'].map((s) => html`<option ${params.get('status') === s ? 'selected' : ''}>${s}</option>`)}</select></label>
          <label>From<input type="date" name="from" value="${params.get('from') || ''}"></label><label>To<input type="date" name="to" value="${params.get('to') || ''}"></label>
          <button class="btn btn-ghost" type="submit">Filter</button><button class="btn btn-ghost" id="csv" type="button">⬇ CSV</button></form>
          <p class="small"><strong>${ok.length}</strong> successful transactions totalling <strong>${inr(ok.reduce((a, r) => a + r.amount, 0))}</strong></p>
          ${table([{ label: 'Date', render: (p) => fmtDateTime(p.paid_at || p.created_at) }, { label: 'Student', render: (p) => html`${p.name}<br><span class="tiny muted">${p.enrollment_no} · ${p.program}</span>` },
            { label: 'Txn / Receipt', render: (p) => html`<span class="tiny">${p.txn_id}</span><br>${p.receipt_no || ''}` }, { label: 'Mode', render: (p) => html`${p.mode}<br><span class="tiny muted">${p.gateway}</span>` },
            { label: 'Amount', render: (p) => inr(p.amount), num: true }, { label: 'Status', render: (p) => statusBadge(p.status) },
            { label: '', render: (p) => (p.status === 'success' ? html`<a href="/receipt?txn=${p.txn_id}" target="_blank" rel="noopener" class="small">Receipt</a>` : '') }], rows.slice(0, 400))}</div>`;
      } else if (tab === 'defaulters') {
        const rows = await api('/admin/fees/defaulters');
        body = html`<div class="card"><div class="toolbar"><span class="small"><strong>${rows.length}</strong> students owe <strong>${inr(rows.reduce((a, r) => a + r.due, 0))}</strong></span>
          <button class="btn btn-ghost" id="csv" type="button" style="margin-left:auto">⬇ Export CSV</button></div>
          ${table([{ label: 'Enrollment', key: 'enrollment_no' }, { label: 'Name', key: 'name' }, { label: 'Class', render: (r) => `${r.program} ${r.semester}-${r.section}` }, { label: 'Mobile', key: 'phone' },
            { label: 'Earliest due', render: (r) => html`${fmtDate(r.earliest_due)} ${r.earliest_due < todayISO() ? raw('<span class="badge badge-danger">Overdue</span>') : ''}` },
            { label: 'Due', render: (r) => html`<strong>${inr(r.due)}</strong>`, num: true }, { label: '', render: (r) => html`<button class="btn btn-ghost btn-sm" data-id="${r.id}" type="button">Open</button>` }], rows)}</div>`;
      } else {
        body = html`<div class="card" style="max-width:760px"><h2>Generate fee demand for a class</h2>
          <p class="small muted">Creates fee entries for every active student of the programme and semester. Entries that already exist for the same head are skipped. Hostel and transport heads apply only to students who use those facilities.</p>
          <form id="gf"><div class="grid-2"><label>Programme<select name="program_id">${programOptions()}</select></label><label>Semester<input type="number" name="semester" min="1" max="10" required></label></div>
          <div class="grid-2"><label>Academic year<input name="academic_year" value="${META.academicYear}" required></label><label>Due date<input type="date" name="due_date" required></label></div>
          <div id="heads">${[['Tuition Fee', 58500, 'all'], ['Development Fee', 6000, 'all'], ['Examination Fee', 2800, 'all'], ['Library & Laboratory Fee', 2500, 'all'], ['Hostel & Mess Fee', 48000, 'hostel'], ['Transport Fee', 16000, 'transport']]
            .map(([h, a, ap]) => html`<div class="grid-3"><label>Head<input data-h value="${h}"></label><label>Amount (₹)<input data-a type="number" value="${a}" min="0"></label>
              <label>Applies to<select data-p>${[['all', 'All students'], ['hostel', 'Hostel residents'], ['transport', 'Transport users']].map(([v, l]) => html`<option value="${v}" ${v === ap ? 'selected' : ''}>${l}</option>`)}</select></label></div>`)}</div>
          <button class="btn btn-primary" type="submit">Generate fees</button></form></div>`;
      }
      el.innerHTML = html`${tabs}${body}`;
      const refresh = () => reload(el, 'fees', { params });
      el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { location.hash = `#/fees?tab=${b.dataset.tab}`; }));
      const flt = el.querySelector('#flt');
      if (flt) flt.addEventListener('submit', (e) => { e.preventDefault(); const f = new URLSearchParams([...new FormData(e.target)].filter(([, v]) => v)); f.set('tab', tab); location.hash = `#/fees?${f}`; });
      const csv = el.querySelector('#csv');
      if (csv) csv.onclick = () => downloadUrl(tab === 'payments' ? `/admin/payments?${qs}&format=csv` : '/admin/fees/defaulters?format=csv');
      el.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => studentDetail(Number(b.dataset.id), refresh).catch(toastError)));
      const gf = el.querySelector('#gf');
      if (gf) onSubmit(gf, async (d) => {
        const heads = [...el.querySelectorAll('#heads .grid-3')].map((r) => ({ head: r.querySelector('[data-h]').value, amount: Number(r.querySelector('[data-a]').value), applies: r.querySelector('[data-p]').value })).filter((h) => h.head && h.amount > 0);
        toast((await api('/admin/fees/generate', { method: 'POST', body: { ...d, heads } })).message);
      });
    },
  },

  library: {
    title: 'Library', icon: '📚',
    async render(el, { params }) {
      const term = params.get('q') || '';
      const d = await api(`/admin/books?q=${encodeURIComponent(term)}`);
      el.innerHTML = html`<div class="cols"><div>
        <div class="card"><div class="card-head"><h2>Issued books (${d.issues.length})</h2></div>${table([{ label: 'Book', render: (i) => html`<strong>${i.title}</strong><br><span class="tiny muted">${i.accession_no}</span>` },
          { label: 'Student', render: (i) => html`${i.name}<br><span class="tiny muted">${i.enrollment_no}</span>` }, { label: 'Due', render: (i) => html`${fmtDate(i.due_on)} ${i.due_on < todayISO() ? raw('<span class="badge badge-danger">Overdue</span>') : ''}` },
          { label: '', render: (i) => html`<button class="btn btn-ghost btn-sm" data-ret="${i.id}" type="button">Return</button>` }], d.issues, { empty: 'No books issued' })}</div>
        <div class="card"><div class="card-head"><h2>Catalogue</h2><form id="sf" class="toolbar" style="margin:0"><input name="q" value="${term}" placeholder="Search" style="margin:0"><button class="btn btn-ghost" type="submit">Search</button></form></div>
          ${table([{ label: 'Acc. No.', key: 'accession_no' }, { label: 'Title', render: (b) => html`<strong>${b.title}</strong><br><span class="tiny muted">${b.author}</span>` }, { label: 'Category', key: 'category' },
            { label: 'Available', render: (b) => `${b.available}/${b.copies}`, num: true }], d.books)}</div></div>
        <div><div class="card"><h2>Issue a book</h2><form id="if"><label>Accession no.<input name="accession_no" required></label><label>Student enrollment no.<input name="enrollment_no" required></label>
          <label>Loan period (days)<input type="number" name="days" value="14" min="1" max="60"></label><button class="btn btn-primary" type="submit">Issue</button></form></div>
        <div class="card"><h2>Add book</h2><form id="bf"><label>Accession no.<input name="accession_no" required></label><label>Title<input name="title" required></label><label>Author<input name="author" required></label>
          <div class="grid-2"><label>Publisher<input name="publisher"></label><label>Category<input name="category"></label></div><label>Copies<input type="number" name="copies" value="1" min="1"></label>
          <button class="btn btn-primary" type="submit">Add book</button></form></div></div></div>`;
      const refresh = () => reload(el, 'library', { params });
      el.querySelector('#sf').addEventListener('submit', (e) => { e.preventDefault(); location.hash = `#/library?q=${encodeURIComponent(e.target.q.value)}`; });
      onSubmit(el.querySelector('#if'), async (d) => { toast((await api('/admin/books/issue', { method: 'POST', body: d })).message); refresh(); });
      onSubmit(el.querySelector('#bf'), async (d) => { toast((await api('/admin/books', { method: 'POST', body: d })).message); refresh(); });
      el.querySelectorAll('[data-ret]').forEach((b) => b.addEventListener('click', async () => { toast((await api(`/admin/books/return/${b.dataset.ret}`, { method: 'POST' })).message); refresh(); }));
    },
  },

  placements: {
    title: 'Placements', icon: '💼',
    async render(el) {
      const rows = await api('/admin/drives');
      const spec = [{ row: [{ name: 'company', label: 'Company', required: true }, { name: 'role', label: 'Job role', required: true }] },
        { row: [{ name: 'package_lpa', label: 'Package (LPA)', type: 'number', step: '0.01' }, { name: 'location', label: 'Location' }, { name: 'min_cgpa', label: 'Minimum CGPA', type: 'number', step: '0.1' }] },
        { row: [{ name: 'drive_date', label: 'Drive date', type: 'date' }, { name: 'last_date', label: 'Last date to apply', type: 'date', required: true }, { name: 'status', label: 'Status', type: 'select', options: ['open', 'closed'] }] },
        { name: 'eligibility', label: 'Eligible branches' }, { name: 'description', label: 'Details', type: 'textarea' }];
      const placed = rows.reduce((a, r) => a + r.selected, 0);
      el.innerHTML = html`<div class="stats">${stat('Drives', rows.length, `${rows.filter((r) => r.status === 'open').length} open`)}${stat('Applications', rows.reduce((a, r) => a + r.applicants, 0), 'All drives', 'info')}
        ${stat('Offers', placed, 'Students selected', 'good')}${stat('Highest Package', `${Math.max(0, ...rows.filter((r) => r.selected).map((r) => r.package_lpa || 0))} LPA`, 'This season', 'warn')}</div>
        <div class="card"><div class="toolbar"><button class="btn btn-primary" id="add" type="button">+ New drive</button></div>
        ${table([{ label: 'Company', render: (r) => html`<strong>${r.company}</strong><br><span class="tiny muted">${r.role}</span>` }, { label: 'Package', render: (r) => (r.package_lpa ? `${r.package_lpa} LPA` : '—') },
          { label: 'Last date', render: (r) => fmtDate(r.last_date) }, { label: 'Applicants', key: 'applicants', num: true }, { label: 'Selected', key: 'selected', num: true }, { label: 'Status', render: (r) => statusBadge(r.status) },
          { label: '', render: (r) => html`<button class="btn btn-ghost btn-sm" data-apps="${r.id}" type="button">Applicants</button> <button class="btn btn-ghost btn-sm" data-edit="${r.id}" type="button">Edit</button>` }], rows)}</div>`;
      const refresh = () => reload(el, 'placements');
      el.querySelector('#add').onclick = () => formModal('New placement drive', spec, { status: 'open', min_cgpa: 6 }, async (body) => { const r = await api('/admin/drives', { method: 'POST', body }); refresh(); return r; });
      el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => {
        const d = rows.find((x) => x.id === Number(b.dataset.edit));
        formModal(`Edit ${d.company}`, spec, d, async (body) => { const r = await api(`/admin/drives/${d.id}`, { method: 'PUT', body }); refresh(); return r; });
      }));
      el.querySelectorAll('[data-apps]').forEach((b) => b.addEventListener('click', async () => {
        const id = b.dataset.apps;
        const apps = await api(`/admin/drives/${id}/applications`);
        const m = modal(html`<h3>Applicants</h3><div class="toolbar"><button class="btn btn-ghost btn-sm" id="acsv" type="button">⬇ CSV</button></div>
          ${table([{ label: 'Name', render: (a) => html`${a.name}<br><span class="tiny muted">${a.enrollment_no} · ${a.program}</span>` }, { label: 'CGPA', key: 'cgpa', num: true },
            { label: 'Contact', render: (a) => html`<span class="tiny">${a.phone}<br>${a.email}</span>` },
            { label: 'Status', render: (a) => html`<select data-st="${a.student_id}" style="margin:0">${['applied', 'shortlisted', 'selected', 'rejected'].map((s) => html`<option ${a.status === s ? 'selected' : ''}>${s}</option>`)}</select>` }], apps, { empty: 'No applications yet' })}`.toString(), { wide: true, onClose: refresh });
        m.el.querySelector('#acsv').onclick = () => downloadUrl(`/admin/drives/${id}/applications?format=csv`);
        m.el.querySelectorAll('[data-st]').forEach((s) => s.addEventListener('change', async () => {
          try { toast((await api(`/admin/drives/${id}/applications/${s.dataset.st}`, { method: 'PUT', body: { status: s.value } })).message); } catch (err) { toastError(err); }
        }));
      }));
    },
  },

  content: {
    title: 'Website Content', icon: '📰',
    async render(el, { params }) {
      const tab = params.get('tab') || 'notices';
      const rows = await api(`/admin/${tab}`);
      const SPEC = {
        notices: [{ name: 'title', label: 'Title', required: true }, { name: 'body', label: 'Description', type: 'textarea', required: true },
          { row: [{ name: 'category', label: 'Category', type: 'select', options: ['General', 'Academic', 'Examination', 'Admission', 'Placement', 'Event', 'Fees'] },
            { name: 'audience', label: 'Visible to', type: 'select', options: [['public', 'Everyone (website)'], ['all', 'Students & faculty'], ['students', 'Students only'], ['faculty', 'Faculty only']] }] },
          { name: 'link', label: 'Link (optional)' }, { name: 'pinned', label: 'Pin to top', type: 'checkbox' }],
        events: [{ name: 'title', label: 'Title', required: true }, { name: 'description', label: 'Description', type: 'textarea' },
          { row: [{ name: 'category', label: 'Category', type: 'select', options: ['Event', 'Fest', 'Workshop', 'Seminar', 'Placement Drive', 'Examination', 'Sports', 'Holiday'] }, { name: 'venue', label: 'Venue' }] },
          { row: [{ name: 'start_date', label: 'Start date', type: 'date', required: true }, { name: 'end_date', label: 'End date', type: 'date' }] }],
        news: [{ name: 'title', label: 'Headline', required: true }, { name: 'summary', label: 'Summary', type: 'textarea', required: true }, { name: 'date', label: 'Date', type: 'date', required: true, value: todayISO() }],
      };
      const cols = {
        notices: [{ label: 'Title', render: (r) => html`${r.pinned ? '📌 ' : ''}<strong>${r.title}</strong>` }, { label: 'Category', key: 'category' }, { label: 'Audience', key: 'audience' }, { label: 'Published', render: (r) => fmtDate(r.published_at) }],
        events: [{ label: 'Title', render: (r) => html`<strong>${r.title}</strong>` }, { label: 'Category', key: 'category' }, { label: 'Dates', render: (r) => `${fmtDate(r.start_date)}${r.end_date && r.end_date !== r.start_date ? ` – ${fmtDate(r.end_date)}` : ''}` }, { label: 'Venue', key: 'venue' }],
        news: [{ label: 'Headline', render: (r) => html`<strong>${r.title}</strong>` }, { label: 'Date', render: (r) => fmtDate(r.date) }],
      }[tab];
      el.innerHTML = html`<div class="tabs">${[['notices', 'Notices'], ['events', 'Events'], ['news', 'News']].map(([k, l]) => html`<button class="${tab === k ? 'active' : ''}" data-tab="${k}">${l}</button>`)}</div>
        <div class="card"><div class="toolbar"><button class="btn btn-primary" id="add" type="button">+ New</button></div>
        ${table([...cols, { label: '', render: (r) => html`<button class="btn btn-ghost btn-sm" data-edit="${r.id}" type="button">Edit</button> <button class="btn btn-ghost btn-sm" data-del="${r.id}" type="button">Delete</button>` }], rows)}</div>`;
      const refresh = () => reload(el, 'content', { params });
      el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { location.hash = `#/content?tab=${b.dataset.tab}`; }));
      el.querySelector('#add').onclick = () => formModal('Create', SPEC[tab], {}, async (body) => { const r = await api(`/admin/${tab}`, { method: 'POST', body }); refresh(); return r; });
      el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => {
        const item = rows.find((x) => x.id === Number(b.dataset.edit));
        formModal('Edit', SPEC[tab], item, async (body) => { const r = await api(`/admin/${tab}/${item.id}`, { method: 'PUT', body }); refresh(); return r; });
      }));
      el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
        if (!(await confirmDialog('Delete this item?', { danger: true, ok: 'Delete' }))) return;
        toast((await api(`/admin/${tab}/${b.dataset.del}`, { method: 'DELETE' })).message);
        refresh();
      }));
    },
  },

  admissions: {
    title: 'Admission Enquiries', icon: '📥',
    async render(el, { params }) {
      const type = params.get('type') || 'admission';
      const rows = await api(`/admin/enquiries?type=${type}`);
      el.innerHTML = html`<div class="tabs">${[['admission', 'Admission enquiries'], ['contact', 'Contact messages']].map(([k, l]) => html`<button class="${type === k ? 'active' : ''}" data-tab="${k}">${l}</button>`)}</div>
        <div class="card"><div class="toolbar"><span class="small">${rows.filter((r) => r.status === 'new').length} new</span><button class="btn btn-ghost" id="csv" type="button" style="margin-left:auto">⬇ Export CSV</button></div>
        ${table([{ label: 'Received', render: (r) => fmtDateTime(r.created_at) }, { label: 'Name', render: (r) => html`<strong>${r.name}</strong><br><span class="tiny muted">${r.email}${r.phone ? ` · ${r.phone}` : ''}</span>` },
          ...(type === 'admission' ? [{ label: 'Programme', key: 'program' }, { label: 'City', key: 'city' }] : []), { label: 'Message', render: (r) => html`<span class="small">${r.message || ''}</span>` },
          { label: 'Status', render: (r) => html`<select data-st="${r.id}" style="margin:0">${['new', 'contacted', 'closed'].map((s) => html`<option ${r.status === s ? 'selected' : ''}>${s}</option>`)}</select>` }], rows, { empty: 'Nothing here yet' })}</div>`;
      el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { location.hash = `#/admissions?type=${b.dataset.tab}`; }));
      el.querySelector('#csv').onclick = () => downloadUrl(`/admin/enquiries?type=${type}&format=csv`);
      el.querySelectorAll('[data-st]').forEach((s) => s.addEventListener('change', async () => toast((await api(`/admin/enquiries/${s.dataset.st}`, { method: 'PUT', body: { status: s.value } })).message)));
    },
  },

  requests: {
    title: 'Helpdesk & Leaves', icon: '🛟',
    async render(el, { params }) {
      const tab = params.get('tab') || 'tickets';
      const rows = await api(tab === 'tickets' ? '/admin/grievances' : '/admin/leaves');
      el.innerHTML = html`<div class="tabs">${[['tickets', 'Grievance tickets'], ['leaves', 'Leave applications']].map(([k, l]) => html`<button class="${tab === k ? 'active' : ''}" data-tab="${k}">${l}</button>`)}</div>
        <div class="card">${tab === 'tickets' ? table([{ label: '#', key: 'id' }, { label: 'Raised by', render: (g) => html`${g.name}<br><span class="tiny muted">${g.role} · ${g.username}</span>` },
          { label: 'Ticket', render: (g) => html`<strong>${g.subject}</strong> <span class="badge">${g.category}</span><br><span class="small">${g.description}</span>` },
          { label: 'Status', render: (g) => statusBadge(g.status) }, { label: '', render: (g) => html`<button class="btn btn-ghost btn-sm" data-g="${g.id}" type="button">Respond</button>` }], rows, { empty: 'No tickets' })
        : table([{ label: 'Student', render: (l) => html`${l.name}<br><span class="tiny muted">${l.enrollment_no} · ${l.program} ${l.semester}-${l.section}</span>` },
          { label: 'Dates', render: (l) => `${fmtDate(l.from_date)} – ${fmtDate(l.to_date)}` }, { label: 'Reason', key: 'reason' }, { label: 'Status', render: (l) => statusBadge(l.status) },
          { label: '', render: (l) => (l.status === 'pending' ? html`<button class="btn btn-primary btn-sm" data-l="${l.id}" data-s="approved" type="button">Approve</button> <button class="btn btn-ghost btn-sm" data-l="${l.id}" data-s="rejected" type="button">Reject</button>` : l.remark || '') }], rows, { empty: 'No leave applications' })}</div>`;
      const refresh = () => reload(el, 'requests', { params });
      el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { location.hash = `#/requests?tab=${b.dataset.tab}`; }));
      el.querySelectorAll('[data-g]').forEach((b) => b.addEventListener('click', () => {
        const g = rows.find((x) => x.id === Number(b.dataset.g));
        formModal(`Ticket #${g.id}: ${g.subject}`, [{ name: 'status', label: 'Status', type: 'select', options: ['open', 'in-progress', 'resolved'] }, { name: 'response', label: 'Response to user', type: 'textarea' }], g,
          async (body) => { const r = await api(`/admin/grievances/${g.id}`, { method: 'PUT', body }); refresh(); return r; }, { wide: false });
      }));
      el.querySelectorAll('[data-l]').forEach((b) => b.addEventListener('click', async () => {
        const remark = b.dataset.s === 'rejected' ? window.prompt('Reason for rejection (optional)') || '' : 'Approved';
        toast((await api(`/admin/leaves/${b.dataset.l}`, { method: 'PUT', body: { status: b.dataset.s, remark } })).message);
        refresh();
      }));
    },
  },

  audit: {
    title: 'Activity Log', icon: '🧾',
    async render(el) {
      const rows = await api('/admin/audit');
      el.innerHTML = html`<div class="card"><p class="small muted">Latest 300 security and data-change events.</p>${table([{ label: 'Time', render: (r) => fmtDateTime(r.at) }, { label: 'User', render: (r) => r.name || '—' },
        { label: 'Action', render: (r) => html`<span class="badge badge-crimson">${r.action}</span>` }, { label: 'Details', render: (r) => html`<code class="tiny">${r.details || ''}</code>` }, { label: 'IP', key: 'ip' }], rows)}</div>`;
    },
  },
};
