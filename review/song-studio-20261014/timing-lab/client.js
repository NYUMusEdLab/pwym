import * as Review from './review.mjs';
const $=id=>document.getElementById(id),player=$('player');let job,result,key,selected=0,history=[],audioFile,audioHash,audioUrl,peaks=[],clipEnd=null,dirty=false,loadSerial=0;
const headers=()=>({Authorization:`Bearer ${key}`,'X-Job-Token':job?.jobToken||''});
const say=text=>$('status').textContent=text;
function on(id,event,fn){$(id).addEventListener(event,async e=>{try{await fn(e);}catch(error){say(error.message);}});}
async function request(path,options={}){const r=await fetch(path,{...options,headers:headers()});if(!r.ok){const b=await r.json();throw Error(typeof b.detail==='string'?b.detail:'Check the submitted fields.');}return r.json();}
function download(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);dirty=false;}
function matched(){return !!result&&audioHash===result.audioSha256;}
function hasWork(){return !dirty||confirm('You have unsaved corrections. Open another report and discard those changes? Save a draft first if you want to keep them.');}
function change(fn){const next=Review.clone(result);fn(next);history.push(Review.clone(result));if(history.length>50)history.shift();result=next;dirty=true;render();}
function issues(){return Review.problems(result);}
function nextAttention(){const list=issues().words;for(let n=1;n<=list.length;n++){const i=(selected+n)%list.length;if(list[i].attention){selected=i;render();return;}}say('Every word has been checked. You can still listen and make changes.');}
function openResult(data){result=Review.openAnalysis(data);selected=Review.problems(result).words.findIndex(w=>w.errors.length);if(selected<0)selected=0;history=[];dirty=false;$('reflection').value=result.reflection;$('result').hidden=false;render();$('result').scrollIntoView({block:'start'});}
async function attachAudio(file){
 if(!file)return;if(file.size>50*1024*1024)throw Error('Choose audio under 50 MB.');
 const serial=++loadSerial;player.pause();player.removeAttribute('src');player.load();audioHash=null;audioFile=null;clipEnd=null;renderAudio();
 const bytes=await file.arrayBuffer(),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
 if(serial!==loadSerial)return;
 if(result&&digest!==result.audioSha256)throw Error('That is a different recording. Choose the exact file used for this timing report.');
 if(audioUrl)URL.revokeObjectURL(audioUrl);audioFile=file;audioHash=digest;audioUrl=URL.createObjectURL(file);player.src=audioUrl;
 const context=new AudioContext();try{const buffer=await context.decodeAudioData(bytes.slice(0)),channel=buffer.getChannelData(0),step=Math.max(1,Math.floor(channel.length/700));peaks=[];for(let i=0;i<channel.length;i+=step){let peak=0;for(let j=i;j<Math.min(i+step,channel.length);j++)peak=Math.max(peak,Math.abs(channel[j]));peaks.push(peak);}}finally{await context.close();}
 renderAudio();paint();if(result)render();
}
function selectWord(index){
 selected=index;clipEnd=null;
 if(matched()){
   const w=result.words[index];let time=w.start;
   if(!Number.isFinite(time)){
     time=0;for(let i=index-1;i>=0;i--)if(Number.isFinite(result.words[i].end)){time=result.words[i].end;break;}
     say('This word has no start yet. The playhead is at the preceding timed word’s end; listen and set its boundaries.');
   }
   player.currentTime=Math.max(0,Math.min(time,Number.isFinite(player.duration)?player.duration:result.duration));
   $('clock').textContent=player.currentTime.toFixed(3)+' s';$('seek').max=result.duration;$('seek').value=player.currentTime;
 }
 render();
}
function renderAudio(){const ok=matched();$('audio-status').textContent=audioFile?(ok?'✓ Same audio verified. Ready to listen.':result?'Choose the matching audio for this report.':'Audio ready. Open its timing report.'):'Choose the exact audio used for this report.';for(const id of ['listen','set-start','set-end'])$(id).disabled=!ok;}
function render(){
 selected=Math.max(0,Math.min(selected,result.words.length-1));const p=issues(),count=result.words.filter(w=>w.reviewed).length;
 $('summary').textContent=`${count} of ${result.words.length} words checked · ${p.invalidWords} missing or invalid timings · ${result.words.filter(w=>w.edited).length} words edited`;
 $('progress').style.width=`${count/result.words.length*100}%`;$('undo').disabled=!history.length;
 const list=$('word-list');list.replaceChildren();
 result.words.forEach((w,i)=>{if($('only-attention').checked&&!p.words[i].attention&&i!==selected)return;const b=document.createElement('button');b.type='button';b.className='word'+(p.words[i].errors.length?' invalid':'')+(i===selected?' selected':'')+(w.reviewed?' reviewed':'');b.textContent=w.text+(w.reviewed?' ✓':'');b.setAttribute('aria-pressed',String(i===selected));b.setAttribute('aria-label',`${i+1}. ${w.text}${p.words[i].errors.length?', needs timing':w.reviewed?', checked':', needs a listen'}`);b.onclick=()=>selectWord(i);list.append(b);});
 const w=result.words[selected];$('word-number').textContent=`WORD ${selected+1} OF ${result.words.length}`;$('selected-word').textContent=w.text;$('word-text').value=w.text;$('word-start').value=w.start??'';$('word-end').value=w.end??'';
 $('word-issue').textContent=p.words[selected].errors.join(' · ')||(w.reviewed?'Checked by you.':w.issues.includes('low_model_score')?'The AI was unsure. Listen and decide.':'Does this word start and end where you hear it?');
 const original=result.originalAnalysis.words.find((x,i)=>(x.reviewId||`original-${i}`)===w.reviewId);
 $('original').textContent=original?`AI first pass: ${original.start??'missing'} → ${original.end??'missing'} seconds. Your edits keep this original for comparison.`:'You added this word. Give it a start and end.';
 $('section-list').replaceChildren();result.sections.forEach((s,i)=>{const row=document.createElement('div');row.className='section-row';const name=document.createElement('input');name.value=s.label;name.maxLength=100;name.setAttribute('aria-label',`Section ${i+1} name`);const start=document.createElement('input');start.type='number';start.step='.001';start.value=s.start;start.disabled=i===0;start.setAttribute('aria-label',`Section ${i+1} start`);const listen=document.createElement('button');listen.textContent='▶';listen.className='secondary';listen.setAttribute('aria-label',`Listen to section ${i+1}`);listen.disabled=!matched();listen.onclick=()=>playFrom(s.start,Math.min(s.end,s.start+8));const save=document.createElement('button');save.textContent=s.reviewed?'✓ Checked':'Keep section';save.onclick=()=>{try{change(d=>Review.editSection(d,i,name.value,Number(start.value)));}catch(e){say(e.message);}};row.append(name,start,listen,save);$('section-list').append(row);});
 $('section-errors').textContent=p.sections.join(' · ');$('export-status').textContent=p.invalidWords||p.sections.length?`Repair ${p.invalidWords} word timing${p.invalidWords===1?'':'s'}${p.sections.length?' and section boundaries':''} to export. You can save a draft at any time.`:`Timings are structurally valid. ${p.remaining} words still need your listening review.`;
 $('download').disabled=!!(p.invalidWords||p.sections.length)||!matched();$('delete').hidden=!job;renderAudio();paint();
}
function paint(){const c=$('wave'),rect=c.getBoundingClientRect();c.width=Math.max(1,Math.round(rect.width*devicePixelRatio));c.height=80*devicePixelRatio;const ctx=c.getContext('2d');ctx.scale(devicePixelRatio,devicePixelRatio);const width=rect.width;ctx.fillStyle='#879f70';peaks.forEach((v,i)=>ctx.fillRect(i*width/peaks.length,40-v*34,Math.max(1,width/peaks.length-1),v*68));if(result){const w=result.words[selected];if(Number.isFinite(w.start)&&Number.isFinite(w.end)){ctx.fillStyle='#f2a54c55';ctx.fillRect(w.start/result.duration*width,0,(w.end-w.start)/result.duration*width,80);}ctx.fillStyle='#175d49';ctx.fillRect(player.currentTime/result.duration*width,0,2,80);}}
async function playFrom(start,end){if(!matched())throw Error('Choose the matching audio first.');player.currentTime=Math.max(0,start);clipEnd=end;await player.play();}
function saveWord(){change(d=>Review.editWord(d,selected,{text:$('word-text').value.trim(),start:$('word-start').value===''?null:Number($('word-start').value),end:$('word-end').value===''?null:Number($('word-end').value)}));}
on('report-file','change',async e=>{const f=e.target.files[0];e.target.value='';if(!f||!hasWork())return;if(f.size>10*1024*1024)throw Error('Use a report smaller than 10 MB.');const data=Review.openAnalysis(JSON.parse(await f.text()));job=null;player.pause();if(audioHash!==data.audioSha256){player.removeAttribute('src');player.load();audioFile=null;audioHash=null;peaks=[];}openResult(data);say('Report opened. Missing words are a good place to start.');});
on('review-audio','change',e=>attachAudio(e.target.files[0]));
on('only-attention','change',render);
on('save-word','click',saveWord);
on('set-start','click',()=>{$('word-start').value=Math.min(result.duration,player.currentTime).toFixed(3);say('Start captured. Keep my changes saves it.');});
on('set-end','click',()=>{$('word-end').value=Math.min(result.duration,player.currentTime).toFixed(3);say('End captured. Keep my changes saves it.');});
on('listen','click',()=>{const w=result.words[selected];let prev=null,next=null;for(let i=selected-1;i>=0;i--)if(Number.isFinite(result.words[i].end)){prev=result.words[i].end;break;}for(let i=selected+1;i<result.words.length;i++)if(Number.isFinite(result.words[i].start)){next=result.words[i].start;break;}const start=Math.max(0,(w.start??prev??0)-.7),end=Math.min(result.duration,(w.end??next??start+5)+.7);return playFrom(start,Math.min(end,start+12));});
on('checked','click',()=>{const next=Review.clone(result);Review.editWord(next,selected,{text:$('word-text').value.trim(),start:$('word-start').value===''?null:Number($('word-start').value),end:$('word-end').value===''?null:Number($('word-end').value)});Review.markReviewed(next,selected);change(d=>Object.assign(d,next));nextAttention();});
on('next-issue','click',nextAttention);
on('next-missing','click',()=>{const list=issues().words;for(let n=1;n<=list.length;n++){const i=(selected+n)%list.length;if(list[i].errors.length){selected=i;render();return;}}say('No missing or invalid word timings remain. Listen through the song to check accuracy.');});
on('add-before','click',()=>{change(d=>Review.addWord(d,selected,$('new-word').value));$('new-word').value='';});
on('add-after','click',()=>{const at=selected+1;change(d=>Review.addWord(d,at,$('new-word').value));selected=at;$('new-word').value='';render();});
on('remove','click',()=>change(d=>Review.removeWord(d,selected)));
on('undo','click',()=>{if(history.length){result=history.pop();dirty=true;render();}});
for(const id of ['word-text','word-start','word-end'])on(id,'input',()=>{dirty=true;});
on('reflection','input',()=>{result.reflection=$('reflection').value;dirty=true;});
on('draft','click',()=>{saveWord();download(Review.output(result,{draft:true}),'song-correction-draft.json');});
on('download','click',()=>{if(!matched())throw Error('Choose the matching audio before exporting.');saveWord();download(Review.output(result),'song-corrected-timings.json');say('Exported. Open it with Import word-timed lyrics in Song Studio.');});
on('delete','click',async()=>{await request(`./v1/jobs/${job.id}`,{method:'DELETE'});job=null;$('delete').hidden=true;say('Server report deleted. Your correction workspace remains open here.');});
on('speed','change',()=>player.playbackRate=Number($('speed').value));
on('seek','input',()=>{player.currentTime=Number($('seek').value);clipEnd=null;});
on('wave','click',e=>{if(!matched())return;const r=$('wave').getBoundingClientRect();player.currentTime=Math.max(0,Math.min(result.duration,(e.clientX-r.left)/r.width*result.duration));clipEnd=null;paint();});
player.addEventListener('timeupdate',()=>{$('clock').textContent=player.currentTime.toFixed(3)+' s';$('seek').max=result?.duration||player.duration||1;$('seek').value=player.currentTime;if(clipEnd!==null&&player.currentTime>=clipEnd){player.pause();clipEnd=null;}paint();});
window.addEventListener('resize',paint);window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
const service=document.documentElement.dataset.uploadService==='true';$('upload-panel').hidden=!service;$('local-only').hidden=service;
on('form','submit',async e=>{e.preventDefault();if(!hasWork())return;$('submit').disabled=true;key=$('key').value;
 try{const file=$('audio').files[0];if(!file||file.size>50*1024*1024)throw Error('Choose audio under 50 MB.');const data=new FormData();data.append('file',file);data.append('lyrics',$('lyrics').value);if($('sections').value)data.append('section_count',$('sections').value);say('Uploading your song…');job=await request('./v1/jobs',{method:'POST',body:data});
 while(true){const s=await request(`./v1/jobs/${job.id}`);say(s.stage.replaceAll('_',' ')+'…');if(s.status==='failed')throw Error(s.error);if(s.status==='completed')break;await new Promise(r=>setTimeout(r,2000));}
 const dataResult=await request(`./v1/jobs/${job.id}/result`);openResult(dataResult);await attachAudio(file);say('Your first pass is ready. Start with a missing word, then check the rest.');
 }finally{$('submit').disabled=false;}});
