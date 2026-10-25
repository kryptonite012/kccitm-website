'use strict';
const crypto = require('node:crypto');
const express = require('express');
const config = require('../config');
const { q } = require('../db');
const { wrap, fail, amountInWords } = require('../util');
const svc = require('../services');

const router = express.Router();

const MODES = ['UPI', 'Net Banking', 'Debit Card', 'Credit Card', 'Online'];

async function razorpayOrder(payment) {
  const auth = Buffer.from(`${config.razorpay.keyId}:${config.razorpay.keySecret}`).toString('base64');
  const r = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: payment.amount * 100, currency: 'INR', receipt: payment.txn_id }),
  });
  if (!r.ok) fail(502, 'Payment gateway is unavailable right now. Please try again later.');
  return r.json();
}

// Creates a pending payment and, for Razorpay, the matching gateway order.
async function startPayment(studentId, feeHeadIds, mode) {
  const payment = svc.createPayment(studentId, feeHeadIds, { mode: MODES.includes(mode) ? mode : 'Online' });
  const student = svc.studentProfile(studentId);
  const out = {
    txn_id: payment.txn_id,
    amount: payment.amount,
    gateway: config.paymentMode,
    student: { name: student.name, email: student.email, phone: student.phone, enrollment_no: student.enrollment_no },
  };
  if (config.paymentMode === 'razorpay') {
    const order = await razorpayOrder(payment);
    q.run('UPDATE payments SET gateway_order_id = ? WHERE id = ?', order.id, payment.id);
    Object.assign(out, { key: config.razorpay.keyId, order_id: order.id });
  }
  return out;
}

const byTxn = (txn) => {
  const p = q.get('SELECT * FROM payments WHERE txn_id = ?', String(txn || ''));
  if (!p) fail(404, 'Transaction not found');
  return p;
};

// Built-in sandbox gateway (used when no Razorpay keys are configured).
router.post('/:txn/demo-complete', wrap((req, res) => {
  if (config.paymentMode !== 'demo') fail(400, 'Demo payments are disabled');
  const p = byTxn(req.params.txn);
  if (req.body && req.body.outcome === 'failed') {
    if (p.status === 'pending') q.run("UPDATE payments SET status = 'failed', remarks = 'Cancelled by payer' WHERE id = ?", p.id);
    return res.json({ status: 'failed', txn_id: p.txn_id });
  }
  const method = ['UPI', 'Debit Card', 'Credit Card', 'Net Banking'].includes(req.body && req.body.method) ? req.body.method : null;
  if (method && p.status === 'pending') q.run('UPDATE payments SET mode = ? WHERE id = ?', method, p.id);
  const done = svc.completePayment(p.id, `DEMO${Date.now()}`);
  res.json({ status: done.status, txn_id: done.txn_id, receipt_no: done.receipt_no });
}));

router.post('/:txn/razorpay-verify', wrap((req, res) => {
  const p = byTxn(req.params.txn);
  const { razorpay_payment_id: pid, razorpay_order_id: oid, razorpay_signature: sig } = req.body || {};
  if (!pid || !oid || !sig || oid !== p.gateway_order_id) fail(400, 'Invalid payment response');
  const expected = crypto.createHmac('sha256', config.razorpay.keySecret).update(`${oid}|${pid}`).digest('hex');
  const ok = expected.length === String(sig).length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(sig)));
  if (!ok) {
    q.run("UPDATE payments SET status = 'failed', remarks = 'Signature mismatch' WHERE id = ? AND status = 'pending'", p.id);
    fail(400, 'Payment verification failed');
  }
  const done = svc.completePayment(p.id, pid);
  res.json({ status: done.status, txn_id: done.txn_id, receipt_no: done.receipt_no });
}));

// The transaction id is an unguessable token, so it doubles as the receipt link for Quick Pay users.
router.get('/:txn/receipt', wrap((req, res) => {
  const p = byTxn(req.params.txn);
  if (req.user && req.user.role === 'student' && req.user.id !== p.student_id) fail(403, 'Not your receipt');
  const r = svc.receipt(p.id);
  res.json({ ...r, amount_words: amountInWords(r.amount), institute: config.institute });
}));

module.exports = router;
module.exports.startPayment = startPayment;
