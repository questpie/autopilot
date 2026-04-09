interface RuntimeEnv {
  APP_URL?: string
  API_BASE_URL?: string
}

let _cache: RuntimeEnv | null = null

function readRuntimeEnv(): RuntimeEnv {
  if (_cache) return _cache

  const el = document.getElementById('__runtime-env__')
  if (el?.textContent) {
    try {
      _cache = JSON.parse(el.textContent) as RuntimeEnv
      return _cache
    } catch {
      // fall through
    }
  }

  _cache = {}
  return _cache
}

/**
 * API base URL. Defaults to same-origin (empty string).
 * In dev mode, falls back to VITE_API_URL if set.
 */
export function getApiBaseUrl(): string {
  const env = readRuntimeEnv()
  if (env.API_BASE_URL) return env.API_BASE_URL
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL
  return ''
}

/**
 * App URL (canonical external URL). Defaults to window.location.origin.
 */
export function getAppUrl(): string {
  const env = readRuntimeEnv()
  return env.APP_URL || window.location.origin
}
