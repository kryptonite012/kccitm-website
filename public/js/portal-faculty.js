import { api, html, fmtDate, toast, modal, onSubmit, DAYS, todayISO } from './lib.js';
import { stat, pctBar, table, noticeList } from './ui.js';
import { helpdesk } from './portal-student.js';

const PERIOD_TIMES = [['09:00', '09:50'], ['09:50', '10:40'], ['10:50', '11:40'], ['11:40', '12:30'], ['13:20', '14:10'], ['14:10', '15:00']];

const classLabel = (c) => `${c.program_code} · Sem ${c.semester} · Sec ${c.section} — ${c.code} ${c.name}`;
const classOptions = (classes, selected) => classes.map((c) => html`<option value="${c.id}" ${String(c.id) === String(selected) ? 'selected' : ''}>${classLabel(c)}</option>`);

export const menu = [
  { group: 'Overview' }, 'dashboard', 'timetable',
  { group: 'Teaching' }, 'attendance', 'attendance-report', 'marks', 'assignments',
  { group: 'Communication' }, 'notices', 'helpdesk',
];

export const routes = {
  dashboard: {
    title: 'Dashboard', icon: '🏠',
    async render(el) {
      const d = await api('/faculty/dashboard');
      const p = d.profile;
      el.innerHTML = html`
        <div class="card"><div class="profile-head"><div class="avatar">${p.name.replace(/^(Dr|Mr|Ms)\.\s*/, '').split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>
          <div><h2 style="margin:0">Welcome, ${p.name}</h2><div class="muted small">${p.designation} · ${p.department} · ${p.employee_id}</div></div></div></div>
        <div class="stats">
          ${stat('Classes Assigned', d.classes.length, 'This semester')}
          ${stat('Students', d.classes.reduce((a, c) => a + c.strength, 0), 'Across all classes', 'info')}
          ${stat('Lectures Taken', d.classes.reduce((a, c) => a + c.lectures, 0), 'Attendance sessions recorded', 'good')}
          ${stat('To Grade', d.toGrade, 'Assignment submissions', d.toGrade ? 'warn' : 'good')}
        </div>
        <div class="cols"><div>
          <div class="card"><h2>📅 Today · ${DAYS[new Date().getDay()]}</h2>${d.today.length ? table([
            { label: 'Time', render: (r) => `${r.start_time}–${r.end_time}` }, { label: 'Class', render: (r) => `${r.program_code} Sem ${r.semester}-${r.section}` },
            { label: 'Subject', render: (r) => html`<strong>${r.code}</strong> ${r.name}` }, { label: 'Room', key: 'room' },
            { label: '', render: (r) => { const c = d.classes.find((x) => x.subject_id === r.subject_id && x.section === r.section); return c ? html`<a class="btn btn-primary btn-sm" href="#/attendance?class=${c.id}&period=${r.period}">Mark</a>` : ''; } }], d.today) : html`<div class="empty">No lectures scheduled today</div>`}</div>
          <div class="card"><h2>📚 My classes</h2>${table([{ label: 'Class', render: (c) => `${c.program_code} · Sem ${c.semester} · ${c.section}` },
            { label: 'Subject', render: (c) => html`<strong>${c.code}</strong> ${c.name}` }, { label: 'Students', key: 'strength', num: true }, { label: 'Lectures', key: 'lectures', num: true },
            { label: '', render: (c) => html`<a class="btn btn-ghost btn-sm" href="#/attendance-report?class=${c.id}">Report</a>` }], d.classes)}</div>
        </div><div class="card"><h2>📢 Notices</h2>${noticeList(d.notices)}</div></div>`;
    },
  },

  timetable: {
    title: 'My Timetable', icon: '🗓️',
    async render(el) {
      const rows = await api('/faculty/timetable');
      const by = new Map();
      for (const r of rows) by.set(`${r.day}-${r.period}`, [...(by.get(`${r.day}-${r.period}`) || []), r]);
      el.innerHTML = html`<div class="card"><div class="table-wrap"><table class="tt">
        <thead><tr><th>Day</th>${PERIOD_TIMES.map(([s, e], i) => html`<th>P${i + 1}<br><span class="tiny">${s}–${e}</span></th>`)}</tr></thead>
        <tbody>${[1, 2, 3, 4, 5, 6].map((d) => html`<tr><th>${DAYS[d].slice(0, 3)}</th>${PERIOD_TIMES.map((_, i) => {
          const cs = by.get(`${d}-${i + 1}`) || [];
          return cs.length ? html`<td>${cs.map((c) => html`<span class="code">${c.code}</span>${c.program_code} ${c.semester}-${c.section}<br><span class="tiny muted">${c.room}</span>`)}</td>` : html`<td class="muted">—</td>`;
        })}</tr>`)}</tbody></table></div></div>`;
    },
  },

  attendance: {
    title: 'Mark Attendance', icon: '✅',
    async render(el, { params }) {
      const classes = await api('/faculty/classes');
      if (!classes.length) { el.innerHTML = html`<div class="card"><div class="empty">No classes are allocated to you yet.</div></div>`; return; }
      const cls = params.get('class') || classes[0].id;
      const date = params.get('date') || todayISO();
      const period = params.get('period') || 1;
      const d = await api(`/faculty/classes/${cls}/roster?date=${date}&period=${period}`);
      const status = new Map(d.students.map((s) => [s.id, s.status || 'P']));
      el.innerHTML = html`
        <div class="card"><form id="pick" class="toolbar" style="margin:0">
          <label class="grow">Class<select name="class">${classOptions(classes, cls)}</select></label>
          <label>Date<input type="date" name="date" value="${date}" max="${todayISO()}"></label>
          <label>Period<select name="period">${[1, 2, 3, 4, 5, 6].map((p) => html`<option ${String(p) === String(period) ? 'selected' : ''}>${p}</option>`)}</select></label>
          <button class="btn btn-ghost" type="submit">Load</button></form></div>
        <div class="card">
          <div class="card-head"><h2>${d.class.code} · ${d.class.name} <span class="badge">${fmtDate(d.date)} · P${d.period}</span></h2>
            ${d.session ? html`<span class="badge badge-info">Already marked — editing</span>` : ''}</div>
          <div class="toolbar"><button class="btn btn-ghost btn-sm" data-all="P" type="button">All present</button><button class="btn btn-ghost btn-sm" data-all="A" type="button">All absent</button>
            <span class="muted small" id="count"></span></div>
          <div class="table-wrap att-grid"><table><thead><tr><th>Roll No.</th><th>Name</th><th>Status</th></tr></thead><tbody>
            ${d.students.map((s) => html`<tr><td>${s.roll_no}</td><td>${s.name}</td><td><div class="seg" data-id="${s.id}">
              ${['P', 'A', 'L'].map((k) => html`<button type="button" data-s="${k}" class="${status.get(s.id) === k ? 'on' : ''}">${k}</button>`)}</div></td></tr>`)}
          </tbody></table></div>
          <form id="save"><label class="mt">Topic covered<input name="topic" maxlength="200" value="${d.session ? d.session.topic || '' : ''}" placeholder="e.g. Unit 2 – Normalization"></label>
          <button class="btn btn-primary" type="submit">Save attendance</button></form>
        </div>`;
      const count = () => {
        const v = [...status.values()];
        el.querySelector('#count').textContent = `Present ${v.filter((x) => x !== 'A').length} · Absent ${v.filter((x) => x === 'A').length} · Total ${v.length}`;
      };
      const paint = () => el.querySelectorAll('.seg').forEach((seg) => seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', status.get(Number(seg.dataset.id)) === b.dataset.s)));
      el.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => { status.set(Number(b.parentElement.dataset.id), b.dataset.s); paint(); count(); }));
      el.querySelectorAll('[data-all]').forEach((b) => b.addEventListener('click', () => { for (const k of status.keys()) status.set(k, b.dataset.all); paint(); count(); }));
      count();
      el.querySelector('#pick').addEventListener('submit', (e) => {
        e.preventDefault();
        const f = e.target;
        location.hash = `#/attendance?class=${f.class.value}&date=${f.date.value}&period=${f.period.value}`;
      });
      onSubmit(el.querySelector('#save'), async (f) => {
        const r = await api('/faculty/attendance', { method: 'POST', body: { allocation_id: Number(cls), date: d.date, period: Number(d.period), topic: f.topic, records: [...status].map(([student_id, s]) => ({ student_id, status: s })) } });
        toast(r.message);
      });
    },
  },

  'attendance-report': {
    title: 'Attendance Report', icon: '📊',
    async render(el, { params }) {
      const classes = await api('/faculty/classes');
      if (!classes.length) { el.innerHTML = html`<div class="card"><div class="empty">No classes allocated.</div></div>`; return; }
      const cls = params.get('class') || classes[0].id;
      const d = await api(`/faculty/classes/${cls}/attendance-report`);
      const low = d.students.filter((s) => s.percent !== null && s.percent < 75);
      el.innerHTML = html`<div class="card"><label class="mb0">Class<select id="cls">${classOptions(classes, cls)}</select></label></div>
        <div class="stats">${stat('Lectures Held', d.sessions.length, 'This semester')}${stat('Students', d.students.length, 'In this class', 'info')}
          ${stat('Below 75%', low.length, 'Shortage students', low.length ? 'bad' : 'good')}</div>
        <div class="cols"><div class="card"><h2>Student-wise</h2>${table([{ label: 'Roll No.', key: 'roll_no' }, { label: 'Name', key: 'name' },
          { label: 'Attended', render: (s) => `${s.present}/${s.total}` }, { label: '%', render: (s) => pctBar(s.percent) }], d.students)}</div>
        <div class="card"><h2>Lectures</h2>${table([{ label: 'Date', render: (s) => fmtDate(s.date) }, { label: 'P', key: 'period' }, { label: 'Topic', key: 'topic' }], d.sessions.slice(0, 60))}</div></div>`;
      el.querySelector('#cls').addEventListener('change', (e) => { location.hash = `#/attendance-report?class=${e.target.value}`; });
    },
  },

  marks: {
    title: 'Internal Marks', icon: '🧮',
    async render(el, { params }) {
      const classes = await api('/faculty/classes');
      if (!classes.length) { el.innerHTML = html`<div class="card"><div class="empty">No classes allocated.</div></div>`; return; }
      const cls = params.get('class') || classes[0].id;
      const d = await api(`/faculty/classes/${cls}/marks`);
      el.innerHTML = html`<div class="card"><label class="mb0">Class<select id="cls">${classOptions(classes, cls)}</select></label></div>
        <div class="card"><div class="card-head"><h2>${d.class.code} · ${d.class.name}</h2><span class="badge">Internal max ${d.class.max_internal}</span></div>
        ${d.published ? html`<div class="alert alert-warn">Results for this class have already been published. Changes will apply only if results are re-published by the exam cell.</div>` : ''}
        <form id="mf">${table([{ label: 'Roll No.', key: 'roll_no' }, { label: 'Name', key: 'name' },
          { label: `Internal (/${d.class.max_internal})`, render: (s) => html`<input class="marks-input" type="number" step="0.5" min="0" max="${d.class.max_internal}" name="m${s.id}" value="${s.internal ?? ''}">` },
          { label: 'External', render: (s) => (s.external ?? html`<span class="muted small">By exam cell</span>`) }], d.students)}
        <div class="actions"><button class="btn btn-primary" type="submit">Save marks</button></div></form></div>`;
      el.querySelector('#cls').addEventListener('change', (e) => { location.hash = `#/marks?class=${e.target.value}`; });
      onSubmit(el.querySelector('#mf'), async () => {
        const marks = d.students.map((s) => ({ student_id: s.id, internal: el.querySelector(`[name=m${s.id}]`).value }));
        toast((await api(`/faculty/classes/${cls}/marks`, { method: 'POST', body: { marks } })).message);
      });
    },
  },

  assignments: {
    title: 'Assignments', icon: '📝',
    async render(el) {
      const [rows, classes] = await Promise.all([api('/faculty/assignments'), api('/faculty/classes')]);
      el.innerHTML = html`<div class="cols"><div class="card"><h2>Published assignments</h2>${table([
        { label: 'Title', render: (a) => html`<strong>${a.title}</strong><br><span class="tiny muted">${a.program_code} Sem ${a.semester}-${a.section} · ${a.code}</span>` },
        { label: 'Due', render: (a) => fmtDate(a.due_date) }, { label: 'Submissions', render: (a) => html`${a.submissions} ${a.ungraded ? html`<span class="badge badge-warn">${a.ungraded} to grade</span>` : ''}` },
        { label: '', render: (a) => html`<button class="btn btn-ghost btn-sm" data-view="${a.id}">Review</button> <button class="btn btn-ghost btn-sm" data-del="${a.id}">Delete</button>` }], rows, { empty: 'No assignments yet' })}</div>
        <div class="card"><h2>New assignment</h2><form id="af">
          <label>Class<select name="allocation_id" required>${classOptions(classes)}</select></label>
          <label>Title<input name="title" required maxlength="150"></label>
          <label>Instructions<textarea name="description" maxlength="3000"></textarea></label>
          <div class="grid-2"><label>Due date<input type="date" name="due_date" required min="${todayISO()}"></label><label>Max marks<input type="number" name="max_marks" value="10" min="1" max="100"></label></div>
          <button class="btn btn-primary" type="submit">Publish</button></form></div></div>`;
      onSubmit(el.querySelector('#af'), async (d) => { toast((await api('/faculty/assignments', { method: 'POST', body: d })).message); routes.assignments.render(el); });
      el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
        if (!window.confirm('Delete this assignment and all its submissions?')) return;
        toast((await api(`/faculty/assignments/${b.dataset.del}`, { method: 'DELETE' })).message);
        routes.assignments.render(el);
      }));
      el.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', async () => {
        const d = await api(`/faculty/assignments/${b.dataset.view}/submissions`);
        const m = modal(html`<h3>${d.assignment.title}</h3>${table([{ label: 'Roll', key: 'roll_no' }, { label: 'Name', key: 'name' },
          { label: 'Submission', render: (s) => (/^https?:\/\//.test(s.content) ? html`<a href="${s.content}" target="_blank" rel="noopener noreferrer">Open link</a>` : html`<span class="small">${s.content.slice(0, 160)}</span>`) },
          { label: 'Marks', render: (s) => html`<input class="marks-input" type="number" min="0" max="${d.assignment.max_marks}" step="0.5" data-sid="${s.student_id}" value="${s.marks ?? ''}">` },
          { label: '', render: (s) => html`<button class="btn btn-primary btn-sm" data-grade="${s.student_id}" type="button">Save</button>` }], d.submissions, { empty: 'No submissions yet' })}`.toString(), { wide: true });
        m.el.querySelectorAll('[data-grade]').forEach((g) => g.addEventListener('click', async () => {
          try {
            const marks = m.el.querySelector(`[data-sid="${g.dataset.grade}"]`).value;
            toast((await api(`/faculty/assignments/${d.assignment.id}/grade`, { method: 'POST', body: { student_id: Number(g.dataset.grade), marks } })).message);
          } catch (err) { toast(err.message, 'error'); }
        }));
      }));
    },
  },

  notices: {
    title: 'Notices', icon: '📢',
    async render(el) {
      const items = await api('/faculty/notices');
      el.innerHTML = html`<div class="cols"><div class="card"><h2>Notice board</h2>${noticeList(items)}</div>
        <div class="card"><h2>Post a notice to students</h2><form id="nf">
          <label>Title<input name="title" required maxlength="200"></label><label>Notice<textarea name="body" required maxlength="5000"></textarea></label>
          <button class="btn btn-primary" type="submit">Post</button></form></div></div>`;
      onSubmit(el.querySelector('#nf'), async (d) => { toast((await api('/faculty/notices', { method: 'POST', body: d })).message); routes.notices.render(el); });
    },
  },

  helpdesk: { title: 'Helpdesk', icon: '🛟', render: (el) => helpdesk(el) },
};
