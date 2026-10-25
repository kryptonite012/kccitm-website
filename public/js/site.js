import { api, html, inr, fmtDate, toast, onSubmit, checkout, esc } from './lib.js';

const $ = (s) => document.querySelector(s);
const bindAll = (key, value) => document.querySelectorAll(`[data-bind="${key}"]`).forEach((el) => { el.innerHTML = value; });

$('#year').textContent = new Date().getFullYear();

// Mobile navigation
const nav = $('#siteNav');
$('#navToggle').addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  $('#navToggle').setAttribute('aria-expanded', String(open));
});
nav.addEventListener('click', (e) => { if (e.target.closest('a')) nav.classList.remove('open'); });

function renderPrograms(programs, filter) {
  const list = programs.filter((p) => filter === 'all' || p.degree === filter);
  $('#programGrid').innerHTML = list.map((p) => html`<article class="prog">
    <div class="ico" aria-hidden="true">${p.icon || '🎓'}</div>
    <h3>${p.degree} – ${p.name}</h3>
    <div class="meta">${p.duration_years} Years · ${p.department || ''}</div>
    <p>${p.description || ''}</p>
    <div class="tags">${p.intake ? html`<span class="badge badge-crimson">${p.intake} Seats</span>` : ''}<span class="badge badge-info">AICTE Approved</span><span class="badge">AKTU</span></div>
    <details class="small mt"><summary style="cursor:pointer;color:var(--crimson);font-weight:600">Eligibility</summary><p class="small mt">${p.eligibility || 'Contact the admission cell.'}</p></details>
  </article>`).join('');
}

async function loadSite() {
  const s = await api('/site');
  const inst = s.institute;

  bindAll('address', `📍 ${esc(inst.address.split(',').slice(1).join(',').trim() || inst.address)}`);
  bindAll('addressFull', esc(`${inst.name}, ${inst.address}`));
  bindAll('phones', inst.phones.map((p) => `<a href="tel:${esc(p.replace(/[^+\d]/g, ''))}">${esc(p)}</a>`).join('<br>'));
  bindAll('emails', Object.values(inst.emails).map((e) => `<a href="mailto:${esc(e)}">${esc(e)}</a>`).join('<br>'));
  bindAll('hours', esc(inst.officeHours));
  document.querySelectorAll('[data-bind="phone"]').forEach((a) => { a.href = `tel:${inst.phones[0].replace(/[^+\d]/g, '')}`; a.textContent = `📞 ${inst.phones[0]}`; });
  document.querySelectorAll('[data-bind="email"]').forEach((a) => { a.href = `mailto:${inst.emails.admission}`; a.textContent = `✉️ ${inst.emails.admission}`; });
  $('#map').src = `https://www.google.com/maps?q=${encodeURIComponent(inst.mapQuery)}&output=embed`;
  $('#social').innerHTML = Object.entries(inst.social).map(([k, v]) => html`<a href="${v}" target="_blank" rel="noopener">${k[0].toUpperCase() + k.slice(1)}</a>`).join('');

  const years = new Date().getFullYear() - inst.established;
  const stat = (k, v) => document.querySelectorAll(`[data-stat="${k}"]`).forEach((el) => { el.textContent = v; });
  stat('years', `${years}+`);
  stat('programs', s.stats.programs);
  stat('recruiters', s.recruiters.length ? `${s.recruiters.length}+` : '—');
  stat('highest', s.placements.highest ? `${s.placements.highest} LPA` : '—');
  if (s.stats.faculty) stat('faculty', `${s.stats.faculty}+ Faculty`);
  if (s.stats.books) stat('books', `${s.stats.books.toLocaleString('en-IN')}+ Books`);

  // Programmes
  let filter = 'all';
  renderPrograms(s.programs, filter);
  $('#progFilter').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    filter = b.dataset.f;
    $('#progFilter').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
    renderPrograms(s.programs, filter);
  });
  $('#enqProgram').innerHTML += s.programs.map((p) => html`<option>${p.degree} – ${p.name}</option>`).join('');

  // Notices
  const notices = s.notices;
  $('#heroNotices').innerHTML = notices.length ? notices.slice(0, 6).map((n) => html`<li><div class="date">${fmtDate(n.published_at)} · ${n.category}</div>${n.pinned ? '📌 ' : ''}${n.title}</li>`).join('') : '<li class="muted">No notices at the moment.</li>';
  const tick = notices.map((n) => html`<span>${n.title}</span>`).join('');
  $('#ticker').innerHTML = tick + tick;
  $('#noticeList').innerHTML = notices.length ? notices.map((n) => html`<li class="${n.pinned ? 'pinned' : ''}"><h4>${n.pinned ? '📌 ' : ''}${n.title}</h4><p>${n.body}</p>
    <div class="meta">${fmtDate(n.published_at)} · <span class="badge badge-crimson">${n.category}</span>${n.link ? html` · <a href="${n.link}" target="_blank" rel="noopener">Details</a>` : ''}</div></li>`).join('') : '<li class="muted">No notices.</li>';
  const admission = notices.find((n) => n.category === 'Admission');
  if (admission) $('#admissionPill').textContent = `★ ${admission.title.slice(0, 60)}`;

  $('#eventList').innerHTML = s.events.length ? s.events.map((e) => {
    const d = new Date(`${e.start_date}T00:00:00`);
    return html`<div><div class="event-date"><b>${d.getDate()}</b><small>${d.toLocaleString('en-IN', { month: 'short' })}</small></div>
      <div><h4>${e.title} <span class="badge">${e.category}</span></h4><p>${e.end_date && e.end_date !== e.start_date ? `${fmtDate(e.start_date)} – ${fmtDate(e.end_date)}` : fmtDate(e.start_date)}${e.venue ? ` · ${e.venue}` : ''}</p><p>${e.description || ''}</p></div></div>`;
  }).join('') : '<p class="muted">No upcoming events.</p>';
  $('#newsList').innerHTML = s.news.map((n) => html`<article><time>${fmtDate(n.date)}</time><h4>${n.title}</h4><p>${n.summary}</p></article>`).join('');

  // Placements
  $('#plHighest').textContent = s.placements.highest ?? '—';
  $('#plAverage').textContent = s.placements.average ?? '—';
  $('#plOffers').textContent = s.placements.offers || '—';
  $('#plRecruiters').textContent = s.recruiters.length || '—';
  $('#recruiters').innerHTML = s.recruiters.map((r) => html`<span>${r}</span>`).join('');
  return s;
}

