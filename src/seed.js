'use strict';
/**
 * Database seeding.
 *  - Base data (departments, programmes, subjects, admin account) is always created on first run.
 *  - Demo data (faculty, students, attendance, marks, fees, notices...) is added unless SEED_DEMO=false.
 *
 * CLI:  node src/seed.js --reset            wipe and reseed with demo data
 *       node src/seed.js --reset --no-demo  wipe and create a clean production database
 */
const fs = require('node:fs');
const config = require('./config');
const db = require('./db');
const { hashPassword } = require('./auth');
const { academicYearFor } = require('./util');

const { q } = db;

// Deterministic PRNG so demo data is the same on every machine.
function rng(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261025);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (min, max) => Math.round(min + rand() * (max - min));
const isoDate = (d) => d.toISOString().slice(0, 10);
const addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d; };

const DEPARTMENTS = [
  ['CSE', 'Computer Science & Engineering'],
  ['IT', 'Information Technology'],
  ['ECE', 'Electronics & Communication Engineering'],
  ['EE', 'Electrical Engineering'],
  ['ME', 'Mechanical Engineering'],
  ['CE', 'Civil Engineering'],
  ['ASH', 'Applied Sciences & Humanities'],
  ['MBA', 'Management Studies'],
];

const BTECH_ELIGIBILITY = '10+2 with Physics & Mathematics and Chemistry/Biology/Computer Science with minimum 45% (40% for reserved categories). Admission through AKTU counselling (JEE Main / CUET) and management quota.';
const PROGRAMS = [
  ['BT-CSE', 'Computer Science & Engineering', 'B.Tech', 'CSE', 4, 180, 'Programming, algorithms, systems and software engineering with electives in cloud computing, cyber security and full-stack development.', '💻'],
  ['BT-AIML', 'CSE (Artificial Intelligence & Machine Learning)', 'B.Tech', 'CSE', 4, 60, 'Core computer science with deep specialisation in machine learning, deep learning, NLP and computer vision.', '🤖'],
  ['BT-DS', 'CSE (Data Science)', 'B.Tech', 'CSE', 4, 60, 'Statistics, big data, data engineering and analytics with hands-on projects on real-world datasets.', '📊'],
  ['BT-IT', 'Information Technology', 'B.Tech', 'IT', 4, 60, 'Networks, databases, web and mobile technologies, and enterprise IT systems.', '🌐'],
  ['BT-ECE', 'Electronics & Communication Engineering', 'B.Tech', 'ECE', 4, 60, 'VLSI, embedded systems, IoT, signal processing and wireless communication.', '📡'],
  ['BT-EE', 'Electrical Engineering', 'B.Tech', 'EE', 4, 30, 'Power systems, electrical machines, control systems and renewable energy technologies.', '⚡'],
  ['BT-ME', 'Mechanical Engineering', 'B.Tech', 'ME', 4, 30, 'Design, thermal engineering, manufacturing, CAD/CAM and automobile engineering.', '⚙️'],
  ['BT-CE', 'Civil Engineering', 'B.Tech', 'CE', 4, 30, 'Structural, geotechnical, transportation and environmental engineering with site exposure.', '🏗️'],
  ['MBA', 'Master of Business Administration', 'MBA', 'MBA', 2, 60, 'Dual specialisation in Marketing, Finance, Human Resources, Operations and Business Analytics.', '📈'],
];

// [code, name, credits, type]
const FIRST_YEAR = {
  1: [['BAS101', 'Engineering Physics', 4], ['BAS103', 'Engineering Mathematics-I', 4], ['BEE101', 'Fundamentals of Electrical Engineering', 3],
    ['BCS101', 'Programming for Problem Solving', 3], ['BAS104', 'Environment and Ecology', 3], ['BCS151', 'Programming for Problem Solving Lab', 1, 'lab']],
  2: [['BAS202', 'Engineering Chemistry', 4], ['BAS203', 'Engineering Mathematics-II', 4], ['BEC201', 'Fundamentals of Electronics Engineering', 3],
    ['BME201', 'Fundamentals of Mechanical Engineering', 3], ['BAS205', 'Soft Skills', 2], ['BAS252', 'Engineering Chemistry Lab', 1, 'lab']],
};

const CS_CORE = {
  3: [['BCS301', 'Data Structures', 4], ['BCS302', 'Computer Organization and Architecture', 4], ['BCS303', 'Discrete Structures & Theory of Logic', 3],
    ['BOE310', 'Digital Electronics', 3], ['BVE301', 'Universal Human Values', 3], ['BCS351', 'Data Structures Lab', 1, 'lab']],
  4: [['BCS401', 'Operating Systems', 4], ['BCS402', 'Theory of Automata and Formal Languages', 4], ['BCS403', 'Object Oriented Programming with Java', 3],
    ['BAS403', 'Engineering Mathematics-IV', 4], ['BCS451', 'Operating Systems Lab', 1, 'lab'], ['BCS452', 'Java Programming Lab', 1, 'lab']],
  5: [['BCS501', 'Database Management System', 4], ['BCS502', 'Web Technology', 4], ['BCS503', 'Design and Analysis of Algorithms', 4],
    ['BCS054', 'Object Oriented System Design with C++', 3], ['BCS551', 'DBMS Lab', 1, 'lab'], ['BCS552', 'Web Technology Lab', 1, 'lab']],
  6: [['BCS601', 'Software Engineering', 4], ['BCS602', 'Compiler Design', 4], ['BCS603', 'Computer Networks', 4],
    ['BCS061', 'Big Data', 3], ['BCS651', 'Software Engineering Lab', 1, 'lab'], ['BCS653', 'Computer Networks Lab', 1, 'lab']],
  7: [['BCS701', 'Artificial Intelligence', 3], ['BCS072', 'Cryptography and Network Security', 3], ['BCS074', 'Cloud Computing', 3],
    ['BOE074', 'Renewable Energy Resources', 3], ['BCS752', 'Internship Assessment', 2, 'lab'], ['BCS753', 'Project-I', 4, 'lab']],
  8: [['BOE081', 'Entrepreneurship Development', 3], ['BCS084', 'Blockchain Architecture Design', 3], ['BCS851', 'Project-II', 9, 'lab']],
};

const SPECIALISATION = {
  'BT-AIML': { 5: [3, ['BAM055', 'Machine Learning Techniques', 3]], 6: [3, ['BAM061', 'Deep Learning', 3]], 7: [2, ['BAM071', 'Natural Language Processing', 3]] },
  'BT-DS': { 5: [3, ['BDS055', 'Data Analytics', 3]], 6: [3, ['BDS061', 'Data Visualization', 3]], 7: [2, ['BDS071', 'Statistical Learning', 3]] },
  'BT-IT': { 5: [3, ['BIT055', 'Mobile Application Development', 3]], 6: [3, ['BIT061', 'Information Security', 3]], 7: [2, ['BIT071', 'Internet of Things', 3]] },
};

