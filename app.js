'use strict';
const R=Rewards,KEY='joetou.payment-rewards.v2',LEGACY_KEY='joetou.payment-rewards.v1';
const $=id=>document.getElementById(id),escapeText=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state=R.fresh(),tab='entry',editing=null,undo=null,timer,boundaryTimer,readError=false,demoMode=false;
try{
 const sourceRaw=localStorage.getItem(KEY)||localStorage.getItem(LEGACY_KEY);
 if(sourceRaw)state=R.upgrade(JSON.parse(sourceRaw));
 const next=structuredClone(state);R.rollover(next);
 // Keep the original v1 key untouched. The complete current state and archive
 // are committed together before any cleared period is shown to the user.
 localStorage.setItem(KEY,JSON.stringify(next));state=next;
}catch(e){readError=true;}
function ask(message){return new Promise(resolve=>{const d=$('confirm-dialog');$('confirm-message').textContent=message;d.returnValue='cancel';d.onclose=()=>resolve(d.returnValue==='ok');d.showModal();});}
function toast(message,canUndo=false){
 clearTimeout(timer);$('status').textContent=message;
 if(canUndo){const b=document.createElement('button');b.textContent='撤銷';b.onclick=()=>{
  const result=syncPeriod();if(!result.ok||result.rolled||!undo)return;
  if(JSON.stringify(state)!==undo.after){undo=null;toast('已有其他修改，未套用舊的撤銷。');return;}
  const old=undo.before;undo=null;save(old,'已撤銷。');
 };$('status').append(b);}
 $('status').className='show';timer=setTimeout(()=>$('status').className='',canUndo?12000:6500);
}
function save(next,message){
 if(readError){alert('資料尚未安全儲存，已停用修改。請檢查裝置空間及瀏覽器設定後重新開啟。');return false;}
 try{next.updatedAt=Date.now();R.validate(next);localStorage.setItem(KEY,JSON.stringify(next));state=next;render();scheduleBoundary();if(message)toast(message);return true;}
 catch(e){alert('未能儲存，變更未套用。原有金額及歷史記錄仍保留，請檢查裝置空間或瀏覽器設定。');return false;}
}
function scheduleBoundary(){clearTimeout(boundaryTimer);const delay=Math.max(100,R.periodAt().next-Date.now()+100);boundaryTimer=setTimeout(()=>{syncPeriod();scheduleBoundary();},Math.min(delay,2147483647));}
function syncPeriod(silent=false){
 if(readError)return {ok:false,rolled:false};
 try{
  const raw=localStorage.getItem(KEY),latest=raw?R.upgrade(JSON.parse(raw)):R.fresh();
  const next=structuredClone(latest),count=R.rollover(next),changed=JSON.stringify(next)!==JSON.stringify(state);
  if(count)localStorage.setItem(KEY,JSON.stringify(next));
  state=next;
  if(count){undo=null;editing=null;for(const id of ['picker','confirm-dialog'])if($(id).open)$(id).close();}
  if(changed)render();scheduleBoundary();
  if(count)toast('上一期已保存至統計，已開始新一期。');
  return {ok:true,rolled:count>0};
 }catch(e){readError=true;if(!silent)alert('未能安全保存換期資料，尚未清零。請檢查裝置空間及瀏覽器設定後重新開啟。');else toast('自動換期未完成，原資料仍保留。請檢查裝置空間後重新開啟。');return {ok:false,rolled:false};}
}
function change(fn,message,allowUndo=false){
 const result=syncPeriod();if(!result.ok||result.rolled)return false;
 const before=structuredClone(state),next=structuredClone(state);fn(next);
 if(save(next)){undo=allowUndo?{before,after:JSON.stringify(state)}:null;toast(message,allowUndo);return true;}return false;
}
function label(id,names=state.names){return names[id]||R.catalog.find(c=>c[0]===id)[1];}
function logo(c){return c[0].startsWith('other')?`<div class="logo" style="background:${c[3]}" aria-hidden="true">${escapeText(c[1])}</div>`:`<div class="logo app-logo"><img src="logo-${c[0]}.jpg" alt="${escapeText(c[1])}圖示" width="44" height="44"></div>`;}
function bankCard(id,records,names,mode,readonly=false){
 const c=R.catalog.find(x=>x[0]===id),rows=records[id],t=R.totals(rows),name=escapeText(label(id,names));
 return `<article class="card${readonly?' snapshot-card':''}"><div class="card-head">${logo(c)}<div class="name"><strong>${name}</strong><small>${escapeText(c[2])}</small></div>${mode==='redeem'&&!readonly?`<button class="subtotal" data-batch="${id}" aria-label="${name}全部核銷，待核銷${t.left}元" ${!t.left?'disabled':''}>待核銷<strong>${t.left}</strong></button>`:`<div class="subtotal">${readonly?'待核銷':'總額'}<strong>${readonly?t.left:t.total}</strong></div>`}</div><div class="slots">${rows.map((x,i)=>{
 const cls=`slot ${x.redeemed?'used':''}`,text=`${name}第${i+1}項，${x.amount}元，${x.redeemed?'已核銷':'未核銷'}`;
 return readonly?`<div class="${cls}" aria-label="${text}"><span>${x.amount}</span></div>`:`<button class="${cls}" data-slot="${id}:${i}" ${mode==='redeem'&&!x.amount?'disabled':''} aria-label="${text}"><span>${x.amount}</span></button>`;
 }).join('')}</div></article>`;
}
function render(){
 const showingDemo=tab==='stats'&&demoMode;
 $('period').textContent=showingDemo?'示範模式 · 以下為虛構紀錄':`期間：${R.periodLabel(state.periodStart)}`;
 const all=showingDemo?R.totals(demoHistory().flatMap(h=>Object.values(h.records).flat())):R.totals(Object.values(state.records).flat()),prefix=showingDemo?'示範':'本期';$('summary').innerHTML=`<div><small>${prefix}中獎</small><strong>${all.total}</strong></div><div><small>${prefix}已核銷</small><strong>${all.used}</strong></div><div><small>${prefix}待核銷</small><strong>${all.left}</strong></div>`;
 document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===tab);b.setAttribute('aria-current',b.dataset.tab===tab?'page':'false');});
 $('title').textContent=({entry:'本期抽獎記錄',redeem:'獎金核銷',stats:'歷史及統計',settings:'我的設置'})[tab];
 $('guide').textContent=({entry:'點按金額記錄獎金。每週五 00:00 自動存檔換期。',redeem:'點按獎金即可劃線，再按一次取消。點按待核銷金額可全部核銷。',stats:'先看各期總額，再向下捲動查看全部支付 App 的快照。',settings:'加入常用支付 App，並按你的習慣調整順序。'})[tab];
 if(tab==='settings'){renderSettings();return;}if(tab==='stats'){renderStats();return;}
 $('content').innerHTML=state.selected.length?state.selected.map(id=>bankCard(id,state.records,state.names,tab)).join(''):'<div class="panel empty">尚未選擇支付 App，請到設置加入。</div>';
 const hidden=R.totals(R.catalog.filter(c=>!state.selected.includes(c[0])).flatMap(c=>state.records[c[0]]));if(hidden.total)$('content').insertAdjacentHTML('beforeend',`<p class="hint">整期摘要包括未顯示 App：中獎 ${hidden.total} 元，待核銷 ${hidden.left} 元。可到設置重新加入。</p>`);
}
function demoHistory(){
 return [2,1].map((offset,index)=>{const start=R.addDays(state.periodStart,-7*offset),records=R.fresh().records;records.boc[0]={amount:200,redeemed:true};if(index===0)records.mpay[0]={amount:100,redeemed:true};else records.taifung[0]={amount:50,redeemed:false};return {id:'week:'+start,origin:'auto',start,end:R.addDays(start,6),records,names:{},selected:R.catalog.map(c=>c[0])};});
}
function renderStats(){
 const controls=`<section class="panel demo-controls${demoMode?' is-demo':''}"><div><h3>${demoMode?'正在查看示範':'想先看看統計效果？'}</h3><p>${demoMode?'以下兩期為虛構資料，不會寫入或改動你的紀錄。可向下查看全部銀行快照。':'用兩期虛構資料預覽統計及核銷快照，毋須等待換期。'}</p></div><button class="primary" data-demo="${demoMode?'off':'on'}">${demoMode?'返回我的紀錄':'查看示範'}</button></section>`;
 const history=demoMode?demoHistory():state.history;
 const dated=history.filter(h=>h.origin==='auto').sort((a,b)=>b.start.localeCompare(a.start)),undated=history.filter(h=>h.origin==='legacy'),hist=[...dated,...undated];
 const total=R.totals(dated.flatMap(h=>Object.values(h.records).flat()));
 if(!hist.length){$('content').innerHTML=controls+'<section class="panel empty"><h3>尚未有已完成期間</h3><p>本期結束後會自動保存至此。所有支付 App 的三項金額及核銷狀態都會保留。</p></section>';return;}
 $('content').innerHTML=controls+`<section class="panel history-overview"><h3>過往各期中獎紀錄</h3><p>已保存 ${dated.length} 期 · 中獎合計 ${total.total} · 已核銷合計 ${total.used}</p>${dated.length?`<table class="history-table"><thead><tr><th scope="col">期間</th><th scope="col">中獎</th><th scope="col">已核銷</th></tr></thead><tbody>${dated.map(h=>{const t=R.totals(Object.values(h.records).flat());return `<tr><th scope="row"><a href="#history-${h.start}"><span>${h.start}</span><small>至 ${h.end}</small></a></th><td>${t.total}</td><td>${t.used}</td></tr>`;}).join('')}</tbody></table>`:''}${undated.length?'<p class="hint">另保留舊版手動重置快照；因日期未記錄，不計入按期合計。</p>':''}</section><h3 class="history-heading">各期消費／核銷快照</h3><p class="hint">橫線代表該項已核銷。以下包含全部支付 App，快照只供查看。</p>${hist.map(h=>{
  const t=R.totals(Object.values(h.records).flat()),order=[...h.selected,...R.catalog.map(c=>c[0]).filter(id=>!h.selected.includes(id))],title=h.origin==='auto'?`${h.start} 至 ${h.end}`:'舊版手動重置快照（日期未記錄）';
  return `<details open class="history-period" id="history-${h.start||'legacy'}"><summary><strong>${title}</strong><span>中獎 ${t.total} · 已核銷 ${t.used} · 待核銷 ${t.left}</span></summary>${order.map(id=>bankCard(id,h.records,h.names,'redeem',true)).join('')}</details>`;
 }).join('')}${!demoMode&&state.migrationNote?`<p class="hint">${escapeText(state.migrationNote)}</p>`:''}`;
}
function renderSettings(){
 const row=(c,selected,index)=>`<div class="manage" draggable="true" data-drag="${c[0]}">${logo(c)}<div class="name"><strong>${escapeText(label(c[0]))}</strong><small>${!selected&&R.totals(state.records[c[0]]).left?`待核銷 ${R.totals(state.records[c[0]]).left} 元`:escapeText(c[2])}</small></div>${selected?`<button data-move="${c[0]}:-1" aria-label="上移${escapeText(label(c[0]))}" ${index===0?'disabled':''}>↑</button><button data-move="${c[0]}:1" aria-label="下移${escapeText(label(c[0]))}" ${index===state.selected.length-1?'disabled':''}>↓</button>`:''}<button data-toggle="${c[0]}">${selected?'移出':'加入'}</button>${c[0].startsWith('other')?`<input data-name="${c[0]}" maxlength="20" aria-label="${escapeText(c[1])}自訂名稱" placeholder="自訂名稱" value="${escapeText(state.names[c[0]]||'')}">`:''}</div>`;
 $('content').innerHTML=`<section class="panel" data-area="mine"><h3>我的支付 App · ${state.selected.length}</h3>${state.selected.map((id,i)=>row(R.catalog.find(c=>c[0]===id),true,i)).join('')||'<p>從下方加入支付 App。</p>'}</section><section class="panel" data-area="others"><h3>其他可選支付 App</h3>${R.catalog.filter(c=>!state.selected.includes(c[0])).map(c=>row(c,false,0)).join('')||'<p>所有 App 已加入。</p>'}<p class="hint">可拖拉搬移；亦可使用加入、移出及箭頭按鈕。移出不會刪除金額。</p></section><section class="panel"><h3>自動換期及歷史</h3><p>按澳門時間，每週五 00:00 先保存全部支付 App 的快照，再開始新一期。網頁關閉時，下次開啟會補做；期間沒有記錄的週會以零元保存。毋須人手重置。</p><p>期間：${R.periodLabel(state.periodStart)}。按裝置時間判斷，請保持裝置日期正確。可在底部「統計」查看以前各期。</p></section><section class="panel"><h3>加入主畫面</h3><p>iPhone：以 Safari 開啟網址，從分享選單選擇「加入主畫面」。Android 及電腦 Chrome：從瀏覽器選單尋找安裝或加入主畫面選項。</p><p>首次開啟需連線。離線快取就緒後可離線使用。網站更新會保留已記錄資料。</p><p class="hint">圖示採用官方 App Store 的銀行／錢包 App 圖示。本工具只作個人記錄，核銷標記不會操作任何支付帳戶。</p></section>`;
}
$('content').onclick=e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.demo){demoMode=b.dataset.demo==='on';render();window.scrollTo({top:0,behavior:'smooth'});return;}
 if(b.dataset.slot){
  const result=syncPeriod();if(!result.ok||result.rolled)return;
  const [id,n]=b.dataset.slot.split(':'),i=Number(n);
  if(tab==='entry'){editing={id,i};$('picker-title').textContent=`${label(id)} · 第 ${i+1} 次`;$('picker').showModal();}
  else if(tab==='redeem')change(s=>{s.records[id][i].redeemed=!s.records[id][i].redeemed;},'核銷狀態已更新。',true);
 }
 if(b.dataset.batch&&tab==='redeem')change(s=>s.records[b.dataset.batch].forEach(x=>{if(x.amount)x.redeemed=true;}),'已全部核銷。',true);
 if(b.dataset.toggle)change(s=>{const id=b.dataset.toggle;s.selected=s.selected.includes(id)?s.selected.filter(x=>x!==id):[...s.selected,id];},'支付 App 名單已更新。');
 if(b.dataset.move){const [id,d]=b.dataset.move.split(':');change(s=>{const i=s.selected.indexOf(id),j=i+Number(d);if(j>=0&&j<s.selected.length)[s.selected[i],s.selected[j]]=[s.selected[j],s.selected[i]];},'排序已儲存。');}
};
$('content').onchange=e=>{if(e.target.dataset.name){const id=e.target.dataset.name,value=e.target.value.trim();change(s=>s.names[id]=value,'名稱已儲存。');}};
let dragging=null;
$('content').ondragstart=e=>{const row=e.target.closest('[data-drag]');if(row){dragging=row.dataset.drag;e.dataTransfer.setData('text/plain',dragging);}};
$('content').ondragover=e=>{if(e.target.closest('[data-area]'))e.preventDefault();};
$('content').ondrop=e=>{const area=e.target.closest('[data-area]'),target=e.target.closest('[data-drag]')?.dataset.drag;if(!area||!dragging)return;e.preventDefault();const id=dragging;dragging=null;change(s=>{s.selected=s.selected.filter(x=>x!==id);if(area.dataset.area==='mine'){const i=target?s.selected.indexOf(target):-1;s.selected.splice(i<0?s.selected.length:i,0,id);}},'名單及排序已儲存。');};
$('amounts').innerHTML=R.amounts.map(x=>`<button type="button" data-amount="${x}">${x}</button>`).join('');
$('amounts').onclick=async e=>{
 const b=e.target.closest('[data-amount]');if(!b||!editing)return;const {id,i}=editing,amount=Number(b.dataset.amount);
 if(!syncPeriod().ok||!editing)return;
 if(state.records[id][i].amount===amount){$('picker').close();return;}
 if(state.records[id][i].redeemed&&!await ask('這項已核銷。修改金額會取消該項核銷，是否繼續？'))return;
 if(change(s=>s.records[id][i]={amount,redeemed:false},'獎金已儲存。'))$('picker').close();
};
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{syncPeriod();demoMode=false;tab=b.dataset.tab;render();window.scrollTo({top:0,behavior:'smooth'});});
window.addEventListener('storage',e=>{if(e.key===KEY){undo=null;if(!readError){syncPeriod();toast('已載入另一分頁的最新資料。');}}});
window.addEventListener('focus',()=>syncPeriod(true));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')syncPeriod(true);});
setInterval(()=>{if(document.visibilityState==='visible')syncPeriod(true);},30000);
render();scheduleBoundary();
if(readError){tab='settings';render();toast('資料無法安全儲存，已停用修改。請檢查裝置空間後重新開啟。');}
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(()=>{if(!sessionStorage.getItem('offline-notice')){toast('離線快取已就緒。');sessionStorage.setItem('offline-notice','1');}}).catch(()=>toast('離線快取未完成；目前仍可在線使用。'));
