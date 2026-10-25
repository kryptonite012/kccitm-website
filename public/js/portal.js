import { api, html, toast, toastError, modal, onSubmit } from './lib.js';

const ROLE_LABEL = { student: 'Student', faculty: 'Faculty', admin: 'Administrator' };

const state = { user: null, routes: {}, menu: [] };

const $ = (s) => document.querySelector(s);

function initials(name) {
  return name.replace(/^(Dr|Mr|Ms|Mrs)\.?\s+/i, '').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function renderMenu(active) {
  $('#menu').innerHTML = state.menu.map((item) => {
    if (item.group) return html`<div class="menu-group">${item.group}</div>`;
    const r = state.routes[item];
    return html`<a href="#/${item}" class="${item === active ? 'active' : ''}"><span class="ico" aria-hidden="true">${r.icon}</span>${r.title}</a>`;
  }).join('');
}

// Shared "change password" and "notices" views available to every role.
const commonRoutes = {
  password: {
    title: 'Change Password', icon: '🔑',
    render(el) {
      el.innerHTML = html`<div class="card" style="max-width:520px">
        <h2>Change your password</h2>
        <form id="pwForm">
          <label>Current password<input type="password" name="current" required autocomplete="current-password"></label>
          <label>New password<input type="password" name="next" required minlength="8" autocomplete="new-password"></label>
          <label>Confirm new password<input type="password" name="confirm" required minlength="8" autocomplete="new-password"></label>
          <p class="tiny muted">At least 8 characters with letters and numbers.</p>
          <button class="btn btn-primary" type="submit">Update password</button>
        </form></div>`;
      onSubmit(el.querySelector('#pwForm'), async (d, form) => {
        if (d.next !== d.confirm) throw new Error('New passwords do not match');
        const r = await api('/auth/change-password', { method: 'POST', body: d });
        toast(r.message);
        form.reset();
      });
    },
  },
};

async function route() {
  const name = (location.hash.replace(/^#\//, '').split('?')[0]) || 'dashboard';
  const r = state.routes[name] || state.routes.dashboard;
  const key = state.routes[name] ? name : 'dashboard';
  renderMenu(key);
  $('#pageTitle').textContent = r.title;
  document.title = `${r.title} · KCCITM ERP`;
  $('#sidebar').classList.remove('open');
  $('#overlay').classList.remove('open');
  // Each navigation renders into a fresh container so a slow, superseded render can never overwrite a newer page.
  const view = document.createElement('div');
  view.innerHTML = '<div class="spinner"></div>';
  $('#view').replaceChildren(view);
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  try {
    await r.render(view, { user: state.user, params });
  } catch (err) {
    if (err.status === 401) return (location.href = '/login');
    view.innerHTML = html`<div class="card"><div class="empty">⚠️ ${err.message}</div></div>`;
  }
  window.scrollTo(0, 0);
}

function forcePasswordChange() {
  const m = modal(html`<h3>Set a new password</h3>
    <p class="muted small">For your security, please replace the temporary password before continuing.</p>
    <form id="fpw">
      <label>Temporary password<input type="password" name="current" required></label>
      <label>New password<input type="password" name="next" required minlength="8"></label>
      <label>Confirm new password<input type="password" name="confirm" required minlength="8"></label>
      <button class="btn btn-primary btn-block" type="submit">Save password</button>
    </form>`.toString());
  onSubmit(m.el.querySelector('#fpw'), async (d) => {
    if (d.next !== d.confirm) throw new Error('New passwords do not match');
    const r = await api('/auth/change-password', { method: 'POST', body: d });
    toast(r.message);
    m.close();
  });
}

async function init() {
  let me;
  try {
    me = await api('/auth/me');
  } catch {
    location.href = `/login?next=${encodeURIComponent(location.pathname + location.hash)}`;
    return;
  }
  state.user = me;
  const mod = await import(`./portal-${me.role}.js`);
  state.routes = { ...mod.routes, ...commonRoutes };
  state.menu = [...mod.menu, { group: 'Account' }, 'password'];

  $('#userName').textContent = me.name;
  $('#userRole').textContent = `${ROLE_LABEL[me.role]} · ${me.username}`;
  $('#avatar').textContent = initials(me.name);
  $('#logoutBtn').addEventListener('click', async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    location.href = '/login';
  });
  $('#menuToggle').addEventListener('click', () => {
    $('#sidebar').classList.add('open');
    $('#overlay').classList.add('open');
  });
  $('#overlay').addEventListener('click', () => {
    $('#sidebar').classList.remove('open');
    $('#overlay').classList.remove('open');
  });
  window.addEventListener('hashchange', route);
  await route();
  if (me.must_change_password) forcePasswordChange();
}

init().catch(toastError);

