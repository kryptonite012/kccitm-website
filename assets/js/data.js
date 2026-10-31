/* =========================================================
   KCC ITM — site content (single source of truth)
   Facts gathered from public sources (official kccitm.edu.in
   pages as indexed by search engines, plus education portals).
   Items marked `verify: true` should be confirmed with the
   institute before going live.
   ========================================================= */
window.KCC = {
  info: {
    name: 'KCC Institute of Technology & Management',
    short: 'KCC ITM',
    group: 'KCC Group of Institutions',
    established: 2009,
    affiliation: 'Dr. A.P.J. Abdul Kalam Technical University (AKTU), Lucknow',
    approval: 'All India Council for Technical Education (AICTE), New Delhi',
    address: 'Knowledge Park III, Greater Noida, Uttar Pradesh – 201308, India',
    phone: ['0120-2320640', '0120-2320641'],
    email: ['info@kccitm.edu.in', 'admissions@kccitm.edu.in'],
    website: 'https://www.kccitm.edu.in',
    hours: 'Mon – Sat, 9:00 AM – 5:00 PM',
    session: '2026–27',
    placement: { highest: '₹10 LPA', average: '₹6.4 LPA' },
    mapQuery: 'KCC Institute of Technology and Management, Knowledge Park III, Greater Noida'
  },

  programmes: [
    { id: 'cse', level: 'ug', icon: '💻', name: 'Computer Science & Engineering', degree: 'B.Tech', duration: '4 Years',
      desc: 'Core computing — algorithms, systems, networks, databases and software engineering — with electives in cloud, security and full-stack development.',
      careers: ['Software Engineer', 'Systems Analyst', 'Cloud Engineer', 'Full-Stack Developer'],
      highlights: ['Coding culture with hackathons & competitive programming', 'Industry certifications alongside AKTU curriculum', 'Project-based labs from 1st year'] },
    { id: 'cse-aiml', level: 'ug', icon: '🤖', name: 'CSE (Artificial Intelligence & Machine Learning)', degree: 'B.Tech', duration: '4 Years',
      desc: 'Machine learning, deep learning, computer vision and NLP built on a strong CSE foundation.',
      careers: ['ML Engineer', 'AI Developer', 'Computer Vision Engineer', 'Research Assistant'],
      highlights: ['GPU-enabled AI lab work', 'Capstone projects on real datasets', 'Python, TensorFlow & PyTorch tracks'] },
    { id: 'cse-ds', level: 'ug', icon: '📊', name: 'CSE (Data Science)', degree: 'B.Tech', duration: '4 Years',
      desc: 'Statistics, data engineering, big-data platforms and analytics for data-driven decision making.',
      careers: ['Data Scientist', 'Data Analyst', 'Data Engineer', 'BI Developer'],
      highlights: ['Big-data & visualisation tools', 'Kaggle-style internal competitions', 'Analytics internships'] },
    { id: 'cse-iot', level: 'ug', icon: '📡', name: 'CSE (Internet of Things)', degree: 'B.Tech', duration: '4 Years',
      desc: 'Embedded systems, sensors, connectivity and cloud platforms for smart devices and automation.',
      careers: ['IoT Developer', 'Embedded Engineer', 'Solutions Architect', 'Automation Engineer'],
      highlights: ['Hands-on with microcontrollers & sensors', 'Smart-campus mini projects', 'Cloud-IoT integration'] },
    { id: 'aids', level: 'ug', icon: '🧠', name: 'CSE (Artificial Intelligence & Data Science)', degree: 'B.Tech', duration: '4 Years',
      desc: 'An integrated track combining AI techniques with data science pipelines and applied analytics.',
      careers: ['AI Engineer', 'Data Scientist', 'Analytics Consultant', 'MLOps Engineer'],
      highlights: ['AI + analytics combined curriculum', 'Applied industry projects', 'Research-oriented electives'] },
    { id: 'it', level: 'ug', icon: '🌐', name: 'Information Technology', degree: 'B.Tech', duration: '4 Years', verify: true,
      desc: 'Software, web technologies, information systems and network administration for the digital enterprise.',
      careers: ['Web Developer', 'Network Administrator', 'IT Consultant', 'DevOps Engineer'],
      highlights: ['Web & mobile app development', 'Networking labs', 'Enterprise systems exposure'] },
    { id: 'ece', level: 'ug', icon: '🔌', name: 'Electronics & Communication Engineering', degree: 'B.Tech', duration: '4 Years',
      desc: 'Analog & digital electronics, VLSI, signal processing, embedded and communication systems.',
      careers: ['VLSI Design Engineer', 'Telecom Engineer', 'Embedded Developer', 'Hardware Engineer'],
      highlights: ['Electronics & microprocessor labs', 'PCB design projects', 'Communication systems lab'] },
    { id: 'ee', level: 'ug', icon: '⚡', name: 'Electrical Engineering', degree: 'B.Tech', duration: '4 Years',
      desc: 'Power systems, machines, control engineering and renewable energy with practical laboratory training.',
      careers: ['Power Engineer', 'Control Engineer', 'Energy Analyst', 'PSU roles via GATE'],
      highlights: ['Machines & power-systems labs', 'Renewable energy focus', 'Industrial visits'] },
    { id: 'me', level: 'ug', icon: '⚙️', name: 'Mechanical Engineering', degree: 'B.Tech', duration: '4 Years',
      desc: 'Design, thermal sciences, manufacturing and CAD/CAM — the backbone of industry.',
      careers: ['Design Engineer', 'Production Engineer', 'Quality Engineer', 'Automotive Engineer'],
      highlights: ['Workshop & CAD/CAM lab', 'Thermal & fluid mechanics labs', 'Industry training'] },
    { id: 'ce', level: 'ug', icon: '🏗️', name: 'Civil Engineering', degree: 'B.Tech', duration: '4 Years',
      desc: 'Structures, geotechnics, transportation and environmental engineering for modern infrastructure.',
      careers: ['Site Engineer', 'Structural Engineer', 'Planning Engineer', 'Government Services'],
      highlights: ['Surveying & materials labs', 'Site visits', 'Software: AutoCAD & STAAD'] },
    { id: 'lateral', level: 'ug', icon: '🎯', name: 'B.Tech Lateral Entry (2nd Year)', degree: 'B.Tech', duration: '3 Years',
      desc: 'Direct admission to the second year of B.Tech for diploma holders and eligible B.Sc graduates, as per AKTU norms.',
      careers: ['As per chosen branch'],
      highlights: ['Admission via AKTU / UPTAC lateral counselling', 'Bridge support for diploma students', 'Same degree as regular B.Tech'] },
    { id: 'mtech', level: 'pg', icon: '🔬', name: 'Master of Technology', degree: 'M.Tech', duration: '2 Years',
      desc: 'Advanced study and research in engineering disciplines with a dissertation in the final year.',
      careers: ['R&D Engineer', 'Assistant Professor', 'Technical Specialist', 'PhD pathway'],
      highlights: ['Research dissertation', 'GATE-qualified scholarship eligibility (AICTE norms)', 'Teaching assistantship exposure'] },
    { id: 'mba', level: 'pg', icon: '📈', name: 'Master of Business Administration', degree: 'MBA', duration: '2 Years',
      desc: 'A management programme with dual specialisations in Marketing, Finance, HR, IT and Operations, built around live projects and industry interaction.',
      careers: ['Business Analyst', 'Marketing Manager', 'Financial Analyst', 'HR Business Partner'],
      highlights: ['Dual specialisation', 'Summer internship programme', 'Case-study & live-project pedagogy'] }
  ],

  departments: [
    { icon: '💻', name: 'Computer Science & Engineering', text: 'CSE and its AI/ML, Data Science, IoT and AI & DS specialisations.' },
    { icon: '🔌', name: 'Electronics & Communication', text: 'Electronics, VLSI, embedded and communication systems.' },
    { icon: '⚡', name: 'Electrical Engineering', text: 'Power, machines, control and renewable energy.' },
    { icon: '⚙️', name: 'Mechanical Engineering', text: 'Design, thermal, manufacturing and CAD/CAM.' },
    { icon: '🏗️', name: 'Civil Engineering', text: 'Structures, geotechnics, transportation and environment.' },
    { icon: '📈', name: 'Management Studies', text: 'MBA with dual specialisations and industry projects.' },
    { icon: '🧪', name: 'Applied Sciences & Humanities', text: 'Physics, chemistry, mathematics and communication skills for first-year students.' },
    { icon: '🎓', name: 'Corporate Resource Centre', text: 'Training & placement — aptitude, soft-skills and recruiter relations.' }
  ],

  recruiters: ['Infosys', 'HCLTech', 'Accenture', 'Samsung', 'Intel', 'Havells', 'Philips', 'Yes Bank', 'Vodafone Idea',
    'Canon', 'Toshiba', 'Cipla', 'Dabur', 'Justdial', 'Wipro', 'TCS', 'Capgemini', 'Cognizant'],

  facilities: [
    { icon: '🏫', name: 'Smart Classrooms', text: 'ICT-enabled classrooms with projectors and audio-visual aids.' },
    { icon: '🔬', name: 'Laboratories', text: 'Department labs for computing, electronics, electrical, mechanical and civil engineering.' },
    { icon: '📚', name: 'Central Library', text: 'Text & reference books, journals, digital resources and a reading hall.' },
    { icon: '🏠', name: 'Hostels', text: 'Separate hostels for boys and girls with mess, Wi-Fi and security.' },
    { icon: '🚌', name: 'Transport', text: 'Bus routes across Greater Noida, Noida and the Delhi-NCR region.' },
    { icon: '🏟️', name: 'Sports', text: 'Outdoor fields and courts plus indoor games for fitness and competition.' },
    { icon: '🍽️', name: 'Cafeteria', text: 'Hygienic food court serving meals and snacks through the day.' },
    { icon: '🏥', name: 'Medical Room', text: 'First-aid and medical support on campus with tie-ups for emergencies.' },
    { icon: '📶', name: 'Wi-Fi Campus', text: 'Campus-wide internet connectivity for academics and research.' },
    { icon: '🎤', name: 'Auditorium & Seminar Halls', text: 'Venues for guest lectures, conferences and cultural events.' },
    { icon: '💡', name: 'Innovation & Incubation', text: 'Support for student start-ups, ideation and prototype building.' },
    { icon: '🏧', name: 'Bank & ATM', text: 'Banking convenience close to the campus.' }
  ],

  clubs: [
    { icon: '👨‍💻', name: 'Coding Club', text: 'Competitive programming, hackathons and open-source contribution.' },
    { icon: '🤖', name: 'Robotics & IoT Club', text: 'Build bots, drones and smart devices for competitions.' },
    { icon: '🎭', name: 'Cultural Society', text: 'Dance, music, drama and the annual cultural fest.' },
    { icon: '📸', name: 'Photography & Media', text: 'Covering campus life, events and storytelling.' },
    { icon: '🌱', name: 'NSS & Social Outreach', text: 'Community service, blood donation and awareness drives.' },
    { icon: '🚀', name: 'Entrepreneurship Cell', text: 'Startup talks, pitch competitions and mentoring.' },
    { icon: '📝', name: 'Literary Club', text: 'Debates, MUNs, quizzes and creative writing.' },
    { icon: '⚽', name: 'Sports Committee', text: 'Inter-college tournaments and annual sports meet.' }
  ],

  /* Representative updates — replace with live CMS / notice-board data. */
  news: [
    { date: '2026-10-24', cat: 'Admissions', icon: '🎓', title: 'Admissions open for session 2026–27', text: 'Applications are being accepted for B.Tech, B.Tech Lateral Entry, M.Tech and MBA programmes. Counselling as per AKTU / UPTAC schedule.' },
    { date: '2026-10-15', cat: 'Placements', icon: '💼', title: 'Corporate Resource Centre announces pre-placement training', text: 'Aptitude, coding and soft-skills training for final-year students ahead of the campus recruitment season.' },
    { date: '2026-10-05', cat: 'Academics', icon: '📘', title: 'Odd semester classes in full swing', text: 'Academic calendar for the odd semester has been published on the student portal.' },
    { date: '2026-09-26', cat: 'Campus', icon: '🌟', title: 'Induction programme welcomes the new batch', text: 'First-year students were introduced to departments, clubs, mentors and campus facilities.' },
    { date: '2026-09-15', cat: 'Events', icon: '🛠️', title: 'Engineers’ Day celebrated with technical quiz & model exhibition', text: 'Students across departments showcased projects and competed in technical events.' },
    { date: '2026-08-15', cat: 'Campus', icon: '🇮🇳', title: 'Independence Day celebrations on campus', text: 'Flag hoisting followed by cultural performances by students.' }
  ],

  events: [
    { date: '2026-11-14', title: 'Inter-departmental Hackathon', venue: 'Computer Centre', type: 'Technical' },
    { date: '2026-11-21', title: 'Industry Expert Talk: Careers in AI', venue: 'Seminar Hall', type: 'Guest Lecture' },
    { date: '2026-12-05', title: 'Annual Sports Meet', venue: 'Sports Ground', type: 'Sports' },
    { date: '2026-12-12', title: 'Parent–Teacher Meet', venue: 'Respective Departments', type: 'Academic' },
    { date: '2027-01-26', title: 'Republic Day Celebration', venue: 'Main Lawn', type: 'Campus' },
    { date: '2027-02-20', title: 'Annual Tech & Cultural Fest', venue: 'Main Campus', type: 'Fest' }
  ],

  notices: [
    { date: '2026-10-28', text: 'Odd semester internal assessment schedule released', isNew: true },
    { date: '2026-10-22', text: 'Scholarship (UP Govt.) online application – last date reminder', isNew: true },
    { date: '2026-10-18', text: 'Hostel fee payment window for second instalment' },
    { date: '2026-10-10', text: 'Registration for training & placement batch 2027' },
    { date: '2026-10-01', text: 'Library timings extended during examinations' },
    { date: '2026-09-20', text: 'Anti-ragging undertaking submission for new students' }
  ],

  faqs: [
    { q: 'Is KCC ITM approved and affiliated?', a: 'Yes. KCC Institute of Technology & Management is approved by AICTE, New Delhi and affiliated to Dr. A.P.J. Abdul Kalam Technical University (AKTU), Lucknow. Degrees are awarded by AKTU.' },
    { q: 'How do I get admission to B.Tech?', a: 'B.Tech admissions are made through AKTU / UPTAC counselling on the basis of JEE Main scores. A limited number of seats may be filled directly as per state government norms — contact the admission cell for current availability.' },
    { q: 'What is the eligibility for B.Tech?', a: '10+2 with Physics and Mathematics as compulsory subjects along with one of Chemistry / Biology / Computer Science / Biotechnology / technical vocational subject, with at least 45% marks (40% for reserved categories) as per AICTE/AKTU norms.' },
    { q: 'Can diploma holders join directly in second year?', a: 'Yes. Diploma holders (and eligible B.Sc graduates) can join B.Tech in the second year through Lateral Entry counselling conducted by AKTU / UPTAC.' },
    { q: 'How do I get admission to MBA?', a: 'Graduates with the required percentage can apply via AKTU / UPTAC counselling using CUET-PG / CAT / MAT / CMAT scores, as notified for the session.' },
    { q: 'What is the fee for B.Tech?', a: 'Education portals report a tuition fee of roughly ₹1.1 lakh per year for B.Tech. Fees are regulated by the Fee Regulatory Committee, U.P., and may change each session — please confirm with the admission cell.' },
    { q: 'Are hostels available?', a: 'Yes. Separate hostel accommodation is available for boys and girls with mess facilities. Seats are allotted on a first-come, first-served basis.' },
    { q: 'Which companies recruit from KCC ITM?', a: 'Recruiters listed by education portals include Infosys, HCLTech, Accenture, Samsung, Intel, Havells, Philips, Yes Bank, Vodafone and others. The institute reports a highest package of about ₹10 LPA and an average of about ₹6.4 LPA.' },
    { q: 'Are scholarships available?', a: 'Eligible students can apply for U.P. Government scholarship and fee-reimbursement schemes, central schemes listed on the National Scholarship Portal, and AICTE schemes. Merit-based institutional support may also be offered.' }
  ],

  pages: [
    { title: 'Home', url: 'index.html', text: 'KCC ITM home Greater Noida engineering management college' },
    { title: 'About KCC ITM', url: 'about.html', text: 'history vision mission leadership approvals AICTE AKTU established 2009' },
    { title: 'Academics & Programmes', url: 'academics.html', text: 'courses B.Tech M.Tech MBA departments curriculum' },
    { title: 'Admissions 2026–27', url: 'admissions.html', text: 'eligibility process fee structure scholarship apply online UPTAC JEE' },
    { title: 'Pay Fees Online', url: 'admissions.html#pay-fees', text: 'fee payment online receipt student' },
    { title: 'Placements', url: 'placements.html', text: 'training placement recruiters package corporate resource centre' },
    { title: 'Campus Life', url: 'campus.html', text: 'hostel transport library labs clubs sports gallery facilities' },
    { title: 'News & Events', url: 'news.html', text: 'news events notices announcements calendar' },
    { title: 'Contact Us', url: 'contact.html', text: 'address phone email map directions enquiry' },
    { title: 'FAQs', url: 'admissions.html#faq', text: 'questions answers help admission' }
  ]
};
