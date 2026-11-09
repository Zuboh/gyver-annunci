// API layer: every non-2xx becomes an ApiError carrying the uniform { error: { code, message, details } }.
export class ApiError extends Error {
  constructor(status, error) {
    super(error.message)
    this.status = status
    this.code = error.code
    this.details = error.details
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, { code: 'NETWORK', message: 'Il server non risponde. Controlla che sia avviato.' })
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? { code: 'INTERNAL', message: `Errore HTTP ${res.status}.` })
  }
  return data
}

/** Path segment from an id (hash-derived ids are user-controlled): never splice it raw. */
export const seg = (id) => encodeURIComponent(id)

export const qs = (params) => {
  const entries = Object.entries(params).filter(([, v]) => v)
  return entries.length ? `?${new URLSearchParams(entries)}` : ''
}
