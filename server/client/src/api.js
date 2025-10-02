export const API = (path, opts = {}) => {
  const base = import.meta.env.VITE_API_BASE || '';
  return fetch(base + path, opts).then(async res => {
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await res.json() : null;
    if (!res.ok) throw data || { error: 'network' };
    return data;
  });
};
