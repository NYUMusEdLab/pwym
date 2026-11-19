import{staffCard}from'./western-ui.mjs';import{tempoMap,secondsAtBeat,beatAtSeconds,followPage}from'./playback-model.mjs';import{search,jianpu,normalize}from'./engine.mjs?v=20261119-corpus';import{loadFullCache,saveFullCache,clearFullCache}from'./full-cache.mjs?v=20261119-full';const $=s=>document.querySelector(s),c=$('#canvas'),ctx=c.getContext('2d');let corpus=[],matches=[],selected=null,points=[],drag=false,page=0,audio,voices=[],raf=0,followPlayback=true;const pageSize=()=>innerWidth<=750?16:24;const el=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
function draw(){ctx.clearRect(0,0,600,230);ctx.strokeStyle='#d3dfce';for(let y=20;y<230;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(600,y);ctx.stroke();}ctx.strokeStyle='#b56627';ctx.lineWidth=3;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();if(selected){const notes=selected.pitches.slice(selected.start,selected.end),curve=normalize(notes),x0=points[0]?.x??10,x1=points.at(-1)?.x??590;ctx.strokeStyle='#136a59';ctx.fillStyle='#136a59';ctx.lineWidth=3;ctx.setLineDash([7,4]);ctx.beginPath();curve.forEach((y,i)=>{const x=x0+i*(x1-x0)/Math.max(1,curve.length-1),py=115-y*190;i?ctx.lineTo(x,py):ctx.moveTo(x,py);});ctx.stroke();ctx.setLineDash([]);curve.forEach((y,i)=>{ctx.beginPath();ctx.arc(x0+i*(x1-x0)/Math.max(1,curve.length-1),115-y*190,4,0,Math.PI*2);ctx.fill();});}}let stroke=null;
function pos(e,r){
 const clamp=(v,size)=>Math.max(0,Math.min(size,v));
 const x=clamp((e.clientX-r.left)*600/r.width,600);
 const y=clamp((e.clientY-r.top)*230/r.height,230);
 // A fingertip just inside the top or bottom can still reach the range limit.
 const edge=230*Math.min(7,r.height*.035)/r.height;
 return{x,y:y<=edge?0:y>=230-edge?230:y};
}
function appendPoint(e){
 const p=pos(e,stroke.rect),last=points.at(-1);
 if(p.x-last.x>=.6)points.push(p);
 else if(p.x>=last.x-.6)points[points.length-1]={x:last.x,y:p.y};
}
c.onpointerdown=e=>{
 if(stroke||!e.isPrimary||e.button!==0)return;
 e.preventDefault();
 const rect=c.getBoundingClientRect();
 stroke={id:e.pointerId,rect};
 drag=true;points=[pos(e,rect)];c.setPointerCapture(e.pointerId);draw();
};
c.onpointermove=e=>{
 if(!drag||stroke.id!==e.pointerId)return;
 e.preventDefault();
 const samples=e.getCoalescedEvents?.();
 for(const p of samples?.length?samples:[e])appendPoint(p);
 draw();
};
function endStroke(e,finish){
 if(!stroke||stroke.id!==e.pointerId)return;
 if(finish){e.preventDefault();appendPoint(e);draw();}
 stroke=null;drag=false;
}
c.onpointerup=e=>endStroke(e,true);
c.onpointercancel=e=>endStroke(e,false);
c.onlostpointercapture=e=>endStroke(e,false);
const drawingDialog=$('#drawing-dialog'), drawingPad=$('#drawing-pad'), drawingSlot=$('#drawing-slot'), drawingToggle=$('#expand-drawing');
drawingToggle.onclick=()=>{
 if(drawingDialog.open){drawingDialog.close();return;}
 drawingDialog.append(drawingPad);
 drawingToggle.textContent='Done';
 drawingDialog.showModal();
 drawingToggle.focus({preventScroll:true});
};
drawingDialog.addEventListener('close',()=>{
 drawingSlot.append(drawingPad);
 drawingToggle.textContent='Expand drawing';
 drawingToggle.focus({preventScroll:true});
});
$('#search').addEventListener('click',()=>{if(drawingDialog.open)drawingDialog.close();});
function query(){if(points.length<2)return[];return Array.from({length:32},(_,i)=>{const x=points[0].x+i*(points.at(-1).x-points[0].x)/31;let j=0;while(j<points.length-2&&points[j+1].x<x)j++;const t=(x-points[j].x)/(points[j+1].x-points[j].x||1);return(230-points[j].y-(points[j+1].y-points[j].y)*t)/230*Number($('#range').value);});}function sample(rise=false){points=normalize(rise?[0,1,2,3,4,5]:[0,1,2,4,5,4,2,1,0]).map((y,i,a)=>({x:10+i*580/(a.length-1),y:115-y*190}));draw();run();}
function stop(){cancelAnimationFrame(raf);voices.forEach(n=>{try{n.stop();}catch{}});voices=[];document.querySelectorAll('.sounding').forEach(n=>n.classList.remove('sounding'));$('#head')?.setAttribute('visibility','hidden');}function run(){stop();const q=query();if(!q.length){$('#status').textContent='Draw a contour or choose Arch / Rise.';return;}const term=$('#filter').value.trim().toLowerCase(),group=$('#dataset').value,scope=corpus.filter(r=>(!group||r.dataset===group||(group==='local-shaanxi-all'&&r.id.startsWith('anthology:shaanxi:')))&&(r.title+' '+r.context+' '+r.id).toLowerCase().includes(term));if(!scope.length){$('#status').textContent='No source songs match this filter.';return;}const minNotes=$('#min-notes').valueAsNumber,maxNotes=$('#max-notes').valueAsNumber;
if(!Number.isInteger(minNotes)||!Number.isInteger(maxNotes)||minNotes<4||maxNotes>32||minNotes>maxNotes){$('#status').textContent='Choose a note range from 4–32, with the minimum no higher than the maximum.';return;}
matches=search(q,scope,$('#span').checked,{minNotes,maxNotes}).slice(0,5);$('#matches').replaceChildren(...matches.map((m,i)=>{const o=el('option',`${i+1}. ${m.title}`);o.value=i;return o;}));$('#match-list').replaceChildren(...matches.map((m,i)=>{const b=el('button',`${i+1}. ${m.title} · ${m.distance.toFixed(4)}`,'match');b.onclick=()=>choose(i);return b;}));if(!matches.length){selected=null;$('#title').textContent='No matching passage';$('#identity').textContent='Try a smaller minimum note count.';$('#context').textContent='';$('#notation').replaceChildren();$('#roll').replaceChildren();$('#page-label').textContent='';$('#source-link').hidden=true;$('#rights').textContent='';$('#tempo-status').textContent='';$('#status').textContent='No source line is long enough for this note range.';draw();return;}
$('#status').textContent=`${scope.length} source lines · ${minNotes}–${maxNotes} notes per match · lower distance = closer shape.`;choose(0);}function choose(i){if(!matches[i])return;stop();selected=matches[i];page=Math.max(0,selected.start-4);$('#matches').value=i;document.querySelectorAll('.match').forEach((n,j)=>n.classList.toggle('selected',i===j));$('#title').textContent=selected.title;$('#identity').textContent=`${selected.id} · matched notes ${selected.start+1}–${selected.end} · measures ${selected.measures[selected.start]}–${selected.measures[selected.end-1]}`;$('#context').textContent=selected.context+' · '+selected.pitchReference;$('#full').textContent=selected.notation==='staff'?'▶ Full line':'▶ Full song';$('#notation-label').textContent=selected.notation==='staff'?'Staff pitch + duration · source lyrics':'Jianpu & lyrics';$('#source-link').href=selected.scoreSourceUrl||selected.sourceUrl;$('#source-link').hidden=!$('#source-link').href;$('#rights').textContent=selected.rights;tempoLabel();draw();render();}
function render(){if(!selected)return;const m=selected,n=pageSize();page=Math.max(0,Math.min(page,Math.max(0,m.pitches.length-1)));const end=Math.min(m.pitches.length,page+n),root=$('#notation');root.replaceChildren();jianpu(m.pitches.slice(page,end)).forEach((note,j)=>{const i=page+j,d=el('div','','cell'+(i>=m.start&&i<m.end?' match-note':''));d.dataset.note=i;const digit=el('span',note.degree,'digit'),dur=m.durations[i];if(dur<1)digit.style.borderBottom=dur<=.25?'3px double':'1px solid';d.append(el('small',`#${i+1} m${m.measures[i]}`));if(m.notation==='staff'){d.append(staffCard(m.pitches[i],m.spellings?.[i],dur));}else{d.append(el('span',note.above,'oct'),digit,el('span',note.below,'oct'));}d.append(el('small',dur+' qn'),el('span',m.lyrics?.[i]||'—','lyric'));d.title=`Note ${i+1}; ${dur} quarter-note units; lyric ${m.lyrics?.[i]||'not encoded'}`;root.append(d);});$('#page-label').textContent=`${page+1}–${end} / ${m.pitches.length}`;$('#previous').disabled=page===0;$('#next').disabled=end===m.pitches.length;roll();}
let displayed={start:0,end:0,base:0,total:1};function roll(){if(!selected)return;const m=selected,whole=$('#view').value==='song',start=whole?0:Math.max(0,m.start-8),end=whole?m.pitches.length:Math.min(m.pitches.length,m.end+8),base=m.onsets[start],total=m.onsets[end-1]+m.durations[end-1]-base,lo=Math.min(...m.pitches.slice(start,end))-1,hi=Math.max(...m.pitches.slice(start,end))+1;displayed={start,end,base,total};const svg=$('#roll');svg.replaceChildren();const add=(tag,attrs,text)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));if(text)n.textContent=text;svg.append(n);return n;};add('text',{x:3,y:15,'font-size':10},String(hi));add('text',{x:3,y:110,'font-size':10},String(lo));for(let b=0;b<=total;b+=Math.max(1,Math.ceil(total/16))){const x=30+b/total*750;add('line',{x1:x,x2:x,y1:5,y2:137,stroke:'#d8e3d1'});add('text',{x,y:155,'font-size':9},b);}const lyricEnds=[30,30];for(let i=start;i<end;i++){const x=30+(m.onsets[i]-base)/total*750,y=8+(hi-m.pitches[i])/(hi-lo)*100;const rect=add('rect',{x,y,width:Math.max(1,m.durations[i]/total*750-1),height:10,rx:2,fill:'#176f57',stroke:i>=m.start&&i<m.end?'#d76720':'none','stroke-width':2,'data-note':i});const tip=document.createElementNS('http://www.w3.org/2000/svg','title');tip.textContent=`Note ${i+1}, measure ${m.measures[i]}: ${m.lyrics?.[i]||'no encoded lyric'}`;rect.append(tip);if(end-start<=32&&m.lyrics?.[i]){const label=add('text',{x,y:124,'font-size':10,'data-note':i,'class':'roll-lyric'},m.lyrics[i]);const width=label.getComputedTextLength(),left=Math.min(x,780-width);const lane=lyricEnds.findIndex(end=>left>=end+4);if(lane<0||left<30)label.remove();else{label.setAttribute('x',left);label.setAttribute('y',124+lane*14);lyricEnds[lane]=left+width;}}}add('line',{id:'head',x1:30,x2:30,y1:3,y2:140,stroke:'#d76720','stroke-width':2,visibility:'hidden'});}
function tempoLabel(){if(!selected)return;const map=tempoMap(selected,$('#tempo').value==='source'?null:Number($('#tempo').value));$('#tempo-status').textContent=$('#tempo').value!=='source'?'User preview speed; not source tempo':(selected.tempoMetadata?`${selected.tempoMetadata.text||'No tempo text'} · ${selected.tempoMetadata.mark||'No metronome mark'} · ${selected.tempos?.length?map[0].bpm+' qn/min; unreviewed metadata candidate':'unknown/missing beat unit; fallback 120 qn/min'}`:(selected.tempos?.length?`Encoded playback: ${map[0].bpm} qn/min · ${map.length} segment(s); not a verified performance tempo`:'No encoded tempo · fallback 120 qn/min'));}
async function play(start,end){if(!selected)return;stop();audio??=new(window.AudioContext||window.webkitAudioContext)();await audio.resume();$('#pause').textContent='Ⅱ Pause';const m=selected,map=tempoMap(m,$('#tempo').value==='source'?null:Number($('#tempo').value)),base=m.onsets[start],baseSeconds=secondsAtBeat(base,map),t0=audio.currentTime+.03,total=secondsAtBeat(m.onsets[end-1]+m.durations[end-1],map)-baseSeconds;for(let i=start;i<end;i++){const o=audio.createOscillator(),g=audio.createGain(),t=t0+secondsAtBeat(m.onsets[i],map)-baseSeconds,dur=secondsAtBeat(m.onsets[i]+m.durations[i],map)-secondsAtBeat(m.onsets[i],map);o.frequency.value=440*2**((m.pitches[i]-69)/12);o.connect(g);g.connect(audio.destination);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.1,t+Math.min(.02,dur/5));g.gain.exponentialRampToValueAtTime(.001,t+dur*.98);o.start(t);o.stop(t+dur);voices.push(o);}function tick(){const elapsed=audio.currentTime-t0,beat=beatAtSeconds(baseSeconds+Math.max(0,elapsed),map);const active=m.onsets.findIndex((on,i)=>i>=start&&i<end&&beat>=on&&beat<on+m.durations[i]);const nextPage=followPage(page,pageSize(),active,followPlayback);if(nextPage!==page){page=nextPage;render();}document.querySelectorAll('[data-note]').forEach(n=>{const i=Number(n.dataset.note);n.classList.toggle('sounding',i>=start&&i<end&&beat>=m.onsets[i]&&beat<m.onsets[i]+m.durations[i]);});const x=30+(beat-displayed.base)/displayed.total*750,h=$('#head');h.setAttribute('visibility',x>=30&&x<=780?'visible':'hidden');h.setAttribute('x1',x);h.setAttribute('x2',x);if(elapsed<total)raf=requestAnimationFrame(tick);else stop();}raf=requestAnimationFrame(tick);}
$('#search').onclick=run;$('#arch').onclick=()=>sample();$('#rise').onclick=()=>sample(true);$('#clear').onclick=()=>{stop();points=[];draw();$('#status').textContent='Contour cleared. Existing result retained for comparison.';};$('#matches').onchange=()=>choose(Number($('#matches').value));$('#filter').onkeydown=e=>{if(e.key==='Enter')run();};$('#previous').onclick=()=>{followPlayback=false;$('#follow').checked=false;page=Math.max(0,page-pageSize());render();};$('#next').onclick=()=>{followPlayback=false;$('#follow').checked=false;page+=pageSize();render();};$('#match-page').onclick=()=>{if(selected){page=selected.start;render();}};$('#view').onchange=()=>{stop();roll();};$('#excerpt').onclick=()=>selected&&play(selected.start,selected.end);$('#passage').onclick=()=>{if(selected){$('#view').value='passage';roll();play(displayed.start,displayed.end);}};$('#full').onclick=()=>{if(selected){$('#view').value='song';page=0;render();play(0,selected.pitches.length);}};$('#tempo').onchange=()=>{stop();tempoLabel();};$('#follow').onchange=()=>followPlayback=$('#follow').checked;$('#pause').onclick=async()=>{if(!audio)return;if(audio.state==='running'){await audio.suspend();$('#pause').textContent='▶ Resume';}else{await audio.resume();$('#pause').textContent='Ⅱ Pause';}};$('#stop').onclick=stop;$('#about').onclick=()=>$('#help').showModal();$('#close').onclick=()=>$('#help').close();window.addEventListener('resize',()=>{stop();if(selected)page=Math.max(0,selected.start-4);render();});window.addEventListener('pagehide',stop);
function collections(){const select=$('#dataset'),prior=select.value,groups=new Map();for(const record of corpus)groups.set(record.dataset,(groups.get(record.dataset)||0)+1);
const shaanxi=corpus.filter(r=>r.id.startsWith('anthology:shaanxi:'));if(new Set(shaanxi.map(r=>r.dataset)).size>1)groups.set('local-shaanxi-all',shaanxi.length);
select.replaceChildren(...[...groups].map(([g,n])=>{
 const province=Object.keys(fullSpecs).find(p=>fullSpecs[p].dataset===g);
 const caption=g==='local-shaanxi-all'?'Anthology · Shaanxi · both volumes':g;
 const o=el('option',caption+(province&&n<fullSpecs[province].total?` (${n}/${fullSpecs[province].total}, partial)`:' ('+n+')'));
 o.value=g;return o;
}));
for(const [p,s] of Object.entries(fullSpecs)){
 const count=groups.get(s.dataset)||0;
 if(count<s.total){const o=el('option',count?`Resume ${s.title} full collection (${count}/${s.total})`:`Load ${s.title} full collection (${s.total})`);o.value='load-full:'+p;select.append(o);}
}
if(groups.has(prior))select.value=prior;select.onchange=()=>{if(select.value.startsWith('load-full:')){const p=select.value.split(':')[1];select.value=groups.has(fullSpecs[p].dataset)?fullSpecs[p].dataset:[...groups.keys()][0]||'';startFullCorpus(p);}else run();};$('#loaded').textContent=corpus.length+' source lines · non-commercial exploration';}
for(const id of ['min-notes','max-notes'])$('#'+id).onchange=run;
$('#add-anthology').onclick=()=>{$('#help').showModal();$('#anthology-import').scrollIntoView({block:'start'});$('#anthology-province').focus({preventScroll:true});};
const metadataBase='https://raw.githubusercontent.com/m-july/Anthology-of-Chinese-Folk-Songs/v261104/metadata/curated/';
const metadataNames=p=>p==='shanghai'?['shanghai']:['shaanxi1','shaanxi2'];
const fetchMetadata=(p,signal)=>Promise.all(metadataNames(p).map(async n=>{
 const fallback=AbortSignal.timeout(60000);
 const response=await fetch(metadataBase+n+'.jsonl',{credentials:'omit',signal:signal?(AbortSignal.any?AbortSignal.any([signal,fallback]):signal):fallback});
 if(!response.ok)throw Error('Publisher metadata could not be downloaded.');
 return response.text();
}));
const anthologyModule=()=>import('./anthology-zip.mjs?v=20261119-full');
const fullSpecs={
 shanghai:{title:'Shanghai',total:831,dataset:'Anthology · Shanghai (full collection)'},
 shaanxi:{title:'Shaanxi',total:1309,dataset:'Anthology · Shaanxi (full collection)'}
};
const fullPrefix=p=>'anthology-full:'+p+':';
const fullRecords=p=>corpus.filter(r=>r.id.startsWith(fullPrefix(p)));
const remember=$('#remember-full-corpus'),cacheStatus=$('#cache-status'),prefKey='musedlab-corpus-remember-v1';
try{remember.checked=localStorage.getItem(prefKey)==='on';}catch{}
let cachePreferenceToken=0, activeFull=null;
remember.onchange=async()=>{
 const token=++cachePreferenceToken;
 try{
  if(remember.checked){
   localStorage.setItem(prefKey,'on');
   for(const p of Object.keys(fullSpecs)){const records=fullRecords(p);if(records.length&&token===cachePreferenceToken&&remember.checked)await saveFullCache(p,records);}
   if(token===cachePreferenceToken)cacheStatus.textContent='This browser will keep the full collection indexes, including partial downloads you pause.';
  }else{
   localStorage.removeItem(prefKey);await clearFullCache();
   if(token===cachePreferenceToken)cacheStatus.textContent='Saved scores cleared. Scores already loaded remain available until reload.';
  }
 }catch{if(token===cachePreferenceToken)cacheStatus.textContent='This browser could not update storage. You can still search in this session.';}
};
function mergeFull(p,records){
 if(!records.length)return;
 corpus=corpus.filter(r=>!r.id.startsWith(fullPrefix(p))).concat(records);
}
const fullPanel=$('#full-corpus-progress'),fullStatus=$('#full-corpus-status'),cancelFull=$('#cancel-full-corpus');
const onlineButtons=()=>['#online-shanghai','#online-shaanxi'].map($);
cancelFull.onclick=()=>{activeFull?.controller.abort();cancelFull.disabled=true;fullStatus.textContent='Pausing download…';};
async function startFullCorpus(p){
 if(!fullSpecs[p])return;
 fullPanel.hidden=false;
 if(activeFull){fullStatus.textContent=`Loading ${fullSpecs[activeFull.province].title}. Pause that download to start another.`;return;}
 const previousCollection=$('#dataset').value;
 const s=fullSpecs[p], controller=new AbortController(), existing=fullRecords(p);
 activeFull={province:p,controller};
 cancelFull.hidden=false;cancelFull.disabled=false;
 onlineButtons().forEach(b=>b.disabled=true);
 fullStatus.textContent=`Connecting to the source for ${s.title}… ${existing.length}/${s.total} ready.`;
 try{
  const [texts,parser]=await Promise.all([fetchMetadata(p,controller.signal),anthologyModule()]);
  const {records,excluded,halted}=await parser.readAnthologyCollection(texts,p,(done,total)=>{
   if(!controller.signal.aborted)fullStatus.textContent=`Checking ${s.title} scores: ${done}/${total}. Keep this tab open while they load.`;
  },{existing,signal:controller.signal});
  mergeFull(p,records);collections();
  if(records.length){
   if($('#dataset').value===previousCollection||$('#dataset').value===s.dataset){$('#dataset').value=s.dataset;$('#filter').value='';if(points.length)run();else sample();}
   if(remember.checked)try{await saveFullCache(p,records);}catch{cacheStatus.textContent='Could not save this index; the loaded scores still work for this session.';}
  }
  fullStatus.textContent=records.length===s.total?`${s.title}: all ${s.total} scores ready to search.`:
   `${s.title}: ${records.length}/${s.total} scores ready. ${controller.signal.aborted?'Paused.':halted|| (excluded.length?'Some source scores didn’t load.':'Download incomplete.')} Choose the full collection in Collection to try the remaining scores.`;
 }catch(error){
  fullStatus.textContent=controller.signal.aborted?`${s.title} download paused. Choose it in Collection to continue.`:`Could not load ${s.title}: ${error.message} Choose it in Collection to retry.`;
 }finally{activeFull=null;cancelFull.hidden=true;onlineButtons().forEach(b=>b.disabled=false);}
}
async function restoreSavedFull(){
 if(!remember.checked)return;
 const token=cachePreferenceToken;
 try{
  const saved=await Promise.all(Object.keys(fullSpecs).map(async p=>[p,await loadFullCache(p)]));
  if(!remember.checked||token!==cachePreferenceToken)return;
  for(const [p,records] of saved){if(!fullRecords(p).length&&activeFull?.province!==p)mergeFull(p,records);}
  collections();
 }catch{cacheStatus.textContent='Saved scores could not be opened. You can load them again from Collection.';}
}
for(const province of ['shanghai','shaanxi'])$('#online-'+province).onclick=async()=>{
 const buttons=onlineButtons(),status=$('#online-status');
 buttons.forEach(b=>b.disabled=true);
 try{
  status.textContent='Getting collection metadata from the publisher…';
  const [texts,parser]=await Promise.all([fetchMetadata(province),anthologyModule()]);
  status.textContent='Loading publisher score selection…';
  const {records,excluded}=await parser.readAnthologySelections(texts,province,(done,total)=>{status.textContent=`Retrieving publisher scores: ${done} of ${total}…`;});
  if(!records.length)throw Error('No usable scores could be retrieved.');
  corpus=corpus.filter(r=>!r.id.startsWith('anthology-online:'+province+':')).concat(records);
  collections();$('#dataset').value=records[0].dataset;$('#filter').value='';
  if(points.length)run();else sample();
  status.textContent=`${records.length} publisher scores added to search. ${excluded.length?excluded.length+' unavailable. ':''}Close this panel to search the selection.`;
 }catch(err){status.textContent='Online selection unavailable: '+err.message+' Try again, or open a local ZIP below.';}
 finally{buttons.forEach(b=>b.disabled=false);}
};
$('#anthology-load').onclick=async()=>{
 const btn=$('#anthology-load'),status=$('#anthology-status'),province=$('#anthology-province').value;
 const zip=$('#anthology-zip').files?.[0],files=[...$('#anthology-metadata').files],names=metadataNames(province);
 if(!zip){status.textContent='Choose the original province score ZIP first. On iPhone, find it in Files → Downloads.';return;}
 if(files.length&&files.length!==names.length){status.textContent='Choose '+names.length+' matching curated metadata file(s), or clear them to load from the publisher.';return;}
 btn.disabled=true;
 try{
  status.textContent=files.length?'Reading local metadata…':'Getting curated metadata from the publisher…';
  const [texts,parser]=await Promise.all([
   files.length?Promise.all(files.map(f=>f.text())):fetchMetadata(province),
   anthologyModule()
  ]);
  status.textContent='Reading scores on this device…';
  const {records,excluded}=await parser.readAnthologyArchive(zip,texts,province,(done,total)=>{status.textContent=`Reading local scores: ${done} of ${total}…`;});
  if(!records.length)throw Error('No playable scores matched these files. Check the province and metadata.');
  corpus=corpus.filter(r=>!r.id.startsWith('anthology:'+province+':')).concat(records);
  collections();$('#dataset').value=(province==='shaanxi'&&$('#dataset').querySelector('[value=local-shaanxi-all]'))?'local-shaanxi-all':records[0].dataset;$('#filter').value='';
  if(points.length)run();else sample();
  status.textContent=`${records.length} lines added. ${excluded.length?excluded.length+' skipped. ':''}Nothing uploaded. Close this panel to search.`;
 }catch(err){status.textContent='Not imported: '+err.message;}
 finally{btn.disabled=false;}
};
$('#local-import').onchange=async e=>{try{const f=e.target.files?.[0];if(!f)return;if(f.size>15e6)throw Error('Use an index below15MB');const data=JSON.parse(await f.text());if(!Array.isArray(data.records)||data.records.length>2000)throw Error('Expected a derived corpus index with at most2000 records');const imported=data.records.map((r,i)=>{if(!r.title||!r.provenance||!r.rights||!Array.isArray(r.pitches)||r.pitches.length<4||r.pitches.length>10000)throw Error('Missing source, rights or note metadata');for(const k of ['durations','onsets','measures'])if(!Array.isArray(r[k])||r[k].length!==r.pitches.length)throw Error('Note arrays do not align');if(r.pitches.some(p=>!Number.isFinite(p)||p<0||p>127)||r.durations.some(d=>!Number.isFinite(d)||d<=0)||r.onsets.some((t,j)=>!Number.isFinite(t)||t<0||j&&t<r.onsets[j-1]))throw Error('Invalid musical timing or pitch');return {...r,id:'local:'+i+':'+r.id,dataset:'Local file · '+r.dataset,lyrics:Array.isArray(r.lyrics)?r.lyrics:r.pitches.map(()=>''),sourceUrl:/^https:\/\//.test(r.sourceUrl||'')?r.sourceUrl:'',scoreSourceUrl:/^https:\/\//.test(r.scoreSourceUrl||'')?r.scoreSourceUrl:''};});corpus=corpus.filter(r=>!r.id.startsWith('local:')).concat(imported);collections();$('#dataset').value=imported[0]?.dataset||$('#dataset').value;run();$('#import-status').textContent=imported.length+' lines loaded only in this browser; nothing uploaded. Reload to clear.';}catch(err){$('#import-status').textContent='Not imported: '+err.message;}};
try{const r=await fetch('./corpus-index.json');if(!r.ok)throw Error('Corpus unavailable');const d=await r.json();corpus=d.records.concat(corpus);collections();sample();void restoreSavedFull();}catch(e){$('#loaded').textContent='Corpus unavailable';$('#status').textContent=e.message+'; no demonstration substituted.';draw();}
