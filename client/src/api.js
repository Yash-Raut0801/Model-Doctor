const KEY = 'md_token';
// localStorage is simple but readable by any script on the page (XSS risk). Alt: httpOnly cookie, which JS can't read.
export const session = { get: () => localStorage.getItem(KEY), set: (t) => localStorage.setItem(KEY, t), clear: () => localStorage.removeItem(KEY) };

async function req(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const token = session.get();
  if (token) headers.Authorization = `Bearer ${token}`; // attach the login token to every request
  const res = await fetch(`/api${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  // 401 while holding a token = it expired or was revoked: clear it and tell the app to show the login page.
  if (res.status === 401 && token) { session.clear(); window.dispatchEvent(new Event('auth-expired')); }
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}
const send = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const api = {
  register: (b) => req('/auth/register', send('POST', b)),
  login: (b) => req('/auth/login', send('POST', b)),
  me: () => req('/auth/me'),
  datasets: () => req('/datasets'),
  upload: (file) => { const fd = new FormData(); fd.append('file', file); return req('/datasets', { method: 'POST', body: fd }); },
  diagnose: (datasetId, target) => req('/diagnoses', send('POST', { datasetId, target })),
  getDiagnosis: (id) => req(`/diagnoses/${id}`),
};
