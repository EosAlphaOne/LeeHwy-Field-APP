/* Network-first service worker shared by BOTH apps at this origin (index.html = Lee Hwy Pre-Rock,
   tle-alexandria.html = TLE Final). Always serve the freshest app when online, fall back to cache offline.
   v3 (2026-09-02): + field.html (EOS shell). v2: pre-cache both app pages at install (falling back to any older cached copy, and failing
   install — which keeps the previous worker — if a page cannot be obtained at all); page-aware offline
   fallback (never serve one app under the other's URL); never cache non-OK or redirected responses;
   purge old caches only once the new cache is complete. */
const CACHE='leehwy-app-v3';
const PRECACHE=['./index.html','./tle-alexandria.html','./field.html'];
self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      return Promise.all(PRECACHE.map(function(u){
        return fetch(u,{cache:'no-store'}).then(function(r){
          if(r && r.ok && !r.redirected) return c.put(u,r);
          throw new Error('precache '+u);
        }).catch(function(){
          // fall back to whatever any older cache already holds for this page
          return caches.match(u,{ignoreSearch:true,ignoreVary:true}).then(function(old){
            if(old) return c.put(u,old);
            throw new Error('no copy available for '+u);   // install fails -> previous worker stays active
          });
        });
      }));
    }).then(function(){ return self.skipWaiting(); })
  );
});
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      return Promise.all(PRECACHE.map(function(u){ return c.match(u); }));
    }).then(function(hits){
      if(hits.indexOf(undefined)!==-1) return;   // new cache incomplete -> keep old caches as a safety net
      return caches.keys().then(function(keys){
        return Promise.all(keys.filter(function(k){ return k!==CACHE; }).map(function(k){ return caches.delete(k); }));
      });
    }).then(function(){ return self.clients.claim(); })
  );
});
function fallbackPage(url){
  // Serve the app that was actually requested; never swap one app for the other.
  var leaf=url.pathname.split('/').pop();
  if(leaf==='tle-alexandria.html') return './tle-alexandria.html';
  if(leaf==='field.html') return './field.html';
  return './index.html';
}
function offlineResponse(){
  return new Response('<!DOCTYPE html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:-apple-system,sans-serif;padding:24px"><h2>Offline</h2><p>Connect to wifi or cellular once and reopen this app to finish installing it.</p></body>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8'}});
}
self.addEventListener('fetch', function(e){
  var req=e.request;
  if(req.method!=='GET') return;                 // never touch uploads / API POSTs
  var url;
  try{ url=new URL(req.url); }catch(_){ return; }
  if(url.origin!==location.origin) return;        // don't intercept Dropbox / cross-origin
  e.respondWith(
    fetch(req).then(function(resp){
      if(resp && resp.ok && resp.type==='basic' && !resp.redirected){
        try{ var cp=resp.clone(); caches.open(CACHE).then(function(c){ return c.put(req, cp); }).catch(function(){}); }catch(_){}
      }
      return resp;
    }).catch(function(){
      return caches.match(req, {ignoreSearch:true, ignoreVary:true}).then(function(r){
        if(r) return r;
        if(req.mode==='navigate'){
          return caches.match(fallbackPage(url),{ignoreSearch:true,ignoreVary:true}).then(function(p){ return p || offlineResponse(); });
        }
        return Response.error();
      });
    })
  );
});