const BRANCH = {
  'BT-ECE': {
    3: [['BEC301', 'Electronic Devices', 4], ['BEC302', 'Digital System Design', 4], ['BEC303', 'Signal and System', 4], ['BEC304', 'Network Analysis and Synthesis', 3], ['BVE301', 'Universal Human Values', 3], ['BEC351', 'Electronic Devices Lab', 1, 'lab']],
    4: [['BEC401', 'Communication Engineering', 4], ['BEC402', 'Analog Circuits', 4], ['BEC403', 'Electromagnetic Field Theory', 3], ['BAS403', 'Engineering Mathematics-IV', 4], ['BEC451', 'Communication Lab', 1, 'lab'], ['BEC452', 'Analog Circuits Lab', 1, 'lab']],
    5: [['BEC501', 'Integrated Circuits', 4], ['BEC502', 'Microprocessor & Microcontroller', 4], ['BEC503', 'Digital Signal Processing', 4], ['BEC054', 'Optical Communication', 3], ['BEC551', 'Integrated Circuits Lab', 1, 'lab'], ['BEC552', 'Microprocessor Lab', 1, 'lab']],
    6: [['BEC601', 'Digital Communication', 4], ['BEC602', 'Control System', 4], ['BEC603', 'Antenna and Wave Propagation', 4], ['BEC061', 'VLSI Design', 3], ['BEC651', 'Digital Communication Lab', 1, 'lab'], ['BEC652', 'Control System Lab', 1, 'lab']],
    7: [['BEC071', 'Embedded Systems', 3], ['BEC072', 'Wireless and Mobile Communication', 3], ['BEC073', 'IoT Applications', 3], ['BOE074', 'Renewable Energy Resources', 3], ['BEC752', 'Internship Assessment', 2, 'lab'], ['BEC753', 'Project-I', 4, 'lab']],
  },
  'BT-EE': {
    3: [['BEE301', 'Electrical Measurements & Instrumentation', 4], ['BEE302', 'Basic Signals & Systems', 4], ['BEE303', 'Electromagnetic Field Theory', 3], ['BOE310', 'Digital Electronics', 3], ['BVE301', 'Universal Human Values', 3], ['BEE351', 'Measurements Lab', 1, 'lab']],
    4: [['BEE401', 'Electrical Machines-I', 4], ['BEE402', 'Network Analysis & Synthesis', 4], ['BEE403', 'Power System-I', 3], ['BAS403', 'Engineering Mathematics-IV', 4], ['BEE451', 'Electrical Machines Lab-I', 1, 'lab'], ['BEE452', 'Networks Lab', 1, 'lab']],
    5: [['BEE501', 'Power System-II', 4], ['BEE502', 'Control System', 4], ['BEE503', 'Electrical Machines-II', 4], ['BEE054', 'Special Electrical Machines', 3], ['BEE551', 'Control System Lab', 1, 'lab'], ['BEE552', 'Electrical Machines Lab-II', 1, 'lab']],
    6: [['BEE601', 'Power Electronics', 4], ['BEE602', 'Microprocessor & Microcontroller', 4], ['BEE603', 'Power System Protection', 4], ['BEE061', 'Electric Drives', 3], ['BEE651', 'Power Electronics Lab', 1, 'lab'], ['BEE652', 'Microprocessor Lab', 1, 'lab']],
    7: [['BEE071', 'Smart Grid', 3], ['BEE072', 'Electric Vehicles', 3], ['BEE073', 'HVDC Transmission', 3], ['BOE074', 'Renewable Energy Resources', 3], ['BEE752', 'Internship Assessment', 2, 'lab'], ['BEE753', 'Project-I', 4, 'lab']],
  },
  'BT-ME': {
    3: [['BME301', 'Thermodynamics', 4], ['BME302', 'Fluid Mechanics & Fluid Machines', 4], ['BME303', 'Materials Engineering', 3], ['BME304', 'Engineering Mechanics', 3], ['BVE301', 'Universal Human Values', 3], ['BME351', 'Fluid Mechanics Lab', 1, 'lab']],
    4: [['BME401', 'Applied Thermodynamics', 4], ['BME402', 'Engineering Mechanics II', 4], ['BME403', 'Manufacturing Processes', 3], ['BAS403', 'Engineering Mathematics-IV', 4], ['BME451', 'Applied Thermodynamics Lab', 1, 'lab'], ['BME452', 'Manufacturing Lab', 1, 'lab']],
    5: [['BME501', 'Heat & Mass Transfer', 4], ['BME502', 'Strength of Materials', 4], ['BME503', 'Industrial Engineering', 4], ['BME054', 'Automobile Engineering', 3], ['BME551', 'Heat Transfer Lab', 1, 'lab'], ['BME552', 'Machine Drawing Lab', 1, 'lab']],
    6: [['BME601', 'Refrigeration & Air Conditioning', 4], ['BME602', 'Machine Design', 4], ['BME603', 'Theory of Machines', 4], ['BME061', 'Computer Aided Design', 3], ['BME651', 'RAC Lab', 1, 'lab'], ['BME652', 'Theory of Machines Lab', 1, 'lab']],
    7: [['BME071', 'Power Plant Engineering', 3], ['BME072', 'Operations Research', 3], ['BME073', 'Additive Manufacturing', 3], ['BOE074', 'Renewable Energy Resources', 3], ['BME752', 'Internship Assessment', 2, 'lab'], ['BME753', 'Project-I', 4, 'lab']],
  },
  'BT-CE': {
    3: [['BCE301', 'Building Materials & Construction', 4], ['BCE302', 'Engineering Mechanics', 4], ['BCE303', 'Surveying & Geomatics', 3], ['BCE304', 'Fluid Mechanics', 3], ['BVE301', 'Universal Human Values', 3], ['BCE351', 'Surveying Lab', 1, 'lab']],
    4: [['BCE401', 'Structural Analysis', 4], ['BCE402', 'Hydraulic Engineering', 4], ['BCE403', 'Concrete Technology', 3], ['BAS403', 'Engineering Mathematics-IV', 4], ['BCE451', 'Concrete Lab', 1, 'lab'], ['BCE452', 'Hydraulics Lab', 1, 'lab']],
    5: [['BCE501', 'Geotechnical Engineering', 4], ['BCE502', 'Structural Analysis II', 4], ['BCE503', 'Quantity Estimation & Management', 4], ['BCE054', 'Water Resources Engineering', 3], ['BCE551', 'Geotechnical Lab', 1, 'lab'], ['BCE552', 'CAD Lab', 1, 'lab']],
    6: [['BCE601', 'Design of Concrete Structures', 4], ['BCE602', 'Transportation Engineering', 4], ['BCE603', 'Environmental Engineering', 4], ['BCE061', 'Bridge Engineering', 3], ['BCE651', 'Environmental Lab', 1, 'lab'], ['BCE652', 'Transportation Lab', 1, 'lab']],
    7: [['BCE071', 'Design of Steel Structures', 3], ['BCE072', 'Earthquake Engineering', 3], ['BCE073', 'Construction Management', 3], ['BOE074', 'Renewable Energy Resources', 3], ['BCE752', 'Internship Assessment', 2, 'lab'], ['BCE753', 'Project-I', 4, 'lab']],
  },
  MBA: {
    1: [['BMB101', 'Management Concepts & Applications', 3], ['BMB102', 'Managerial Economics', 3], ['BMB103', 'Accounting for Managers', 3], ['BMB104', 'Business Statistics & Analytics', 3], ['BMB105', 'Marketing Management', 3], ['BMB106', 'Business Communication', 3]],
    2: [['BMB201', 'Organizational Behaviour', 3], ['BMB202', 'Financial Management', 3], ['BMB203', 'Human Resource Management', 3], ['BMB204', 'Operations Management', 3], ['BMB205', 'Business Research Methods', 3], ['BMB206', 'Business Environment & Law', 3]],
    3: [['BMB301', 'Strategic Management', 3], ['BMB302', 'Digital Marketing', 3], ['BMB303', 'Investment Analysis & Portfolio Management', 3], ['BMB304', 'Talent Management', 3], ['BMB305', 'Supply Chain Management', 3], ['BMB351', 'Summer Training Report', 4, 'lab']],
    4: [['BMB401', 'Entrepreneurship', 3], ['BMB402', 'Corporate Governance & Ethics', 3], ['BMB403', 'International Business', 3], ['BMB451', 'Research Project', 6, 'lab']],
  },
};

