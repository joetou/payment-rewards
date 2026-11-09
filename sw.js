const CACHE='joetou-payment-rewards-v16';
const ASSETS=['./','./index.html','./help.html','./user-guide.png','./style.css','./compact.css?v=16','./flat-banner.png','./core.js?v=16','./app.js?v=16','./analytics.js','./manifest.webmanifest','./campaign-banner.png','./logo-taifung.jpg','./icon.svg','./icon-192.png','./icon-512.png','./logo-boc.jpg','./logo-icbc.jpg','./logo-mpay.jpg','./logo-luso.jpg','./logo-cgb.jpg','./logo-alipay.jpg','./logo-uepay.jpg','./update.js?v=16'];
// Finish downloading this release before activating. Keep the previous shell for open tabs.
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS.map(p=>new Request(new URL(p,self.registration.scope),{cache:'reload'})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil((async()=>{const keys=(await caches.keys()).filter(k=>k.startsWith('joetou-payment-rewards-'));const old=keys.filter(k=>k!==CACHE);await Promise.all(old.slice(0,-1).map(k=>caches.delete(k)));await self.clients.claim();})()));
self.addEventListener('message',e=>{if(e.data==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET'||!r.url.startsWith(self.registration.scope))return;const u=new URL(r.url);if(!ASSETS.some(p=>new URL(p,self.registration.scope).pathname===u.pathname))return;
if(r.mode==='navigate'){e.respondWith(fetch(new Request(r,{cache:'no-store'})).then(res=>{if(!res.ok)throw new Error('Page unavailable');return res;}).catch(()=>caches.match(new URL('./index.html',self.registration.scope).href,{cacheName:CACHE})));return;}
e.respondWith(caches.match(r,{cacheName:CACHE}).then(hit=>hit||fetch(r)));});
