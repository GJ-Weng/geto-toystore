const CACHE_NAME = 'geto-v1';
const STATIC_ASSETS = ['/index.html', '/manifest.json'];

// 安裝：快取靜態資源
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// 啟動：清除舊快取
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 攔截請求策略
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Supabase API 請求：永遠走網路（不快取動態資料）
  if (url.hostname.includes('supabase.co') && url.pathname.includes('/rest/')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Supabase Storage 圖片：Cache First（快取優先，有快取直接用）
  if (url.hostname.includes('supabase.co') && url.pathname.includes('/storage/')) {
    e.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        const response = await fetch(e.request);
        if (response.ok) cache.put(e.request, response.clone());
        return response;
      })
    );
    return;
  }

  // index.html：Stale-while-revalidate（先回快取，背景更新）
  if (url.pathname === '/' || url.pathname.endsWith('index.html')) {
    e.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(e.request);
        const fetchPromise = fetch(e.request).then(response => {
          if (response.ok) cache.put(e.request, response.clone());
          return response;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // CDN 資源（fonts、supabase.min.js 等）：Cache First
  if (url.hostname.includes('cdn.jsdelivr.net') || url.hostname.includes('fonts.g')) {
    e.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        const response = await fetch(e.request);
        if (response.ok) cache.put(e.request, response.clone());
        return response;
      })
    );
    return;
  }

  // 其他：直接走網路
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