function subjectsFor(code, sem) {
  if (code === 'MBA') return BRANCH.MBA[sem] || [];
  if (sem <= 2) return FIRST_YEAR[sem];
  let list = BRANCH[code] ? BRANCH[code][sem] : CS_CORE[sem];
  if (!list && sem === 8) list = CS_CORE[8];
  list = [...(list || [])];
  const spec = SPECIALISATION[code] && SPECIALISATION[code][sem];
  if (spec) list[spec[0]] = spec[1];
  return list;
}

function seedBase({ adminPassword, adminMustChange } = {}) {
  q.tx(() => {
    for (const [code, name] of DEPARTMENTS) q.run('INSERT INTO departments (code, name) VALUES (?, ?)', code, name);
    const dept = Object.fromEntries(q.all('SELECT id, code FROM departments').map((d) => [d.code, d.id]));
    for (const [code, name, degree, dcode, years, intake, description, icon] of PROGRAMS) {
      const sems = years * 2;
      const r = q.run(
        `INSERT INTO programs (code, name, degree, department_id, duration_years, total_semesters, intake, eligibility, description, icon)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        code, name, degree, dept[dcode], years, sems, intake,
        degree === 'MBA' ? 'Graduation in any discipline with minimum 50% (45% for reserved categories) and a valid CUET-PG / CAT / MAT / CMAT score.' : BTECH_ELIGIBILITY,
        description, icon,
      );
      const pid = Number(r.lastInsertRowid);
      for (let sem = 1; sem <= sems; sem++) {
        for (const [scode, sname, credits, type = 'theory'] of subjectsFor(code, sem)) {
          const lab = type === 'lab';
          q.run('INSERT INTO subjects (code, name, program_id, semester, credits, type, max_internal, max_external) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            scode, sname, pid, sem, credits, type, lab ? 50 : 30, lab ? 50 : 70);
        }
      }
    }
    q.run("INSERT INTO users (role, username, password_hash, name, email, must_change_password) VALUES ('admin', 'admin', ?, 'Administrator', ?, ?)",
      hashPassword(adminPassword), config.institute.emails.info, adminMustChange ? 1 : 0);
  });
}

const FIRST = ['Aarav', 'Vivaan', 'Aditya', 'Arjun', 'Sai', 'Reyansh', 'Krishna', 'Ishaan', 'Shaurya', 'Atharv', 'Ananya', 'Diya', 'Saanvi', 'Aadhya',
  'Pari', 'Anika', 'Navya', 'Myra', 'Sara', 'Kavya', 'Rohan', 'Kunal', 'Harsh', 'Nikhil', 'Rahul', 'Priya', 'Sneha', 'Pooja', 'Riya', 'Tanya',
  'Yash', 'Dev', 'Kartik', 'Aman', 'Vansh', 'Muskan', 'Khushi', 'Simran', 'Shruti', 'Nandini', 'Mohit', 'Abhishek', 'Ritika', 'Ayush', 'Lakshay'];
const LAST = ['Sharma', 'Verma', 'Gupta', 'Singh', 'Yadav', 'Chauhan', 'Agarwal', 'Mishra', 'Tiwari', 'Pandey', 'Srivastava', 'Kumar', 'Jain',
  'Saxena', 'Rastogi', 'Bhati', 'Nagar', 'Tyagi', 'Rawat', 'Malik', 'Chaudhary', 'Dubey', 'Shukla', 'Rajput', 'Goel'];
const FEMALE = new Set(['Ananya', 'Diya', 'Saanvi', 'Aadhya', 'Pari', 'Anika', 'Navya', 'Myra', 'Sara', 'Kavya', 'Priya', 'Sneha', 'Pooja', 'Riya',
  'Tanya', 'Muskan', 'Khushi', 'Simran', 'Shruti', 'Nandini', 'Ritika']);
const CITIES = ['Greater Noida', 'Noida', 'Ghaziabad', 'Delhi', 'Meerut', 'Bulandshahr', 'Aligarh', 'Agra', 'Hapur', 'Mathura', 'Faridabad', 'Bareilly'];

const FACULTY = {
  CSE: ['Dr. Rajesh Kumar Sharma', 'Dr. Neha Gupta', 'Mr. Amit Verma', 'Ms. Shweta Singh', 'Mr. Vikas Tyagi', 'Ms. Pooja Agarwal', 'Dr. Manoj Kumar Mishra', 'Mr. Sandeep Yadav'],
  IT: ['Dr. Sunil Kumar', 'Ms. Ritu Saxena', 'Mr. Gaurav Jain'],
  ECE: ['Dr. Alok Srivastava', 'Ms. Kavita Rawat', 'Mr. Deepak Chauhan', 'Ms. Anjali Pandey'],
  EE: ['Dr. Prakash Tiwari', 'Mr. Rakesh Nagar', 'Ms. Monika Sharma'],
  ME: ['Dr. Vinod Kumar Singh', 'Mr. Arvind Bhati', 'Mr. Sachin Malik'],
  CE: ['Dr. Sanjay Goel', 'Ms. Preeti Shukla', 'Mr. Rohit Chaudhary'],
  ASH: ['Dr. Meenakshi Dubey', 'Dr. Ashok Kumar Pandey', 'Ms. Swati Rastogi', 'Dr. Ravi Shankar Mishra'],
  MBA: ['Dr. Shalini Agarwal', 'Dr. Nitin Saxena', 'Ms. Garima Jain'],
};
const DESIGNATIONS = ['Professor & Head', 'Associate Professor', 'Assistant Professor', 'Assistant Professor', 'Assistant Professor', 'Associate Professor', 'Assistant Professor', 'Assistant Professor'];

const PERIODS = [['09:00', '09:50'], ['09:50', '10:40'], ['10:50', '11:40'], ['11:40', '12:30'], ['13:20', '14:10'], ['14:10', '15:00']];

function seedDemo() {
  const now = new Date();
  const year = academicYearFor(now);
  const startYear = Number(year.slice(0, 4));
  const oddSemester = now.getMonth() >= 6; // July–December
  const semStart = oddSemester ? new Date(startYear, 7, 1) : new Date(startYear + 1, 0, 15);
  const facultyHash = hashPassword('Faculty@123');
  const studentHash = hashPassword('Student@123');
  const dept = Object.fromEntries(q.all('SELECT id, code FROM departments').map((d) => [d.code, d.id]));
  const programs = q.all('SELECT * FROM programs ORDER BY id');

  q.tx(() => {
    // Faculty
    let fno = 1;
    const facultyByDept = {};
    for (const [dcode, names] of Object.entries(FACULTY)) {
      facultyByDept[dcode] = [];
      names.forEach((name, i) => {
        const empId = `KCCF${String(fno++).padStart(3, '0')}`;
        const first = name.replace(/^(Dr\.|Mr\.|Ms\.)\s+/, '').split(' ')[0].toLowerCase();
        const r = q.run("INSERT INTO users (role, username, password_hash, name, email, phone) VALUES ('faculty', ?, ?, ?, ?, ?)",
          empId, facultyHash, name, `${first}.${empId.toLowerCase()}@kccitm.edu.in`, `98${between(10000000, 99999999)}`);
        const id = Number(r.lastInsertRowid);
        q.run('INSERT INTO faculty (user_id, employee_id, department_id, designation, qualification, specialization, joined_on) VALUES (?, ?, ?, ?, ?, ?, ?)',
          id, empId, dept[dcode], DESIGNATIONS[i % DESIGNATIONS.length], name.startsWith('Dr.') ? 'Ph.D.' : (dcode === 'MBA' ? 'MBA, UGC-NET' : 'M.Tech'),
          { CSE: 'Machine Learning', IT: 'Computer Networks', ECE: 'VLSI Design', EE: 'Power Systems', ME: 'Thermal Engineering', CE: 'Structural Engineering', ASH: 'Applied Mathematics', MBA: 'Marketing & Finance' }[dcode],
          isoDate(new Date(2009 + (i * 2) % 15, (i * 5) % 12, 1 + i)));
        facultyByDept[dcode].push(id);
      });
    }

    // Students: one batch per running semester.
    const semesters = oddSemester ? [1, 3, 5, 7] : [2, 4, 6, 8];
    const allStudents = [];
    for (const p of programs) {
      const sems = semesters.filter((s) => s <= p.total_semesters);
      const sections = p.code === 'BT-CSE' ? ['A', 'B'] : ['A'];
      const perSection = p.code === 'BT-CSE' ? 8 : 6;
      for (const sem of sems) {
        const batch = startYear - Math.floor((sem - 1) / 2);
        const yy = String(batch).slice(2);
        const bcode = p.code.replace('BT-', '');
        let n = 1;
        for (const section of sections) {
          for (let k = 0; k < perSection; k++) {
            const first = pick(FIRST);
            const last = pick(LAST);
            const enrollment = `${yy}KCC${bcode}${String(n).padStart(3, '0')}`;
            const roll = `${yy}0492${String(p.id).padStart(2, '0')}${String(n).padStart(4, '0')}`;
            n++;
            const email = `${first.toLowerCase()}.${enrollment.toLowerCase()}@kccitm.edu.in`;
            const r = q.run("INSERT INTO users (role, username, password_hash, name, email, phone) VALUES ('student', ?, ?, ?, ?, ?)",
              enrollment, studentHash, `${first} ${last}`, email, `${pick(['9', '8', '7'])}${between(100000000, 999999999)}`);
            const id = Number(r.lastInsertRowid);
            const dob = isoDate(new Date(batch - 18, between(0, 11), between(1, 28)));
            const hostel = rand() < 0.3 ? 1 : 0;
            q.run(`INSERT INTO students (user_id, enrollment_no, roll_no, program_id, batch_year, current_semester, section, dob, gender,
                     father_name, mother_name, address, category, blood_group, hostel, transport)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            id, enrollment, roll, p.id, batch, sem, section, dob, FEMALE.has(first) ? 'Female' : 'Male',
            `${pick(['Ramesh', 'Suresh', 'Rajendra', 'Mahesh', 'Vinod', 'Anil', 'Sanjay', 'Ashok'])} ${last}`,
            `${pick(['Sunita', 'Geeta', 'Rekha', 'Anita', 'Seema', 'Kiran', 'Meena', 'Usha'])} ${last}`,
            `${between(1, 250)}, Sector ${between(1, 60)}, ${pick(CITIES)}, Uttar Pradesh`, pick(['General', 'General', 'OBC', 'OBC', 'SC', 'EWS']),
            pick(['A+', 'B+', 'O+', 'AB+', 'A-', 'O-']), hostel, hostel ? 0 : (rand() < 0.45 ? 1 : 0));
            const star = n === 2; // first student of each batch is a strong, regular student (used for demos)
            allStudents.push({ id, program: p, sem, section, ability: star ? 0.86 : 0.45 + rand() * 0.5, attendance: star ? 0.93 : 0.62 + rand() * 0.36, batch });
          }
        }
      }
    }

    // Allocations: current-semester subjects get a teacher per section.
    const subjects = q.all('SELECT s.*, p.code AS pcode FROM subjects s JOIN programs p ON p.id = s.program_id');
    const deptOfProgram = (code) => ({ 'BT-CSE': 'CSE', 'BT-AIML': 'CSE', 'BT-DS': 'CSE', 'BT-IT': 'IT', 'BT-ECE': 'ECE', 'BT-EE': 'EE', 'BT-ME': 'ME', 'BT-CE': 'CE', MBA: 'MBA' }[code]);
    const classes = [];
    for (const p of programs) {
      for (const sem of semesters.filter((s) => s <= p.total_semesters)) {
        for (const section of p.code === 'BT-CSE' ? ['A', 'B'] : ['A']) classes.push({ p, sem, section });
      }
    }
    let rr = 0;
    for (const c of classes) {
      const subs = subjects.filter((s) => s.program_id === c.p.id && s.semester === c.sem);
      const pool = c.sem <= 2 && c.p.code !== 'MBA' ? [...facultyByDept.ASH, ...facultyByDept[deptOfProgram(c.p.code)]] : facultyByDept[deptOfProgram(c.p.code)];
      for (const s of subs) q.run('INSERT INTO allocations (subject_id, faculty_id, section) VALUES (?, ?, ?)', s.id, pool[rr++ % pool.length], c.section);
      // Timetable: 6 days x 6 periods, rotating through the class's subjects.
      const theory = subs.filter((s) => s.type === 'theory');
      const labs = subs.filter((s) => s.type === 'lab');
      for (let day = 1; day <= 6; day++) {
        for (let period = 1; period <= 6; period++) {
          if (day === 6 && period > 4) continue;
          let sub;
          if (period >= 5 && labs.length && day % 2 === 1) sub = labs[(day + period) % labs.length];
          else sub = theory[(day * 2 + period) % Math.max(theory.length, 1)];
          if (!sub) continue;
          const room = sub.type === 'lab' ? `Lab-${c.p.id}${(day % 3) + 1}` : `${c.p.code === 'MBA' ? 'M' : 'A'}-${100 * Math.ceil(c.sem / 2) + c.p.id}${c.section === 'B' ? 'B' : ''}`;
          q.run('INSERT INTO timetable (program_id, semester, section, day, period, start_time, end_time, subject_id, room) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            c.p.id, c.sem, c.section, day, period, PERIODS[period - 1][0], PERIODS[period - 1][1], sub.id, room);
        }
      }
    }

    // Attendance for the running semester, from semester start until yesterday.
    const tt = q.all('SELECT t.*, a.faculty_id FROM timetable t JOIN allocations a ON a.subject_id = t.subject_id AND a.section = t.section');
    const roster = {};
    for (const s of allStudents) (roster[`${s.program.id}-${s.sem}-${s.section}`] ||= []).push(s);
    const topics = ['Introduction & overview', 'Fundamental concepts', 'Problem solving session', 'Case study discussion', 'Numericals & examples',
      'Unit revision', 'Class test', 'Practical demonstration', 'Tutorial', 'Doubt clearing session'];
    for (let d = new Date(semStart); d < addDays(now, -0.5); d = addDays(d, 1)) {
      const dow = d.getDay();
      if (dow === 0) continue;
      const date = isoDate(d);
      for (const slot of tt.filter((t) => t.day === dow)) {
        const r = q.run('INSERT OR IGNORE INTO attendance_sessions (subject_id, section, faculty_id, date, period, topic) VALUES (?, ?, ?, ?, ?, ?)',
          slot.subject_id, slot.section, slot.faculty_id, date, slot.period, pick(topics));
        if (!r.changes) continue;
        const sid = Number(r.lastInsertRowid);
        for (const s of roster[`${slot.program_id}-${slot.semester}-${slot.section}`] || []) {
          const roll = rand();
          q.run('INSERT INTO attendance_records (session_id, student_id, status) VALUES (?, ?, ?)', sid, s.id,
            roll < s.attendance ? 'P' : roll < s.attendance + 0.02 ? 'L' : 'A');
        }
      }
    }

    // Marks and published results for all completed semesters; internal marks only for the running one.
    const subjectsOf = (pid, sem) => subjects.filter((s) => s.program_id === pid && s.semester === sem);
    for (const s of allStudents) {
      for (let sem = 1; sem <= s.sem; sem++) {
        const running = sem === s.sem;
        for (const sub of subjectsOf(s.program.id, sem)) {
          const perf = Math.min(1, Math.max(0.25, s.ability + (rand() - 0.5) * 0.3));
          const internal = Math.round(sub.max_internal * Math.min(1, perf + 0.1));
          const external = running ? null : Math.round(sub.max_external * perf);
          if (running && rand() < 0.4) continue; // internal marks still being entered
          q.run('INSERT INTO marks (student_id, subject_id, internal, external) VALUES (?, ?, ?, ?)', s.id, sub.id, internal, external);
        }
      }
    }
  });

  const { publishResults } = require('./services');
  for (const p of programs) {
    for (let sem = 1; sem < p.total_semesters; sem++) publishResults(p.id, sem);
  }
  // Odd-semester results are declared around March, even-semester results around August.
  q.run(`UPDATE results SET published_at = (SELECT CASE WHEN results.semester % 2 = 1
           THEN (s.batch_year + (results.semester + 1) / 2) || '-03-15 11:00:00'
           ELSE (s.batch_year + results.semester / 2) || '-08-10 11:00:00' END
           FROM students s WHERE s.user_id = results.student_id)`);
  // Re-stamp academic years on historic results.
  q.run(`UPDATE results SET academic_year = (SELECT (s.batch_year + (results.semester - 1) / 2) || '-' || substr(s.batch_year + (results.semester - 1) / 2 + 1, 3, 2)
           FROM students s WHERE s.user_id = results.student_id)`);

  seedFees(year, semStart, now);
  seedContent(now);
  q.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('demo', '1')");
}

