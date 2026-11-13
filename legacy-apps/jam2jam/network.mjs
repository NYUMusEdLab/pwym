import{PROTOCOL,cleanControl,keyFor,validRole,parseClientMessage}from'./jam-protocol.mjs';
export class Ensemble{
 constructor({onControl,onStatus,onActivity,fetcher=globalThis.fetch,Socket=globalThis.WebSocket,Channel=globalThis.BroadcastChannel}){
  Object.assign(this,{onControl,onStatus,onActivity,fetcher,Socket,Channel});this.actor=crypto.randomUUID();this.room='studio';this.seq=0;this.enabled=false;this.mode='offline';this.endpoint=null;this.state='solo';this.peers=new Map();this.values=new Map();this.stamps=new Map();this.attempt=0;this.generation=0;this.revision=-1;this.lastHeard=0;this.selected=2;this.timer=setInterval(()=>this.heartbeat(),10000);
 }
 status(message=this.message||''){this.message=message;this.onStatus?.({enabled:this.enabled,connected:['connected','local'].includes(this.state),mode:this.mode,state:this.state,room:this.room,peers:this.peers.size,message});}
 async discover(){
  const generation=this.generation;
  try{
   const response=await this.fetcher('/api/jam/config',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(5000)});if(generation!==this.generation)return;
   if(!response.ok){this.status(response.status===401?'Sign in to join the online ensemble.':'Online jamming is not available on this host.');return;}
   const config=await response.json();if(generation!==this.generation)return;
   if(config.protocol!==PROTOCOL||typeof config.endpoint!=='string')throw Error('Unsupported room service.');
   const endpoint=new URL(config.endpoint,location.href);if(endpoint.origin!==location.origin||!['https:','http:'].includes(endpoint.protocol))throw Error('The room service must use this site’s origin.');
   endpoint.protocol=endpoint.protocol==='https:'?'wss:':'ws:';this.endpoint=endpoint.href;this.join(config.defaultRoom||'studio');
  }catch{if(generation===this.generation)this.status('Online jamming could not connect. Local playback remains available.');}
 }
 join(room='studio',mode='online'){
  if(!/^[a-zA-Z0-9_-]{1,64}$/.test(room)){this.status('Use 1–64 letters, numbers, hyphens or underscores for the room.');return false;}
  if(mode!=='local'&&!this.endpoint){this.status('No online room service is configured on this host.');return false;}
  this.leave();this.room=room;this.mode=mode;this.enabled=true;
  if(mode==='local'){
   if(!this.Channel){this.leave();this.status('Same-browser rooms are unavailable.');return false;}
   this.state='local';this.channel=new this.Channel('jam2jam-controls-v2:'+room);this.channel.onmessage=e=>this.receiveLocal(e.data);this.localSend('hello',{});this.status('Same-browser controls only.');
  }else this.connect();return true;
 }
 connect(){
  if(!this.enabled||this.mode!=='online')return;
  const generation=this.generation,url=new URL(this.endpoint);url.searchParams.set('room',this.room);this.state='connecting';this.status('Connecting to the shared controls…');
  let socket;try{socket=this.socket=new this.Socket(url.href);}catch{this.retry(generation);return;}
  // Also bound a stalled handshake, not just a missing welcome after open.
  this.connectDeadline=setTimeout(()=>socket.close(),10000);
  socket.onopen=()=>{if(generation===this.generation)this.lastHeard=Date.now();};
  socket.onmessage=e=>{if(generation===this.generation&&socket===this.socket)this.receive(e.data);};
  socket.onerror=()=>{if(generation===this.generation)this.status('Connection interrupted; reconnecting…');};
  socket.onclose=()=>{if(generation!==this.generation)return;clearTimeout(this.connectDeadline);this.socket=null;this.peers.clear();this.retry(generation);};
 }
 retry(generation){if(!this.enabled||generation!==this.generation)return;this.state='reconnecting';this.status('Disconnected. Local controls still work; reconnecting…');clearTimeout(this.retryTimer);this.retryTimer=setTimeout(()=>this.connect(),Math.min(15000,500*2**Math.min(this.attempt++,5)));}
 receive(raw){
  let m;try{m=JSON.parse(raw);}catch{return;}if(!m||m.v!==PROTOCOL)return;this.lastHeard=Date.now();
  if(m.type==='error'){this.status(typeof m.message==='string'?m.message:'Connection error.');return;}if(m.type==='pong')return;
  if(m.type==='presence'&&Array.isArray(m.participants)&&m.participants.length<=64){this.peers=new Map(m.participants.filter(p=>typeof p.actor==='string'&&p.actor!==this.actor).map(p=>[p.actor,{role:validRole(p.role)?p.role:null}]));this.status();return;}
  if(!['welcome','control'].includes(m.type)||!Number.isSafeInteger(m.revision)||m.revision<0||!Array.isArray(m.controls)||m.controls.length>36||m.controls.some(c=>!cleanControl(c)))return;
  if(m.type==='welcome'){if(typeof m.actor!=='string')return;this.actor=m.actor;this.revision=-1;this.attempt=0;this.state='connected';clearTimeout(this.connectDeadline);this.values.clear();this.status('Online · shared controls, local sound and images.');}
  if(m.revision<=this.revision)return;this.revision=m.revision;
  for(const entry of m.controls){const c=cleanControl(entry);this.values.set(keyFor(c),c);this.onControl?.(c,m.actor,{initial:m.type==='welcome',self:m.type==='control'&&m.actor===this.actor});}
  if(m.type==='control'&&m.actor!==this.actor&&m.controls.length)this.onActivity?.(m.controls[0].role);
  if(m.type==='welcome')this.select(this.selected);
 }
 sendPacket(type,payload){if(this.mode!=='online'||this.state!=='connected'||this.socket?.readyState!==1)return false;if(this.socket.bufferedAmount>16384){this.socket.close();return false;}this.socket.send(JSON.stringify({v:PROTOCOL,type,seq:++this.seq,...payload}));return true;}
 control(role,param,value){return this.controls([{role,param,value}]);}
 controls(entries){const controls=entries.map(cleanControl);if(controls.some(c=>!c)||!controls.length||controls.length>2)return false;const unique=[...new Map(controls.map(c=>[keyFor(c),c])).values()];if(this.mode==='local'&&this.enabled){this.localSend('control',{controls:unique});return true;}return this.sendPacket('control',{controls:unique});}
 select(role){if(!validRole(role))return;this.selected=role;if(this.mode==='local'&&this.enabled)this.localSend('presence',{role});else this.sendPacket('select',{role});}
 localSend(type,payload){const m={v:PROTOCOL,room:this.room,type,actor:this.actor,seq:++this.seq,clock:Date.now(),...payload};if(type==='control')this.applyLocal(m,true);this.channel?.postMessage(m);}
 applyLocal(m,self=false){
  if(!Array.isArray(m.controls)||m.controls.length>36)return;
  for(const entry of m.controls){const c=cleanControl(entry);if(!c)continue;const stamp=entry.stamp||[m.clock,m.actor,m.seq];if(!Array.isArray(stamp)||stamp.length!==3||!Number.isFinite(stamp[0])||typeof stamp[1]!=='string'||!Number.isSafeInteger(stamp[2]))continue;
   const key=keyFor(c),old=this.stamps.get(key);if(old&&(stamp[0]<old[0]||stamp[0]===old[0]&&(stamp[1]<old[1]||stamp[1]===old[1]&&stamp[2]<=old[2])))continue;
   this.stamps.set(key,stamp);this.values.set(key,c);if(!self)this.onControl?.(c,m.actor,{initial:m.type==='snapshot',self:false});
  }
 }
 receiveLocal(m){
  if(!m||m.v!==PROTOCOL||m.room!==this.room||m.actor===this.actor||typeof m.actor!=='string')return;
  if(m.type==='bye'){this.peers.delete(m.actor);this.status();return;}
  this.peers.set(m.actor,{seen:Date.now(),role:validRole(m.role)?m.role:null});this.status();
  if(m.type==='hello')this.localSend('snapshot',{controls:[...this.values].map(([key,c])=>({...c,stamp:this.stamps.get(key)}))});
  else if(m.type==='control'){if(!parseClientMessage(JSON.stringify({v:PROTOCOL,type:'control',seq:m.seq,controls:m.controls})))return;this.applyLocal(m);this.onActivity?.(m.controls[0].role);}
  else if(m.type==='snapshot')this.applyLocal(m);
 }
 heartbeat(){if(!this.enabled)return;if(this.mode==='local'){this.localSend('presence',{role:this.selected});for(const[id,p]of this.peers)if(Date.now()-p.seen>30000)this.peers.delete(id);this.status();}else if(this.socket?.readyState===1){if(Date.now()-this.lastHeard>30000)this.socket.close();else this.sendPacket('ping',{});}}
 leave(){this.enabled=false;this.generation++;clearTimeout(this.retryTimer);clearTimeout(this.connectDeadline);if(this.channel){this.localSend('bye',{});this.channel.close();this.channel=null;}this.socket?.close();this.socket=null;this.peers.clear();this.values.clear();this.stamps.clear();this.revision=-1;this.attempt=0;this.state='solo';this.mode='offline';this.status('Disconnected.');}
 close(){this.leave();clearInterval(this.timer);}
}
