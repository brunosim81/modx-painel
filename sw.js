const CACHE = 'modx-painel-dev90';
const FILES = ['./', 'index.html', 'style.css', 'app.mjs', 'live-touch.mjs', 'app-settings.mjs', 'i18n.mjs', 'support.mjs', 'offline.mjs', 'catalog-storage.mjs', 'midi-access.mjs', 'touch-functions.mjs', 'sample-editor.mjs', 'song-search.mjs', 'curve-editor.mjs', 'data-dial.mjs', 'editor.mjs', 'synthesis.mjs', 'drum.mjs', 'effect-editor.mjs', 'effect-blocks.mjs', 'common-editor.mjs', 'sequence-editor.mjs', 'control-editor.mjs', 'system-editor.mjs', 'factory-search.mjs', 'assign-switch.mjs', 'unit-copy.mjs', 'factory-catalog.json', 'part-audio-editor.mjs', 'control-names.json', 'effect-catalog.json', 'protocol.mjs', 'sync.mjs', 'knob.mjs', 'wheels.mjs', 'soundmondo.mjs', 'data.json', 'build.json', 'manifest.webmanifest', 'icon.svg', 'assets/modx-knob.png'];
const root=new URL('./',self.location.href);
const resource=url=>{const path=new URL(url);return path.origin===root.origin&&FILES.some(file=>new URL(file,root).pathname===path.pathname)?new URL(path.pathname,root).href:null;};
self.addEventListener('install',event=>event.waitUntil((async()=>{try{const cache=await caches.open(CACHE);await cache.addAll(FILES);}catch(error){await caches.delete(CACHE);throw error;}})()));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('modx-painel-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',event=>{
 if(event.data?.type==='activate-update'){event.waitUntil(self.skipWaiting());return;}
 if(event.data?.type==='offline-info')event.waitUntil((async()=>{const cache=await caches.open(CACHE),missing=[];for(const file of FILES)if(!await cache.match(new URL(file,root).href))missing.push(file);event.ports?.[0]?.postMessage({version:CACHE,expected:FILES.length,missing});})());
});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);if(url.origin!==root.origin)return;
 if(event.request.mode==='navigate'&&url.pathname.startsWith(root.pathname)){event.respondWith(caches.open(CACHE).then(cache=>cache.match(new URL('./',root).href)).then(cached=>cached||fetch(event.request)));return;}
 const key=resource(event.request.url);if(key)event.respondWith(caches.open(CACHE).then(cache=>cache.match(key)).then(cached=>cached||fetch(event.request)));
});