const FEE_STRUCTURE = {
  'B.Tech': [['Tuition Fee', 58500], ['Development Fee', 6000], ['Examination Fee', 2800], ['Library & Laboratory Fee', 2500]],
  MBA: [['Tuition Fee', 52000], ['Development Fee', 5000], ['Examination Fee', 2800], ['Library & Laboratory Fee', 2000]],
};

function seedFees(year, semStart, now) {
  const students = q.all('SELECT s.*, p.degree FROM students s JOIN programs p ON p.id = s.program_id');
  const { createPayment, completePayment } = require('./services');
  const modes = ['UPI', 'UPI', 'Net Banking', 'Debit Card', 'Credit Card'];
  for (const s of students) {
    for (let sem = 1; sem <= s.current_semester; sem++) {
      const ay = `${s.batch_year + Math.floor((sem - 1) / 2)}-${String((s.batch_year + Math.floor((sem - 1) / 2) + 1) % 100).padStart(2, '0')}`;
      const due = sem === s.current_semester ? isoDate(addDays(semStart, 30)) : (sem % 2 ? `${ay.slice(0, 4)}-08-31` : `${Number(ay.slice(0, 4)) + 1}-02-15`);
      const heads = [...FEE_STRUCTURE[s.degree === 'MBA' ? 'MBA' : 'B.Tech']];
      if (s.hostel) heads.push(['Hostel & Mess Fee', 48000]);
      if (s.transport) heads.push(['Transport Fee', 16000]);
      for (const [head, amount] of heads) {
        q.run('INSERT INTO fee_heads (student_id, semester, academic_year, head, amount, concession, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
          s.user_id, sem, sem === s.current_semester ? year : ay, head, amount,
          head === 'Tuition Fee' && s.category === 'SC' ? 15000 : 0, due);
      }
    }
    // Past semesters fully paid; running semester: ~55% paid, ~15% partial, rest pending.
    const heads = q.all('SELECT * FROM fee_heads WHERE student_id = ? ORDER BY semester, id', s.user_id);
    for (let sem = 1; sem <= s.current_semester; sem++) {
      const ids = heads.filter((h) => h.semester === sem).map((h) => h.id);
      const current = sem === s.current_semester;
      const roll = rand();
      let pay = ids;
      if (current && roll > 0.7) continue;
      if (current && roll > 0.55) pay = ids.slice(0, 1);
      const p = createPayment(s.user_id, pay, { mode: pick(modes) });
      completePayment(p.id, `DEMO${p.id}`);
      const paidAt = current ? addDays(semStart, between(2, Math.max(3, Math.floor((now - semStart) / 864e5) - 1))) : new Date(`${heads.find((h) => h.semester === sem).due_date}T10:00:00`);
      paidAt.setHours(between(9, 16), between(0, 59), between(0, 59));
      const ts = paidAt.toISOString().replace('T', ' ').slice(0, 19);
      q.run('UPDATE payments SET created_at = ?, paid_at = ? WHERE id = ?', ts, ts, p.id);
    }
  }
  // Receipt numbers in payment-date order.
  const rows = q.all("SELECT id, paid_at FROM payments WHERE status = 'success' ORDER BY paid_at, id");
  q.tx(() => {
    q.run('UPDATE payments SET receipt_no = NULL');
    const counters = {};
    for (const r of rows) {
      const y = r.paid_at.slice(0, 4);
      counters[y] = (counters[y] || 0) + 1;
      q.run('UPDATE payments SET receipt_no = ? WHERE id = ?', `KCC/${y}/${String(counters[y]).padStart(6, '0')}`, r.id);
    }
  });
}

