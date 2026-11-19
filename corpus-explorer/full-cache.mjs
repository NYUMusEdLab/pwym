// Optional browser-only cache. No application server or network requests.
const DB='musedlab-explorer-local-collections';
const STORE='collections';
const REV='source-v261104-xml-9de9bbe-index-1';
const LIMIT={shanghai:831,shaanxi:1309};
const request=r=>new Promise((ok,fail)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>fail(r.error);});
async function db(){
 const r=indexedDB.open(DB,1);
 r.onupgradeneeded=()=>r.result.createObjectStore(STORE);
 return request(r);
}
async function transact(mode,operation){
 const d=await db();
 try{
  const tx=d.transaction(STORE,mode);
  const complete=new Promise((ok,fail)=>{tx.oncomplete=ok;tx.onabort=()=>fail(tx.error||Error('Storage transaction cancelled'));});
  const [res]=await Promise.all([request(operation(tx.objectStore(STORE))),complete]);
  return res;
 }finally{d.close();}
}
export async function loadFullCache(province){
 if(!Object.hasOwn(LIMIT,province))return [];
 const entry=await transact('readonly',s=>s.get(province));
 if(entry?.version!==REV||!Array.isArray(entry.records)||entry.records.length>LIMIT[province])return [];
 const p='anthology-full:'+province+':';
 return entry.records.filter(r=>typeof r?.id==='string'&&r.id.startsWith(p)&&typeof r.title==='string'&&Array.isArray(r.pitches)&&Array.isArray(r.onsets)&&Array.isArray(r.durations)&&Array.isArray(r.measures)&&r.pitches.length>=4&&r.onsets.length===r.pitches.length&&r.durations.length===r.pitches.length&&r.measures.length===r.pitches.length&&/^https:\/\/raw\.githubusercontent\.com\/m-july\/Anthology-of-Chinese-Folk-Songs\//.test(r.scoreSourceUrl));
}
export function saveFullCache(province,records){
 if(!Object.hasOwn(LIMIT,province)||!Array.isArray(records)||!records.length||records.length>LIMIT[province])throw Error('Invalid collection cache');
 return transact('readwrite',s=>s.put({version:REV,records},province));
}
export function clearFullCache(){return transact('readwrite',s=>s.clear());}
