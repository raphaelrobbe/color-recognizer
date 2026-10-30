/** Ask the active service worker to keep every file from this visit. */
export function warmOfflineCache(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

  const collect = () => {
    const urls = new Set<string>()
    urls.add(new URL(import.meta.env.BASE_URL, window.location.origin).href)
    for (const entry of performance.getEntriesByType('resource')) {
      if (entry.name.startsWith(window.location.origin)) urls.add(entry.name)
    }
    for (const element of document.querySelectorAll('link[href], script[src]')) {
      const value = element.getAttribute('href') || element.getAttribute('src')
      if (!value) continue
      const url = new URL(value, window.location.href)
      if (url.origin === window.location.origin) urls.add(url.href)
    }
    void navigator.serviceWorker.ready.then((registration) => {
      registration.active?.postMessage({ type: 'cache-urls', urls: [...urls] })
    })
  }

  if (document.readyState === 'complete') collect()
  else window.addEventListener('load', collect, { once: true })
}
