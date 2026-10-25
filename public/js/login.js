import { api, onSubmit } from './lib.js';

const LABELS = {
  student: ['Enrollment Number', 'e.g. 24KCCCSE001'],
  faculty: ['Employee ID', 'e.g. KCCF001'],
  admin: ['Admin Username', 'admin'],
};
const DEMO = { student: ['24KCCCSE001', 'Student@123'], faculty: ['KCCF001', 'Faculty@123'], admin: ['admin', 'Admin@123'] };

const form = document.querySelector('#loginForm');
const setRole = (role) => {
  document.querySelectorAll('[data-role]').forEach((b) => b.classList.toggle('active', b.dataset.role === role));
  document.querySelector('#userLabel').textContent = LABELS[role][0];
  form.username.placeholder = LABELS[role][1];
};
document.querySelectorAll('[data-role]').forEach((b) => b.addEventListener('click', () => setRole(b.dataset.role)));
document.querySelectorAll('[data-demo]').forEach((b) => b.addEventListener('click', () => {
  setRole(b.dataset.demo);
  [form.username.value, form.password.value] = DEMO[b.dataset.demo];
}));

// Demo credentials are only shown while the server runs with demo data.
const demoBox = document.querySelector('#demoBox');
demoBox.hidden = true;
api('/site').then((s) => { demoBox.hidden = !s.demo; }).catch(() => {});

api('/auth/me').then(() => { location.href = '/portal'; }).catch(() => {});

onSubmit(form, async (d) => {
  await api('/auth/login', { method: 'POST', body: d });
  const next = new URLSearchParams(location.search).get('next');
  location.href = next && next.startsWith('/portal') ? next : '/portal';
});
