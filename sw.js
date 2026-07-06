/* Network-first service worker: always serve the freshest app when online, fall back to cache offline. */
const CACHE='leehwy-app';
self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function(e){
  var req=e.request;
  if(req.method!=='GET') return;                 // never touch uploads / API POSTs
  var url;
  try{ url=new URL(req.url); }catch(_){ return; }
  if(url.origin!==location.origin) return;        // don't intercept Dropbox / cross-origin
  e.respondWith(
    fetch(req).then(function(resp){
      try{ var cp=resp.clone(); caches.open(CACHE).then(function(c){ c.put(req, cp); }); }catch(_){}
      return resp;
    }).catch(function(){
      return caches.match(req).then(function(r){ return r || caches.match('./index.html'); });
    })
  );
});
