/* Aggregate usage only. Never pass reward state, bank IDs, amounts or names. */
(()=>{
 'use strict';
 const endpoint='https://joetou-payment-rewards.goatcounter.com/count';
 const labels=Object.freeze({tab_entry:'開啟消費',tab_redeem:'開啟核銷',tab_stats:'開啟統計',tab_settings:'開啟設置',reward_saved:'儲存獎金',redeem_toggled:'切換單筆核銷',redeem_all:'整間銀行核銷',demo_opened:'查看統計示範',demo_closed:'結束統計示範'});
 const queue=[];
 const enabled=()=>location.hostname==='joetou.github.io'&&location.pathname.startsWith('/payment-rewards/')&&navigator.onLine;
 window.trackUsage=name=>{
  if(!endpoint||!enabled()||!Object.hasOwn(labels,name))return;
  const data={path:name,title:labels[name],event:true,no_session:true,referrer:''};
  try{if(window.goatcounter?.count)window.goatcounter.count(data);else if(queue.length<20)queue.push(data);}catch(_){}
 };
 if(!endpoint||!enabled())return;
 let source='';
 try{const ref=new URL(document.referrer);if(ref.hostname!==location.hostname)source=ref.origin;}catch(_){}
 window.goatcounter={path:location.pathname,title:location.pathname.endsWith('help.html')?'週賞記使用說明':'週賞記',referrer:source,no_events:true};
 const script=document.createElement('script');script.src='https://gc.zgo.at/count.js';script.async=true;script.dataset.goatcounter=endpoint;
 script.onload=()=>{for(const data of queue.splice(0))try{window.goatcounter.count(data);}catch(_){}};
 document.head.appendChild(script);
})();
