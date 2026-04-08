export function getApiBaseUrl() {
  const raw = (import.meta?.env?.VITE_API_BASE_URL || '').trim()
  if (!raw) return ''
  return raw.endsWith('/') ? raw.slice(0, -1) : raw
}

export function apiUrl(path) {
  const p = String(path || '').trim()
  if (!p) return p
  if (!p.startsWith('/')) return `${getApiBaseUrl()}/${p}`
  return `${getApiBaseUrl()}${p}`
}

export async function apiFetch(path, options) {
  return fetch(apiUrl(path), options)
}

