# KCC Institute of Technology & Management – Website & Campus ERP

A complete, production-ready website and campus management system (ERP) for **KCC Institute of Technology & Management (KCCITM), Knowledge Park-III, Greater Noida** – AICTE approved and affiliated to Dr. A.P.J. Abdul Kalam Technical University (AKTU), Lucknow.

It combines the public college website with three role-based portals – **Student**, **Faculty** and **Administration** – backed by a real database, so attendance, fees, results, admit cards, placements and more all work end to end.

---

## ✨ Features

### Public website (`/`)
- Modern, responsive design (desktop, tablet, mobile) in the institute's crimson & gold identity
- Live **notice board**, scrolling announcements ticker, upcoming **events** and campus **news** (managed from the admin panel)
- **Programmes** with intake and eligibility (B.Tech CSE, CSE-AI&ML, CSE-Data Science, IT, ECE, EE, ME, CE and MBA)
- **Admissions** process and **enquiry form** (leads go straight to the admin panel)
- **Placements** statistics (highest/average package, offers, recruiters) calculated from real placement data
- Campus facilities, contact details, Google Map and **contact form**
- **Quick Pay** – students pay fees with just enrollment number + date of birth, no login needed

### Student portal
| Module | What it does |
|---|---|
| Dashboard | Attendance %, CGPA, fee dues, today's classes, notices, upcoming exams, shortage & dues alerts |
| Attendance | Subject-wise %, "can skip / must attend" advice for the 75% rule, day-by-day log |
| Timetable | Weekly class schedule with faculty & rooms |
| Assignments | View, submit and resubmit assignments, see marks & feedback |
| Results | Semester-wise SGPA/CGPA (AKTU 10-point scale), printable **statement of grades** |
| Admit Card | Auto-generated, printable admit card (blocked if attendance < 75% or semester fees pending) |
| Fees | Fee ledger, select & **pay online**, payment history, printable **receipts** |
| Library | Issued books, due dates, overdue fines, catalogue (OPAC) search |
| Placements | Eligible drives (CGPA-based), one-click apply, application status |
| Leave & Helpdesk | Leave applications and grievance / anti-ragging tickets with responses |
| Profile | Personal details, update contact information, change password |

### Faculty portal
- Dashboard with today's lectures and class summary
- **Mark attendance** (Present / Absent / Duty Leave) per lecture, edit past records
- Class-wise **attendance reports** with shortage list
- **Internal (sessional) marks** entry
- Create **assignments**, review submissions and grade them
- Post notices to students, personal timetable, helpdesk

### Admin / ERP panel
- Dashboard: students, faculty, fee collected, outstanding dues, collection chart, average attendance, pending work
- **Students**: search & filter, add / edit, full profile with attendance, fee ledger and results, reset password, **promote semester**, CSV export
- **Faculty**: add / edit, department & designation, reset password
- **Programmes & Subjects**: edit intake/eligibility, add subjects, assign faculty per section
- **Timetable** builder (click-to-edit grid)
- **Examinations**: exam schedule, internal + external marks entry, **one-click result publishing** (SGPA/CGPA computed automatically, back papers detected)
- **Fees & Accounts**: generate semester fee demand per class (hostel/transport aware), concessions/scholarships, counter payments (cash / cheque / DD / NEFT) with receipts, transaction register, **defaulters list**, CSV export
- **Library**: catalogue, issue / return with automatic late fine
- **Placements**: drives, applicants, shortlist / select, CSV export
- **Website content**: notices (public / students / faculty), events, news
- **Admissions**: enquiry & contact message inbox with follow-up status, CSV export
- **Helpdesk & Leaves**: respond to grievances, approve / reject leave
- **Activity log**: audit trail of logins, marks changes, payments and more

### Payments
- Works out of the box with a built-in **sandbox gateway** for demos
- Add Razorpay keys to accept **live payments** (UPI, cards, net banking, wallets) – server-side order creation and signature verification
- Unique transaction IDs, sequential receipt numbers (`KCC/2026/000123`), amount in words, double-payment protection

### Security
- Passwords hashed with **scrypt**; temporary passwords must be changed at first login
- HttpOnly, SameSite session cookies; changing a password signs out other devices
- CSRF protection, strict Content-Security-Policy and security headers
- Role-based access on every API, faculty restricted to their own classes, students to their own data
- Rate-limited login and public forms, parameterised SQL everywhere, audit log

---

## 🚀 Getting started

**Requirements:** Node.js **22.13 or newer** (uses the built-in SQLite engine – no database server to install).

```bash
npm install
npm start
```

Open **http://localhost:3000**. On first start the database is created and filled with realistic demo data.

### Demo logins

| Role | Login ID | Password |
|---|---|---|
| Student | `24KCCCSE001` | `Student@123` |
| Faculty | `KCCF001` | `Faculty@123` |
| Admin | `admin` | `Admin@123` |

Every demo student uses the password `Student@123` (login ID = enrollment number, e.g. `25KCCCSE003`, `23KCCECE002`), and every faculty member uses `Faculty@123` (`KCCF001` – `KCCF031`).
For **Quick Pay**, use any student's enrollment number and date of birth (visible in Admin → Students).

### Useful commands

| Command | Purpose |
|---|---|
| `npm start` | Start the server |
| `npm run dev` | Start with auto-reload while editing |
| `npm run seed` | Wipe and recreate the database with demo data |
| `node src/seed.js --reset --no-demo` | Wipe and create a **clean production database** (programmes, subjects and an admin account only) |
| `npm test` | Run the automated API test-suite |

---

## 🏫 Going live for the institute

1. **Create a clean database:**
   ```bash
   ADMIN_PASSWORD='choose-a-strong-password' node src/seed.js --reset --no-demo
   ```
2. **Configure** the environment – copy `.env.example` to `.env` and set:
   - `NODE_ENV=production` (enables secure cookies & HSTS – serve over HTTPS)
   - `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` for live online payments
   - Official phone numbers and email addresses
3. **Verify institute details** in `src/config.js` (address, phones, emails, social links, year of establishment) and programme intake / eligibility in *Admin → Programmes & Subjects*.
4. **Load data**: add faculty and students (*Admin → Students / Faculty*), assign subjects, build timetables and generate semester fees.
5. **Deploy** behind HTTPS (e.g. Nginx or Caddy as a reverse proxy to port 3000), or use Docker:
   ```bash
   docker build -t kccitm .
   docker run -d -p 3000:3000 -v kccitm-data:/app/data --env-file .env kccitm
   ```
6. **Back up** the `data/` folder (SQLite database) regularly – it contains all institute records.

---

## 🗂️ Project structure

```
server.js              Express app, security headers, routing
src/
  config.js            Environment & institute profile
  db.js                SQLite schema and helpers
  auth.js              Password hashing, sessions, roles, rate limiting, audit
  services.js          Attendance, fees, payments, results, admit-card logic
  seed.js              Base + demo data
  routes/              public, student, faculty, admin, payments, support APIs
public/
  index.html           Public website
  login.html           Portal sign-in
  portal.html          ERP single-page app shell
  receipt.html         Printable fee receipt
  js/                  Front-end modules (site, portal-student, portal-faculty, portal-admin…)
  css/                 Styles
tests/                 Automated API tests (node:test)
```

---

© KCC Institute of Technology & Management. Developed by [kryptonite012](https://github.com/kryptonite012).
