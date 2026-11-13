const CACHE_NAME = "recipe-vault-v1";
const CORE_ASSETS = [
  "/ultimate-recipe-vault/",
  "/ultimate-recipe-vault/index.html",
  "/ultimate-recipe-vault/style.css",
  "/ultimate-recipe-vault/script.js",
  "/ultimate-recipe-vault/recipes.json",
  "/ultimate-recipe-vault/images/vault-bg.jpg"
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

// 3. Fetch: Serve cached files offline, and cache viewed recipe photos on the fly
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // Let live Supabase API calls go straight to the network
  if (event.request.url.includes("supabase.co")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          // Dynamically cache recipe photos as the user views them
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Fallback if completely offline and asset wasn't cached
          if (event.request.mode === "navigate") {
            return caches.match("/ultimate-recipe-vault/index.html");
          }
        });
    })
  );
});