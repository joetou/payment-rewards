(function(root){
'use strict';
const amounts=[0,10,20,50,100,200];
const catalog=[['boc','中銀','澳門中銀手機銀行','#b51e30'],['icbc','工商','工銀e支付','#c72c30'],['mpay','MPay','澳門錢包','#e27725'],['luso','國際','LusoPay','#16756e'],['cgb','廣發','廣發移動支付','#b62c39'],['alipay','支付寶','Alipay','#1677ff'],['uepay','UePay','澳門錢包','#7150a4'],['other1','其他1','自訂支付工具','#52677e'],['other2','其他2','自訂支付工具','#52677e']];
const fresh=()=>({version:1,period:1,updatedAt:Date.now(),selected:['boc','icbc','mpay'],names:{},records:Object.fromEntries(catalog.map(([id])=>[id,[0,0,0].map(()=>({amount:0,redeemed:false}))])),snapshot:null});
function validate(s,snapshot=true){
 if(!s||s.version!==1||!Number.isSafeInteger(s.period)||s.period<1||!Array.isArray(s.selected)||new Set(s.selected).size!==s.selected.length||s.selected.some(id=>!catalog.some(c=>c[0]===id)))throw Error('備份格式不正確');
 if(!s.names||typeof s.names!=='object'||Array.isArray(s.names))throw Error('名稱格式不正確');
 for(const [id,name]of Object.entries(s.names))if(!['other1','other2'].includes(id)||typeof name!=='string'||name.length>20)throw Error('自訂名稱不正確');
 for(const [id]of catalog){const r=s.records?.[id];if(!Array.isArray(r)||r.length!==3||r.some(x=>!x||!amounts.includes(x.amount)||typeof x.redeemed!=='boolean'||(x.amount===0&&x.redeemed)))throw Error('獎金資料不正確');}
 if(s.snapshot){if(!snapshot||s.snapshot.snapshot)throw Error('恢復資料不正確');validate(s.snapshot,false);}
 return s;
}
const totals=rows=>rows.reduce((a,x)=>({total:a.total+x.amount,used:a.used+(x.redeemed?x.amount:0),left:a.left+(x.redeemed?0:x.amount)}),{total:0,used:0,left:0});
function reset(s){if(!Object.values(s.records).flat().some(x=>x.amount>0))return false;const snap=JSON.parse(JSON.stringify(s));snap.snapshot=null;s.snapshot=snap;s.records=fresh().records;s.period++;return true;}
function restore(s){if(!s.snapshot)return null;const prev=JSON.parse(JSON.stringify(s.snapshot));prev.selected=[...s.selected];prev.names={...s.names};prev.snapshot=null;return prev;}
const api={amounts,catalog,fresh,validate,totals,reset,restore};root.Rewards=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
