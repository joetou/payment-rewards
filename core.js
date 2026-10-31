(function(root){
'use strict';
const amounts=[0,10,20,50,100,200],DAY=86400000,OFFSET=8*3600000;
const catalog=[['boc','中銀','澳門中銀手機銀行','#b51e30'],['icbc','工商','工銀e支付','#c72c30'],['mpay','MPay','澳門錢包','#e27725'],['luso','國際','LusoPay','#16756e'],['cgb','廣發','廣發移動支付','#b62c39'],['alipay','支付寶','Alipay','#1677ff'],['uepay','UePay','澳門錢包','#7150a4'],['taifung','豐付寶','大豐銀行','#c7173b'],['other1','其他1','自訂支付工具','#52677e'],['other2','其他2','自訂支付工具','#52677e']];
const clone=x=>JSON.parse(JSON.stringify(x));
const blank=()=>Object.fromEntries(catalog.map(([id])=>[id,[0,0,0].map(()=>({amount:0,redeemed:false,recorded:false}))]));
function addDays(date,days){return new Date(Date.parse(date+'T00:00:00Z')+days*DAY).toISOString().slice(0,10);}
function periodAt(now=Date.now()){
 const local=new Date(now+OFFSET),date=local.toISOString().slice(0,10),start=addDays(date,-((local.getUTCDay()+2)%7));
 return {start,end:addDays(start,6),next:Date.parse(addDays(start,7)+'T00:00:00Z')-OFFSET};
}
const periodLabel=start=>`${start} 至 ${addDays(start,6)}`;
const fresh=(now=Date.now())=>({version:2,periodStart:periodAt(now).start,updatedAt:now,selected:['boc','icbc','mpay'],names:{},records:blank(),history:[]});
const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
function checkFields(s){
 if(!s||!Array.isArray(s.selected)||new Set(s.selected).size!==s.selected.length||s.selected.some(id=>!catalog.some(c=>c[0]===id)))throw Error('支付 App 名單不正確');
 if(!s.names||typeof s.names!=='object'||Array.isArray(s.names))throw Error('名稱格式不正確');
 for(const [id,name]of Object.entries(s.names))if(!['other1','other2'].includes(id)||typeof name!=='string'||name.length>20)throw Error('自訂名稱不正確');
 if(!s.records||typeof s.records!=='object'||Array.isArray(s.records))throw Error('獎金資料不正確');
 for(const [id]of catalog){const r=s.records[id];if(!Array.isArray(r)||r.length!==3||r.some(x=>!x||!amounts.includes(x.amount)||typeof x.redeemed!=='boolean'||(x.recorded!==undefined&&typeof x.recorded!=='boolean')||(x.amount===0&&x.redeemed)))throw Error('獎金資料不正確');}
 if(Object.keys(s.records).some(id=>!catalog.some(c=>c[0]===id)))throw Error('不明支付 App 資料');
}
function fillLegacyBank(s){if(s?.records&&typeof s.records==='object'&&!Object.hasOwn(s.records,'taifung'))s.records.taifung=blank().taifung;}
function legacyValidate(s,nested=false){
 if(!s||s.version!==1||!Number.isSafeInteger(s.period)||s.period<1)throw Error('舊版備份格式不正確');
 fillLegacyBank(s);checkFields(s);
 if(s.snapshot){if(nested)throw Error('恢復資料不正確');legacyValidate(s.snapshot,true);}
 return s;
}
function validate(s){
 if(!s||s.version!==2||!validDate(s.periodStart)||new Date(s.periodStart+'T00:00:00Z').getUTCDay()!==5||s.periodStart<'2000-01-01'||!Number.isFinite(s.updatedAt))throw Error('期間資料不正確');
 checkFields(s);if(!Array.isArray(s.history))throw Error('歷史資料不正確');
 const seen=new Set();
 for(const h of s.history){
  if(!h||typeof h.id!=='string'||seen.has(h.id)||!['auto','legacy'].includes(h.origin)||!Number.isFinite(h.archivedAt))throw Error('歷史記錄不正確');seen.add(h.id);checkFields(h);
  if(h.origin==='auto'){
   if(!validDate(h.start)||new Date(h.start+'T00:00:00Z').getUTCDay()!==5||h.end!==addDays(h.start,6)||h.start>=s.periodStart||h.id!=='week:'+h.start)throw Error('歷史期間不正確');
  }else if(h.id!=='legacy-reset'||h.start!==null||h.end!==null)throw Error('舊版歷史資料不正確');
 }
 return s;
}
function snapshot(s,start,now,origin='auto'){
 return {id:origin==='auto'?'week:'+start:'legacy-reset',origin,start:origin==='auto'?start:null,end:origin==='auto'?addDays(start,6):null,archivedAt:now,records:clone(s.records),selected:[...s.selected],names:{...s.names}};
}
function upgrade(input,now=Date.now()){
 const s=clone(input);if(s?.version===2)return validate(s);
 legacyValidate(s);
 // Old releases recorded an update time, but no calendar period. Keep their
 // current data together; retain the undated manual-reset snapshot separately.
 const savedAt=Number.isFinite(s.updatedAt)&&s.updatedAt>=Date.UTC(2000,0,1)&&s.updatedAt<=now?s.updatedAt:now;
 const next=fresh(now);next.periodStart=periodAt(savedAt).start;next.updatedAt=savedAt;next.selected=[...s.selected];next.names={...s.names};next.records=clone(s.records);
 next.migrationNote='舊版現有記錄按最後儲存時間歸入相應期間；舊版未記錄確切週期。';
 if(s.snapshot)next.history.push(snapshot(s.snapshot,null,now,'legacy'));
 return validate(next);
}
function rollover(s,now=Date.now()){
 validate(s);const target=periodAt(now).start;if(target<=s.periodStart)return 0;
 const next=clone(s);let count=0;
 while(next.periodStart<target){
  if(++count>10000)throw Error('裝置日期超出可處理範圍');
  if(next.history.some(h=>h.id==='week:'+next.periodStart))throw Error('歷史期間重複');
  next.history.push(snapshot(next,next.periodStart,now));next.periodStart=addDays(next.periodStart,7);next.records=blank();
 }
 next.updatedAt=now;validate(next);Object.assign(s,next);return count;
}
const totals=rows=>rows.reduce((a,x)=>({total:a.total+x.amount,used:a.used+(x.redeemed?x.amount:0),left:a.left+(x.redeemed?0:x.amount)}),{total:0,used:0,left:0});
const hasResult=x=>x.amount>0||x.recorded===true;
const resultLabel=x=>hasResult(x)?(x.amount===0?'重在參與':String(x.amount)):'未抽';
const api={hasResult,resultLabel,amounts,catalog,fresh,validate,upgrade,rollover,totals,periodAt,periodLabel,addDays};root.Rewards=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