function seedContent(now) {
  const d = (n) => isoDate(addDays(now, n));
  const admin = q.get("SELECT id FROM users WHERE role = 'admin'").id;
  q.tx(() => {
    const notices = [
      ['Admissions Open for B.Tech & MBA – Session ' + academicYearFor(addDays(now, 300)), 'Applications are invited for admission to B.Tech (CSE, CSE-AIML, CSE-DS, IT, ECE, EE, ME, CE) and MBA programmes. Apply online or visit the admission cell at the campus. Merit scholarships are available for eligible candidates.', 'Admission', 'public', 1, -2],
      ['Mid-Term (Sessional) Examination Schedule Released', 'The sessional examination schedule for all odd-semester classes has been published on the student portal. Students must carry their ID card and download the admit card from the portal.', 'Examination', 'all', 1, -4],
      ['Last Date for Semester Fee Payment', 'Students with pending semester dues are requested to pay through the Student Portal or Quick Pay before the due date to avoid a late fee and exam debarment.', 'Fees', 'students', 0, -6],
      ['Campus Recruitment Drive – Leading IT Companies', 'Pre-final and final year students of B.Tech (all branches) and MBA should register for upcoming placement drives through the Placements section of the student portal.', 'Placement', 'public', 0, -8],
      ['Diwali Holidays', 'The institute will remain closed for Diwali festivities. Classes will resume as per the academic calendar.', 'General', 'all', 0, -10],
      ['Anti-Ragging Committee & Helpline', 'Ragging in any form is strictly prohibited. Students can report incidents through the Grievance section of the portal or the national anti-ragging helpline 1800-180-5522.', 'General', 'public', 0, -30],
      ['Faculty Development Programme on Outcome Based Education', 'All faculty members are requested to attend the FDP on OBE and NBA accreditation process in the Seminar Hall.', 'Academic', 'faculty', 0, -3],
      ['Library Timings Extended During Examinations', 'The Central Library will remain open from 8:00 AM to 8:00 PM during the examination period.', 'Academic', 'students', 0, -5],
    ];
    for (const [title, body, cat, aud, pinned, off] of notices) {
      q.run('INSERT INTO notices (title, body, category, audience, pinned, created_by, published_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        title, body, cat, aud, pinned, admin, `${d(off)} 10:00:00`);
    }
    const news = [
      ['KCCITM Students Shine at Smart India Hackathon', 'A team of B.Tech CSE students reached the grand finale of Smart India Hackathon with an AI-based crop disease detection solution.', -12],
      ['MoU Signed for Industry-Academia Collaboration', 'The institute signed an MoU with a leading IT services company to provide internships, live projects and certification programmes for students.', -25],
      ['Workshop on Generative AI and Cloud Technologies', 'Industry experts conducted a two-day hands-on workshop on Generative AI, prompt engineering and cloud deployment for pre-final year students.', -40],
      ['Annual Sports Meet Concludes with Record Participation', 'Over 600 students participated across cricket, football, basketball, athletics and indoor games during the annual sports meet.', -55],
    ];
    for (const [title, summary, off] of news) q.run('INSERT INTO news (title, summary, date) VALUES (?, ?, ?)', title, summary, d(off));
    const events = [
      ['Mid-Term Sessional Examinations', 'Sessional examinations for all odd-semester B.Tech and MBA classes.', 'Examination', 15, 20, 'Academic Blocks'],
      ['IGNITE – Annual Tech & Cultural Fest', 'Hackathon, robotics, coding contests, cultural nights and celebrity performances.', 'Fest', 30, 32, 'Main Campus'],
      ['Campus Placement Drive', 'On-campus recruitment drive for final year students (all branches).', 'Placement Drive', 10, 10, 'Placement Cell, Block A'],
      ['Entrepreneurship Development Programme', 'Three-day EDP in association with MSME on startups, funding and business planning.', 'Workshop', 22, 24, 'Seminar Hall'],
      ['National Mathematics Day Seminar', 'Guest lecture and quiz competition celebrating the legacy of Srinivasa Ramanujan.', 'Seminar', 58, 58, 'Auditorium'],
    ];
    for (const [title, desc, cat, s, e, venue] of events) {
      q.run('INSERT INTO events (title, description, category, start_date, end_date, venue) VALUES (?, ?, ?, ?, ?, ?)', title, desc, cat, d(s), d(e), venue);
    }

    // Exam schedule (mid-term) for every running-semester subject.
    const running = q.all(`SELECT DISTINCT sub.id, sub.type FROM subjects sub JOIN students s ON s.program_id = sub.program_id AND s.current_semester = sub.semester`);
    const counter = {};
    for (const sub of running.filter((x) => x.type === 'theory')) {
      const key = q.get('SELECT program_id || \'-\' || semester AS k FROM subjects WHERE id = ?', sub.id).k;
      const idx = (counter[key] = (counter[key] || 0) + 1);
      let date = addDays(now, 14 + idx);
      if (date.getDay() === 0) date = addDays(date, 1);
      q.run("INSERT INTO exam_schedule (subject_id, exam_type, date, start_time, end_time, venue) VALUES (?, 'Mid Term', ?, ?, ?, ?)",
        sub.id, isoDate(date), idx % 2 ? '10:00' : '14:00', idx % 2 ? '11:30' : '15:30', `Block ${'ABC'[idx % 3]} – Exam Hall`);
    }

    // Library
    const books = [
      ['Introduction to Algorithms', 'Cormen, Leiserson, Rivest, Stein', 'PHI', 'Computer Science', 8], ['Operating System Concepts', 'Silberschatz, Galvin, Gagne', 'Wiley', 'Computer Science', 6],
      ['Database System Concepts', 'Korth, Silberschatz, Sudarshan', 'McGraw Hill', 'Computer Science', 6], ['Computer Networks', 'Andrew S. Tanenbaum', 'Pearson', 'Computer Science', 5],
      ['Let Us C', 'Yashavant Kanetkar', 'BPB', 'Computer Science', 10], ['Java: The Complete Reference', 'Herbert Schildt', 'McGraw Hill', 'Computer Science', 6],
      ['Artificial Intelligence: A Modern Approach', 'Stuart Russell, Peter Norvig', 'Pearson', 'Computer Science', 4], ['Hands-On Machine Learning', 'Aurélien Géron', "O'Reilly", 'Computer Science', 4],
      ['Compilers: Principles, Techniques and Tools', 'Aho, Lam, Sethi, Ullman', 'Pearson', 'Computer Science', 4], ['Software Engineering', 'Roger S. Pressman', 'McGraw Hill', 'Computer Science', 5],
      ['Higher Engineering Mathematics', 'B. S. Grewal', 'Khanna Publishers', 'Mathematics', 12], ['Advanced Engineering Mathematics', 'Erwin Kreyszig', 'Wiley', 'Mathematics', 8],
      ['Engineering Physics', 'H. K. Malik, A. K. Singh', 'McGraw Hill', 'Physics', 10], ['Engineering Chemistry', 'Jain & Jain', 'Dhanpat Rai', 'Chemistry', 10],
      ['Electronic Devices and Circuit Theory', 'Boylestad, Nashelsky', 'Pearson', 'Electronics', 6], ['Signals and Systems', 'Oppenheim, Willsky', 'PHI', 'Electronics', 5],
      ['Digital Design', 'M. Morris Mano', 'Pearson', 'Electronics', 7], ['Electrical Machinery', 'P. S. Bimbhra', 'Khanna Publishers', 'Electrical', 6],
      ['Power System Engineering', 'Nagrath, Kothari', 'McGraw Hill', 'Electrical', 5], ['Engineering Thermodynamics', 'P. K. Nag', 'McGraw Hill', 'Mechanical', 7],
      ['Strength of Materials', 'R. K. Rajput', 'S. Chand', 'Mechanical', 6], ['Theory of Machines', 'S. S. Rattan', 'McGraw Hill', 'Mechanical', 5],
      ['Surveying Vol. 1', 'B. C. Punmia', 'Laxmi Publications', 'Civil', 6], ['Soil Mechanics and Foundations', 'B. C. Punmia', 'Laxmi Publications', 'Civil', 5],
      ['Marketing Management', 'Philip Kotler, Kevin Lane Keller', 'Pearson', 'Management', 8], ['Financial Management', 'Prasanna Chandra', 'McGraw Hill', 'Management', 6],
      ['Organizational Behaviour', 'Stephen P. Robbins', 'Pearson', 'Management', 6], ['Wings of Fire', 'A. P. J. Abdul Kalam', 'Universities Press', 'General', 4],
    ];
    books.forEach(([title, author, publisher, category, copies], i) => {
      q.run('INSERT INTO books (accession_no, title, author, publisher, category, copies) VALUES (?, ?, ?, ?, ?, ?)',
        `KCCL${String(1001 + i * 17)}`, title, author, publisher, category, copies);
    });
    const bookIds = q.all('SELECT id FROM books').map((b) => b.id);
    const someStudents = q.all("SELECT user_id FROM students ORDER BY user_id LIMIT 80");
    for (const s of someStudents) {
      if (rand() < 0.5) continue;
      const issued = addDays(now, -between(3, 25));
      q.run('INSERT INTO book_issues (book_id, student_id, issued_on, due_on) VALUES (?, ?, ?, ?)', pick(bookIds), s.user_id, isoDate(issued), isoDate(addDays(issued, 14)));
    }

    // Placements
    const drives = [
      ['Tata Consultancy Services', 'Assistant System Engineer', 3.6, 'Pan India', -40, -45, 'B.Tech (All Branches), MBA', 6.0, 'closed'],
      ['Infosys', 'Systems Engineer', 3.6, 'Bengaluru / Pune / Noida', -30, -35, 'B.Tech (CSE, IT, ECE)', 6.0, 'closed'],
      ['Cognizant', 'Programmer Analyst Trainee', 4.0, 'Noida / Chennai', -20, -25, 'B.Tech (CSE, IT, AIML, DS)', 6.5, 'closed'],
      ['Capgemini', 'Analyst', 4.25, 'Pan India', -12, -15, 'B.Tech (All Branches)', 6.0, 'closed'],
      ['Accenture', 'Associate Software Engineer', 4.5, 'Pan India', 12, 8, 'B.Tech (CSE, IT, AIML, DS, ECE)', 6.5, 'open'],
      ['HCLTech', 'Graduate Engineer Trainee', 4.25, 'Noida', 18, 14, 'B.Tech (All Branches)', 6.0, 'open'],
      ['Wipro', 'Project Engineer', 3.5, 'Pan India', 25, 20, 'B.Tech (All Branches)', 6.0, 'open'],
      ['Deloitte', 'Business Technology Analyst', 7.6, 'Gurugram / Hyderabad', 30, 22, 'B.Tech (CSE, IT, AIML, DS), MBA', 7.0, 'open'],
      ['HDFC Bank', 'Relationship Manager', 5.2, 'Delhi NCR', -18, -22, 'MBA (Finance / Marketing)', 6.0, 'closed'],
    ];
    for (const [company, role, pkg, loc, dd, ld, elig, cg, status] of drives) {
      q.run(`INSERT INTO placement_drives (company, role, package_lpa, location, drive_date, last_date, eligibility, min_cgpa, description, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      company, role, pkg, loc, d(dd), d(ld), elig, cg,
      `${company} is hiring ${role}s from the current graduating batch. Process: online assessment, technical interview and HR interview. Bring updated resume, ID card and academic documents.`, status);
    }
    const finalYear = q.all(`SELECT s.user_id, p.degree, (SELECT cgpa FROM results r WHERE r.student_id = s.user_id ORDER BY semester DESC LIMIT 1) AS cgpa
                               FROM students s JOIN programs p ON p.id = s.program_id
                              WHERE (p.degree = 'B.Tech' AND s.current_semester >= 7) OR (p.degree = 'MBA' AND s.current_semester >= 3)`);
    const closed = q.all("SELECT * FROM placement_drives WHERE status = 'closed'");
    for (const s of finalYear) {
      let placed = false;
      for (const dr of closed) {
        const mbaDrive = dr.eligibility.startsWith('MBA');
        if ((s.degree === 'MBA') !== mbaDrive || (s.cgpa || 0) < dr.min_cgpa || rand() < 0.3) continue;
        const status = !placed && rand() < 0.45 ? 'selected' : pick(['rejected', 'shortlisted', 'rejected']);
        if (status === 'selected') placed = true;
        q.run('INSERT INTO drive_applications (drive_id, student_id, status) VALUES (?, ?, ?)', dr.id, s.user_id, status);
      }
    }

    // Assignments with some submissions.
    const allocs = q.all(`SELECT a.*, s.name, s.program_id, s.semester FROM allocations a JOIN subjects s ON s.id = a.subject_id WHERE s.type = 'theory'`);
    for (const a of allocs) {
      if (rand() < 0.5) continue;
      const r = q.run('INSERT INTO assignments (subject_id, section, faculty_id, title, description, due_date, max_marks) VALUES (?, ?, ?, ?, ?, ?, ?)',
        a.subject_id, a.section, a.faculty_id, `${a.name} – Assignment ${between(1, 3)}`,
        'Answer all questions from the unit question bank shared in class. Write neatly, cite references and submit a link to your scanned PDF or a typed answer.',
        d(between(-10, 12)), 10);
      const aid = Number(r.lastInsertRowid);
      const studs = q.all("SELECT user_id FROM students WHERE program_id = ? AND current_semester = ? AND section = ?", a.program_id, a.semester, a.section);
      for (const s of studs) {
        if (rand() < 0.45) continue;
        const graded = rand() < 0.5;
        q.run('INSERT INTO submissions (assignment_id, student_id, content, marks, feedback) VALUES (?, ?, ?, ?, ?)', aid, s.user_id,
          'https://drive.google.com/ (submission link)', graded ? between(5, 10) : null, graded ? pick(['Good work', 'Well explained', 'Needs more examples', 'Excellent']) : null);
      }
    }

    // Helpdesk samples
    const sample = q.all("SELECT user_id FROM students ORDER BY user_id LIMIT 6");
    const g = [['Infrastructure', 'Projector not working in A-305', 'The projector in classroom A-305 has not been working for the last three days.', 'resolved', 'Projector replaced by the maintenance team.'],
      ['Examination', 'Correction in name on marksheet', 'My middle name is missing on the semester marksheet. Kindly correct it.', 'in-progress', 'Forwarded to the examination cell for correction with AKTU.'],
      ['Hostel', 'Wi-Fi connectivity in Boys Hostel Block B', 'Internet connectivity is very slow in the evening.', 'open', null]];
    g.forEach(([cat, subject, desc, status, response], i) => {
      q.run('INSERT INTO grievances (user_id, category, subject, description, status, response) VALUES (?, ?, ?, ?, ?, ?)', sample[i].user_id, cat, subject, desc, status, response);
    });
    q.run("INSERT INTO leave_requests (student_id, from_date, to_date, reason, status) VALUES (?, ?, ?, 'Medical leave due to viral fever (certificate attached at office).', 'approved')", sample[3].user_id, d(-20), d(-18));
    q.run("INSERT INTO leave_requests (student_id, from_date, to_date, reason) VALUES (?, ?, ?, 'Attending sister''s wedding in hometown.')", sample[4].user_id, d(3), d(6));
    const enq = [['Ankit Sharma', 'ankit.s@example.com', '9876543210', 'B.Tech – CSE (AI & ML)', 'Ghaziabad', 'Please share the fee structure and hostel availability.'],
      ['Megha Rawat', 'megha.r@example.com', '9812345678', 'MBA', 'Noida', 'Is there a scholarship for students with above 85% in graduation?'],
      ['Rohit Bhati', 'rohit.b@example.com', '9898989898', 'B.Tech – Mechanical Engineering', 'Greater Noida', 'Want to know about lateral entry admission.']];
    for (const [name, email, phone, program, city, message] of enq) {
      q.run("INSERT INTO enquiries (type, name, email, phone, program, city, message) VALUES ('admission', ?, ?, ?, ?, ?, ?)", name, email, phone, program, city, message);
    }
  });
}

function ensureSeeded() {
  if (q.get('SELECT COUNT(*) AS n FROM users').n > 0) return;
  const demo = process.env.SEED_DEMO !== 'false';
  const adminPassword = process.env.ADMIN_PASSWORD || (demo ? 'Admin@123' : `Kcc@${require('node:crypto').randomInt(10000000, 99999999)}`);
  console.log('Initialising database…');
  seedBase({ adminPassword, adminMustChange: !demo });
  if (demo) seedDemo();
  console.log(`Admin login → username: admin · password: ${process.env.ADMIN_PASSWORD ? '(from ADMIN_PASSWORD)' : adminPassword}`);
  if (demo) console.log('Demo logins → faculty: KCCF001 / Faculty@123 · student: see README (password Student@123)');
}

if (require.main === module) {
  if (process.argv.includes('--reset')) {
    for (const ext of ['', '-wal', '-shm']) fs.rmSync(config.dbFile + ext, { force: true });
  }
  if (process.argv.includes('--no-demo')) process.env.SEED_DEMO = 'false';
  db.get();
  const t = Date.now();
  ensureSeeded();
  console.log(`Done in ${((Date.now() - t) / 1000).toFixed(1)}s`);
}

module.exports = { ensureSeeded, seedBase, seedDemo };
