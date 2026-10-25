'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const config = require('./config');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('student','faculty','admin')),
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  last_login TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  hod TEXT
);

CREATE TABLE IF NOT EXISTS programs (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  degree TEXT NOT NULL,
  department_id INTEGER REFERENCES departments(id),
  duration_years INTEGER NOT NULL,
  total_semesters INTEGER NOT NULL,
  intake INTEGER,
  eligibility TEXT,
  description TEXT,
  icon TEXT
);

CREATE TABLE IF NOT EXISTS students (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enrollment_no TEXT NOT NULL UNIQUE,
  roll_no TEXT NOT NULL UNIQUE,
  program_id INTEGER NOT NULL REFERENCES programs(id),
  batch_year INTEGER NOT NULL,
  current_semester INTEGER NOT NULL,
  section TEXT NOT NULL DEFAULT 'A',
  dob TEXT,
  gender TEXT,
  father_name TEXT,
  mother_name TEXT,
  address TEXT,
  category TEXT,
  blood_group TEXT,
  hostel INTEGER NOT NULL DEFAULT 0,
  transport INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS faculty (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL UNIQUE,
  department_id INTEGER REFERENCES departments(id),
  designation TEXT,
  qualification TEXT,
  specialization TEXT,
  joined_on TEXT
);

CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  program_id INTEGER NOT NULL REFERENCES programs(id),
  semester INTEGER NOT NULL,
  credits INTEGER NOT NULL DEFAULT 3,
  type TEXT NOT NULL DEFAULT 'theory',
  max_internal INTEGER NOT NULL DEFAULT 30,
  max_external INTEGER NOT NULL DEFAULT 70,
  UNIQUE (code, program_id)
);

CREATE TABLE IF NOT EXISTS allocations (
  id INTEGER PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  faculty_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section TEXT NOT NULL DEFAULT 'A',
  UNIQUE (subject_id, section)
);

CREATE TABLE IF NOT EXISTS timetable (
  id INTEGER PRIMARY KEY,
  program_id INTEGER NOT NULL REFERENCES programs(id),
  semester INTEGER NOT NULL,
  section TEXT NOT NULL,
  day INTEGER NOT NULL CHECK (day BETWEEN 1 AND 6),
  period INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
  room TEXT,
  UNIQUE (program_id, semester, section, day, period)
);

CREATE TABLE IF NOT EXISTS attendance_sessions (
  id INTEGER PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  faculty_id INTEGER REFERENCES users(id),
  date TEXT NOT NULL,
  period INTEGER NOT NULL DEFAULT 1,
  topic TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (subject_id, section, date, period)
);

CREATE TABLE IF NOT EXISTS attendance_records (
  session_id INTEGER NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('P','A','L')),
  PRIMARY KEY (session_id, student_id)
);

CREATE TABLE IF NOT EXISTS marks (
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  internal REAL,
  external REAL,
  updated_by INTEGER REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (student_id, subject_id)
);

CREATE TABLE IF NOT EXISTS results (
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  semester INTEGER NOT NULL,
  academic_year TEXT NOT NULL,
  sgpa REAL NOT NULL,
  cgpa REAL NOT NULL,
  credits INTEGER NOT NULL,
  status TEXT NOT NULL,
  published_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (student_id, semester)
);

CREATE TABLE IF NOT EXISTS exam_schedule (
  id INTEGER PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  exam_type TEXT NOT NULL DEFAULT 'End Semester',
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  venue TEXT
);

CREATE TABLE IF NOT EXISTS fee_heads (
  id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  semester INTEGER NOT NULL,
  academic_year TEXT NOT NULL,
  head TEXT NOT NULL,
  amount INTEGER NOT NULL,
  concession INTEGER NOT NULL DEFAULT 0,
  due_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id, semester, head)
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY,
  txn_id TEXT NOT NULL UNIQUE,
  receipt_no TEXT UNIQUE,
  student_id INTEGER NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,
  mode TEXT NOT NULL,
  gateway TEXT NOT NULL,
  gateway_order_id TEXT,
  gateway_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','success','failed')),
  remarks TEXT,
  recorded_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at TEXT
);

CREATE TABLE IF NOT EXISTS payment_items (
  payment_id INTEGER NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  fee_head_id INTEGER NOT NULL REFERENCES fee_heads(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  PRIMARY KEY (payment_id, fee_head_id)
);

CREATE TABLE IF NOT EXISTS notices (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  audience TEXT NOT NULL DEFAULT 'public' CHECK (audience IN ('public','students','faculty','all')),
  pinned INTEGER NOT NULL DEFAULT 0,
  link TEXT,
  created_by INTEGER REFERENCES users(id),
  published_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'Event',
  start_date TEXT NOT NULL,
  end_date TEXT,
  venue TEXT
);

CREATE TABLE IF NOT EXISTS news (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  faculty_id INTEGER REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  due_date TEXT NOT NULL,
  max_marks INTEGER NOT NULL DEFAULT 10,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS submissions (
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  marks REAL,
  feedback TEXT,
  PRIMARY KEY (assignment_id, student_id)
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_date TEXT NOT NULL,
  to_date TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  remark TEXT,
  reviewed_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS grievances (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in-progress','resolved')),
  response TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY,
  accession_no TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  publisher TEXT,
  category TEXT,
  copies INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS book_issues (
  id INTEGER PRIMARY KEY,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issued_on TEXT NOT NULL,
  due_on TEXT NOT NULL,
  returned_on TEXT,
  fine INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS placement_drives (
  id INTEGER PRIMARY KEY,
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  package_lpa REAL,
  location TEXT,
  drive_date TEXT,
  last_date TEXT NOT NULL,
  eligibility TEXT,
  min_cgpa REAL NOT NULL DEFAULT 0,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed'))
);

CREATE TABLE IF NOT EXISTS drive_applications (
  drive_id INTEGER NOT NULL REFERENCES placement_drives(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('applied','shortlisted','selected','rejected')),
  applied_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (drive_id, student_id)
);

CREATE TABLE IF NOT EXISTS enquiries (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('admission','contact')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  program TEXT,
  city TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','closed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  action TEXT NOT NULL,
  details TEXT,
  ip TEXT,
  at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_students_class ON students(program_id, current_semester, section);
CREATE INDEX IF NOT EXISTS idx_att_records_student ON attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_fee_heads_student ON fee_heads(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
`;

function open(file = config.dbFile) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec(SCHEMA);
  return db;
}

let instance;

function get() {
  if (!instance) instance = open();
  return instance;
}

// Thin helpers so route code stays readable.
const q = {
  all: (sql, ...p) => get().prepare(sql).all(...p),
  get: (sql, ...p) => get().prepare(sql).get(...p),
  run: (sql, ...p) => get().prepare(sql).run(...p),
  tx(fn) {
    const db = get();
    db.exec('BEGIN IMMEDIATE');
    try {
      const out = fn();
      db.exec('COMMIT');
      return out;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  },
};

function setInstance(db) {
  instance = db;
}

module.exports = { open, get, setInstance, q };
