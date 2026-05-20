self.addEventListener('install', function(event) {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches
      .keys()
      .then(function(keys) {
        return Promise.all(
          keys.map(function(key) {
            return caches.delete(key);
          })
        );
      })
      .then(function() {
        return self.clients.claim();
      })
  );
});
