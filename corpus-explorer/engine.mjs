// Local-only contour retrieval. No trained model and no network requests.
export const demos = [
 ['arch','Arch',[60,62,64,67,69,67,64,62,60]],
 ['rise','Stepwise rise',[60,62,64,65,67,69,71,72]],
 ['fall','Stepwise descent',[72,71,69,67,65,64,62,60]],
 ['wave','Two waves',[60,64,67,64,60,64,69,64,60]],
 ['leap','Leap and return',[60,67,65,64,62,60,62,60]],
 ['repeat','Repeated tone and release',[64,64,64,64,67,65,62,60]],
 ['valley','Valley',[72,69,67,64,60,64,67,69,72]],
 ['terrace','Terraced ascent',[60,60,64,64,67,67,72,72]]
].map(([id,title,pitches])=>({id,title,pitches,durations:pitches.map(()=>1),pitchReference:'1=C',provenance:'Original interface demonstration, 2026. Not a traditional song or stylistic reconstruction.',rights:'Original demonstration',dataset:'Demo exercises',context:'No regional, ethnic or modal claim'}));
export function resample(a,n=32){if(!a.length)return[];if(a.length===1)return Array(n).fill(a[0]);return Array.from({length:n},(_,i)=>{const x=i*(a.length-1)/(n-1),j=Math.floor(x);return a[j]+((a[Math.min(j+1,a.length-1)]-a[j])*(x-j));});}
export function normalize(a){if(!a.length)return[];const mean=a.reduce((s,x)=>s+x,0)/a.length;const span=Math.max(...a)-Math.min(...a);return a.map(x=>span<1e-9?0:(x-mean)/span);}
export function dtw(a,b){if(!a.length||!b.length)return Infinity;let prev=Array(b.length+1).fill(Infinity);prev[0]=0;for(let i=1;i<=a.length;i++){const next=Array(b.length+1).fill(Infinity);for(let j=1;j<=b.length;j++)next[j]=Math.abs(a[i-1]-b[j-1])+Math.min(prev[j],next[j-1],prev[j-1]);prev=next;}return prev[b.length]/(a.length+b.length);}
export function search(query,items=demos,preserveSpan=false){const prep=a=>{const r=resample(a);if(!preserveSpan)return normalize(r);const mean=r.reduce((s,x)=>s+x,0)/r.length;return r.map(x=>(x-mean)/12);};const q=prep(query);if(!q.length)return[];return items.map(item=>{let shortlist=[];const lens=[...new Set([item.pitches.length,6,8,12,16].filter(n=>n<=item.pitches.length))];for(const len of lens)for(let start=0;start<=item.pitches.length-len;start++){const curve=prep(item.pitches.slice(start,start+len)),coarse=curve.reduce((s,x,i)=>s+(x-q[i])**2,0);if(shortlist.length<3||coarse<shortlist.at(-1).coarse){shortlist.push({coarse,curve,start,end:start+len});shortlist.sort((a,b)=>a.coarse-b.coarse);shortlist=shortlist.slice(0,3);}}const best=shortlist.map(w=>({...w,distance:dtw(q,w.curve)})).sort((a,b)=>a.distance-b.distance)[0];return {...item,distance:best.distance,start:best.start,end:best.end};}).sort((a,b)=>a.distance-b.distance);}
const degrees=['1','♯1','2','♯2','3','4','♯4','5','♯5','6','♯6','7'];
export function jianpu(pitches){return pitches.map(p=>{const d=p-60,oct=Math.floor(d/12),pc=((d%12)+12)%12;return {degree:degrees[pc],above:oct>0?'•'.repeat(oct):'',below:oct<0?'•'.repeat(-oct):''};});}
export function validateImport(data){if(!Array.isArray(data)||data.length>200)throw Error('Use a JSON array of at most 200 excerpts.');return data.map((r,i)=>{if(!r||typeof r.title!=='string'||!Array.isArray(r.pitches)||r.pitches.length<4||r.pitches.length>128||r.pitches.some(x=>!Number.isInteger(x)||x<24||x>108))throw Error(`Record ${i+1}: supply a title and 4–128 integer MIDI pitches (24–108).`);if(typeof r.provenance!=='string'||!r.provenance.trim()||typeof r.rights!=='string'||!r.rights.trim())throw Error(`Record ${i+1}: provenance and rights statement required.`);return {...r,id:`import-${i}`,durations:r.pitches.map(()=>1),dataset:'Local imported excerpts',context:typeof r.context==='string'?r.context:'Context not supplied',pitchReference:'1=C'};});}
