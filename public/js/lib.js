// Shared front-end helpers for the public site and the ERP portal.

class Raw {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);
export const raw = (s) => new Raw(String(s));

function renderValue(v) {
  if (v === null || v === undefined || v === false) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(renderValue).join('');
  return esc(v);
}

// Tagged template that escapes every interpolated value unless wrapped with raw()/html``.
export function html(strings, ...values) {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < values.length) out += renderValue(values[i]);
  });
  return new Raw(out);
}

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: { 'X-Requested-With': 'fetch', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export function fmtDate(s, opts = { day: '2-digit', month: 'short', year: 'numeric' }) {
  if (!s) return '—';
  // Plain dates are local; SQLite timestamps ("YYYY-MM-DD HH:MM:SS") are UTC.
  const d = new Date(s.length === 10 ? `${s}T00:00:00` : `${s.replace(' ', 'T')}${/Z|[+-]\d\d:?\d\d$/.test(s) ? '' : 'Z'}`);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('en-IN', opts);
}

export function fmtDateTime(s) {
  if (!s) return '—';
  const d = new Date(s.replace(' ', 'T') + 'Z');
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

// ── Toasts ──
export function toast(message, type = 'success') {
  let box = document.querySelector('.toasts');
  if (!box) {
    box = document.createElement('div');
    box.className = 'toasts';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    document.body.append(box);
  }
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = message;
  box.append(t);
  setTimeout(() => t.classList.add('hide'), 4200);
  setTimeout(() => t.remove(), 4700);
}

export const toastError = (err) => toast(err.message || String(err), 'error');

// ── Modal ──
export function modal(content, { wide = false, onClose } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `<div class="modal${wide ? ' modal-wide' : ''}" role="dialog" aria-modal="true">
    <button class="modal-close" type="button" aria-label="Close">×</button><div class="modal-body"></div></div>`;
  wrap.querySelector('.modal-body').innerHTML = content;
  const close = () => {
    wrap.remove();
    document.removeEventListener('keydown', onKey);
    if (onClose) onClose();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('.modal-close')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.append(wrap);
  const first = wrap.querySelector('input, select, textarea, button:not(.modal-close)');
  if (first) first.focus();
  return { el: wrap.querySelector('.modal-body'), close };
}

export function confirmDialog(message, { ok = 'Confirm', danger = false } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    const m = modal(html`<h3>Please confirm</h3><p class="muted">${message}</p>
      <div class="actions"><button class="btn btn-ghost" data-no>Cancel</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes>${ok}</button></div>`
      .toString(), { onClose: () => { if (!answered) resolve(false); } });
    m.el.querySelector('[data-yes]').onclick = () => { answered = true; m.close(); resolve(true); };
    m.el.querySelector('[data-no]').onclick = () => { answered = true; m.close(); resolve(false); };
  });
}

// Reads a form into a plain object (checkboxes become booleans).
export function formData(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'checkbox') out[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; } else out[el.name] = el.value;
  }
  return out;
}

// Wires a form to submit via fn(data); disables the button while busy.
export function onSubmit(form, fn) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = 'Please wait…'; }
    try {
      await fn(formData(form), form);
    } catch (err) {
      toastError(err);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label; }
    }
  });
}

export function downloadUrl(path) {
  const a = document.createElement('a');
  a.href = `/api${path}`;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
}

// ── Payments ──
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load the payment gateway. Check your internet connection.'));
    document.head.append(s);
  });
}

