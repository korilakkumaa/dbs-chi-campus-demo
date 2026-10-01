const RELOAD_KEY = 'campus-chunk-reload'

function alreadyReloaded(): boolean {
  try {
    return sessionStorage.getItem(RELOAD_KEY) === '1'
  } catch {
    return true
  }
}

function reloadOnce(): void {
  try {
    sessionStorage.setItem(RELOAD_KEY, '1')
  } catch {
    return
  }
  const url = new URL(window.location.href)
  url.searchParams.set('__refresh', String(Date.now()))
  window.location.replace(url.toString())
}

/** One fresh navigation when a lazy route chunk 404s after a deploy. */
export function installChunkLoadRecovery(): void {
  window.addEventListener('vite:preloadError', (event) => {
    if (alreadyReloaded()) return
    event.preventDefault()
    reloadOnce()
  })

  window.setTimeout(() => {
    try {
      sessionStorage.removeItem(RELOAD_KEY)
    } catch {
      /* ignore */
    }
  }, 15000)
}
