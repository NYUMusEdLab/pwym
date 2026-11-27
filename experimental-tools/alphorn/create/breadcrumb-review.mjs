const map={
 listen:{label:'Listen / revisit',color:'#79d9eb',y:80},
 claim:{label:'Make a claim',color:'#ffcd7d',y:126},
 revision:{label:'Revise / reflect',color:'#d8afff',y:172},
 session:{label:'Session',color:'#a9b9cb',y:218}
};
export const category=action=>/revis(?:ed position|ited position)|listen|playback|replay|pitch evidence/i.test(action)?'listen':/revis(?:ed|ion)|reflect/i.test(action)?'revision':/Annotation added|Annotation removed/i.test(action)?'claim':'session';
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock=s=>{const n=Math.max(0,Math.floor(s)),m=Math.floor(n/60),f=String(n%60).padStart(2,'0');return m<60?m+':'+f:Math.floor(m/60)+':'+String(m%60).padStart(2,'0')+':'+f;};
const pos=x=>Number.isFinite(x.at);
export function traceSummary(trail,dur){
 const count=trail.filter(e=>category(e.action)==='revision').length,bins=new Map();
 for(const e of trail)if(pos(e)&&category(e.action)==='listen'){
  const a=Math.max(0,Math.floor(e.at/10)*10);
  bins.set(a,(bins.get(a)||0)+1);
 }
 const best=[...bins].sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0];
 return {count,hot:best&&best[1]>=2?{start:best[0],end:Math.min(dur||best[0]+10,best[0]+10),count:best[1]}:null};
}
function symbol(k,x,y,c,selected){
 const q=selected?7:5;
 const base=`class="traceDot" fill="${c}" stroke="#101a27" stroke-width="1.4"`;
 if(k==='claim'||k==='session')return `<rect ${base} x="${x-q}" y="${y-q}" width="${2*q}" height="${2*q}" rx="${k==='session'?2:0}"/>`;
 if(k==='revision')return `<path ${base} d="M${x},${y-q-2}l${q+2},${q+2}l-${q+2},${q+2}l-${q+2},-${q+2}z"/>`;
 return `<circle ${base} cx="${x}" cy="${y}" r="${q}"/>`;
}
export function timelineSvg(trail,dur,mode,selected,width=900){
 const compact=width<540,L=compact?86:142,R=width-(compact?26:32),axis=247;
 const session=Math.max(60000,...trail.map(x=>x.elapsedMs));
 const rounded=session>=1200000?Math.ceil(session/600000)*600000:session>=300000?Math.ceil(session/120000)*120000:Math.ceil(session/60000)*60000;
 const xp=t=>L+Math.max(0,t)/rounded*(R-L);
 const room=Math.max(1,dur||0,...trail.filter(pos).map(x=>x.at));
 const pitchY=t=>207-158*Math.min(1,Math.max(0,t/room));
 let s=`<rect width="${width}" height="295" fill="#111b29"/>`;
 if(mode==='teacher'){
  const hot=traceSummary(trail,dur).hot;
  if(hot){const y1=pitchY(hot.end),y2=pitchY(hot.start);
    s+=`<rect x="${L}" y="${y1}" width="${R-L}" height="${Math.max(3,y2-y1)}" fill="#77cde9" fill-opacity=".13"/>`;}
  const step=room>130?30:room>53?15:10;
  for(let t=0;t<=room;t+=step){const y=pitchY(t);s+=`<path d="M${L},${y}H${R}" stroke="#30455c"/><text x="${L-13}" y="${y+4}" text-anchor="end" fill="#b9cde4" font-size="14">${clock(t)}</text>`;}
  s+=`<text x="${L-13}" y="30" fill="#b9cde4" text-anchor="end" font-size="${compact?11:14}">${compact?'Music time':'Music position'}</text><text x="${L-13}" y="228" text-anchor="end" fill="#b9cde4" font-size="${compact?11:14}">${compact?'No audio':'No audio point'}</text><path d="M${L},224H${R}" stroke="#30455c"/>`;
 }else for(const [k,info] of Object.entries(map)){
  s+=`<path d="M${L},${info.y}H${R}" stroke="#30455c"/><text x="${L-13}" y="${info.y+5}" text-anchor="end" fill="${info.color}" font-size="${compact?11:14}">${compact?({listen:'Listen / revisit',claim:'Claim',revision:'Revise / reflect',session:'Session'}[k]):info.label}</text>`;
 }
 const ticks=compact?3:6;
 for(let i=0;i<=ticks;i++){const t=rounded*i/ticks,x=xp(t);
 s+=`<path d="M${x},39V${axis}" stroke="#2b3f55" stroke-dasharray="3 4"/><text x="${x}" y="264" fill="#b9cde4" font-size="14" text-anchor="middle">${clock(t/1000)}</text>`;}
 s+=`<text x="${(L+R)/2}" y="287" text-anchor="middle" fill="#b9cde4" font-size="14">Elapsed session time</text>`;
 const every=Math.max(1,Math.ceil(trail.length/260));
 const chosen=trail[selected];
 if(chosen)s+=`<path d="M${xp(chosen.elapsedMs)},39V${axis}" stroke="#f1f7ff" opacity=".4"/>`;
 trail.forEach((event,i)=>{
  const k=category(event.action), info=map[k];
  if((i%every)!==0&&i!==selected&&k!=='revision')return;
  const x=xp(event.elapsedMs),y=mode==='teacher'?(pos(event)?pitchY(event.at):224):info.y;
  const label=clock(event.elapsedMs/1000)+' · '+event.action+(pos(event)?' · music '+clock(event.at):'');
  s+=`<g class="traceHit${i===selected?' traceHit-selected':''}" data-event="${i}"><title>${esc(label)}</title><circle cx="${x}" cy="${y}" r="13" fill="transparent"/><circle class="traceFocus" cx="${x}" cy="${y}" r="13" fill="none" stroke="#edf5ff" stroke-width="1.5"/>${symbol(k,x,y,info.color,i===selected)}</g>`;
 });
 return s;
}
export function mountTrace({root,seek,replay}){
 const $=q=>root.querySelector(q),svg=$('#traceSvg'),picker=$('#eventPicker');let mode='learner',selected=null,events=[],dur=0,synthetic=false;
 function render(){
  $('#traceReview').hidden=!events.length;if(!events.length)return;
  const index=Math.max(0,events.indexOf(selected));
  const x=events[index];
  const teacher=mode==='teacher',summary=traceSummary(events,dur);
  $('#learnerTrace').setAttribute('aria-pressed',!teacher);$('#teacherTrace').setAttribute('aria-pressed',teacher);
  const description=teacher?(summary.hot?`The shaded band is the most revisited passage (${clock(summary.hot.start)}–${clock(summary.hot.end)}, ${summary.hot.count} listening or navigation events). `:'')+`Compare position in the music with elapsed time. ${summary.count} revision or reflection entries; activity is not a grade.`:'Follow listening, claims, and revisions in order. Choose a dot to recover what you heard or wrote. Gold squares are claims; purple diamonds are revisions or reflections.';
  $('#traceHint').textContent=description;
  svg.setAttribute('aria-label',teacher?'Elapsed time versus recording position. Select an event below.':'Elapsed session time in four activity lanes. Select an event below.');
  const width=Math.round(svg.clientWidth||900);
  svg.setAttribute('viewBox','0 0 '+width+' 295');
  svg.setAttribute('preserveAspectRatio','none');
  svg.innerHTML=timelineSvg(events,dur,mode,index,width);picker.value=index;
  $('#previousEvent').disabled=index<=0;$('#nextEvent').disabled=index>=events.length-1;
  $('#eventTitle').textContent=x.action;
  $('#eventMeta').textContent='Session '+clock(x.elapsedMs/1000)+(pos(x)?' · Music '+clock(x.at):' · No audio position');
  $('#eventNote').textContent=x.note||'';
  const near=pos(x)&&category(x.action)==='revision'?events.map((e,i)=>[e,i]).slice(0,index).filter(([e])=>pos(e)&&Math.abs(e.at-x.at)<4&&category(e.action)==='listen').slice(-3):[];
  $('#eventContext').textContent=near.length?'Nearby listening before this revision: '+near.map(([e])=>clock(e.elapsedMs/1000)+' into the session').join(', ')+'.':'';
  $('#replayEvent').hidden=!pos(x)||!dur;
 }
 function jump(i,move=true){if(!events[i])return;selected=events[i];render();if(move&&pos(selected))seek(selected.at);}
 function feed(rows,demo,length){
  const oldLen=events.length;
  const newSample=demo&&!synthetic;
  events=rows.slice();synthetic=demo;dur=length;
  if(newSample||!selected||!events.includes(selected)){selected=(synthetic?events.find(e=>e.action==='Annotation revised'):events.at(-1))||events[0]||null;}
  if(oldLen!==events.length||newSample||!events.length){
   picker.replaceChildren();
   events.forEach((x,i)=>{const o=root.createElement('option');o.value=i;o.textContent=clock(x.elapsedMs/1000)+' · '+x.action;picker.append(o);});
  }
  render();
 }
 $('#learnerTrace').onclick=()=>{mode='learner';render();};
 $('#teacherTrace').onclick=()=>{mode='teacher';render();};
 picker.onchange=()=>jump(Number(picker.value));
 $('#previousEvent').onclick=()=>jump(events.indexOf(selected)-1);
 $('#nextEvent').onclick=()=>jump(events.indexOf(selected)+1);
 svg.addEventListener('click',e=>{const x=e.target.closest?.('[data-event]');if(x)jump(Number(x.dataset.event));});
 $('#replayEvent').onclick=()=>{if(selected&&pos(selected))replay(selected.at,selected.action);};
 if(typeof ResizeObserver==='function')new ResizeObserver(render).observe(svg);
 return {feed};
}
