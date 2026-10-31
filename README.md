# 🎓 KCC Institute of Technology & Management — Website

A multi-page, responsive website for **KCC Institute of Technology & Management (KCC ITM), Greater Noida**, styled like a large university portal. It is built with plain HTML, CSS and JavaScript, needs no build step, and works by opening `index.html`.

## Pages
| Page | What's on it |
|---|---|
| `index.html` | Hero slider with a callback form, animated stats, news ticker, quick links, programme preview, "Why KCC", placement highlights and a recruiter marquee, plus news, notices and events |
| `about.html` | Overview, vision and mission, timeline, leadership, director's message, approvals, statutory committees |
| `academics.html` | Programme catalogue you can filter and search, with a detail modal for each programme; departments; teaching-and-learning tabs; academic resources |
| `admissions.html` | Admission process, eligibility table, fee table and **fee estimator**, scholarships, **3-step application form**, **3-step online fee payment** with a printable receipt, FAQs |
| `placements.html` | Placement stats, 4-year training plan, placement process, recruiters, recruiter enquiry form |
| `campus.html` | Facilities, hostel and transport tabs, clubs, student welfare, gallery with a lightbox |
| `news.html` | News filtered by category, upcoming events with **add-to-calendar (.ics)**, notice board |
| `contact.html` | Contact details, validated enquiry form, Google Map, directions, office directory |

`kccitm.html` redirects to `index.html`.

## Site-wide features
- Header with mega-menus, a mobile drawer menu, and an in-page navigation bar on each page that highlights the current section
- **Site search** (press `Ctrl/⌘ + K` or `/`) across pages, programmes, FAQs, facilities and news
- **Dark mode**, which follows the system setting and can be switched by hand; the choice is remembered
- Scroll-reveal animations, animated counters, a reading-progress bar, a back-to-top button and a floating "Enquire" button
- Form validation (Indian mobile numbers, email), success states with reference numbers
- Accessibility: skip link, ARIA labels, keyboard support, reduced-motion support
- SEO: meta and OpenGraph tags, plus schema.org `CollegeOrUniversity` data

## Structure
```
assets/css/style.css   # design system and all styles
assets/js/data.js      # ALL content: programmes, departments, recruiters, news, events, notices, FAQs
assets/js/main.js      # shared header/footer, search, rendering, forms, payment flow
```
To update content such as news, notices or programmes, edit `assets/js/data.js`. Every page picks up the change.

## Content sources and things to check
Institute facts come from public sources: kccitm.edu.in pages as indexed by search engines, Careers360, CollegeDekho, Collegedunia and Zollege. They are: established 2009, AICTE approved, AKTU affiliated, CSE / AI-ML / Data Science / IoT / AI-DS specialisations, M.Tech and MBA, and a reported highest package of ₹10 LPA and average of ₹6.4 LPA.

**Confirm these with the institute before going live:** phone numbers, email addresses, PIN code, intake and fees, the IT branch, leadership names, and social media links. The news, events and notices are sample entries to be replaced with real ones.

The fee payment and application forms are **front-end demos only**. Nothing is sent or charged until they are connected to a backend and a payment gateway.
