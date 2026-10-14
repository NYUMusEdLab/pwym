const DB='musedlab-song-studio-v1';
let pending;
function database(){return pending ||= new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{r.result.createObjectStore('projects',{keyPath:'id'});r.result.createObjectStore('audio');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function transact(store,mode,run){const db=await database();return new Promise((resolve,reject)=>{const t=db.transaction(store,mode);const request=run(t.objectStore(store));t.oncomplete=()=>resolve(request?.result);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||Error('Local save interrupted.'));});}
export const saveProject=p=>transact('projects','readwrite',s=>s.put(p));
export const listProjects=()=>transact('projects','readonly',s=>s.getAll());
export const getProject=id=>transact('projects','readonly',s=>s.get(id));
export const saveAudio=(id,blob)=>transact('audio','readwrite',s=>s.put(blob,id));
export const getAudio=id=>transact('audio','readonly',s=>s.get(id));
// Minimal ZIP writer, STORE method, UTF-8 filenames. No packages or network.
function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
export async function zip(files){
  const chunks=[],directory=[];let offset=0;const enc=new TextEncoder();
  for(const [path,value] of Object.entries(files)){
    const name=enc.encode(path),body=value instanceof Blob?new Uint8Array(await value.arrayBuffer()):enc.encode(typeof value==='string'?value:JSON.stringify(value,null,2)),crc=crc32(body);
    const h=new Uint8Array(30+name.length),v=new DataView(h.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,body.length,true);v.setUint32(22,body.length,true);v.setUint16(26,name.length,true);h.set(name,30);
    const d=new Uint8Array(46+name.length),dv=new DataView(d.buffer);dv.setUint32(0,0x02014b50,true);dv.setUint16(4,20,true);dv.setUint16(6,20,true);dv.setUint16(8,0x800,true);dv.setUint32(16,crc,true);dv.setUint32(20,body.length,true);dv.setUint32(24,body.length,true);dv.setUint16(28,name.length,true);dv.setUint32(42,offset,true);d.set(name,46);
    chunks.push(h,body);directory.push(d);offset+=h.length+body.length;
  }
  const len=directory.reduce((a,d)=>a+d.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,directory.length,true);v.setUint16(10,directory.length,true);v.setUint32(12,len,true);v.setUint32(16,offset,true);
  return new Blob([...chunks,...directory,end],{type:'application/zip'});
}
export function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
