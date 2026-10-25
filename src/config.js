'use strict';
const path = require('node:path');
const fs = require('node:fs');

// Load a simple .env file (KEY=VALUE per line) if present.
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const env = process.env;

module.exports = {
  port: Number(env.PORT) || 3000,
  dbFile: env.DB_FILE || path.join(__dirname, '..', 'data', 'kccitm.db'),
  isProduction: env.NODE_ENV === 'production',
  sessionDays: Number(env.SESSION_DAYS) || 7,
  // Payment gateway: "razorpay" when keys are configured, otherwise the built-in demo gateway.
  razorpay: {
    keyId: env.RAZORPAY_KEY_ID || '',
    keySecret: env.RAZORPAY_KEY_SECRET || '',
  },
  get paymentMode() {
    return this.razorpay.keyId && this.razorpay.keySecret ? 'razorpay' : 'demo';
  },
  // Minimum attendance (%) required for admit card eligibility.
  minAttendance: Number(env.MIN_ATTENDANCE) || 75,

  // Institute profile shown across the website, receipts, admit cards and marksheets.
  // Edit these values to match the official records before going live.
  institute: {
    name: 'KCC Institute of Technology & Management',
    shortName: 'KCCITM',
    tagline: 'Approved by AICTE · Affiliated to Dr. A.P.J. Abdul Kalam Technical University, Lucknow',
    university: 'Dr. A.P.J. Abdul Kalam Technical University (AKTU), Lucknow',
    established: 2008,
    address: '2B-2C, Knowledge Park-III, Greater Noida, Uttar Pradesh – 201306',
    phones: [env.INSTITUTE_PHONE || '+91-9971731071', env.INSTITUTE_PHONE_2 || '+91-9891070497'],
    emails: { admission: env.ADMISSION_EMAIL || 'admission@kccitm.edu.in', info: env.INFO_EMAIL || 'info@kccitm.edu.in' },
    website: 'https://www.kccitm.edu.in',
    officeHours: 'Monday – Saturday, 9:00 AM – 5:00 PM',
    mapQuery: 'KCC Institute of Technology and Management, Knowledge Park III, Greater Noida',
    social: {
      facebook: 'https://www.facebook.com/kccitm',
      instagram: 'https://www.instagram.com/kccitm',
      linkedin: 'https://www.linkedin.com/school/kccitm',
      youtube: 'https://www.youtube.com/@kccitm',
    },
  },
};
