/* =========================================================
   KCC ITM — shared layout + interactive behaviour
   ========================================================= */
(function () {
  'use strict';
  const D = window.KCC;
  const I = D.info;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const page = document.body.dataset.page || '';
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tel = (p) => 'tel:' + p.replace(/[^0-9+]/g, '');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const fmtDate = (s) => { const d = parseDate(s); return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  };

  /* ---------- Theme (apply early) ---------- */
  const savedTheme = store.get('kcc-theme');
  if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
  function isDark() {
    const t = document.documentElement.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
  }

  /* ---------- Layout: header / drawer / footer ---------- */
  const NAV = [
    { label: 'About', url: 'about.html', key: 'about', mega: 'cols-2', groups: [
      { h: 'The Institute', links: [['Overview', 'about.html#overview'], ['Vision & Mission', 'about.html#vision'], ['Our Journey', 'about.html#journey'], ['Approvals & Affiliation', 'about.html#approvals']] },
      { h: 'Leadership', links: [['Leadership Team', 'about.html#leadership'], ["Director's Message", 'about.html#message'], ['Governance & Committees', 'about.html#committees'], ['Mandatory Disclosure', 'about.html#approvals']] }
    ] },
    { label: 'Academics', url: 'academics.html', key: 'academics', mega: 'cols-3', groups: [
      { h: 'Undergraduate', links: [['B.Tech CSE', 'academics.html?p=cse'], ['B.Tech CSE (AI & ML)', 'academics.html?p=cse-aiml'], ['B.Tech CSE (Data Science)', 'academics.html?p=cse-ds'], ['B.Tech CSE (IoT)', 'academics.html?p=cse-iot'], ['B.Tech ECE / EE / ME / CE', 'academics.html#programmes']] },
      { h: 'Postgraduate', links: [['MBA', 'academics.html?p=mba'], ['M.Tech', 'academics.html?p=mtech'], ['B.Tech Lateral Entry', 'academics.html?p=lateral'], ['Departments', 'academics.html#departments'], ['Academic Calendar', 'academics.html#resources']] },
      { feature: true, h: 'Admissions ' + I.session, p: 'Applications are open for engineering and management programmes.', cta: ['Apply Now →', 'admissions.html#apply'] }
    ] },
    { label: 'Admissions', url: 'admissions.html', key: 'admissions', mega: 'cols-2', groups: [
      { h: 'Apply', links: [['Admission Process', 'admissions.html#process'], ['Eligibility', 'admissions.html#eligibility'], ['Apply Online', 'admissions.html#apply'], ['FAQs', 'admissions.html#faq']] },
      { h: 'Fees & Aid', links: [['Fee Structure', 'admissions.html#fees'], ['Scholarships', 'admissions.html#scholarships'], ['Pay Fees Online', 'admissions.html#pay-fees'], ['Fee Refund Policy', 'admissions.html#fees']] }
    ] },
    { label: 'Placements', url: 'placements.html', key: 'placements' },
    { label: 'Campus Life', url: 'campus.html', key: 'campus', mega: 'cols-2', groups: [
      { h: 'Facilities', links: [['Infrastructure', 'campus.html#facilities'], ['Hostel & Transport', 'campus.html#hostel'], ['Library', 'campus.html#facilities'], ['Gallery', 'campus.html#gallery']] },
      { h: 'Student Life', links: [['Clubs & Societies', 'campus.html#clubs'], ['Student Welfare', 'campus.html#welfare'], ['Anti-Ragging', 'campus.html#welfare'], ['Grievance Redressal', 'campus.html#welfare']] }
    ] },
    { label: 'News & Events', url: 'news.html', key: 'news' },
    { label: 'Contact', url: 'contact.html', key: 'contact' }
  ];

  function megaHTML(item) {
    return '<div class="mega ' + item.mega + '">' + item.groups.map((g) => {
      if (g.feature) return '<div class="mega-feature"><h6>' + esc(g.h) + '</h6><p>' + esc(g.p) + '</p><a href="' + g.cta[1] + '">' + esc(g.cta[0]) + '</a></div>';
      return '<div><h6>' + esc(g.h) + '</h6>' + g.links.map((l) => '<a href="' + l[1] + '">' + esc(l[0]) + '</a>').join('') + '</div>';
    }).join('') + '</div>';
  }

  function buildLayout() {
    const brand = '<a class="brand" href="index.html" aria-label="' + esc(I.name) + ' — Home"><div class="brand-badge"><div><b>KCC</b><small>ITM</small></div></div><div class="brand-text"><strong>' + esc(I.name) + '</strong><span>Approved by AICTE · Affiliated to AKTU</span></div></a>';

    const header =
      '<a class="skip-link" href="#main">Skip to content</a>' +
      '<div class="progress-bar" id="progress"></div>' +
      '<div class="topbar"><div class="container">' +
        '<span>📍 Knowledge Park III, Greater Noida <span class="hide-sm">· Est. ' + I.established + '</span></span>' +
        '<div class="topbar-links">' +
          '<a href="' + tel(I.phone[0]) + '">📞 ' + I.phone[0] + '</a>' +
          '<a class="hide-sm" href="mailto:' + I.email[0] + '">✉️ ' + I.email[0] + '</a>' +
          '<span class="sep hide-sm">|</span>' +
          '<a class="hide-sm" href="news.html#notices">Notices</a>' +
          '<a class="hide-sm" href="admissions.html#pay-fees">Pay Fees</a>' +
          '<a class="hide-sm" href="contact.html#enquiry">Grievance</a>' +
        '</div></div></div>' +
      '<header class="site-header" id="siteHeader"><div class="container">' + brand +
        '<nav class="main-nav" aria-label="Primary">' +
          NAV.map((n) => '<div class="nav-item"><a class="nav-link' + (n.key === page ? ' active' : '') + '" href="' + n.url + '"' + (n.key === page ? ' aria-current="page"' : '') + '>' + esc(n.label) + (n.mega ? ' <span class="caret">▼</span>' : '') + '</a>' + (n.mega ? megaHTML(n) : '') + '</div>').join('') +
        '</nav>' +
        '<div class="header-actions">' +
          '<button class="icon-btn" id="searchBtn" aria-label="Search the site (Ctrl+K)">🔍</button>' +
          '<button class="icon-btn" id="themeBtn" aria-label="Toggle dark mode">🌙</button>' +
          '<a class="btn-apply" href="admissions.html#apply">Apply ' + I.session + '</a>' +
          '<button class="icon-btn menu-toggle" id="menuBtn" aria-label="Open menu" aria-expanded="false" aria-controls="drawer">☰</button>' +
        '</div>' +
      '</div></header>' +
      '<div class="drawer-backdrop" id="drawerBackdrop"></div>' +
      '<aside class="drawer" id="drawer" aria-label="Mobile menu"><div class="drawer-head">' + brand + '<button class="icon-btn" id="drawerClose" aria-label="Close menu">✕</button></div><div class="drawer-body">' +
        '<a class="d-link" href="index.html">Home</a>' +
        NAV.map((n) => n.mega
          ? '<details><summary>' + esc(n.label) + '</summary><a href="' + n.url + '">' + esc(n.label) + ' overview</a>' + n.groups.filter((g) => !g.feature).flatMap((g) => g.links).map((l) => '<a href="' + l[1] + '">' + esc(l[0]) + '</a>').join('') + '</details>'
          : '<a class="d-link" href="' + n.url + '">' + esc(n.label) + '</a>').join('') +
        '<a class="btn-apply" href="admissions.html#apply">Apply for ' + I.session + '</a>' +
        '<a class="btn btn-line" style="display:flex;justify-content:center;margin:10px 8px 0" href="admissions.html#pay-fees">💳 Pay Fees Online</a>' +
      '</div></aside>' +
      '<div class="search-overlay" id="searchOverlay" role="dialog" aria-modal="true" aria-label="Site search"><div class="search-box">' +
        '<input id="searchInput" type="search" placeholder="Search programmes, admissions, placements…" autocomplete="off" aria-label="Search">' +
        '<div class="search-results" id="searchResults"></div>' +
        '<div class="search-hint"><span><kbd>↑</kbd> <kbd>↓</kbd> navigate</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span></div>' +
      '</div></div>';

    const year = new Date().getFullYear();
    const footer =
      '<footer class="site-footer"><div class="container">' +
        '<div class="newsletter"><div><h3>Stay in the loop</h3><p>Admission alerts, events and campus news — straight to your inbox.</p></div>' +
          '<form id="newsletterForm" novalidate><label class="sr-only" for="nlEmail">Email address</label><input id="nlEmail" type="email" placeholder="Your email address" required><button class="btn btn-gold" type="submit">Subscribe</button></form></div>' +
        '<div class="footer-grid">' +
          '<div class="footer-brand">' + brand.replace('class="brand"', 'class="brand" style="color:#fff"') +
            '<p>' + esc(I.name) + ', Greater Noida — a constituent of the ' + esc(I.group) + ', established in ' + I.established + ' to deliver industry-ready technical and management education.</p>' +
            '<div class="socials">' +
              '<a href="https://www.facebook.com/" aria-label="Facebook" rel="noopener" target="_blank">f</a>' +
              '<a href="https://www.instagram.com/" aria-label="Instagram" rel="noopener" target="_blank">ig</a>' +
              '<a href="https://www.linkedin.com/" aria-label="LinkedIn" rel="noopener" target="_blank">in</a>' +
              '<a href="https://www.youtube.com/" aria-label="YouTube" rel="noopener" target="_blank">▶</a>' +
              '<a href="https://x.com/" aria-label="X (Twitter)" rel="noopener" target="_blank">𝕏</a>' +
            '</div></div>' +
          '<div><h5>Institute</h5><ul><li><a href="about.html">About Us</a></li><li><a href="about.html#leadership">Leadership</a></li><li><a href="about.html#approvals">Approvals</a></li><li><a href="about.html#committees">Committees</a></li><li><a href="contact.html">Contact</a></li></ul></div>' +
          '<div><h5>Academics</h5><ul><li><a href="academics.html#programmes">Programmes</a></li><li><a href="academics.html#departments">Departments</a></li><li><a href="academics.html#resources">Academic Calendar</a></li><li><a href="https://aktu.ac.in/" target="_blank" rel="noopener">AKTU Portal ↗</a></li><li><a href="placements.html">Placements</a></li></ul></div>' +
          '<div><h5>Admissions</h5><ul><li><a href="admissions.html#process">How to Apply</a></li><li><a href="admissions.html#fees">Fee Structure</a></li><li><a href="admissions.html#scholarships">Scholarships</a></li><li><a href="admissions.html#pay-fees">Pay Fees Online</a></li><li><a href="admissions.html#faq">FAQs</a></li></ul></div>' +
          '<div><h5>Students</h5><ul><li><a href="campus.html#clubs">Clubs</a></li><li><a href="campus.html#hostel">Hostel</a></li><li><a href="news.html#notices">Notices</a></li><li><a href="campus.html#welfare">Anti-Ragging</a></li><li><a href="campus.html#welfare">Grievance Cell</a></li></ul></div>' +
        '</div>' +
        '<div class="footer-bottom"><p>© ' + year + ' ' + esc(I.name) + ', Greater Noida. All rights reserved.</p><p>Affiliated to <a href="https://aktu.ac.in/" target="_blank" rel="noopener">AKTU, Lucknow</a> · Approved by <a href="https://www.aicte-india.org/" target="_blank" rel="noopener">AICTE, New Delhi</a></p></div>' +
      '</div></footer>' +
      '<div class="fab-stack"><button class="fab top" id="toTop" aria-label="Back to top">↑</button><a class="fab enquire" href="contact.html#enquiry">💬 Enquire</a></div>' +
      '<div class="toast" id="toast" role="status" aria-live="polite"></div>';

    document.body.insertAdjacentHTML('afterbegin', header);
    document.body.insertAdjacentHTML('beforeend', footer);
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('show'), 3400);
  }

  /* ---------- Global interactions ---------- */
  function initGlobal() {
    const header = $('#siteHeader');
    const progress = $('#progress');
    const toTop = $('#toTop');
    const onScroll = () => {
      const y = window.scrollY;
      header.classList.toggle('scrolled', y > 10);
      toTop.classList.toggle('show', y > 600);
      const h = document.documentElement.scrollHeight - innerHeight;
      progress.style.width = (h > 0 ? (y / h) * 100 : 0) + '%';
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    toTop.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));

    // theme
    const themeBtn = $('#themeBtn');
    const syncThemeIcon = () => { themeBtn.textContent = isDark() ? '☀️' : '🌙'; };
    syncThemeIcon();
    themeBtn.addEventListener('click', () => {
      const next = isDark() ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      store.set('kcc-theme', next);
      syncThemeIcon();
    });

    // drawer
    const menuBtn = $('#menuBtn');
    const openDrawer = (o) => { document.body.classList.toggle('drawer-open', o); menuBtn.setAttribute('aria-expanded', o); if (o) $('#drawerClose').focus(); };
    menuBtn.addEventListener('click', () => openDrawer(true));
    $('#drawerClose').addEventListener('click', () => openDrawer(false));
    $('#drawerBackdrop').addEventListener('click', () => openDrawer(false));
    $$('#drawer a').forEach((a) => a.addEventListener('click', () => openDrawer(false)));

    // newsletter
    $('#newsletterForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const inp = $('#nlEmail');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inp.value.trim())) { toast('Please enter a valid email address.'); inp.focus(); return; }
      inp.value = '';
      toast('🎉 Subscribed! You will receive KCC ITM updates.');
    });

    initSearch();

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); }
      if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); openSearch(); }
      if (e.key === 'Escape') { closeSearch(); openDrawer(false); closeModals(); }
    });
  }

  /* ---------- Search ---------- */
  let searchIndex = [];
  let selIdx = 0;
  function initSearch() {
    searchIndex = [
      ...D.pages.map((p) => ({ tag: 'Page', title: p.title, url: p.url, text: p.text })),
      ...D.programmes.map((p) => ({ tag: p.degree, title: p.name, url: 'academics.html?p=' + p.id, text: p.desc + ' ' + p.careers.join(' ') })),
      ...D.departments.map((d) => ({ tag: 'Department', title: d.name, url: 'academics.html#departments', text: d.text })),
      ...D.facilities.map((f) => ({ tag: 'Campus', title: f.name, url: 'campus.html#facilities', text: f.text })),
      ...D.clubs.map((c) => ({ tag: 'Club', title: c.name, url: 'campus.html#clubs', text: c.text })),
      ...D.faqs.map((f) => ({ tag: 'FAQ', title: f.q, url: 'admissions.html#faq', text: f.a })),
      ...D.news.map((n) => ({ tag: 'News', title: n.title, url: 'news.html#news', text: n.text }))
    ];
    $('#searchBtn').addEventListener('click', openSearch);
    $('#searchOverlay').addEventListener('click', (e) => { if (e.target.id === 'searchOverlay') closeSearch(); });
    const input = $('#searchInput');
    input.addEventListener('input', () => { selIdx = 0; renderSearch(input.value); });
    input.addEventListener('keydown', (e) => {
      const items = $$('#searchResults a');
      if (e.key === 'ArrowDown') { e.preventDefault(); selIdx = Math.min(selIdx + 1, items.length - 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); selIdx = Math.max(selIdx - 1, 0); }
      else if (e.key === 'Enter' && items[selIdx]) { e.preventDefault(); location.href = items[selIdx].getAttribute('href'); closeSearch(); return; }
      else return;
      items.forEach((a, i) => a.classList.toggle('sel', i === selIdx));
      if (items[selIdx]) items[selIdx].scrollIntoView({ block: 'nearest' });
    });
  }
  function renderSearch(q) {
    const box = $('#searchResults');
    q = q.trim().toLowerCase();
    let res;
    if (!q) res = searchIndex.filter((r) => r.tag === 'Page').slice(0, 8);
    else {
      const terms = q.split(/\s+/);
      res = searchIndex.map((r) => {
        const t = r.title.toLowerCase(); const b = r.text.toLowerCase();
        let score = 0;
        for (const term of terms) {
          if (t.includes(term)) score += t.startsWith(term) ? 5 : 3;
          else if (b.includes(term)) score += 1;
          else return null;
        }
        return { r, score };
      }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 10).map((x) => x.r);
    }
    box.innerHTML = res.length
      ? res.map((r, i) => '<a href="' + r.url + '" class="' + (i === selIdx ? 'sel' : '') + '"><span class="tag">' + esc(r.tag) + '</span><b>' + esc(r.title) + '</b><span>' + esc(r.text.slice(0, 90)) + (r.text.length > 90 ? '…' : '') + '</span></a>').join('')
      : '<div class="search-empty">No results for “' + esc(q) + '”. Try “B.Tech”, “hostel” or “fees”.</div>';
    $$('a', box).forEach((a) => a.addEventListener('click', closeSearch));
  }
  function openSearch() {
    $('#searchOverlay').classList.add('open');
    document.body.classList.add('modal-open');
    const input = $('#searchInput');
    input.value = '';
    selIdx = 0;
    renderSearch('');
    setTimeout(() => input.focus(), 30);
  }
  function closeSearch() {
    const o = $('#searchOverlay');
    if (o && o.classList.contains('open')) { o.classList.remove('open'); document.body.classList.remove('modal-open'); }
  }

  /* ---------- Reveal, counters, bars ---------- */
  function initReveal() {
    const els = $$('.reveal');
    const counters = $$('[data-count]');
    const bars = $$('.bar-fill[data-w]');
    if (!('IntersectionObserver' in window)) {
      els.forEach((e) => e.classList.add('in'));
      counters.forEach((c) => { c.textContent = c.dataset.count + (c.dataset.suffix || ''); });
      bars.forEach((b) => { b.style.width = b.dataset.w + '%'; });
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const el = en.target;
        if (el.classList.contains('reveal')) el.classList.add('in');
        if (el.dataset.count) animateCount(el);
        if (el.dataset.w) el.style.width = el.dataset.w + '%';
        io.unobserve(el);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    [...els, ...counters, ...bars].forEach((e) => io.observe(e));
  }
  function animateCount(el) {
    const target = parseFloat(el.dataset.count);
    const dec = (el.dataset.count.split('.')[1] || '').length;
    const suffix = el.dataset.suffix || '';
    const prefix = el.dataset.prefix || '';
    const dur = 1600; const t0 = performance.now();
    const step = (t) => {
      const p = Math.min((t - t0) / dur, 1);
      const v = target * (1 - Math.pow(1 - p, 3));
      el.textContent = prefix + v.toFixed(dec) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------- Ticker ---------- */
  function initTicker() {
    const track = $('#tickerTrack');
    if (!track) return;
    const items = [
      ['Admissions open for ' + I.session + ' — B.Tech, Lateral Entry, M.Tech & MBA', 'admissions.html#apply'],
      ...D.notices.slice(0, 4).map((n) => [n.text, 'news.html#notices']),
      ['Pay your semester fees online — instant digital receipt', 'admissions.html#pay-fees'],
      ['Upcoming: ' + D.events[0].title + ' — ' + fmtDate(D.events[0].date), 'news.html#events']
    ];
    const html = items.map((i) => '<span><a href="' + i[1] + '">' + esc(i[0]) + '</a></span>').join('');
    track.innerHTML = html + html;
  }

  /* ---------- Hero slider + rotating word ---------- */
  function initHero() {
    const slides = $$('.hero-slide');
    const dotsBox = $('.hero-dots');
    if (slides.length && dotsBox) {
      let i = 0;
      dotsBox.innerHTML = slides.map((_, k) => '<button aria-label="Show slide ' + (k + 1) + '"' + (k === 0 ? ' class="active"' : '') + '></button>').join('');
      const dots = $$('button', dotsBox);
      const go = (n) => { slides[i].classList.remove('active'); dots[i].classList.remove('active'); i = n; slides[i].classList.add('active'); dots[i].classList.add('active'); };
      dots.forEach((d, k) => d.addEventListener('click', () => { go(k); restart(); }));
      let h; const restart = () => { clearInterval(h); h = setInterval(() => go((i + 1) % slides.length), 6000); };
      restart();
    }
    const rot = $('.hero-rotator');
    if (rot) {
      const words = rot.dataset.words.split('|');
      let k = 0;
      setInterval(() => {
        k = (k + 1) % words.length;
        rot.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-8px)' }], { duration: 250 }).onfinish = () => {
          rot.textContent = words[k];
          rot.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 250 });
        };
      }, 2600);
    }
  }

  /* ---------- Renderers ---------- */
  function progCard(p) {
    return '<article class="prog-card reveal" data-level="' + p.level + '" data-id="' + p.id + '">' +
      '<div class="prog-top"><div class="pi">' + p.icon + '</div><div><h3>' + esc(p.name) + '</h3><small>' + p.degree + ' · ' + p.duration + '</small></div></div>' +
      '<div class="prog-body"><div class="badges"><span class="badge">' + (p.level === 'ug' ? 'Undergraduate' : 'Postgraduate') + '</span><span class="badge gold">AKTU Affiliated</span></div>' +
      '<p>' + esc(p.desc) + '</p>' +
      '<div class="prog-actions"><button class="btn btn-line btn-sm" data-prog="' + p.id + '">Details</button><a class="btn btn-crimson btn-sm" href="admissions.html?course=' + p.id + '#apply">Apply</a></div></div></article>';
  }
  function renderProgrammes(target, list) {
    target.innerHTML = list.length ? list.map(progCard).join('') : '<div class="empty-state">No programmes match your search.</div>';
    $$('.reveal', target).forEach((e) => requestAnimationFrame(() => e.classList.add('in')));
  }
  function initCatalog() {
    const grid = $('#progGrid');
    if (!grid) return;
    const limit = parseInt(grid.dataset.limit || '0', 10);
    let level = 'all'; let q = '';
    const apply = () => {
      let list = D.programmes.filter((p) => (level === 'all' || p.level === level) && (!q || (p.name + ' ' + p.desc + ' ' + p.degree).toLowerCase().includes(q)));
      if (limit) list = list.slice(0, limit);
      renderProgrammes(grid, list);
    };
    $$('[data-filter]').forEach((c) => c.addEventListener('click', () => {
      $$('[data-filter]').forEach((x) => x.classList.toggle('active', x === c));
      level = c.dataset.filter; apply();
    }));
    const s = $('#progSearch');
    if (s) s.addEventListener('input', () => { q = s.value.trim().toLowerCase(); apply(); });
    apply();
    const want = new URLSearchParams(location.search).get('p');
    if (want && D.programmes.some((p) => p.id === want)) setTimeout(() => openProgramme(want), 250);
  }

  function openProgramme(id) {
    const p = D.programmes.find((x) => x.id === id);
    if (!p) return;
    const elig = p.level === 'pg'
      ? (p.degree === 'MBA' ? 'Graduation in any discipline with minimum 50% marks (45% for reserved categories); valid CUET-PG / CAT / MAT / CMAT score as notified.' : 'B.E./B.Tech in a relevant discipline with minimum marks as per AICTE/AKTU norms; GATE score preferred.')
      : (p.id === 'lateral' ? 'Three-year diploma in engineering (or B.Sc with Mathematics) with at least 45% marks (40% for reserved categories).' : '10+2 with Physics & Mathematics plus one of Chemistry / Biology / Computer Science / technical vocational subject, minimum 45% marks (40% reserved); admission via JEE Main & AKTU/UPTAC counselling.');
    $('#progModalBody').innerHTML =
      '<div class="modal-head"><span class="badge gold">' + p.degree + ' · ' + p.duration + '</span><h3>' + p.icon + ' ' + esc(p.name) + '</h3></div>' +
      '<div class="modal-body">' +
        '<div class="kv"><div><small>Degree</small><b>' + p.degree + '</b></div><div><small>Duration</small><b>' + p.duration + '</b></div><div><small>Awarded by</small><b>AKTU, Lucknow</b></div><div><small>Mode</small><b>Full-time</b></div></div>' +
        '<h4>Overview</h4><p>' + esc(p.desc) + '</p>' +
        '<h4>Eligibility</h4><p>' + elig + '</p>' +
        '<h4>Programme Highlights</h4><ul>' + p.highlights.map((h) => '<li>' + esc(h) + '</li>').join('') + '</ul>' +
        '<h4>Career Paths</h4><div class="badges">' + p.careers.map((c) => '<span class="badge">' + esc(c) + '</span>').join('') + '</div>' +
        '<div class="hero-actions" style="margin-top:22px"><a class="btn btn-crimson" href="admissions.html?course=' + p.id + '#apply">Apply for this programme →</a><a class="btn btn-line" href="admissions.html#fees">View fees</a></div>' +
      '</div>';
    openModal('progModal');
  }

  function openModal(id) { const m = document.getElementById(id); if (!m) return; m.classList.add('open'); document.body.classList.add('modal-open'); const c = $('.modal-close', m); if (c) c.focus(); }
  function closeModals() { $$('.modal.open').forEach((m) => m.classList.remove('open')); if (!$('#searchOverlay.open')) document.body.classList.remove('modal-open'); }
  function initModals() {
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-prog]');
      if (b) { openProgramme(b.dataset.prog); return; }
      if (e.target.classList.contains('modal') || e.target.closest('.modal-close')) closeModals();
    });
  }

  function renderSimpleCards(sel, list, cls) {
    const el = $(sel);
    if (!el) return;
    el.innerHTML = list.map((x) => '<div class="card reveal ' + (cls || '') + '"><div class="ico">' + x.icon + '</div><div><h3>' + esc(x.name) + '</h3><p>' + esc(x.text) + '</p></div></div>').join('');
  }

  function renderRecruiters() {
    $$('.logo-marquee').forEach((m, idx) => {
      const list = idx % 2 ? [...D.recruiters].reverse() : D.recruiters;
      const html = list.map((r) => '<div class="logo-pill">' + esc(r) + '</div>').join('');
      m.innerHTML = '<div class="logo-track' + (idx % 2 ? ' reverse' : '') + '">' + html + html + '</div>';
    });
  }

  function newsCard(n, i) {
    return '<article class="news-card reveal" data-cat="' + esc(n.cat) + '"><div class="news-thumb c' + ((i % 4) + 1) + '"><span class="cat">' + esc(n.cat) + '</span>' + n.icon + '</div>' +
      '<div class="news-body"><time datetime="' + n.date + '">' + fmtDate(n.date) + '</time><h3>' + esc(n.title) + '</h3><p>' + esc(n.text) + '</p></div></article>';
  }
  function eventRow(e) {
    const d = parseDate(e.date);
    return '<div class="event-row reveal" data-type="' + esc(e.type) + '"><div class="date-box"><b>' + String(d.getDate()).padStart(2, '0') + '</b><small>' + MONTHS[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2) + '</small></div>' +
      '<div><h4>' + esc(e.title) + '</h4><div class="meta"><span>📍 ' + esc(e.venue) + '</span><span>🏷️ ' + esc(e.type) + '</span></div></div>' +
      '<button class="btn btn-line btn-sm" data-ics="' + e.date + '|' + esc(e.title) + '|' + esc(e.venue) + '">+ Calendar</button></div>';
  }
  function renderNews() {
    const nl = $('#newsGrid');
    if (nl) {
      const limit = parseInt(nl.dataset.limit || '0', 10);
      const draw = (cat) => {
        let list = D.news.filter((n) => cat === 'all' || n.cat === cat);
        if (limit) list = list.slice(0, limit);
        nl.innerHTML = list.map(newsCard).join('') || '<div class="empty-state">No news in this category yet.</div>';
        $$('.reveal', nl).forEach((e) => requestAnimationFrame(() => e.classList.add('in')));
      };
      const fbox = $('#newsFilters');
      if (fbox) {
        const cats = ['all', ...new Set(D.news.map((n) => n.cat))];
        fbox.innerHTML = cats.map((c, i) => '<button class="chip' + (i === 0 ? ' active' : '') + '" data-ncat="' + esc(c) + '">' + (c === 'all' ? 'All News' : esc(c)) + '</button>').join('');
        $$('[data-ncat]', fbox).forEach((b) => b.addEventListener('click', () => { $$('[data-ncat]', fbox).forEach((x) => x.classList.toggle('active', x === b)); draw(b.dataset.ncat); }));
      }
      draw('all');
    }
    const el = $('#eventList');
    if (el) {
      const limit = parseInt(el.dataset.limit || '0', 10);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      let list = D.events.filter((e) => parseDate(e.date) >= today);
      if (!list.length) list = D.events;
      if (limit) list = list.slice(0, limit);
      el.innerHTML = list.map(eventRow).join('');
    }
    const nt = $('#noticeList');
    if (nt) {
      const limit = parseInt(nt.dataset.limit || '0', 10);
      const list = limit ? D.notices.slice(0, limit) : D.notices;
      nt.innerHTML = list.map((n) => '<li><time datetime="' + n.date + '">' + fmtDate(n.date).replace(/ \d{4}$/, '') + '</time><span>' + esc(n.text) + (n.isNew ? '<span class="new-flag">NEW</span>' : '') + '</span></li>').join('');
    }
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ics]');
      if (!b) return;
      const [date, title, venue] = b.dataset.ics.split('|');
      const dt = date.replace(/-/g, '');
      const next = parseDate(date); next.setDate(next.getDate() + 1);
      const dt2 = next.getFullYear() + String(next.getMonth() + 1).padStart(2, '0') + String(next.getDate()).padStart(2, '0');
      const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//KCC ITM//Events//EN', 'BEGIN:VEVENT', 'UID:' + dt + '-' + title.replace(/\W+/g, '') + '@kccitm', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z', 'DTSTART;VALUE=DATE:' + dt, 'DTEND;VALUE=DATE:' + dt2, 'SUMMARY:' + title, 'LOCATION:' + venue + ', KCC ITM Greater Noida', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
      a.download = title.replace(/\W+/g, '-').toLowerCase() + '.ics';
      document.body.appendChild(a); a.click(); a.remove();
      toast('📅 Calendar file downloaded.');
    });
  }

  function renderFaq() {
    const el = $('#faqList');
    if (!el) return;
    el.innerHTML = D.faqs.map((f, i) => '<details class="reveal"' + (i === 0 ? ' open' : '') + '><summary>' + esc(f.q) + '</summary><div class="ans">' + esc(f.a) + '</div></details>').join('');
  }

  /* ---------- Tabs ---------- */
  function initTabs() {
    $$('[data-tabs]').forEach((wrap) => {
      const tabs = $$('.tab', wrap);
      tabs.forEach((t) => t.addEventListener('click', () => {
        tabs.forEach((x) => { x.classList.toggle('active', x === t); x.setAttribute('aria-selected', x === t); });
        $$('.tab-panel', wrap).forEach((p) => p.classList.toggle('active', p.id === t.dataset.target));
      }));
    });
  }

  /* ---------- Sub-nav scrollspy ---------- */
  function initSubnav() {
    const links = $$('.subnav a[href^="#"]');
    if (!links.length || !('IntersectionObserver' in window)) return;
    const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          links.forEach((l) => l.classList.remove('active'));
          const a = map.get(en.target.id);
          if (a) { a.classList.add('active'); a.scrollIntoView({ block: 'nearest', inline: 'center' }); }
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    map.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  }

  /* ---------- Gallery lightbox ---------- */
  function initGallery() {
    const items = $$('.g-item');
    if (!items.length) return;
    let cur = 0;
    const show = (i) => {
      cur = (i + items.length) % items.length;
      const it = items[cur];
      $('#lbStage').style.background = getComputedStyle(it).backgroundImage;
      $('#lbStage').textContent = it.dataset.icon;
      $('#lbCap').textContent = it.dataset.caption;
      $('#lbCount').textContent = (cur + 1) + ' / ' + items.length;
    };
    items.forEach((it, i) => it.addEventListener('click', () => { show(i); openModal('lightbox'); }));
    $('#lbPrev').addEventListener('click', () => show(cur - 1));
    $('#lbNext').addEventListener('click', () => show(cur + 1));
    document.addEventListener('keydown', (e) => {
      if (!$('#lightbox.open')) return;
      if (e.key === 'ArrowLeft') show(cur - 1);
      if (e.key === 'ArrowRight') show(cur + 1);
    });
  }

  /* ---------- Testimonial-style rotator (pillars) ---------- */
  function initRotator() {
    $$('[data-rotator]').forEach((wrap) => {
      const items = $$('.testi', wrap);
      if (!items.length) return;
      let i = 0;
      const go = (n) => { items[i].classList.remove('active'); i = (n + items.length) % items.length; items[i].classList.add('active'); };
      const prev = $('[data-prev]', wrap); const next = $('[data-next]', wrap);
      if (prev) prev.addEventListener('click', () => { go(i - 1); restart(); });
      if (next) next.addEventListener('click', () => { go(i + 1); restart(); });
      let h; const restart = () => { clearInterval(h); h = setInterval(() => go(i + 1), 7000); };
      restart();
    });
  }

  /* ---------- Forms ---------- */
  const RULES = {
    required: (v) => v.trim() !== '',
    email: (v) => v.trim() === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
    mobile: (v) => /^[6-9]\d{9}$/.test(v.replace(/\D/g, '').slice(-10)) && v.replace(/\D/g, '').length >= 10,
    name: (v) => /^[A-Za-z][A-Za-z .'-]{1,60}$/.test(v.trim())
  };
  function validate(scope) {
    let ok = true; let first = null;
    $$('[data-v]', scope).forEach((inp) => {
      const g = inp.closest('.f-group');
      const rules = inp.dataset.v.split(' ');
      const val = inp.type === 'checkbox' ? (inp.checked ? 'y' : '') : inp.value;
      const bad = rules.some((r) => RULES[r] && !RULES[r](val));
      if (g) g.classList.toggle('invalid', bad);
      if (bad) { ok = false; if (!first) first = inp; }
    });
    if (first) first.focus();
    return ok;
  }
  function liveValidate(form) {
    $$('[data-v]', form).forEach((inp) => inp.addEventListener('input', () => { const g = inp.closest('.f-group'); if (g && g.classList.contains('invalid')) validate(g); }));
  }
  const refCode = (p) => p + '-' + new Date().getFullYear() + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();

  function fillCourseSelects() {
    $$('select[data-courses]').forEach((s) => {
      const opts = D.programmes.map((p) => '<option value="' + p.id + '">' + p.degree + ' — ' + esc(p.name) + '</option>').join('');
      s.insertAdjacentHTML('beforeend', opts);
    });
    const want = new URLSearchParams(location.search).get('course');
    if (want) $$('select[data-courses]').forEach((s) => { if (D.programmes.some((p) => p.id === want)) s.value = want; });
  }

  function initSimpleForms() {
    $$('form[data-simple]').forEach((form) => {
      liveValidate(form);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!validate(form)) return;
        const btn = $('button[type=submit]', form);
        btn.disabled = true; const label = btn.textContent; btn.textContent = 'Sending…';
        setTimeout(() => {
          const succ = form.parentElement.querySelector('.form-success');
          if (succ) {
            form.style.display = 'none';
            const rc = $('.ref-code', succ); if (rc) rc.textContent = 'Reference: ' + refCode(form.dataset.simple);
            succ.classList.add('show');
          } else toast('✅ Thank you! Our team will contact you shortly.');
          form.reset(); btn.disabled = false; btn.textContent = label;
        }, 900);
      });
    });
    $$('[data-reset-form]').forEach((b) => b.addEventListener('click', () => {
      const card = b.closest('.form-card');
      $('.form-success', card).classList.remove('show');
      $('form', card).style.display = '';
    }));
  }

  function wizard(root, onStep, beforeNext) {
    const steps = $$('.f-step', root);
    const marks = $$('.stepper .s', root);
    let cur = 0;
    const go = (n) => {
      steps[cur].classList.remove('active'); steps[n].classList.add('active');
      marks.forEach((m, i) => { m.classList.toggle('active', i === n); m.classList.toggle('done', i < n); });
      cur = n;
      if (onStep) onStep(n);
      const top = root.getBoundingClientRect().top + scrollY - 150;
      if (scrollY > top) scrollTo({ top, behavior: 'smooth' });
    };
    $$('[data-next]', root).forEach((b) => b.addEventListener('click', () => { if (validate(steps[cur]) && (!beforeNext || beforeNext(cur))) go(cur + 1); }));
    $$('[data-back]', root).forEach((b) => b.addEventListener('click', () => go(cur - 1)));
    liveValidate(root);
    return { go, get cur() { return cur; }, steps };
  }

  function initApply() {
    const root = $('#applyWizard');
    if (!root) return;
    const val = (id) => ($('#' + id).value || '').trim();
    const w = wizard(root, (n) => {
      if (n === 2) {
        const c = D.programmes.find((p) => p.id === val('apCourse'));
        $('#apReview').innerHTML = [
          ['Applicant', val('apName')], ['Mobile', val('apMobile')], ['Email', val('apEmail') || '—'], ['State', val('apState')],
          ['Programme', c ? c.degree + ' — ' + c.name : '—'], ['Qualifying Exam', val('apQual')], ['Score / %', val('apScore') || '—'], ['Entrance', val('apEntrance') || '—']
        ].map((r) => '<div class="summary-row"><span>' + r[0] + '</span><span>' + esc(r[1]) + '</span></div>').join('');
      }
    });
    $('#apSubmit').addEventListener('click', () => {
      if (!validate(w.steps[2])) return;
      const b = $('#apSubmit'); b.disabled = true; b.textContent = 'Submitting…';
      setTimeout(() => {
        $('#apForm').style.display = 'none';
        $('#apRef').textContent = 'Application No: ' + refCode('KCCAPP');
        $('#apSuccess').classList.add('show');
        b.disabled = false; b.textContent = 'Submit Application';
      }, 1100);
    });
    $('#apAgain').addEventListener('click', () => {
      $$('input, select', root).forEach((i) => { if (i.type === 'checkbox') i.checked = false; else i.value = ''; });
      $('#apSuccess').classList.remove('show'); $('#apForm').style.display = ''; w.go(0);
    });
  }

  const FEE_HEADS = { tuition: ['Tuition Fee (Semester)', 55000], exam: ['Examination Fee', 2500], hostel: ['Hostel Fee (Semester)', 45000], transport: ['Transport Fee (Semester)', 15000], library: ['Library & Lab Fee', 3000], late: ['Late Fee', 500] };
  function initPay() {
    const root = $('#payWizard');
    if (!root) return;
    const val = (id) => ($('#' + id).value || '').trim();
    const inr = (n) => '₹' + n.toLocaleString('en-IN');
    const selected = () => $$('input[name=feeHead]:checked', root).map((c) => FEE_HEADS[c.value]);
    const calc = () => {
      const heads = selected();
      const sub = heads.reduce((a, h) => a + h[1], 0);
      const mode = ($('input[name=payMode]:checked', root) || {}).value;
      const conv = mode === 'Credit Card' ? Math.round(sub * 0.012) : 0;
      return { heads, sub, conv, total: sub + conv, mode };
    };
    const drawSummary = () => {
      const c = calc();
      $('#feeLive').innerHTML = c.heads.length
        ? c.heads.map((h) => '<div class="summary-row"><span>' + h[0] + '</span><span>' + inr(h[1]) + '</span></div>').join('') + (c.conv ? '<div class="summary-row"><span>Card convenience (1.2%)</span><span>' + inr(c.conv) + '</span></div>' : '') + '<div class="summary-row total"><span>Total Payable</span><span>' + inr(c.total) + '</span></div>'
        : '<div class="summary-row"><span>Select at least one fee head</span><span>—</span></div>';
    };
    $$('input[name=feeHead], input[name=payMode]', root).forEach((i) => i.addEventListener('change', drawSummary));
    drawSummary();
    const w = wizard(root, (n) => {
      if (n === 2) {
        const c = calc();
        $('#payReview').innerHTML = [
          ['Student', val('pyName')], ['Roll / Enrolment No.', val('pyRoll')], ['Programme', $('#pyCourse').selectedOptions[0] ? $('#pyCourse').selectedOptions[0].text : ''], ['Semester', val('pySem')], ['Payment Mode', c.mode || '—']
        ].map((r) => '<div class="summary-row"><span>' + r[0] + '</span><span>' + esc(r[1]) + '</span></div>').join('') +
          c.heads.map((h) => '<div class="summary-row"><span>' + h[0] + '</span><span>' + inr(h[1]) + '</span></div>').join('') +
          (c.conv ? '<div class="summary-row"><span>Convenience fee</span><span>' + inr(c.conv) + '</span></div>' : '') +
          '<div class="summary-row total"><span>Total</span><span>' + inr(c.total) + '</span></div>';
      }
    }, (n) => {
      if (n === 1 && (!selected().length || !$('input[name=payMode]:checked', root))) { toast('Select at least one fee head and a payment mode.'); return false; }
      return true;
    });
    $('#payNow').addEventListener('click', () => {
      if (!validate(w.steps[2])) return;
      const b = $('#payNow'); b.disabled = true; b.textContent = '⏳ Connecting to secure gateway…';
      setTimeout(() => {
        const c = calc();
        const txn = refCode('KCCTXN');
        $('#payForm').style.display = 'none';
        $('#payTxn').textContent = 'Transaction ID: ' + txn;
        $('#payAmt').textContent = inr(c.total) + ' paid via ' + c.mode;
        $('#paySuccess').classList.add('show');
        $('#payReceipt').onclick = () => receipt(txn, c);
        b.disabled = false; b.textContent = '🔒 Pay Securely';
      }, 2000);
    });
    $('#payAgain').addEventListener('click', () => {
      $$('input[type=text], input[type=tel], input[type=email], select', root).forEach((i) => { i.value = ''; });
      $$('input[type=checkbox], input[type=radio]', root).forEach((i) => { i.checked = false; });
      drawSummary();
      $('#paySuccess').classList.remove('show'); $('#payForm').style.display = ''; w.go(0);
    });
    function receipt(txn, c) {
      const rows = c.heads.map((h) => '<tr><td>' + h[0] + '</td><td style="text-align:right">' + inr(h[1]) + '</td></tr>').join('') + (c.conv ? '<tr><td>Convenience fee</td><td style="text-align:right">' + inr(c.conv) + '</td></tr>' : '');
      const html = '<!doctype html><html><head><meta charset="utf-8"><title>Fee Receipt ' + txn + '</title><style>body{font-family:system-ui,sans-serif;max-width:640px;margin:30px auto;padding:0 16px;color:#1c1c1e}h1{color:#8B1A1A;font-size:20px;margin:0}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}.tot td{font-weight:700;border-top:2px solid #8B1A1A}.muted{color:#666;font-size:12px}.hd{border-bottom:3px solid #C9A84C;padding-bottom:12px;margin-bottom:16px}</style></head><body><div class="hd"><h1>' + esc(I.name) + '</h1><div class="muted">' + esc(I.address) + '</div></div><h2 style="font-size:16px">Fee Payment Receipt (Demo)</h2>' +
        '<p><b>Transaction ID:</b> ' + txn + '<br><b>Date:</b> ' + new Date().toLocaleString('en-IN') + '<br><b>Student:</b> ' + esc(val('pyName')) + '<br><b>Roll No.:</b> ' + esc(val('pyRoll')) + '<br><b>Semester:</b> ' + esc(val('pySem')) + '<br><b>Mode:</b> ' + esc(c.mode) + '</p>' +
        '<table><tr><th>Fee Head</th><th style="text-align:right">Amount</th></tr>' + rows + '<tr class="tot"><td>Total</td><td style="text-align:right">' + inr(c.total) + '</td></tr></table><p class="muted">This is a computer-generated demo receipt from the website prototype and is not valid for accounting purposes.</p><script>print()<\/script></body></html>';
      const wdw = window.open('', '_blank');
      if (wdw) { wdw.document.write(html); wdw.document.close(); } else toast('Please allow pop-ups to view the receipt.');
    }
  }

  /* ---------- Fee estimator (admissions) ---------- */
  function initEstimator() {
    const box = $('#estimator');
    if (!box) return;
    const inr = (n) => '₹' + n.toLocaleString('en-IN');
    const calc = () => {
      const tuition = parseInt($('#esProg').value, 10);
      const years = parseInt($('#esProg').selectedOptions[0].dataset.years, 10);
      const hostel = $('#esHostel').checked ? 90000 : 0;
      const bus = $('#esBus').checked ? 30000 : 0;
      const sch = parseInt($('#esSch').value, 10) / 100;
      const perYear = tuition * (1 - sch) + hostel + bus;
      $('#esYear').textContent = inr(Math.round(perYear));
      $('#esTotal').textContent = inr(Math.round(perYear * years));
      $('#esSchLbl').textContent = (sch * 100) + '%';
    };
    $$('input, select', box).forEach((i) => i.addEventListener('input', calc));
    calc();
  }

  /* ---------- Contact map lazy ---------- */
  function initMap() {
    const f = $('#mapFrame');
    if (f && !f.src) f.src = 'https://www.google.com/maps?q=' + encodeURIComponent(I.mapQuery) + '&output=embed';
  }

  /* ---------- Boot ---------- */
  buildLayout();
  initGlobal();
  initTicker();
  initHero();
  initCatalog();
  initModals();
  renderSimpleCards('#deptGrid', D.departments, 'dept');
  renderSimpleCards('#facGrid', D.facilities);
  renderSimpleCards('#clubGrid', D.clubs);
  renderRecruiters();
  renderNews();
  renderFaq();
  fillCourseSelects();
  initTabs();
  initSubnav();
  initGallery();
  initRotator();
  initSimpleForms();
  initApply();
  initPay();
  initEstimator();
  initMap();
  initReveal();
  // Handle hash after dynamic content renders
  if (location.hash) { const t = document.getElementById(location.hash.slice(1)); if (t) setTimeout(() => t.scrollIntoView(), 60); }
  window.KCCUI = { toast, openProgramme };
})();
