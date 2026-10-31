# KCC Institute of Technology & Management – Concept Website


A modern, responsive and visually appealing college website built using HTML, CSS, and JavaScript.
This project showcases a complete institutional website including programs, campus facilities, news updates, and an integrated online fee payment interface.

🚀 Features
🏫 Professional UI/UX Design
Clean, premium layout with modern typography and color scheme
Fully responsive for desktop, tablet, and mobile devices
🎯 Hero Section
Eye-catching landing section with statistics and call-to-action buttons
📚 Programs Section
Multiple academic programs with detailed cards
Tab-based filtering UI (interactive)
🏢 Campus Facilities
Smart classrooms, labs, hostels, sports, and more
📰 News & Events
Dynamic layout for latest updates and upcoming events
💳 Online Fee Payment System (Frontend Simulation)
Multi-step form (Student Details → Fee → Review → Payment)
Real-time fee summary
Payment success simulation with transaction ID
🖼️ Gallery Section
Grid-based image layout with hover effects
📞 Contact Section
Enquiry form with interactive feedback
Address, phone, and email details

## What's new

- Programme tabs now filter the programme cards
- Mobile menu (☰) on small screens
- Validation for the enquiry form and the fee-payment student details
- Gallery images load from `images/` with graceful placeholders when absent
- Clear notice that this is an unofficial student project and the payment flow is a demo

> **Disclaimer:** this is a student learning project. It is not the official KCC ITM website and does not process real payments.

## Run locally

Open `index.html` in any modern browser. No install or build step is needed. To serve it over HTTP instead:

```bash
python3 -m http.server 8000
```

## Deploy

This repository includes a GitHub Pages workflow (`.github/workflows/pages.yml`).

1. Go to **Settings → Pages** and set **Source** to **GitHub Actions**.
2. Push to the default branch. The site is published at `https://<username>.github.io/kccitm-website/`.

Any static host (Netlify, Vercel, Cloudflare Pages) also works: publish the repository root with no build command.
