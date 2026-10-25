'use strict';
const path = require('node:path');
const express = require('express');
const config = require('./src/config');
const db = require('./src/db');
const { loadUser } = require('./src/auth');
const { HttpError } = require('./src/util');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self' https://checkout.razorpay.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com",
      "frame-src https://api.razorpay.com https://checkout.razorpay.com https://www.google.com",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '));
    if (config.isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });

  app.use(express.json({ limit: '200kb' }));
  app.use(loadUser);

  // CSRF defence: state-changing API calls must carry a custom header, which browsers
  // will not attach to cross-site requests without a CORS preflight (which we never allow).
  app.use('/api', (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('X-Requested-With') !== 'fetch') {
      return next(new HttpError(403, 'Invalid request origin'));
    }
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.use('/api', require('./src/routes/public'));
  app.use('/api/payments', require('./src/routes/payments'));
  app.use('/api/student', require('./src/routes/student'));
  app.use('/api/faculty', require('./src/routes/faculty'));
  app.use('/api/admin', require('./src/routes/admin'));
  app.use('/api/support', require('./src/routes/common'));
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found')));

  const pub = path.join(__dirname, 'public');
  app.use(express.static(pub, { extensions: ['html'], maxAge: config.isProduction ? '1h' : 0 }));
  app.get(['/portal', '/portal/*rest'], (_req, res) => res.sendFile(path.join(pub, 'portal.html')));
  app.use((req, res) => res.status(404).sendFile(path.join(pub, '404.html')));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    const status = err.status || (err.type === 'entity.parse.failed' ? 400 : 500);
    if (status >= 500) console.error(err);
    const message = status >= 500 ? 'Something went wrong. Please try again.' : err.message;
    if (req.path.startsWith('/api')) return res.status(status).json({ error: message });
    res.status(status).send(message);
  });

  return app;
}

if (require.main === module) {
  db.get();
  const { ensureSeeded } = require('./src/seed');
  ensureSeeded();
  createApp().listen(config.port, () => {
    console.log(`KCCITM portal running at http://localhost:${config.port} (payments: ${config.paymentMode} mode)`);
  });
}

module.exports = { createApp };
