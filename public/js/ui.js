import { html, raw, inr, fmtDate } from './lib.js';

export const stat = (label, value, sub, tone = '') => html`<div class="stat ${tone}"><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub || ''}</div></div>`;

export function pctBar(p, min = 75) {
  if (p === null || p === undefined) return html`<span class="muted small">No classes yet</span>`;
  const tone = p >= min ? '' : p >= min - 10 ? 'warn' : 'bad';
  return html`<div class="pct"><div class="bar ${tone}" style="flex:1"><span style="width:${Math.min(100, p)}%"></span></div><b>${p.toFixed(1)}%</b></div>`;
}

export const toneFor = (p, min = 75) => (p === null || p === undefined ? '' : p >= min ? 'good' : p >= min - 10 ? 'warn' : 'bad');

const STATUS_TONE = {
  success: 'success', paid: 'success', approved: 'success', resolved: 'success', selected: 'success', open: 'info', PASS: 'success',
  pending: 'warn', 'in-progress': 'warn', applied: 'info', shortlisted: 'warn', new: 'warn', contacted: 'info',
  failed: 'danger', rejected: 'danger', closed: '', active: 'success', 'passed-out': 'info', left: '', suspended: 'danger', P: 'success', A: 'danger', L: 'info',
};
export const statusBadge = (s) => html`<span class="badge badge-${STATUS_TONE[s] || (String(s).startsWith('BACK') ? 'danger' : '')}">${s}</span>`;

export function table(columns, rows, { empty = 'No records found', foot } = {}) {
  if (!rows.length) return html`<div class="table-wrap"><div class="empty">${empty}</div></div>`;
  return html`<div class="table-wrap"><table>
    <thead><tr>${columns.map((c) => html`<th class="${c.num ? 'num' : ''}">${c.label}</th>`)}</tr></thead>
    <tbody>${rows.map((r) => html`<tr>${columns.map((c) => html`<td class="${c.num ? 'num' : ''}">${c.render ? c.render(r) : r[c.key] ?? '—'}</td>`)}</tr>`)}</tbody>
    ${foot ? html`<tfoot>${foot}</tfoot>` : ''}
  </table></div>`;
}

export function docHeader(inst, title) {
  return html`<div class="doc-head"><img src="/img/logo.svg" alt="">
    <div><h2>${inst.name}</h2><p>${inst.tagline}</p><p>${inst.address}</p></div></div>
    <div class="doc-title">${title}</div>`;
}

export function noticeList(items) {
  if (!items.length) return html`<div class="empty">No notices</div>`;
  return html`<ul class="list">${items.map((n) => html`<li>
    <div class="title">${n.pinned ? raw('📌 ') : ''}${n.title} <span class="badge badge-crimson">${n.category}</span></div>
    <div class="small">${n.body}</div>
    <div class="meta">${fmtDate(n.published_at)}${n.author ? ` · ${n.author}` : ''}</div></li>`)}</ul>`;
}

export const money = inr;

export function semesterOptions(max = 8, selected) {
  return Array.from({ length: max }, (_, i) => i + 1).map((s) => html`<option value="${s}" ${s === Number(selected) ? 'selected' : ''}>Semester ${s}</option>`);
}
