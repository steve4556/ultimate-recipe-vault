const CACHE_NAME = "recipe-vault-v11";
const CORE_ASSETS = [
  "/ultimate-recipe-vault/",
  "/ultimate-recipe-vault/index.html",
  "/ultimate-recipe-vault/styles.css",
  "/ultimate-recipe-vault/script.js",
  "/ultimate-recipe-vault/recipes.json",
  "/ultimate-recipe-vault/manifest.json"
];

// 1. Install: Cache core app files immediately
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

// 2. Activate: Clean up old caches when you update CACHE_NAME
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// 3. Fetch: Network-First for fresh updates, Cache fallback for offline use
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // Let live Supabase API calls go straight to the network
  if (event.request.url.includes("supabase.co")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Save the fresh copy into the cache
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // If offline, serve from cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === "navigate") {
            return caches.match("/ultimate-recipe-vault/index.html");
          }
        });
      })
  );
});
