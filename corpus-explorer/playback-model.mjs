// All tempo values use quarter notes per minute; absent data is never inferred.
export function tempoMap(record,override=null){
 if(override)return[{onset:0,bpm:60/override,source:'user preview speed'}];
 const entries=(record.tempos||[]).filter(t=>Number.isFinite(t.onset)&&t.onset>=0&&Number.isFinite(t.bpm)&&t.bpm>0).sort((a,b)=>a.onset-b.onset);
 const out=[{onset:0,bpm:120,source:'fallback: no initial numeric source tempo'}];
 for(const t of entries){if(out.at(-1).onset===t.onset)out[out.length-1]=t;else out.push(t);}
 return out;
}
export function secondsAtBeat(beat,map){let seconds=0;for(let i=0;i<map.length;i++){const a=map[i],end=Math.min(beat,map[i+1]?.onset??beat);if(end>a.onset)seconds+=(end-a.onset)*60/a.bpm;if(end===beat)break;}return seconds;}
export function beatAtSeconds(seconds,map){let remaining=Math.max(0,seconds);for(let i=0;i<map.length;i++){const a=map[i],span=((map[i+1]?.onset??Infinity)-a.onset)*60/a.bpm;if(remaining<span)return a.onset+remaining*a.bpm/60;remaining-=span;}return 0;}
export function followPage(page,size,active,enabled){return enabled&&active>=0&&(active<page||active>=page+size)?active:page;}
