import {MAX,noteName,analyze,wav} from './analysis.mjs';
import {mountTrace} from './breadcrumb-review.mjs';
const $=q=>document.querySelector(q),a=$('#player'),roll=$('#roll'),wave=$('#wave'),slider=$('#seek');
const W=900,L=56,R=882,T=15,B=218;
const esc=x=>String(x).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const timeText=t=>Math.floor(t/60)+':'+String(Math.floor(t)%60).padStart(2,'0');
const sec=t=>Number(t).toFixed(2);
const center=(t,len)=>Math.min(Math.max(0,t-Math.min(30,len)/2),Math.max(0,len-30));
const fixed=t=>Math.round(t*20)/20;
const status=t=>$('#status').textContent=t;
let blob,dataURL='',audioBuffer,takeDuration=0,envelope=[],pitch=[],marks=[],trail=[],edit=null,recording,stream,timer,clock,ctx,busy=false,follow=true,viewStart=0,refClock=Date.now(),synthetic=new URLSearchParams(location.search).get('demo')==='1',didPitch=false,raf,playFrom=0,lastSeek=0,searchTarget=null,pendingSeek=null,reflectionTouched=false;
let id=0,cursor,wcursor,windowShade;
const max=()=>takeDuration||30, span=()=>follow?Math.min(30,max()):max(), xp=t=>L+(t-viewStart)/span()*(R-L), wx=t=>L+t/max()*(R-L), yp=n=>T+24+(83-n)/(83-40)*(B-T-34);
const colors={Section:'#e1eaff',Chord:'#adc1df',Key:'#ad9ce8',Cadence:'#a0d8bd','Motif / contour':'#ffd47e','Other observation':'#d2dbe8'};
const stamp=()=>Date.now()-refClock;
const traceReview=mountTrace({root:document,seek:at=>seekTo(at,false),replay:(at,action)=>{
 if(!blob)return;const start=Math.max(0,at-2);seekTo(start,false);searchTarget=Math.min(takeDuration,at+3);
 log('Replayed passage',start,'From breadcrumb: '+action);
 a.play().catch(()=>status('Use the audio player above to hear the selected passage.'));
}});
function log(action,position,note='',ms=null){
 if(synthetic)return;
 trail.push({elapsedMs:ms??stamp(),action,at:Number.isFinite(position)?fixed(position):null,note:String(note).slice(0,1500)});
 if(trail.length>5000)trail.shift();
 renderTrail();
}
function renderTrail(){
 traceReview.feed(trail,synthetic,takeDuration);
 const root=$('#trail');root.replaceChildren();
 for(const x of trail.slice(-100)){
  const li=document.createElement('li'),t=document.createElement('time'),s=document.createElement('span');
  t.textContent=elapsed(x.elapsedMs);s.textContent=x.action+(x.at!==null?' (at '+timeText(x.at)+')':'')+(x.note?' · '+x.note:'');
  li.append(t,s);root.append(li);
 }
 const tries=trail.filter(x=>x.action==='Annotation added'||x.action==='Annotation revised').length;
 const listens=trail.filter(x=>['Playback started','Replayed passage'].includes(x.action)).length;
 $('#trailStats').textContent=(synthetic?'Synthetic example · ':'')+trail.length+' activity entries · '+listens+' listens or replays · '+tries+' annotation attempts'+(trail.length?' · Elapsed '+elapsed(trail.at(-1).elapsedMs):'');
}
function setView(t){viewStart=follow?center(t,max()):0;}
function zoom(b){
 follow=b;setView(a.currentTime);$('#zoom').setAttribute('aria-pressed',b);$('#zoom').textContent=b?'Show whole recording':'30-second view';refreshPlot();
}
function refreshControls(){
 $('#record').disabled=!!recording||busy;
 $('#record').textContent=blob?'Record a new performance':'Record a performance';
 $('#stop').disabled=!recording;
 $('#pitch').disabled=!!recording||busy||!audioBuffer;
 $('#saveNote').disabled=!blob||busy||!!recording;
 slider.disabled=!blob;slider.max=max();
 $('#atCursor').disabled=!blob;$('#download').disabled=!blob&&!trail.length;
 $('#saveReflection').disabled=!blob;
 $('#exampleFlag').hidden=!synthetic;$('#exampleLink').textContent=synthetic?'Start a blank workspace':'Show synthetic one-hour session';$('#exampleLink').href=synthetic?'./':'?demo=1';
}
function refreshPlot(){
 let p='<defs><clipPath id="bounds"><rect x="56" y="12" width="826" height="208"/></clipPath></defs>';
 const step=span()>75?30:span()>25?5:span()>9?2:1;
 for(let t=Math.ceil(viewStart/step)*step;t<=viewStart+span()+.001;t+=step){
  const x=xp(t);p+=`<path d="M${x},${T}V${B}" stroke="#28394e"/><text x="${x}" y="243" fill="#adc0d5" font-size="14" text-anchor="middle">${timeText(t)}</text>`;
 }
 if(didPitch)for(const n of [43,48,55,60,67,72,79])p+=`<path d="M${L},${yp(n)}H${R}" stroke="#26364b"/><text x="${L-8}" y="${yp(n)+4}" text-anchor="end" fill="#b6c7da" font-size="14">${noteName(n)}</text>`;
 p+='<g clip-path="url(#bounds)">';
 for(let i=0;i<marks.length;i++){
  const m=marks[i],x=xp(m.start),end=m.end==null?null:xp(m.end),color=colors[m.kind]||'#cddff1';
  if(end!=null&&end>0&&x<R)p+=`<rect x="${x}" y="${T+3}" width="${end-x}" height="${B-T-5}" fill="${color}" opacity=".085"/>`;
  if(x<L||x>R)continue;
  if(m.kind==='Section')p+=`<path d="M${x},${T}V${B}" stroke="${color}" stroke-dasharray="5 4" opacity=".68"/>`;
  const y=m.kind==='Section'?30:54+((i%5)*28);
  p+=`<rect x="${x}" y="${y-12}" width="${Math.min(245,Math.max(40,9*m.label.length+13))}" height="21" rx="4" fill="#26374e"/><text x="${x+5}" y="${y+3}" fill="${color}" font-size="14">${esc(m.label)}</text><title>${esc(m.kind+': '+m.label)}</title>`;
 }
 if(didPitch){
  let path='',prev=null;
  for(const [t,n] of pitch){if(t<viewStart-.1||t>viewStart+span()+.1||n<40||n>83){prev=null;continue;}
   path+=((prev&&t-prev[0]<.09&&Math.abs(n-prev[1])<7)?'L':'M')+xp(t).toFixed(2)+','+yp(n).toFixed(2);prev=[t,n];}
  if(path)p+=`<path d="${path}" fill="none" stroke="#ffc56a" stroke-width="3" stroke-linecap="round"/>`;
 }
 p+='</g>';
 if(!blob)p+='<text x="460" y="125" text-anchor="middle" fill="#dbe7f3" font-size="22">Your analysis starts here</text>';
 else if(!didPitch&&!marks.length)p+='<text x="460" y="125" text-anchor="middle" fill="#dbe7f3" font-size="19">Listen and add your first annotation</text>';
 roll.innerHTML=p+'<path id="cursor" d="M56,15V218" stroke="#fff" stroke-width="1.6"/>';cursor=roll.querySelector('#cursor');
 const top=Math.max(.001,...envelope), line=envelope.map((v,i)=>{const x=L+i/Math.max(1,envelope.length-1)*(R-L), h=20*Math.sqrt(v/top);return `M${x.toFixed(2)},${(24-h).toFixed(2)}V${(24+h).toFixed(2)}`;}).join('');
 const section=marks.filter(x=>x.kind==='Section').map(m=>`<path d="M${wx(m.start)},1V47" stroke="#dbeaff" stroke-dasharray="3 3"/>`).join('');
 wave.innerHTML=`<path d="M56,24H882" stroke="#33455b"/><path d="${line}" stroke="#8da2bd" stroke-width="1.35"/>${section}<rect id="lens" y="1" height="46" fill="#7cc3ff" fill-opacity=".1" stroke="#91c2f2"/><path id="waveCursor" d="M56,0V48" stroke="#fff" stroke-width="1.6"/>`;
 windowShade=wave.querySelector('#lens');wcursor=wave.querySelector('#waveCursor');
 windowShade?.setAttribute('x',wx(viewStart));windowShade?.setAttribute('width',wx(viewStart+span())-wx(viewStart));
 $('#viewName').textContent=follow?`View: ${timeText(viewStart)}–${timeText(viewStart+span())}`:'Whole recording';
 sync(false);
}
function sync(autofollow=true){
 const t=a.currentTime||0;
 if(autofollow&&follow&&t<max()-.12&&(t<viewStart||t>viewStart+span()-.3)){setView(t);refreshPlot();return;}
 slider.value=t;$('#position').textContent=timeText(t)+(blob?' / '+timeText(takeDuration):'');
 cursor?.setAttribute('d',`M${xp(Math.max(viewStart,Math.min(viewStart+span(),t)))},15V218`);
 wcursor?.setAttribute('d',`M${wx(t)},0V48`);
}
function where(svg,e){const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return (p.matrixTransform(svg.getScreenCTM().inverse()).x-L)/(R-L);}
function seekTo(t,entry=true,recenter=true){
 if(!blob)return;const to=Math.min(takeDuration,Math.max(0,t));
 if(entry&&Date.now()-lastSeek>700){log('Revisited position',to);lastSeek=Date.now();}
 if(a.readyState===0)pendingSeek=to;
 try{a.currentTime=to;}catch{pendingSeek=to;}
 if(recenter){follow=true;setView(to);$('#zoom').textContent='Show whole recording';$('#zoom').setAttribute('aria-pressed','true');refreshPlot();}
 $('#anchor').value=sec(to);sync(false);
}
a.addEventListener('loadedmetadata',()=>{if(pendingSeek!==null){const t=pendingSeek;pendingSeek=null;seekTo(t,false,false);}sync();});
wave.addEventListener('click',e=>seekTo(where(wave,e)*max()));
roll.addEventListener('click',e=>seekTo(viewStart+where(roll,e)*span()));
slider.addEventListener('input',()=>seekTo(Number(slider.value),false,false));
slider.addEventListener('change',()=>{log('Revisited position',Number(slider.value));});
function playFrame(){sync();if(!a.paused)raf=requestAnimationFrame(playFrame);}
a.addEventListener('play',()=>{playFrom=a.currentTime;log('Playback started',playFrom);cancelAnimationFrame(raf);playFrame();});
a.addEventListener('pause',()=>{cancelAnimationFrame(raf);if(blob&&Math.abs(a.currentTime-playFrom)>.3)log('Playback paused',a.currentTime,'Listened from '+timeText(playFrom));sync();});
a.addEventListener('ended',()=>{cancelAnimationFrame(raf);log('Playback reached the end',takeDuration);sync();});
a.addEventListener('timeupdate',()=>{if(searchTarget!==null&&a.currentTime>=searchTarget){searchTarget=null;a.pause();}sync();});
function release(ref){ref?.getTracks().forEach(t=>t.stop());}
function ac(){const A=window.AudioContext||window.webkitAudioContext;if(!A)throw Error('Audio analysis is unavailable in this browser.');return ctx??=new A();}
function computeEnvelope(samples,n=550){
 const out=[],step=Math.max(1,Math.ceil(samples.length/n));
 for(let i=0;i<samples.length;i+=step){let peak=0;for(let j=i;j<Math.min(samples.length,i+step);j+=3)peak=Math.max(peak,Math.abs(samples[j]));out.push(peak);}
 return out;
}
async function loadSound(recorded,fallback){
 blob=recorded;if(dataURL)URL.revokeObjectURL(dataURL);dataURL=URL.createObjectURL(blob);
 a.src=dataURL;takeDuration=fallback;audioBuffer=null;envelope=[];pitch=[];didPitch=false;
 try{audioBuffer=await ac().decodeAudioData(await recorded.arrayBuffer());takeDuration=Math.min(MAX+.5,audioBuffer.duration);envelope=computeEnvelope(audioBuffer.getChannelData(0));}catch{}
 viewStart=0;$('#pitch').setAttribute('aria-pressed','false');$('#pitch').textContent='Estimate a solo contour';zoom(true);
}
async function record(){
 if(busy||recording)return;
 if(blob&&!confirm('Start a new performance and clear the current annotations? Download your session first to keep it.'))return;
 if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){status('Microphone capture is not available in this browser. Try Chrome or Safari over HTTPS.');return;}
 busy=true;a.pause();refreshControls();
 try{
  const c=ac();if(c.state==='suspended')await c.resume();
  stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
  const opts=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(x=>MediaRecorder.isTypeSupported?.(x));
  const r=new MediaRecorder(stream,opts?{mimeType:opts}:undefined),capture=stream,chunks=[];let failed=false;recording=r;
  r.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  r.onerror=()=>{failed=true;status('Recording failed. Try again.');release(capture);clearTimeout(timer);clearInterval(clock);recording=null;busy=false;refreshControls();};
  const began=Date.now();
  r.onstop=async()=>{
   release(capture);stream=null;clearTimeout(timer);clearInterval(clock);recording=null;
   if(failed)return;
   busy=true;refreshControls();
   try{
    const next=new Blob(chunks,{type:r.mimeType||chunks[0]?.type||'audio/webm'});
    if(!next.size)throw Error('No audio was captured.');
    synthetic=false;marks=[];trail=[];edit=null;refClock=began;id=0;$('#reflection').value='';clearForm();
    log('Recording started',null,'Microphone capture',0);await loadSound(next,Math.min(MAX,(Date.now()-began)/1000));
    log('Recording finished',takeDuration,'Original take kept unchanged');renderNotes();status('Recording ready. Replay a passage and add your first observation.');
   }catch(err){status(err?.message||'Could not prepare the take.');}finally{busy=false;refreshControls();}
  };
  timer=setTimeout(()=>{if(r.state==='recording')r.stop();},MAX*1000);
  clock=setInterval(()=>status('Recording · '+timeText((Date.now()-began)/1000)+' / 5:00'),300);
  r.start(200);status('Recording…');busy=false;refreshControls();
 }catch(e){release(stream);stream=null;recording=null;busy=false;refreshControls();status(e?.name==='NotAllowedError'?'Microphone permission was declined. Allow access in your browser, then try again.':e?.message||'Could not open the microphone.');}
}
function clearForm(){edit=null;$('#label').value='';$('#evidence').value='';$('#finish').value='';$('#anchor').value=sec(a.currentTime||0);$('#saveNote').textContent='Add annotation';$('#cancelEdit').hidden=true;}
function renderNotes(){
 const root=$('#annotations');root.replaceChildren();
 for(const m of marks){
  const row=document.createElement('article'),title=document.createElement('strong'),text=document.createElement('p'),controls=document.createElement('div');controls.className='row';
  title.textContent=m.kind+' · '+m.label+' · '+sec(m.start)+'s'+(m.end!==null?'–'+sec(m.end)+'s':'');text.textContent=m.evidence;
  const button=(name,cb)=>{const b=document.createElement('button');b.type='button';b.textContent=name;b.onclick=cb;return b;};
  controls.append(button('Replay passage',()=>{seekTo(m.start,false);searchTarget=m.end??Math.min(takeDuration,m.start+5);log('Replayed passage',m.start,m.label);a.play().catch(()=>status('Use the audio controls to start playback.'));}),button('Revise',()=>{edit=m.id;$('#kind').value=m.kind;$('#anchor').value=sec(m.start);$('#finish').value=m.end===null?'':sec(m.end);$('#label').value=m.label;$('#evidence').value=m.evidence;$('#saveNote').textContent='Save revision';$('#cancelEdit').hidden=false;$('#label').focus();}),button('Remove',()=>{marks=marks.filter(x=>x.id!==m.id);if(edit===m.id)clearForm();log('Annotation removed',m.start,m.kind+': '+m.label+' · '+m.evidence);renderNotes();refreshPlot();}));
  row.append(title,text,controls);root.append(row);
 }
}
$('#annotationForm').onsubmit=e=>{
 e.preventDefault();if(!blob)return;
 const start=Number($('#anchor').value),raw=$('#finish').value,end=raw===''?null:Number(raw),label=$('#label').value.trim(),evidence=$('#evidence').value.trim(),kind=$('#kind').value;
 if(!label||!Number.isFinite(start)||start<0||start>=takeDuration||(end!==null&&(!Number.isFinite(end)||end<=start||end>takeDuration+.05))){status('Enter a label and a time within the recording; the end must be later than the start.');return;}
 const old=marks.find(x=>x.id===edit);
 const m={id:old?.id||++id,kind,label,start,end:end===null?null:Math.min(end,takeDuration),evidence};marks=[...marks.filter(x=>x.id!==m.id),m].sort((a,b)=>a.start-b.start);
 log(old?'Annotation revised':'Annotation added',m.start,old?`${old.kind}: ${old.label} (${old.evidence}) → ${m.kind}: ${m.label} (${m.evidence})`:`${kind}: ${label} (${evidence})`);
 clearForm();renderNotes();refreshPlot();status(old?'Revision saved in the session trail.':'Annotation added to the timeline.');
};
$('#cancelEdit').onclick=clearForm;
$('#atCursor').onclick=()=>{$('#anchor').value=sec(a.currentTime||0);};
$('#zoom').onclick=()=>zoom(!follow);
$('#record').onclick=record;
$('#stop').onclick=()=>{if(recording?.state==='recording')recording.stop();};
$('#pitch').onclick=async()=>{
 if(!audioBuffer||busy)return;
 if(didPitch){didPitch=false;$('#pitch').setAttribute('aria-pressed','false');$('#pitch').textContent='Estimate a solo contour';refreshPlot();return;}
 busy=true;refreshControls();status('Estimating a monophonic contour locally…');await new Promise(r=>setTimeout(r,25));
 try{pitch=analyze(audioBuffer.getChannelData(0),audioBuffer.sampleRate).data;didPitch=!!pitch.length;$('#pitch').setAttribute('aria-pressed',didPitch);$('#pitch').textContent=didPitch?'Hide solo contour':'Estimate a solo contour';log('Requested solo pitch evidence',a.currentTime,didPitch?'Estimated pitches shown':'No reliable solo contour');status(didPitch?'Solo pitch estimate shown. Check it against what you hear.':'No clear solo contour was found. You can still analyze the recording.');refreshPlot();}finally{busy=false;refreshControls();}
};
$('#saveReflection').onclick=()=>{const v=$('#reflection').value.trim();if(v&&!reflectionTouched){log('Reflection saved',null,v);reflectionTouched=true;status('Reflection added to the breadcrumbs.');}else if(!v)status('Write a short reflection first.');};$('#reflection').addEventListener('input',()=>{reflectionTouched=false;});
async function enc(f){const z=new Uint8Array(await f.arrayBuffer());let s='';for(let i=0;i<z.length;i+=8192)s+=String.fromCharCode(...z.subarray(i,i+8192));return btoa(s);}
$('#download').onclick=async()=>{try{log('Session export requested',null);const o={format:'performance-mirror-independent-analysis',version:1,synthetic,audio:blob?{mime:blob.type,duration:takeDuration,base64:await enc(blob)}:null,annotations:marks,activity:trail,reflection:$('#reflection').value,optionalSoloContour:didPitch?pitch:[]};const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([JSON.stringify(o)],{type:'application/json'}));link.download='performance-mirror-analysis-session.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),20000);}catch{status('Export failed. Keep this tab open and try again.');}};
window.addEventListener('pagehide',()=>release(stream));
const workspaceViews=['listen','annotate','breadcrumbs'];
function showWorkspace(name){
 for(const view of workspaceViews){$('#'+view+'View').hidden=view!==name;$('#'+view+'Tab').setAttribute('aria-pressed',String(view===name));}
}
for(const view of workspaceViews)$('#'+view+'Tab').onclick=()=>showWorkspace(view);
if(synthetic)showWorkspace('breadcrumbs');
refreshControls();refreshPlot();renderTrail();
function elapsed(ms){const s=Math.floor(ms/1000),m=Math.floor(s/60);return m<60?m+':'+String(s%60).padStart(2,'0'):Math.floor(m/60)+':'+String(m%60).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}
function generatedStudy(rate=22050){
 const total=46,out=new Float32Array(total*rate);
 const events=[
  [0,4,[48,52,55]],[4,4,[43,50,53,59]],[8,4,[48,52,55]],[12,4,[41,48,53,57]],
  [16,4,[45,52,57,60]],[20,2,[41,48,53,57]],[22,4,[40,52,56,59,62]],[26,4,[45,52,57,60]],
  [30,4,[41,48,53,57]],[34,4,[43,50,53,59]],[38,7,[48,52,55,60]]
 ];
 const melody=[[.1,1.75,64],[2,1.55,67],[4.1,1.8,65],[6.1,1.7,62],[8.15,1.85,64],[10,1.65,60],[12.05,1.9,65],[14.05,1.7,69],[16.1,1.7,72],[18.1,1.7,69],[20.1,1.75,65],[22.1,1.65,71],[24.1,1.78,68],[26.05,2.5,69],[29, .84,72],[30.1,1.75,69],[32.2,1.55,65],[34.1,1.65,67],[36.1,1.65,71],[38.1,5.75,72]];
 const add=(start,len,n,amp,decay)=>{
  const f=440*2**((n-69)/12),begin=Math.floor(start*rate),count=Math.floor(len*rate);
  for(let j=0;j<count&&begin+j<out.length;j++){
   const t=j/rate, shape=Math.min(1,t/.04)*Math.min(1,(len-t)/.10)*Math.exp(-decay*t);
   out[begin+j]+=amp*shape*(Math.sin(2*Math.PI*f*t)+.14*Math.sin(4*Math.PI*f*t));
  }
 };
 for(const [t,l,nn] of events)for(let step=0;step<l;step+=1)nn.forEach((n,i)=>add(t+step+i*.038,Math.min(.93,l-step),n,i===0?.07:.038,1.4));
 for(const [t,l,n] of melody)add(t,l,n,.165,.09);return out;
}
async function example(){
 busy=true;refreshControls();const rate=22050,samples=generatedStudy(rate);await loadSound(wav(samples,rate),samples.length/rate);
 if(!envelope.length)envelope=computeEnvelope(samples);
 marks=[
 {id:1,kind:'Key',label:'C major',start:0,end:16,evidence:'Opening and cadential motion return to C.'},
 {id:2,kind:'Section',label:'A · opening question',start:0,end:16,evidence:'The material begins and settles back on C.'},
 {id:3,kind:'Section',label:'B · contrast',start:16,end:30,evidence:'A minor colors the contrasting phrase.'},
 {id:4,kind:'Chord',label:'E7 · V⁷/vi',start:22,end:26,evidence:'Bass E moves to A; G♯ rises to A. This is an applied dominant to A minor, not V in C.'},
 {id:5,kind:'Cadence',label:'Local resolution to A minor',start:26,end:29.5,evidence:'A arrives in bass and melody after E7. C major returns later.'},
 {id:6,kind:'Section',label:'A′ · return to C',start:30,end:45,evidence:'Closing G7–C reestablishes the opening tonal center.'},
 {id:7,kind:'Cadence',label:'V⁷–I in C',start:34,end:43.5,evidence:'Bass G–C; the melody B resolves to C.'}];id=7;
 const entries=[
 [0,'Synthetic session started',null,'Fictional learner; generated study, no real microphone or student data.'],
 [1,'Recording finished',46,'46-second example performance'],
 [2,'Playback started',0,'First uninterrupted listen'],
 [3,'Playback reached the end',46,'First full hearing; no labels yet'],
 [4,'Replayed passage',0,'Check where the opening settles'],
 [5,'Replayed passage',8,'Compare the opening phrase with where it settles'],
 [6,'Annotation added',0,'Key: C major'],
 [8,'Annotation added',0,'Section: A · opening question'],
 [10,'Replayed passage',14,'Is the next phrase a new section?'],
 [11,'Revisited position',16,'Contrast starts with A in the bass'],
 [13,'Annotation added',16,'Section: contrasting phrase'],
 [15,'Replayed passage',22,'Hear the change before naming it'],
 [17,'Annotation added',24,'Chord: V. I heard a dominant quality but did not check the bass.'],
 [20,'Replayed passage',21.3,'Listen to the bass through the change'],
 [22,'Revisited position',22.75,'Try to identify the bass without the upper notes'],
 [24,'Replayed passage',24.1,'Sing back the upper line, then listen again'],
 [27,'Revisited position',26,'Arrival lands on A, not C'],
 [31,'Replayed passage',22,'Compare E→A with G→C later'],
 [33,'Replayed passage',26,'Check which note the semitone leads into'],
 [36,'Annotation revised',24,'V → E7 · V⁷/vi. Bass E→A and G♯→A give concrete evidence.｜低音 E→A、导音升 G→A，支持将 E7 听作导向 a 小调的副属七和弦。'],
 [38,'Replayed passage',24,'Test revised label against the same recording'],
 [40,'Annotation added',26,'Cadence: local resolution to A minor'],
 [43,'Replayed passage',34,'Check the final G7–C against E7–Am'],
 [46,'Annotation added',34,'Cadence: V⁷–I in C'],
 [47,'Replayed passage',38,'Compare the last arrival with the earlier A-minor arrival'],
 [50,'Annotation added',30,'Section: A′ · return to C'],
 [54,'Annotation revised',16,'Contrasting phrase → B · contrast, with A minor color rather than permanent modulation.'],
 [56,'Replayed passage',30,'Check where the return begins after the contrast'],
 [57,'Playback reached the end',46,'Last listen with revised markings'],
 [59,'Reflection saved',null,'My first label described a feeling. Comparing bass motion and the leading tone let me name where the chord actually leads.'],
 [60,'Synthetic session ended',null,'One hour of elapsed work, not one hour of audio.']
 ];
 trail=entries.map(([m,action,at,note])=>({elapsedMs:m*60000,action,at,note}));
 refClock=Date.now()-3600000;
 $('#reflection').value=entries.find(e=>e[1]==='Reflection saved')[3];$('#trailPanel').open=false;setView(0);refreshPlot();renderNotes();renderTrail();busy=false;refreshControls();status('Synthetic example loaded. Play the study or replay an annotation; the fictional trail shows an hour of listening and revisions.');
}
if(synthetic)example().catch(()=>{busy=false;refreshControls();status('Could not load the synthetic example. The blank recorder is still available.');});
