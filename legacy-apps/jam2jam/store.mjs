let dbPromise;
function db(){return dbPromise??=new Promise((resolve,reject)=>{const r=indexedDB.open('musedlab-jam2jam',1);r.onupgradeneeded=()=>r.result.createObjectStore('takes',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function saveTake(take){const d=await db();await new Promise((resolve,reject)=>{const tx=d.transaction('takes','readwrite');tx.objectStore('takes').put(take);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
export async function allTakes(){const d=await db();return new Promise((resolve,reject)=>{const r=d.transaction('takes').objectStore('takes').getAll();r.onsuccess=()=>resolve(r.result.sort((a,b)=>b.created-a.created));r.onerror=()=>reject(r.error);});}
export async function removeTake(id){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('takes','readwrite');tx.objectStore('takes').delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
export function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),30000);}
export const blobBase64=blob=>new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(blob);});
