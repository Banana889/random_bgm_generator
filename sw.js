const CACHE_NAME = 'driftone-pwa-v1';

const CORE_ASSETS = [
    './',
    './index.html',
    './manifest.webmanifest',
    './css/style.css?v=thunder-visuals',
    './js/data.js',
    './js/instruments.js',
    './js/synth.js?v=drum-samples',
    './js/noise_generator.js',
    './js/nextnote.js',
    './js/visuals.js?v=thunder-visuals',
    './js/app.js?v=thunder-visuals',
    './js/worker.js',
    './static/driftone-icon-1024.svg',
    './res/rain.mp3',
    './res/drums/kick.mp3',
    './res/drums/snare.mp3',
    './res/drums/hihat.mp3',
    './res/drums/hihat-heavy.mp3'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;

            return fetch(event.request).then(response => {
                const copy = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, copy);
                });
                return response;
            });
        })
    );
});
