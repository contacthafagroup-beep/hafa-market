// Hafa Market Service Worker — v2
const CACHE_STATIC  = 'hafa-static-v2'
const CACHE_IMAGES  = 'hafa-images-v2'
const CACHE_API     = 'hafa-api-v2'
const API_TIMEOUT   = 3000 // 3s before falling back to cache

const STATIC_ASSETS = ['/', '/index.html', '/favicon.svg']

// ── Install: pre-cache shell ──────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_STATIC)
      .then(c => c.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  )
})

// ── Activate: clean old caches ────────────────────────────────────────────────
self.addEventListener('activate', e => {
  const keep = [CACHE_STATIC, CACHE_IMAGES, CACHE_API]
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !keep.includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// ── Helpers ───────────────────────────────────────────────────────────────────
function fetchWithTimeout(req, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    fetch(req).then(r => { clearTimeout(timer); resolve(r) }, reject)
  })
}

// ── Fetch strategy router ─────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const { request } = e
  const url = new URL(request.url)

  // Skip non-GET and cross-origin (except images)
  if (request.method !== 'GET') return

  // 1. Images → StaleWhileRevalidate
  if (request.destination === 'image' || /\.(png|jpg|jpeg|webp|gif|svg|ico)$/i.test(url.pathname)) {
    e.respondWith(staleWhileRevalidate(request, CACHE_IMAGES))
    return
  }

  // 2. API calls → NetworkFirst with 3s timeout fallback
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(networkFirstWithTimeout(request, CACHE_API, API_TIMEOUT))
    return
  }

  // 3. Navigation → NetworkFirst, fallback to /index.html (SPA)
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    )
    return
  }

  // 4. Static assets (JS/CSS/fonts) → CacheFirst
  e.respondWith(cacheFirst(request, CACHE_STATIC))
})

// ── Strategies ────────────────────────────────────────────────────────────────
async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req)
  if (cached) return cached
  const res = await fetch(req)
  if (res.ok) {
    const cache = await caches.open(cacheName)
    cache.put(req, res.clone())
  }
  return res
}

async function staleWhileRevalidate(req, cacheName) {
  const cache  = await caches.open(cacheName)
  const cached = await cache.match(req)
  const fetchPromise = fetch(req).then(res => {
    if (res.ok) cache.put(req, res.clone())
    return res
  }).catch(() => null)
  return cached || fetchPromise
}

async function networkFirstWithTimeout(req, cacheName, timeout) {
  const cache = await caches.open(cacheName)
  try {
    const res = await fetchWithTimeout(req, timeout)
    if (res.ok) cache.put(req, res.clone())
    return res
  } catch {
    const cached = await cache.match(req)
    return cached || new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// ── Background Sync: cart ─────────────────────────────────────────────────────
self.addEventListener('sync', e => {
  if (e.tag === 'sync-cart') {
    e.waitUntil(syncCart())
  }
  if (e.tag === 'sync-offline-orders') {
    e.waitUntil(syncOfflineOrders())
  }
})

async function syncCart() {
  try {
    const db = await openDB()
    const items = await getAll(db, 'pending-cart')
    for (const item of items) {
      await fetch('/api/v1/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${item.token}` },
        body: JSON.stringify(item.payload),
      })
      await deleteItem(db, 'pending-cart', item.id)
    }
  } catch {}
}

async function syncOfflineOrders() {
  // Notify all clients to sync their offline order queue
  const clients = await self.clients.matchAll({ type: 'window' })
  clients.forEach(client => client.postMessage({ type: 'SYNC_OFFLINE_ORDERS' }))
}

// Minimal IndexedDB helpers for background sync
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('hafa-sync', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('pending-cart', { keyPath: 'id', autoIncrement: true })
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}
function getAll(db, store) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}
function deleteItem(db, store, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    const req = tx.objectStore(store).delete(id)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener('push', e => {
  const data = e.data?.json() || {}
  e.waitUntil(
    self.registration.showNotification(data.title || 'Hafa Market', {
      body: data.body || '',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      data: { url: data.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(clients.openWindow(e.notification.data?.url || '/'))
})
