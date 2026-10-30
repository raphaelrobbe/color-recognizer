/* App shell: after the first visit, the page and its assets open offline. */
const CACHE = 'color-recognizer-shell-v4'

const PRECACHE = [
  '',
  'index.html',
  'site.webmanifest',
  'favicon.svg',
  'logo.svg',
  'app-icon-192.png',
  'app-icon-512.png',
  'app-icon-maskable-192.png',
  'app-icon-maskable-512.png',
  'apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        Promise.all(
          PRECACHE.map((path) => cache.add(new URL(path, self.location).href).catch(() => undefined)),
        ),
      )
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'cache-urls' || !Array.isArray(event.data.urls)) return
  event.waitUntil(cacheUrls(event.data.urls))
})

async function cacheUrls(urls) {
  const cache = await caches.open(CACHE)
  await Promise.all(
    urls.map(async (raw) => {
      let url
      try {
        url = new URL(raw)
      } catch {
        return
      }
      if (url.origin !== self.location.origin || url.pathname.endsWith('.map')) return
      try {
        const response = await fetch(url.href)
        if (response.ok) await cache.put(url.href, response)
      } catch {
        /* A missing optional file must not block the shell. */
      }
    }),
  )
}

function isAsset(url) {
  if (url.pathname.endsWith('/sw.js')) return false
  return url.pathname.includes('/assets/') || /\.(?:js|css|woff2?|png|svg|ico|webmanifest)$/i.test(url.pathname)
}

async function shellResponse() {
  const cache = await caches.open(CACHE)
  return (await cache.match(new URL('./', self.location).href)) || (await cache.match(new URL('index.html', self.location).href))
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            void caches.open(CACHE).then((cache) => {
              void cache.put(request, copy.clone())
              void cache.put(new URL('./', self.location).href, copy)
            })
          }
          return response
        })
        .catch(async () => (await shellResponse()) || new Response('Hors ligne', { status: 503 })),
    )
    return
  }

  if (!isAsset(url)) return

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request)
      const network = fetch(request)
        .then((response) => {
          if (response.ok) void cache.put(request, response.clone())
          return response
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})
