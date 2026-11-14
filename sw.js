const CACHE_NAME = "recipe-vault-v12";
const CORE_ASSETS = [
  "/ultimate-recipe-vault/",
  "/ultimate-recipe-vault/index.html",
  "/ultimate-recipe-vault/styles.css",
  "/ultimate-recipe-vault/script.js",
  "/ultimate-recipe-vault/recipes.json",
  "/ultimate-recipe-vault/manifest.json"
];

// 1. Install: Cache core files safely one by one so one missing file never breaks the whole worker
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of CORE_ASSETS) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn("Skipped caching asset:", url, err);
        }
      }
    })
  );
  self.skipWaiting();
});

// 2. Activate: Wipe out v11 and any older caches immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// 3. Fetch: Always get fresh files from the network; only use cache when offline
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (event.request.url.includes("supabase.co")) return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) return cachedResponse;
        if (event.request.mode === "navigate") {
          return caches.match("/ultimate-recipe-vault/index.html");
        }
        return new Response("Offline", { status: 503, statusText: "Offline" });
      })
  );
});
