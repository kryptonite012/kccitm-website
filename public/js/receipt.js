import { api, html, inr, fmtDateTime } from './lib.js';
import { docHeader, table } from './ui.js';

const GATEWAY = { demo: 'Online (sandbox)', razorpay: 'Online via Razorpay', counter: 'Accounts counter' };
const txn = new URLSearchParams(location.search).get('txn');
const box = document.querySelector('#receipt');
document.querySelector('#printBtn').addEventListener('click', () => window.print());

api(`/payments/${encodeURIComponent(txn || '')}/receipt`).then((r) => {
  if (r.status !== 'success') {
    box.innerHTML = html`<div class="doc"><div class="empty">This transaction is <strong>${r.status}</strong>. No receipt is available.</div></div>`;
    return;
  }
  document.title = `Receipt ${r.receipt_no} – KCCITM`;
  box.innerHTML = html`<div class="doc">
    ${docHeader(r.institute, 'Fee Receipt')}
    <div class="kv" style="margin-bottom:1rem">
      <div><div class="k">Receipt No.</div><div class="v">${r.receipt_no}</div></div>
      <div><div class="k">Date</div><div class="v">${fmtDateTime(r.paid_at)}</div></div>
      <div><div class="k">Student Name</div><div class="v">${r.name}</div></div>
      <div><div class="k">Enrollment / Roll No.</div><div class="v">${r.enrollment_no} / ${r.roll_no}</div></div>
      <div><div class="k">Programme</div><div class="v">${r.program_name}</div></div>
      <div><div class="k">Semester / Section</div><div class="v">${r.current_semester} / ${r.section}</div></div>
      <div><div class="k">Payment Mode</div><div class="v">${r.mode} · ${GATEWAY[r.gateway] || r.gateway}</div></div>
      <div><div class="k">Transaction ID</div><div class="v">${r.txn_id}</div></div>
      ${r.gateway_payment_id ? html`<div><div class="k">Bank / Gateway Ref.</div><div class="v">${r.gateway_payment_id}</div></div>` : ''}
    </div>
    ${table([{ label: '#', render: (i) => i.n }, { label: 'Particulars', render: (i) => `${i.head} – Semester ${i.semester} (${i.academic_year})` }, { label: 'Amount', render: (i) => inr(i.amount), num: true }],
      r.items.map((i, n) => ({ ...i, n: n + 1 })), { foot: html`<tr><td></td><td>Total</td><td class="num">${inr(r.amount)}</td></tr>` })}
    <p class="small mt"><strong>Amount in words:</strong> ${r.amount_words}</p>
    <p class="tiny muted">This is a computer-generated receipt and does not require a physical signature. For queries contact the accounts section: ${r.institute.emails.info}.</p>
    <div class="sign-row"><div>Student / Parent</div><div>Accounts Officer</div></div>
  </div>`;
}).catch((err) => {
  box.innerHTML = html`<div class="doc"><div class="empty">⚠️ ${err.message}</div></div>`;
});
