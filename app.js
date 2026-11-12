'use strict';
const R=Rewards,KEY='joetou.payment-rewards.v2',LEGACY_KEY='joetou.payment-rewards.v1';
const $=id=>document.getElementById(id),escapeText=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state=R.fresh(),tab='entry',editing=null,undo=null,timer,boundaryTimer,readError=false,demoMode=false,pendingTap=null;
const LAST_TAB_KEY='joetou.payment-rewards.last-tab';
try{const previous=JSON.parse(localStorage.getItem(LAST_TAB_KEY));}catch(_){}
function rememberMainTab(value){if(value!=='entry'&&value!=='redeem')return;try{localStorage.setItem(LAST_TAB_KEY,JSON.stringify(value));}catch(_){}}
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
  if(changed){if(editing){editing=null;if($('picker').open)$('picker').close();}render();}scheduleBoundary();
  if(count)toast('上一期已保存至統計，已開始新一期。');
  return {ok:true,rolled:count>0};
 }catch(e){readError=true;if(!silent)alert('未能安全保存換期資料，尚未清零。請檢查裝置空間及瀏覽器設定後重新開啟。');else toast('自動換期未完成，原資料仍保留。請檢查裝置空間後重新開啟。');return {ok:false,rolled:false};}
}
function change(fn,message,allowUndo=false){
 const result=syncPeriod();if(!result.ok||result.rolled)return false;
 const before=structuredClone(state),next=structuredClone(state);fn(next);
 if(save(next)){undo=allowUndo?{before,after:JSON.stringify(state)}:null;render();toast(message,allowUndo);const event=({'獎金已儲存。':'reward_saved','核銷狀態已更新。':'redeem_toggled','已全部核銷。':'redeem_all'})[message];if(event)window.trackUsage?.(event);return true;}return false;
}
function label(id,names=state.names){return names[id]||R.catalog.find(c=>c[0]===id)[1];}
function logo(c){return c[0].startsWith('other')?`<div class="logo" style="background:${c[3]}" aria-hidden="true">其他</div>`:`<div class="logo app-logo"><img src="logo-${c[0]}.jpg" alt="${escapeText(c[1])}圖示" width="44" height="44"></div>`;}
function bankCard(id,records,names,mode='entry',readonly=false){const state={records,names};const c=R.catalog.find(c=>c[0]===id),name=state.names[id]||c[1],rows=state.records[id],t=R.totals(rows);
 return `<article class="bank-row${readonly?' snapshot-card':''}"><div class="bank-label">${logo(c)}<strong title="${escapeText(name)}">${escapeText(name)}</strong></div><div class="slots">${rows.map((x,i)=>{const label=R.resultLabel(x),cls=x.redeemed?'redeemed':(x.amount===0?'word-result':'');return readonly?`<span class="${cls}">${escapeText(label)}</span>`:`<button data-slot="${id}:${i}" class="${cls}" aria-label="${escapeText(name)}第${i+1}次 ${escapeText(label)}${x.amount>0?'元':''}${x.redeemed?' 已核銷，單擊取消核銷，雙擊修改結果':R.slotAction(x)==='redeem'?' 單擊核銷，雙擊修改結果':' 點按選結果'}">${x.redeemed?'<s>':''}${escapeText(label)}${x.redeemed?'</s>':''}</button>`;}).join('')}</div><div class="row-balance" aria-label="待核銷${t.left}元">${t.left}</div></article>`;
}
function render(){
 $('period').textContent=`期間：${R.periodLabel(state.periodStart)}`;const all=R.totals(Object.values(state.records).flat());$('summary').innerHTML=[['中獎',all.total],['已核銷',all.used],['待核銷',all.left]].map(([label,n])=>`<div><small>${label}</small><strong>${n}</strong></div>`).join('');
 $('title').textContent='本期紀錄';$('guide').textContent='單擊：核銷／還原　雙擊：改結果';
 if(tab==='stats'||tab==='settings'){const scroll=$('panel-dialog').scrollTop;$('panel-title').textContent=tab==='stats'?'統計':'設置';if(tab==='stats')renderStats();else renderSettings();$('panel-content').innerHTML=$('content').innerHTML;$('panel-dialog').scrollTop=scroll;}
 $('content').innerHTML=state.selected.length?state.selected.map(id=>bankCard(id,state.records,state.names)).join(''):'<div class="panel empty">請到設置加入支付 App。</div>';
 if(undo)$('content').innerHTML+='<button class="undo-button" data-undo="yes">↶ 撤銷上一次操作</button>';
 const hidden=R.totals(R.catalog.filter(c=>!state.selected.includes(c[0])).flatMap(c=>state.records[c[0]]));if(hidden.total)$('content').insertAdjacentHTML('beforeend',`<p class="hint">摘要包括未顯示 App：中獎 ${hidden.total} 元，待核銷 ${hidden.left} 元。</p>`);
}
function cumulativeChart(s){const c=R.cumulative(s),banks=[...c.banks].sort((a,b)=>b.amount-a.amount),max=Math.max(1,...banks.map(b=>b.amount));return `<section class="panel cumulative-panel"><h3>${demoMode?'示範 · ':''}各銀行累積中獎</h3><div class="cumulative-total"><span>總累積金額</span><strong>${c.total.toLocaleString('zh-Hant')}<small> 澳門元</small></strong></div><p>${demoMode?'以下為虛構資料':'本期＋已保存各期 · 包括所有支付 App'}</p><div class="bank-chart" role="list" aria-label="各銀行累積中獎金額">${banks.map(b=>{const item=R.catalog.find(x=>x[0]===b.id),name=s.names[b.id]||item[1];return `<div class="chart-row" role="listitem" aria-label="${escapeText(name)} ${b.amount}澳門元"><div class="chart-label" title="${escapeText(name)}">${logo(item)}<span>${escapeText(name)}</span></div><div class="chart-track"><div class="chart-bar" style="width:${b.amount/max*100}%;background:${item[3]}"></div></div><strong>${b.amount.toLocaleString('zh-Hant')}</strong></div>`;}).join('')}</div>${s.history.some(h=>h.origin==='legacy')?'<p>未註明日期的舊版快照不計入累積，避免重複。</p>':''}</section>`;}
function demoHistory(){
 return [2,1].map((offset,index)=>{const start=R.addDays(state.periodStart,-7*offset),records=R.fresh().records;records.boc[0]={amount:200,redeemed:true};if(index===0)records.mpay[0]={amount:100,redeemed:true};else records.taifung[0]={amount:50,redeemed:false};return {id:'week:'+start,origin:'auto',start,end:R.addDays(start,6),records,names:{},selected:R.catalog.map(c=>c[0])};});
}
function renderStats(){
 const controls=`<section class="panel demo-controls${demoMode?' is-demo':''}"><div><h3>${demoMode?'正在查看示範':'想先看看統計效果？'}</h3><p>${demoMode?'以下兩期為虛構資料，不會寫入或改動你的紀錄。可向下查看全部銀行快照。':'用兩期虛構資料預覽統計及核銷快照，毋須等待換期。'}</p></div><button class="primary" data-demo="${demoMode?'off':'on'}">${demoMode?'返回我的紀錄':'查看示範'}</button></section>`;
 const history=demoMode?demoHistory():state.history,chart=cumulativeChart(demoMode?{...R.fresh(),history}:state);
 const dated=history.filter(h=>h.origin==='auto').sort((a,b)=>b.start.localeCompare(a.start)),undated=history.filter(h=>h.origin==='legacy'),hist=[...dated,...undated];
 const total=R.totals(dated.flatMap(h=>Object.values(h.records).flat()));
 if(!hist.length){$('content').innerHTML=chart+controls+'<section class="panel empty"><h3>尚未有已完成期間</h3><p>本期結束後會自動保存至此。所有支付 App 的三項金額及核銷狀態都會保留。</p></section>';return;}
 $('content').innerHTML=chart+controls+`<section class="panel history-overview"><h3>過往各期中獎紀錄</h3><p>已保存 ${dated.length} 期 · 中獎合計 ${total.total} · 已核銷合計 ${total.used}</p>${dated.length?`<table class="history-table"><thead><tr><th scope="col">期間</th><th scope="col">中獎</th><th scope="col">已核銷</th></tr></thead><tbody>${dated.map(h=>{const t=R.totals(Object.values(h.records).flat());return `<tr><th scope="row"><a href="#history-${h.start}"><span>${h.start}</span><small>至 ${h.end}</small></a></th><td>${t.total}</td><td>${t.used}</td></tr>`;}).join('')}</tbody></table>`:''}${undated.length?'<p class="hint">另保留舊版手動重置快照；因日期未記錄，不計入按期合計。</p>':''}</section><h3 class="history-heading">各期消費／核銷快照</h3><p class="hint">橫線代表該項已核銷。以下包含全部支付 App，快照只供查看。</p>${hist.map(h=>{
  const t=R.totals(Object.values(h.records).flat()),order=[...h.selected,...R.catalog.map(c=>c[0]).filter(id=>!h.selected.includes(id))],title=h.origin==='auto'?`${h.start} 至 ${h.end}`:'舊版手動重置快照（日期未記錄）';
  return `<details open class="history-period" id="history-${h.start||'legacy'}"><summary><strong>${title}</strong><span>中獎 ${t.total} · 已核銷 ${t.used} · 待核銷 ${t.left}</span></summary>${order.map(id=>bankCard(id,h.records,h.names,'redeem',true)).join('')}</details>`;
 }).join('')}${!demoMode&&state.migrationNote?`<p class="hint">${escapeText(state.migrationNote)}</p>`:''}`;
}
function renderSettings(){
 const row=(c,selected,index)=>`<div class="manage" draggable="true" data-drag="${c[0]}">${logo(c)}<div class="name"><strong>${escapeText(label(c[0]))}</strong><small>${!selected&&R.totals(state.records[c[0]]).left?`待核銷 ${R.totals(state.records[c[0]]).left} 元`:escapeText(c[2])}</small></div>${selected?`<button data-move="${c[0]}:-1" aria-label="上移${escapeText(label(c[0]))}" ${index===0?'disabled':''}>↑</button><button data-move="${c[0]}:1" aria-label="下移${escapeText(label(c[0]))}" ${index===state.selected.length-1?'disabled':''}>↓</button>`:''}<button data-toggle="${c[0]}">${selected?'移出':'加入'}</button>${c[0].startsWith('other')?`<input data-name="${c[0]}" maxlength="20" aria-label="${escapeText(c[1])}自訂名稱" placeholder="自訂名稱" value="${escapeText(state.names[c[0]]||'')}">`:''}</div>`;
 $('content').innerHTML=`<section class="panel"><h3>使用說明</h3><p>未抽：點按輸入結果。已有結果：單擊反覆切換核銷／未核銷，雙擊修改結果。0元顯示謝謝參與；未抽、滿減劵及禮遇劵均以0元計算。修改結果會取消原核銷，選錯可撤銷上一次操作。</p><a href="help.html">詳細使用說明</a></section><section class="panel" data-area="mine"><h3>我的支付 App · ${state.selected.length}</h3>${state.selected.map((id,i)=>row(R.catalog.find(c=>c[0]===id),true,i)).join('')||'<p>從下方加入支付 App。</p>'}</section><section class="panel" data-area="others"><h3>其他可選支付 App</h3>${R.catalog.filter(c=>!state.selected.includes(c[0])).map(c=>row(c,false,0)).join('')||'<p>所有 App 已加入。</p>'}<p class="hint">可拖拉搬移；亦可使用加入、移出及箭頭按鈕。移出不會刪除金額。</p></section><section class="panel"><h3>私隱及使用統計</h3><p>獎金、銀行名單及核銷紀錄只保存在你的裝置，不會傳送至統計服務。網站使用 GoatCounter 統計瀏覽量、估算訪客、來源、裝置及功能操作次數；不傳送銀行名稱、金額或自訂名稱，亦不使用追蹤 Cookie。</p><p>統計服務會處理連線 IP 及瀏覽器資訊以估算訪客；並非完全沒有資料傳送。離線及阻擋統計時仍可正常使用。</p><p><a href="https://www.goatcounter.com/help/privacy" target="_blank" rel="noopener noreferrer">GoatCounter 私隱說明</a></p></section><section class="panel"><h3>自動換期及歷史</h3><p>按澳門時間，每週五 00:00 先保存全部支付 App 的快照，再開始新一期。網頁關閉時，下次開啟會補做；期間沒有記錄的週會以零元保存。毋須人手重置。</p><p>期間：${R.periodLabel(state.periodStart)}。按裝置時間判斷，請保持裝置日期正確。可在頂部「統計」查看以前各期。</p></section><section class="panel"><h3>加入主畫面</h3><p>iPhone：以 Safari 開啟網址，從分享選單選擇「加入主畫面」。Android 及電腦 Chrome：從瀏覽器選單尋找安裝或加入主畫面選項。</p><p>首次開啟需連線。離線快取就緒後可離線使用。網站更新會保留已記錄資料。</p><p class="hint">圖示採用官方 App Store 的銀行／錢包 App 圖示。本工具只作個人記錄，核銷標記不會操作任何支付帳戶。</p></section>`;
}
// Wait for a possible second tap before saving a redemption change.
function cancelPendingTap(){if(pendingTap)clearTimeout(pendingTap.timer);pendingTap=null;}
function pickSlot(id,i){cancelPendingTap();const result=syncPeriod();if(!result.ok||result.rolled)return;editing={id,i};$('picker-title').textContent=`${label(id)} · 第 ${i+1} 次`;if(!$('picker').open)$('picker').showModal();}
function applyTap(tap){const result=syncPeriod();if(!result.ok||result.rolled)return false;if(JSON.stringify(state)!==tap.before){toast('紀錄已有更新，請重新點按。');return false;}return change(s=>{s.records[tap.id][tap.i].redeemed=!s.records[tap.id][tap.i].redeemed;},'核銷狀態已更新。',true);}
function tapSlot(id,i){const result=syncPeriod();if(!result.ok||result.rolled)return;if(!R.hasResult(state.records[id][i])){pickSlot(id,i);return;}if(pendingTap){const old=pendingTap;cancelPendingTap();if(old.id===id&&old.i===i){pickSlot(id,i);return;}if(!applyTap(old))return;}
const tap={id,i,before:JSON.stringify(state)};pendingTap=tap;tap.timer=setTimeout(()=>{if(pendingTap!==tap)return;pendingTap=null;applyTap(tap);},350);}
$('content').ondblclick=e=>{const b=e.target.closest('[data-slot]');if(!b)return;e.preventDefault?.();const [id,n]=b.dataset.slot.split(':');pickSlot(id,Number(n));};
$('picker').onclose=()=>{editing=null;};
$('content').onclick=e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.undo){const result=syncPeriod();if(!result.ok||result.rolled||!undo)return;if(JSON.stringify(state)!==undo.after){undo=null;render();toast('已有其他修改，未撤銷。');return;}const before=undo.before;undo=null;save(before,'已撤銷。');return;}
 if(b.dataset.demo){demoMode=b.dataset.demo==='on';window.trackUsage?.(demoMode?'demo_opened':'demo_closed');render();$('panel-dialog').scrollTop=0;return;}
 if(b.dataset.slot){const [id,n]=b.dataset.slot.split(':');tapSlot(id,Number(n));return;}
 if(b.dataset.batch&&tab==='redeem')change(s=>s.records[b.dataset.batch].forEach(x=>{if(x.amount)x.redeemed=true;}),'已全部核銷。',true);
 if(b.dataset.toggle)change(s=>{const id=b.dataset.toggle;s.selected=s.selected.includes(id)?s.selected.filter(x=>x!==id):[...s.selected,id];},'支付 App 名單已更新。');
 if(b.dataset.move){const [id,d]=b.dataset.move.split(':');change(s=>{const i=s.selected.indexOf(id),j=i+Number(d);if(j>=0&&j<s.selected.length)[s.selected[i],s.selected[j]]=[s.selected[j],s.selected[i]];},'排序已儲存。');}
};
$('content').onchange=e=>{if(e.target.dataset.name){const id=e.target.dataset.name,value=e.target.value.trim();change(s=>s.names[id]=value,'名稱已儲存。');}};
let dragging=null;
$('content').ondragstart=e=>{const row=e.target.closest('[data-drag]');if(row){dragging=row.dataset.drag;e.dataTransfer.setData('text/plain',dragging);}};
$('content').ondragover=e=>{if(e.target.closest('[data-area]'))e.preventDefault();};
$('content').ondrop=e=>{const area=e.target.closest('[data-area]'),target=e.target.closest('[data-drag]')?.dataset.drag;if(!area||!dragging)return;e.preventDefault();const id=dragging;dragging=null;change(s=>{s.selected=s.selected.filter(x=>x!==id);if(area.dataset.area==='mine'){const i=target?s.selected.indexOf(target):-1;s.selected.splice(i<0?s.selected.length:i,0,id);}},'名單及排序已儲存。');};
$('amounts').innerHTML=R.amounts.map(x=>`<button type="button" data-amount="${x}">${x}元</button>`).join('')+'<button type="button" data-amount="pending">未抽</button><button type="button" data-amount="discount">滿減劵</button><button type="button" data-amount="benefit">禮遇劵</button>';
$('amounts').onclick=async e=>{
 const b=e.target.closest('[data-amount]');if(!b||!editing)return;
 if(!syncPeriod().ok||!editing)return;const {id,i}=editing,choice=b.dataset.amount;
 if(!['pending','discount','benefit',...R.amounts.map(String)].includes(choice))return;
 const outcome=choice==='pending'?{amount:0,redeemed:false,recorded:false}:choice==='discount'?{amount:0,redeemed:false,recorded:true,discount:true}:choice==='benefit'?{amount:0,redeemed:false,recorded:true,benefit:true}:{amount:Number(choice),redeemed:false,recorded:true};
 if(change(s=>s.records[id][i]=outcome,'獎金已儲存。',true))$('picker').close();
};
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{syncPeriod();demoMode=false;tab=b.dataset.tab;window.trackUsage?.('tab_'+tab);render();if(!$('panel-dialog').open)$('panel-dialog').showModal();});
$('panel-content').onclick=e=>$('content').onclick(e);
$('panel-content').onchange=e=>$('content').onchange(e);
for(const event of ['ondragstart','ondragover','ondrop'])$('panel-content')[event]=e=>$('content')[event](e);
$('close-panel').onclick=()=>$('panel-dialog').close();
$('panel-dialog').onclose=()=>{tab='entry';demoMode=false;render();};
window.addEventListener('storage',e=>{if(e.key===KEY){undo=null;if(!readError){syncPeriod();toast('已載入另一分頁的最新資料。');}}});
window.addEventListener('focus',()=>syncPeriod(true));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')syncPeriod(true);});
setInterval(()=>{if(document.visibilityState==='visible')syncPeriod(true);},30000);
render();scheduleBoundary();
if(readError){tab='settings';render();$('panel-dialog').showModal();toast('資料無法安全儲存，已停用修改。請檢查裝置空間後重新開啟。');}
window.canApplyAppUpdate=()=>!pendingTap&&!editing&&!readError;
