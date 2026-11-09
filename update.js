/* Updates never clear application records or authentication. */
(()=>{'use strict';if(!('serviceWorker'in navigator))return;
let pending=false,reloading=false,controlled=!!navigator.serviceWorker.controller;
const safe=()=>document.visibilityState==='visible'&&!document.querySelector('dialog[open]')&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)&&window.canApplyAppUpdate?.()!==false;
function apply(){if(pending&&!reloading&&safe()){reloading=true;location.reload();}}
navigator.serviceWorker.addEventListener('controllerchange',()=>{if(controlled){pending=true;apply();}controlled=true;});
setInterval(apply,1500);document.addEventListener('visibilitychange',apply);
navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>{const check=()=>{if(navigator.onLine)reg.update().catch(()=>{});};check();window.addEventListener('online',check);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check();});setInterval(check,5*60*1000);}).catch(()=>{});
})();
