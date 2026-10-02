// One wrapper = one place for base URL, JSON parsing and error handling (alt: axios, TanStack Query).
async function req(path, opts) {
  const res = await fetch(`/api${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}
const json = (body) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const api = {
  datasets: () => req('/datasets'),
  upload: (file) => { const fd = new FormData(); fd.append('file', file); return req('/datasets', { method: 'POST', body: fd }); }, // don't set Content-Type: the browser adds the multipart boundary
  diagnose: (datasetId, target) => req('/diagnoses', json({ datasetId, target })),
  getDiagnosis: (id) => req(`/diagnoses/${id}`),
};
