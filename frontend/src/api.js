const API_BASE = import.meta.env.VITE_API_URL || ''

export function api(path) {
  return fetch(`${API_BASE}${path}`).then(r => r.json())
}
