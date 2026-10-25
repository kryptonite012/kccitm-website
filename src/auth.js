'use strict';
const crypto = require('node:crypto');
const config = require('./config');
const { q } = require('./db');
const { HttpError } = require('./util');

const COOKIE = 'kcc_session';

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(expected, actual);
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function createSession(res, userId, ip) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + config.sessionDays * 864e5);
  q.run('INSERT INTO sessions (token_hash, user_id, expires_at, ip) VALUES (?, ?, ?, ?)', sha256(token), userId, expires.toISOString(), ip || null);
  q.run("DELETE FROM sessions WHERE expires_at < ?", new Date().toISOString());
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${config.sessionDays * 86400}${config.isProduction ? '; Secure' : ''}`);
}

function destroySession(req, res) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token) q.run('DELETE FROM sessions WHERE token_hash = ?', sha256(token));
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

// Attaches req.user when a valid session cookie is present.
function loadUser(req, _res, next) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token) {
    const row = q.get(
      `SELECT u.id, u.role, u.username, u.name, u.email, u.phone, u.must_change_password, s.expires_at, s.token_hash
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND u.active = 1`,
      sha256(token),
    );
    if (row && row.expires_at > new Date().toISOString()) req.user = row;
  }
  next();
}

function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'Please sign in to continue'));
    if (roles.length && !roles.includes(req.user.role)) return next(new HttpError(403, 'You do not have access to this resource'));
    next();
  };
}

// Simple fixed-window limiter for login and public form endpoints.
function rateLimit({ windowMs, max, key = (req) => req.ip }) {
  const hits = new Map();
  return (req, _res, next) => {
    const now = Date.now();
    const k = key(req);
    const entry = hits.get(k);
    if (!entry || entry.reset < now) {
      hits.set(k, { count: 1, reset: now + windowMs });
    } else if (++entry.count > max) {
      return next(new HttpError(429, 'Too many attempts. Please wait a few minutes and try again.'));
    }
    if (hits.size > 10000) for (const [hk, v] of hits) if (v.reset < now) hits.delete(hk);
    next();
  };
}

function audit(req, action, details) {
  q.run('INSERT INTO audit_log (user_id, action, details, ip) VALUES (?, ?, ?, ?)',
    req.user ? req.user.id : null, action, details ? JSON.stringify(details) : null, req.ip || null);
}

module.exports = { hashPassword, verifyPassword, createSession, destroySession, loadUser, requireRole, rateLimit, audit };
