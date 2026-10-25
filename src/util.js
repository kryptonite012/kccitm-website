'use strict';
const crypto = require('node:crypto');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const fail = (status, message) => {
  throw new HttpError(status, message);
};

// Wrap a sync/async route handler so thrown errors reach the error middleware.
const wrap = (fn) => (req, res, next) => {
  try {
    const out = fn(req, res, next);
    if (out && typeof out.catch === 'function') out.catch(next);
  } catch (err) {
    next(err);
  }
};

/**
 * Validate and coerce a request body against a small schema.
 * Rule format: { type: 'string'|'int'|'number'|'date'|'email'|'phone'|'bool'|'enum', required, max, min, values }
 */
function validate(body, schema) {
  const out = {};
  body = body || {};
  for (const [key, rule] of Object.entries(schema)) {
    let v = body[key];
    if (typeof v === 'string') v = v.trim();
    const empty = v === undefined || v === null || v === '';
    if (empty) {
      if (rule.required) fail(400, `${rule.label || key} is required`);
      out[key] = rule.default !== undefined ? rule.default : null;
      continue;
    }
    const label = rule.label || key;
    switch (rule.type || 'string') {
      case 'string':
        v = String(v);
        if (rule.max && v.length > rule.max) fail(400, `${label} must be at most ${rule.max} characters`);
        if (rule.min && v.length < rule.min) fail(400, `${label} must be at least ${rule.min} characters`);
        break;
      case 'int':
        v = Number(v);
        if (!Number.isInteger(v)) fail(400, `${label} must be a whole number`);
        if (rule.min !== undefined && v < rule.min) fail(400, `${label} must be ≥ ${rule.min}`);
        if (rule.max !== undefined && v > rule.max) fail(400, `${label} must be ≤ ${rule.max}`);
        break;
      case 'number':
        v = Number(v);
        if (!Number.isFinite(v)) fail(400, `${label} must be a number`);
        if (rule.min !== undefined && v < rule.min) fail(400, `${label} must be ≥ ${rule.min}`);
        if (rule.max !== undefined && v > rule.max) fail(400, `${label} must be ≤ ${rule.max}`);
        break;
      case 'date':
        v = String(v);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) fail(400, `${label} must be a valid date`);
        break;
      case 'email':
        v = String(v).toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || v.length > 120) fail(400, `${label} must be a valid email`);
        break;
      case 'phone':
        v = String(v).replace(/[\s-]/g, '');
        if (!/^(\+91)?[6-9]\d{9}$/.test(v)) fail(400, `${label} must be a valid 10-digit mobile number`);
        break;
      case 'bool':
        v = v === true || v === 'true' || v === 1 || v === '1' || v === 'on';
        break;
      case 'enum':
        if (!rule.values.includes(v)) fail(400, `${label} is invalid`);
        break;
      default:
        break;
    }
    out[key] = v;
  }
  return out;
}

// AKTU-style 10 point grading on percentage of total marks.
const GRADES = [
  { min: 90, grade: 'A+', point: 10 },
  { min: 80, grade: 'A', point: 9 },
  { min: 70, grade: 'B+', point: 8 },
  { min: 60, grade: 'B', point: 7 },
  { min: 50, grade: 'C', point: 6 },
  { min: 45, grade: 'D', point: 5 },
  { min: 40, grade: 'E', point: 4 },
  { min: 0, grade: 'F', point: 0 },
];

function gradeFor(total, max) {
  const pct = max > 0 ? (total / max) * 100 : 0;
  return GRADES.find((g) => pct >= g.min);
}

const round2 = (n) => Math.round(n * 100) / 100;

function academicYearFor(date = new Date()) {
  const y = date.getFullYear();
  const start = date.getMonth() >= 6 ? y : y - 1; // session starts in July
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

const today = () => new Date().toISOString().slice(0, 10);

function randomId(prefix, bytes = 5) {
  return `${prefix}${crypto.randomBytes(bytes).toString('hex').toUpperCase()}`;
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n) {
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ' ' + ONES[n % 10] : ''}`;
}

// Indian numbering system: crore, lakh, thousand, hundred.
function amountInWords(amount) {
  let n = Math.floor(amount);
  if (n === 0) return 'Rupees Zero Only';
  const parts = [];
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1e3); n %= 1e3;
  const hundred = Math.floor(n / 100); n %= 100;
  if (crore) parts.push(`${amountInWords(crore).replace(/^Rupees | Only$/g, '')} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (n) parts.push(twoDigits(n));
  return `Rupees ${parts.join(' ')} Only`;
}

module.exports = { HttpError, fail, wrap, validate, gradeFor, GRADES, round2, academicYearFor, today, randomId, amountInWords };