function demoGateway(order) {
  return new Promise((resolve) => {
    let settled = false;
    const m = modal(html`
      <div class="gateway">
        <div class="gateway-head">
          <div><strong>KCC SecurePay</strong><span class="badge badge-warn">Sandbox</span></div>
          <div class="gateway-amount">${inr(order.amount)}</div>
        </div>
        <p class="muted small">Paying for ${order.student.name} (${order.student.enrollment_no}) · Txn ${order.txn_id}</p>
        <div class="gateway-tabs" role="tablist">
          <button class="active" data-tab="upi" type="button">UPI</button>
          <button data-tab="card" type="button">Card</button>
          <button data-tab="nb" type="button">Net Banking</button>
        </div>
        <div class="gateway-pane" data-pane="upi"><label>UPI ID<input placeholder="yourname@okaxis" value="student@upi"></label></div>
        <div class="gateway-pane hidden" data-pane="card">
          <label>Card number<input inputmode="numeric" value="4111 1111 1111 1111"></label>
          <div class="grid-2"><label>Expiry<input value="12/30"></label><label>CVV<input value="123" type="password"></label></div>
        </div>
        <div class="gateway-pane hidden" data-pane="nb"><label>Bank<select><option>State Bank of India</option><option>HDFC Bank</option><option>ICICI Bank</option><option>Punjab National Bank</option><option>Axis Bank</option></select></label></div>
        <div class="actions"><button class="btn btn-ghost" data-cancel type="button">Cancel</button><button class="btn btn-primary" data-pay type="button">Pay ${inr(order.amount)}</button></div>
        <p class="tiny muted">Sandbox mode: no money is charged. Configure Razorpay keys on the server to accept live payments.</p>
      </div>`.toString(), {
      onClose: () => {
        if (settled) return;
        settled = true;
        api(`/payments/${order.txn_id}/demo-complete`, { method: 'POST', body: { outcome: 'failed' } }).catch(() => {});
        resolve({ status: 'failed' });
      },
    });
    m.el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
      m.el.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('active', x === b));
      m.el.querySelectorAll('[data-pane]').forEach((p) => p.classList.toggle('hidden', p.dataset.pane !== b.dataset.tab));
    }));
    m.el.querySelector('[data-cancel]').onclick = () => m.close();
    m.el.querySelector('[data-pay]').onclick = async (e) => {
      e.target.disabled = true;
      e.target.textContent = 'Processing…';
      try {
        const tab = m.el.querySelector('[data-tab].active').dataset.tab;
        const method = { upi: 'UPI', card: 'Debit Card', nb: 'Net Banking' }[tab];
        const r = await api(`/payments/${order.txn_id}/demo-complete`, { method: 'POST', body: { outcome: 'success', method } });
        settled = true;
        m.close();
        resolve(r);
      } catch (err) {
        toastError(err);
        e.target.disabled = false;
        e.target.textContent = `Pay ${inr(order.amount)}`;
      }
    };
  });
}

async function razorpayGateway(order, institute) {
  await loadScript('https://checkout.razorpay.com/v1/checkout.js');
  return new Promise((resolve) => {
    const rz = new window.Razorpay({
      key: order.key,
      amount: order.amount * 100,
      currency: 'INR',
      order_id: order.order_id,
      name: institute || 'KCC Institute of Technology & Management',
      description: `Fee payment · ${order.student.enrollment_no}`,
      prefill: { name: order.student.name, email: order.student.email || '', contact: order.student.phone || '' },
      theme: { color: '#8B1A1A' },
      handler: async (resp) => {
        try {
          resolve(await api(`/payments/${order.txn_id}/razorpay-verify`, { method: 'POST', body: resp }));
        } catch (err) {
          toastError(err);
          resolve({ status: 'failed' });
        }
      },
      modal: { ondismiss: () => resolve({ status: 'failed' }) },
    });
    rz.open();
  });
}

// Runs the checkout for an order returned by the server and shows the outcome.
export async function checkout(order, institute) {
  const result = order.gateway === 'razorpay' ? await razorpayGateway(order, institute) : await demoGateway(order);
  if (result.status === 'success') {
    modal(html`<div class="success-box">
      <div class="success-icon">✓</div>
      <h3>Payment Successful</h3>
      <p class="muted">${inr(order.amount)} received. Receipt No. <strong>${result.receipt_no}</strong></p>
      <p class="tiny muted">Transaction ID: ${result.txn_id}</p>
      <div class="actions center"><a class="btn btn-primary" href="/receipt?txn=${encodeURIComponent(result.txn_id)}" target="_blank" rel="noopener">View / Print Receipt</a></div>
    </div>`.toString());
  } else {
    toast('Payment was not completed. No amount has been deducted.', 'error');
  }
  return result;
}