const sitePromise = loadSite().catch((err) => toast(err.message, 'error'));

onSubmit($('#enquiryForm'), async (d, form) => {
  const r = await api('/enquiries', { method: 'POST', body: { ...d, type: 'admission' } });
  toast(r.message);
  form.reset();
});

onSubmit($('#contactForm'), async (d, form) => {
  const r = await api('/enquiries', { method: 'POST', body: d });
  toast(r.message);
  form.reset();
});

// Quick Pay
let qpCreds = null;
onSubmit($('#qpForm'), async (d) => {
  const r = await api('/quick-pay/lookup', { method: 'POST', body: d });
  qpCreds = d;
  const box = $('#qpResult');
  if (!r.heads.length) {
    box.innerHTML = html`<div class="qp-dues"><p><strong>${r.student.name}</strong> · ${r.student.program} · Sem ${r.student.semester}</p><div class="alert-success" style="padding:.8rem;border-radius:8px">✅ No pending dues. Thank you!</div></div>`;
    return;
  }
  box.innerHTML = html`<div class="qp-dues">
    <p><strong>${r.student.name}</strong><br><span class="small muted">${r.student.enrollment_no} · ${r.student.program} · Semester ${r.student.semester}</span></p>
    ${r.heads.map((h) => html`<label class="row check" style="margin:0"><span><input type="checkbox" value="${h.id}" checked> ${h.head} <span class="tiny muted">(Sem ${h.semester})</span></span><span>${inr(h.due)}</span></label>`)}
    <div class="row total"><span>Selected total</span><span id="qpTotal">${inr(r.due)}</span></div>
    <button class="btn btn-gold btn-block mt" id="qpPay" type="button">Proceed to pay</button></div>`;
  const update = () => {
    const ids = [...box.querySelectorAll('input:checked')].map((c) => Number(c.value));
    $('#qpTotal').textContent = inr(r.heads.filter((h) => ids.includes(h.id)).reduce((a, h) => a + h.due, 0));
    return ids;
  };
  box.addEventListener('change', update);
  $('#qpPay').addEventListener('click', async (e) => {
    const ids = update();
    if (!ids.length) return toast('Select at least one fee head', 'error');
    e.target.disabled = true;
    try {
      const order = await api('/quick-pay/order', { method: 'POST', body: { ...qpCreds, fee_head_ids: ids } });
      const s = await sitePromise;
      const res = await checkout(order, s && s.institute.name);
      if (res.status === 'success') box.innerHTML = '';
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      e.target.disabled = false;
    }
  });
});
