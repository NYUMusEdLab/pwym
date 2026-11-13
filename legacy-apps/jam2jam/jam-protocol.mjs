// Musical controls only; media, takes, scene content and code never belong here.
export const PROTOCOL=2,MAX_MESSAGE_BYTES=512;
export const validRole=r=>Number.isInteger(r)&&r>=0&&r<=5;
export function validControl(c){return c&&validRole(c.role)&&Number.isInteger(c.param)&&(c.role===0?c.param>=0&&c.param<6:c.param>=6&&c.param<12)&&typeof c.value==='number'&&Number.isFinite(c.value)&&c.value>=0&&c.value<=1;}
export function cleanControl(c){return validControl(c)?{role:c.param===7?1:c.role,param:c.param,value:c.value}:null;}
export const keyFor=c=>`${c.role}:${c.param}`;
export function parseClientMessage(raw){
 if(typeof raw!=='string'||new TextEncoder().encode(raw).length>MAX_MESSAGE_BYTES)return null;
 let m;try{m=JSON.parse(raw);}catch{return null;}
 if(!m||m.v!==PROTOCOL||!Number.isSafeInteger(m.seq)||m.seq<1)return null;
 if(m.type==='ping')return{v:PROTOCOL,type:'ping',seq:m.seq};
 if(m.type==='select'&&validRole(m.role))return{v:PROTOCOL,type:'select',seq:m.seq,role:m.role};
 if(m.type!=='control'||!Array.isArray(m.controls)||m.controls.length<1||m.controls.length>2)return null;
 const controls=m.controls.map(cleanControl);
 if(controls.some(c=>!c)||new Set(controls.map(keyFor)).size!==controls.length)return null;
 // Rebuild packets: unrecognized fields can never leak into a broadcast.
 return{v:PROTOCOL,type:'control',seq:m.seq,controls};
}
