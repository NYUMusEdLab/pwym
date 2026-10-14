import * as M from './model.mjs';
import * as A from './audio.mjs';
import * as Store from './storage.mjs';
import * as D from './doodles.mjs';
import * as Timing from './timing-service.mjs';
let pendingTimings=null;
import {loadFreshExample} from './fresh-example.mjs';
import {Preview} from './adapter.mjs';
const $=id=>document.getElementById(id),html=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const audio=$('audio');let project=null,selected=null,env=null,blobs=new Map(),layers=[],urls=[],history=[],saveQueue=Promise.resolve(),view='edit',tapState=null,toastTimer,loopUntil=null;
const editor=new window.Annotator.Graffiti(300,220,$('draw-area'));
const suggestionPreview=new window.Annotator.Graffiti(240,180,$('suggestion-canvas'));
suggestionPreview.canvas.setAttribute('aria-label','Suggested drawing preview');
suggestionPreview.canvas.setAttribute('role','img');
let suggestionContext=null,drawingSuggestion=null;
$('drawing-concept').innerHTML='<option value="">Choose a picture…</option>'+D.concepts.map(([id,label])=>`<option value="${id}">${label}</option>`).join('');
editor.size=.45;editor.color=$('ink').value;
// Remove idle time between strokes without changing the legacy renderer or saved strokes.
for(const type of ['pointerdown','mousedown','touchstart'])editor.canvas.addEventListener(type,()=>{
  if(editor.drawable&&!editor._isDrawing)editor._startTime=Date.now()-editor.drawing.duration*1000;
},{capture:true,passive:true});
const preview=new Preview(audio,$('preview-stage'),event=>{
  $('preview-note').textContent=event?project?.annotations[event.data.wordId]?.note||'':'';
  document.querySelectorAll('[data-marker]').forEach(el=>el.classList.toggle('playing',el.dataset.marker===event?.data.wordId));
},event=>{$('preview-lyric').textContent=event?.data.text||'♪';followLyric(event?.data.wordId);});
function toast(message,error=false){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').classList.toggle('error',error);$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,error?11000:5500);}
function action(fn){return async event=>{try{await fn(event);}catch(error){console.error(error);toast(error.message||'Something went wrong.',true);}};}
function on(id,type,fn){$(id).addEventListener(type,action(fn));}
function current(){return project?.words.find(w=>w.id===selected);}
function fmt(t,ms=false){const total=ms?Math.round(t*1000):Math.round(t)*1000;return `${Math.floor(total/60000)}:${((total%60000)/1000).toFixed(ms?3:0).padStart(ms?6:2,'0')}`;}
function requireProject(){if(!project)throw Error('Choose a song or try the demo first.');}
function persist(){
  if(!project)return Promise.resolve();project.updatedAt=new Date().toISOString();const snapshot=M.clone(project);
  $('saved').textContent='Saving on this device…';
  saveQueue=saveQueue.catch(()=>{}).then(()=>Store.saveProject(snapshot)).then(()=>{$('saved').textContent='Saved on this device';});
  saveQueue.catch(()=>{$('saved').textContent='Save failed — download a copy';toast('Browser storage is full or unavailable. Use Save a copy before closing.',true);});return saveQueue;
}
function commit(edit,{draw=true}={}){
  requireProject();const next=M.clone(project);edit(next);M.validateProject(next);
  history.push(M.clone(project));if(history.length>50)history.shift();project=next;
  if(!project.words.some(w=>w.id===selected))selected=project.words[0]?.id||null;
  persist();render(draw);updatePreview();
}
let previewQueue=Promise.resolve();
function updatePreview(){
  if(!project)return;const snapshot=M.clone(project);
  previewQueue=previewQueue.catch(()=>{}).then(()=>preview.load(snapshot)).then(()=>{
    $('preview-proof').textContent=`Loaded ${preview.song.events.length} lyric events and ${preview.song.events.filter(e=>e.events.length).length} keyword events through the original Annotator SongLoader. Permanent word IDs bind the artwork.`;
  });previewQueue.catch(e=>toast('Preview: '+e.message,true));return previewQueue;
}
async function renderLibrary(){const items=await Store.listProjects();$('library-list').innerHTML=items.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(p=>`<button class="library-song ${p.id===project?.id?'current':''}" data-project="${p.id}">♫ &nbsp; ${html(p.title)}</button>`).join('');}
async function openProject(p,provided=new Map()){
  pendingTimings=null;$('timing-review').hidden=true;
  M.normalizeSourceNames(p);M.validateProject(p);audio.pause();tapState=null;$('tap-panel').hidden=true;loopUntil=null;
  closeSuggestion();$('sketch-result').hidden=true;
  if(project)await persist();editor.drawable=false;project=p;selected=p.words[0]?.id||null;history=[];
  layers.forEach(l=>{l.audio.pause();l.audio.removeAttribute('src');l.audio.load();});layers=[];urls.forEach(URL.revokeObjectURL);urls=[];blobs=new Map();
  for(const t of p.tracks){
    let blob=provided.get(t.id)||await Store.getAudio(t.id);
    if(t.data){blob=A.blobFromDataURL(t.data);delete t.data;await Store.saveAudio(t.id,blob);}
    if(blob)blobs.set(t.id,blob);
  }
  const first=project.tracks[0];
  if(first&&blobs.has(first.id)){
    const url=URL.createObjectURL(blobs.get(first.id));urls.push(url);audio.src=url;env=A.envelope(await A.decodeBlob(blobs.get(first.id)));
  }else{audio.removeAttribute('src');audio.load();env=null;toast('No audio is attached to this project. Import a saved copy with its audio.',true);}
  for(const t of project.tracks.slice(1))if(blobs.has(t.id)){
    const player=new Audio(URL.createObjectURL(blobs.get(t.id)));urls.push(player.src);player.preload='auto';layers.push({id:t.id,audio:player});
  }
  $('welcome').hidden=true;$('workspace').hidden=false;$('lyrics-input-panel').hidden=!!p.words.length;$('lyrics-text').value='';
  await persist();render();await updatePreview();await renderLibrary();setView('edit');$('song-overview').scrollIntoView({block:'start'});
}
async function chooseAudio(file,layer=false){
  if(!file)return;if(layer){requireProject();if(project.tracks.length>=8)throw Error('Use at most eight tracks.');}
  toast('Opening audio on this device…');const result=await A.readAudio(file);
  await Store.saveAudio(result.track.id,result.blob);
  if(layer){
    commit(p=>p.tracks.push(result.track));blobs.set(result.track.id,result.blob);
    const player=new Audio(URL.createObjectURL(result.blob));urls.push(player.src);layers.push({id:result.track.id,audio:player});syncLayers(true);
  }else await openProject(M.createProject(file.name.replace(/\.[^.]+$/,''),result.buffer.duration,result.track),new Map([[result.track.id,result.blob]]));
  toast(layer?'Sound layer added.':'Your song is ready. Add the words you want to animate.');
}
async function demo(){const p=M.fixtureProject(),blob=A.fixtureAudio();await Store.saveAudio(p.tracks[0].id,blob);await openProject(p,new Map([[p.tracks[0].id,blob]]));toast('Demo loaded: generated tones and invented lyrics.');}
async function freshExample(){
  const buttons=[$('fresh-example'),$('welcome-fresh')];buttons.forEach(b=>b.disabled=true);
  try{
    toast('Opening the original Fresh Annotator song, lyrics, and recovered drawings…');
    const result=await loadFreshExample(window.Annotator.Graffiti.decompressDrawing),p=result.project;
    await Store.saveAudio(p.tracks[0].id,result.audio);await openProject(p,new Map([[p.tracks[0].id,result.audio]]));
    selected=p.words.find(w=>p.annotations[w.id]?.drawing.strokes.length)?.id||selected;render();seek(current()?.start||0);
    toast('Real Fresh Annotator example ready. Your edits save as an independent copy on this device.');
  }finally{buttons.forEach(b=>b.disabled=false);}
}
function render(draw=true){
  if(!project)return;
  $('song-title').value=project.title;$('song-meta').textContent=`${fmt(project.duration)} · ${project.tracks.length} sound layer${project.tracks.length===1?'':'s'} · ${project.lyricsSource}`;
  $('fixture-label').hidden=!project.fixture;$('scrub').max=project.duration;$('undo').disabled=!history.length;
  $('source-label').hidden=project.source?.kind!=='fresh-example';$('source-details').hidden=$('source-label').hidden;
  if(project.source?.kind==='fresh-example')$('source-label').textContent=`Fresh Annotator example · ${project.source.artists} · ${project.source.album}. Original audio, lyrics, section timings, and recovered drawings. ${project.words.filter(w=>w.sourceUnit==='phrase').length} timed phrases are kept whole; their internal word times are unavailable. Timings still need your review.`;
  $('lyrics-toggle').textContent=project.words.length?'Replace lyrics':'Add lyrics';
  const lines=new Map();for(const w of project.words){if(!lines.has(w.line))lines.set(w.line,[]);lines.get(w.line).push(w);}
  $('word-list').innerHTML=project.words.length?[...lines.values()].map(words=>`<div class="lyric-line">${words.map(w=>`<div class="word-chip ${w.keyword?'keyword':''} ${w.id===selected?'selected':''} ${w.reviewed?'checked':''}" data-chip="${w.id}"><button data-word="${w.id}" aria-label="Edit ${html(w.text)} at ${w.start.toFixed(3)} seconds">${html(w.text)}</button><button class="word-star" data-star="${w.id}" aria-label="${w.keyword?'Remove':'Add'} keyword status for ${html(w.text)}" aria-pressed="${w.keyword}">${w.keyword?'★':'☆'}</button><small>${w.start.toFixed(3)} ${w.reviewed?'✓':'~'}</small></div>`).join('')}</div>`).join(''):'<p class="empty-hint">Your words will appear here.<br>Add lyrics above, then listen and give them their own moments.</p>';
  $('live-lyrics').innerHTML=project.words.length?[...lines.values()].map(words=>`<p>${words.map(w=>`<button data-live-word="${w.id}" aria-label="Listen to ${html(w.text)} at ${w.start.toFixed(3)} seconds">${html(w.text)}</button>`).join(' ')}</p>`).join(''):'<p>Add lyrics to follow your song here.</p>';
  const reviewed=project.words.filter(w=>w.reviewed).length,units=project.words.some(w=>w.sourceUnit==='phrase')?'timed words / phrases':'words';
  $('word-count').textContent=`${project.words.length} ${units} · ${reviewed} reviewed by you · ${project.words.filter(w=>w.keyword).length} starred · ${project.archivedWords.length} archived`;
  $('export-review').textContent=`${reviewed} of ${project.words.length} word timings are marked reviewed. ${project.words.length-reviewed} still need a listen. Exports retain their timing source and review status.`;
  $('section-strip').innerHTML=project.sections.map(s=>`<button data-seek="${s.start}" style="flex:${s.end-s.start}">${html(s.label)}</button>`).join('');
  $('sections').innerHTML=project.sections.map((s,i)=>`<div class="section-row"><input data-section-name="${i}" aria-label="Section ${i+1} label" value="${html(s.label)}" maxlength="100"><input data-section-time="${i}" aria-label="Section ${i+1} start in seconds" type="number" step=".001" value="${s.start}" ${i===0?'disabled':''}><small title="${html(s.source)}">${s.reviewed?'Reviewed':'Estimate'}</small><button data-section-review="${i}" title="Mark section reviewed" aria-label="Mark section ${i+1} reviewed">✓</button></div>`).join('');
  $('tracks').innerHTML=project.tracks.map((t,i)=>`<div class="track-row"><div class="track-name">${i===0?'● Lead audio':'♫'} &nbsp; ${html(t.name)}</div><div class="track-controls"><label><input type="checkbox" data-track-mute="${t.id}" ${t.muted?'checked':''}> Mute</label><label>Level <input aria-label="${html(t.name)} volume" data-track-volume="${t.id}" type="range" min="0" max="1" step=".05" value="${t.volume}"></label>${i?`<label>Offset <input aria-label="${html(t.name)} offset" data-track-offset="${t.id}" type="number" min="-1200" max="1200" step=".01" value="${t.offset}"></label><button data-track-remove="${t.id}">Remove</button>`:''}</div></div>`).join('');
  $('preview-markers').innerHTML=project.words.filter(w=>w.keyword).map(w=>`<button data-marker="${w.id}" data-seek="${w.start}">★ ${html(w.text)} <small>${w.start.toFixed(3)}s</small></button>`).join('');
  if(draw)renderInspector();syncLayers();paintWave();
}
function renderInspector(){
  editor.drawable=false;const w=current();$('word-controls').hidden=!w;$('selected-heading').textContent=w?.text||'Pick a word';if(!w){closeSuggestion();return;}
  if(suggestionContext?.id!==w.id||suggestionContext?.text!==w.text)closeSuggestion();
  $('word-text').value=w.text;$('word-start').value=w.start.toFixed(3);$('word-end').value=w.end.toFixed(3);
  $('timing-status').textContent=w.reviewed?'✓ Reviewed by you':`${w.timingSource} · needs a listen`;$('timing-status').className='small '+(w.reviewed?'reviewed':'estimate');
  $('keyword-toggle').textContent=w.keyword?'★ Keyword — click to unstar':'☆ Make this a keyword';$('keyword-toggle').setAttribute('aria-pressed',w.keyword);
  $('art-retained').textContent=w.keyword?'Your drawing will animate when this word plays.':'You can draw now. Star this word to show it during playback; un-starring keeps your artwork.';
  const a=project.annotations[w.id];$('word-note').value=a?.note||'';$('paper').value=a?.background||'#f9f5e9';$('draw-area').style.background=$('paper').value;$('animation').value=a?.animation||'timed';
  editor.drawing=M.clone(a?.drawing||M.blankDrawing());editor.draw(1);editor.drawable=true;
  $('restore-drawing').hidden=!a?.drawingHistory?.length;
  if(suggestionContext)renderSuggestion();
}
function closeSuggestion(){suggestionContext=null;drawingSuggestion=null;$('drawing-suggestion-panel').hidden=true;$('suggest-drawing').setAttribute('aria-expanded','false');}
function renderSuggestion(){
  const w=current();if(!w||!suggestionContext)return;
  $('drawing-suggestion-panel').hidden=false;$('suggest-drawing').setAttribute('aria-expanded','true');
  $('drawing-concept').value=drawingSuggestion?.concept||'';
  $('suggestion-caption').textContent=drawingSuggestion?`${drawingSuggestion.label} for “${w.text}”. Change the picture if you imagine something else.`:`No automatic match for “${w.text}” yet. Choose a picture below.`;
  $('suggestion-canvas').hidden=!drawingSuggestion;$('use-drawing').disabled=!drawingSuggestion;$('another-drawing').disabled=!drawingSuggestion;
  $('use-drawing').textContent=project.annotations[w.id]?.drawing.strokes.length?'Use suggestion · keep previous':'Use this drawing';
  suggestionPreview.drawing=M.clone(drawingSuggestion?.drawing||M.blankDrawing());suggestionPreview.draw(1);
  suggestionPreview.canvas.setAttribute('aria-label',`${drawingSuggestion?.label||'Empty'} sketch suggestion for ${w.text}`);
  $('suggestion-canvas').style.background=project.annotations[w.id]?.background||'#f9f5e9';
}
function makeSuggestion(concept,variant=0){
  const w=current();if(!w)throw Error('Choose a word first.');
  suggestionContext={id:w.id,text:w.text,variant};
  drawingSuggestion=D.suggestDrawing(w,{concept,variant,color:$('ink').value});renderSuggestion();
}
function syncLayers(force=false){
  if(!project)return;const first=project.tracks[0];audio.volume=first?.volume??1;audio.muted=first?.muted??false;
  for(const l of layers){
    const t=project.tracks.find(t=>t.id===l.id);if(!t){l.audio.pause();continue;}
    const pos=audio.currentTime-t.offset;l.audio.volume=t.volume;l.audio.muted=t.muted;l.audio.playbackRate=audio.playbackRate;
    if(pos<0||pos>=t.duration||audio.paused){l.audio.pause();if(force&&pos>=0&&pos<t.duration)l.audio.currentTime=pos;continue;}
    if(force||Math.abs(l.audio.currentTime-pos)>.12)l.audio.currentTime=pos;
    if(l.audio.paused)l.audio.play().catch(()=>toast('A sound layer could not play. Press pause, then play again.',true));
  }
}
function seek(t){requireProject();audio.currentTime=Math.max(0,Math.min(project.duration,t));syncLayers(true);preview.tick();updateClock();}
async function play(){requireProject();if(!audio.src)throw Error('This project has no attached audio.');if(audio.paused){if(audio.currentTime>=project.duration-.02)seek(0);await audio.play();syncLayers(true);}else audio.pause();}
function updateClock(){if(!project)return;$('clock').textContent=`${fmt(audio.currentTime,true)} / ${fmt(project.duration)}`;$('scrub').value=audio.currentTime;}
function paintWave(){
  const canvas=$('wave'),width=Math.max(200,canvas.clientWidth*devicePixelRatio),height=110*devicePixelRatio;canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,width,height);if(!env||!project)return;
  const peak=Math.max(.01,...env.bins);ctx.fillStyle='#a5bc84';const n=Math.floor(width/5);
  for(let i=0;i<n;i++){const v=env.bins[Math.floor(i*env.bins.length/n)]/peak,h=Math.max(2,v*height*.8);ctx.fillRect(i*5,(height-h)/2,3,h);}
  const w=current();if(w){ctx.fillStyle='#e8ad6150';ctx.fillRect(w.start/project.duration*width,0,(w.end-w.start)/project.duration*width,height);}
  ctx.fillStyle='#1a654f';ctx.fillRect(audio.currentTime/project.duration*width,0,2*devicePixelRatio,height);
}
function setView(next){view=next;for(const name of ['edit','preview','export']){$(name+'-view').hidden=name!==view;$(name+'-tab').classList.toggle('active',name===view);}if(next==='preview')updatePreview();}
async function saveCopy(){
  requireProject();await persist();const copy=M.clone(project);let size=0;
  for(const t of copy.tracks){const blob=blobs.get(t.id);if(!blob)throw Error(`Missing audio for ${t.name}.`);size+=blob.size;if(size>180*1024*1024)throw Error('The combined audio is over the 180 MB export limit. Remove an extra track first.');t.data=await A.dataURL(blob);}
  Store.download(new Blob([JSON.stringify(copy)],{type:'application/json'}),`${project.id}.song.json`);toast('Saved a project copy with its audio.');
}
async function exportKit(){
  requireProject();if(!project.words.length)throw Error('Add some lyrics before exporting an Annotator kit.');
  if(project.tracks.reduce((sum,t)=>sum+(blobs.get(t.id)?.size||0),0)>180*1024*1024)throw Error('The combined audio is over the 180 MB export limit. Remove an extra track first.');
  toast('Making your local Annotator kit…');const snapshot=M.clone(project),bundle=M.toAnnotator(snapshot),mixed=await A.mixdown(snapshot,new Map(blobs));
  const full=M.clone(snapshot);for(const t of full.tracks){const blob=blobs.get(t.id);if(!blob)throw Error('A track is missing.');t.data=await A.dataURL(blob);}
  bundle.project=full;const slug=bundle.song.slug;bundle.song.audioURL=`${slug}/mix.wav`;
  const files={'default-songset.json':bundle.catalog,[`${slug}/${slug}.json`]:bundle.song,[`${slug}/${slug}_events.json`]:bundle.events,[`${slug}/${slug}.lrc`]:bundle.lrc,[`${slug}/mix.wav`]:mixed,'session.json':bundle.session,'project.song.json':full,'annotator-bundle.json':bundle,
    'READ-ME.txt':'LOCAL ANNOTATOR KIT\nOpen project.song.json in Song Studio, or annotator-bundle.json in harness.html.\nSongLoader can read default-songset.json + the song folder using its _events.json route.\nThe stable-ID adapter uses data.wordId and session.creator.annotationsByWordId.\nThe legacy drawingOverrides projection is regenerated at export; canonical IDs remain authoritative.\nMixed audio is 22.05 kHz mono, peak-normalized only when needed. Original layers remain in the project.\nLRC contains word starts only, not IDs, review status, end times, sections, or artwork.\nNo files were published. Live Annotator has no general file importer.\n'};
  Store.download(await Store.zip(files),`${slug}-annotator-kit.zip`);toast('Annotator kit saved. Open its bundle JSON in the independent harness.');
}
on('audio-file','change',e=>chooseAudio(e.target.files[0]));on('welcome-audio','change',e=>chooseAudio(e.target.files[0]));on('track-file','change',e=>chooseAudio(e.target.files[0],true));
on('demo','click',demo);on('welcome-demo','click',demo);
on('fresh-example','click',freshExample);on('welcome-fresh','click',freshExample);
on('project-file','change',async e=>{const file=e.target.files[0];if(!file)return;if(file.size>250*1024*1024)throw Error('This project file is too large.');const p=M.importProject(JSON.parse(await file.text()));await openProject(p);toast('Project reopened, including permanent word IDs and artwork.');});
on('library-list','click',async e=>{const button=e.target.closest('[data-project]');if(button)await openProject(await Store.getProject(button.dataset.project));});
on('song-title','change',e=>{commit(p=>p.title=e.target.value.trim()||'My song',{draw:false});renderLibrary();});
on('lyrics-toggle','click',()=>$('lyrics-input-panel').hidden=!$('lyrics-input-panel').hidden);
on('apply-lyrics','click',()=>{requireProject();if(!$('lyrics-text').value.trim())throw Error('Type a few words first.');commit(p=>M.setLyrics(p,$('lyrics-text').value));$('lyrics-input-panel').hidden=true;toast('Words placed at rough, evenly spaced positions. Listen and adjust them.');});
on('timings-file','change',async e=>{
  requireProject();const file=e.target.files[0];if(!file)return;e.target.value='';
  if(file.size>10*1024*1024)throw Error('Use a lyric file smaller than 10 MB.');
  const text=await file.text(),data=file.name.toLowerCase().endsWith('.lrc')?null:JSON.parse(text);
  if(data?.schema==='musedlab.song-timings'){
    const info=Timing.inspectTimings(data,project),blob=blobs.get(project.tracks[0]?.id);
    if(!blob)throw Error('Load the original audio before importing this result.');
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
    if(digest!==data.audioSha256)throw Error('This result belongs to a different audio file. Open the exact uploaded file first.');
    pendingTimings={data,projectId:project.id};$('timing-summary').textContent=`${info.count} words · ${info.missing} untimed · ${info.sections} sections. ${info.matches?'Existing drawings and notes will stay attached.':'Lyrics differ from this project.'}`;
    $('timing-words').checked=!info.missing;$('timing-words').disabled=!!info.missing;$('timing-sections').checked=false;$('timing-replace').checked=false;$('timing-replace-label').hidden=info.matches||!project.words.length;$('timing-review').hidden=false;return;
  }
  const words=data?M.fromTranscript(data,project.duration):M.fromLRC(text,project.duration);
  commit(p=>{p.archivedWords.push(...p.words);p.words=words;p.lyricsSource='imported timing file; unreviewed';});$('lyrics-input-panel').hidden=true;toast('Imported word estimates. Please listen and review.');
});
on('timing-cancel','click',()=>{pendingTimings=null;$('timing-review').hidden=true;});
on('timing-apply','click',()=>{
  if(!pendingTimings||pendingTimings.projectId!==project?.id)throw Error('Import a result for the current song first.');
  if(!$('timing-words').checked&&!$('timing-sections').checked)throw Error('Choose word timings or sections to apply.');
  const next=Timing.applyTimings(project,pendingTimings.data,{words:$('timing-words').checked,sections:$('timing-sections').checked,replace:$('timing-replace').checked});
  commit(p=>Object.assign(p,next));pendingTimings=null;$('timing-review').hidden=true;toast('Suggestions applied. Listen and review; Undo restores the previous version.');
});
on('word-list','click',e=>{const star=e.target.closest('[data-star]'),button=e.target.closest('[data-word]');if(star){selected=star.dataset.star;commit(p=>M.toggleKeyword(p,selected));}else if(button){selected=button.dataset.word;render();seek(current().start);}});
on('apply-word','click',()=>commit(p=>M.editWord(p,selected,{text:$('word-text').value.trim(),start:M.round(Number($('word-start').value)),end:M.round(Number($('word-end').value))})));
on('keyword-toggle','click',()=>commit(p=>M.toggleKeyword(p,selected)));
on('review-word','click',()=>commit(p=>{p.words.find(w=>w.id===selected).reviewed=true;}));
on('at-playhead','click',()=>commit(p=>M.editWord(p,selected,{start:M.round(audio.currentTime)})));
on('end-playhead','click',()=>commit(p=>M.editWord(p,selected,{end:M.round(audio.currentTime)})));
on('nudge-left','click',()=>commit(p=>M.editWord(p,selected,{start:M.round(current().start-.01)})));
on('nudge-right','click',()=>commit(p=>M.editWord(p,selected,{start:M.round(current().start+.01)})));
on('insert-word','click',()=>{let id;commit(p=>{id=M.insertWord(p,selected,$('new-word').value).id;});selected=id;render();});
on('remove-word','click',()=>commit(p=>M.removeWord(p,selected)));
on('word-note','input',e=>commit(p=>M.annotation(p,selected).note=e.target.value,{draw:false}));
on('paper','change',e=>commit(p=>M.annotation(p,selected).background=e.target.value));
on('animation','change',e=>commit(p=>M.annotation(p,selected).animation=e.target.value,{draw:false}));
on('ink','input',e=>editor.color=e.target.value);
on('suggest-drawing','click',()=>{makeSuggestion(D.matchConcept(current().text));});
on('drawing-concept','change',e=>makeSuggestion(e.target.value||null));
on('another-drawing','click',()=>makeSuggestion(drawingSuggestion.concept,(suggestionContext.variant+1)%6));
on('close-suggestion','click',closeSuggestion);
on('use-drawing','click',()=>{const w=current(),suggestion=drawingSuggestion;if(suggestionContext?.id!==w?.id)throw Error('Choose a drawing for this word first.');commit(p=>D.useSuggestion(p,w.id,suggestion));closeSuggestion();toast(`Sketch added to “${w.text}”. You can draw on it, or undo a stroke.${w.keyword?'':' Star the word to animate it.'}`);});
on('restore-drawing','click',()=>{commit(p=>D.restoreDrawing(p,selected));closeSuggestion();toast('Previous drawing restored.');});
on('sketch-keywords','click',()=>{
  let result;commit(p=>{result=D.sketchEmptyKeywords(p);});
  const missing=[...new Set(result.unmatched)];
  $('sketch-result').textContent=`Added ${result.added} sketch${result.added===1?'':'es'}. Kept ${result.kept} existing drawing${result.kept===1?'':'s'}.${missing.length?` Choose pictures for: ${missing.slice(0,8).join(', ')}${missing.length>8?'…':''}. Select a word, then Suggest a drawing.`:''}`;
  $('sketch-result').hidden=false;
});
editor.onChange=()=>{if(!project||!selected)return;try{const drawing=M.clone(editor.drawing);commit(p=>M.annotation(p,selected).drawing=drawing,{draw:false});}catch(e){toast(e.message,true);}};
on('undo-stroke','click',()=>{editor.undo();editor.onChange();});
on('undo','click',()=>{if(!history.length)return;project=history.pop();selected=project.words.some(w=>w.id===selected)?selected:project.words[0]?.id;persist();render();updatePreview();});
on('play','click',play);on('back','click',()=>seek(audio.currentTime-2));on('scrub','input',e=>seek(Number(e.target.value)));
on('wave','click',e=>{const r=e.target.getBoundingClientRect();seek((e.clientX-r.left)/r.width*project.duration);});
on('speed','change',e=>{audio.playbackRate=Number(e.target.value);syncLayers(true);});
on('section-strip','click',e=>{const b=e.target.closest('[data-seek]');if(b)seek(Number(b.dataset.seek));});
on('preview-markers','click',e=>{const b=e.target.closest('[data-seek]');if(b)seek(Number(b.dataset.seek));});
on('sections','change',e=>{if(e.target.dataset.sectionName!==undefined)commit(p=>{const s=p.sections[Number(e.target.dataset.sectionName)];s.label=e.target.value.trim();s.source='manual label';s.reviewed=false;},{draw:false});if(e.target.dataset.sectionTime!==undefined)commit(p=>M.setSectionBoundary(p,Number(e.target.dataset.sectionTime),Number(e.target.value)),{draw:false});});
on('sections','click',e=>{const b=e.target.closest('[data-section-review]');if(b)commit(p=>p.sections[Number(b.dataset.sectionReview)].reviewed=true,{draw:false});});
on('add-section','click',()=>commit(p=>{const at=M.round(audio.currentTime),i=p.sections.findIndex(s=>at>s.start+.01&&at<s.end-.01);if(i<0)throw Error('Move the playhead inside a section first.');const s=p.sections[i],end=s.end;s.end=at;s.reviewed=false;p.sections.splice(i+1,0,{id:M.uid('section'),label:'New part',start:at,end,source:'manual split',reviewed:false});},{draw:false}));
on('suggest-sections','click',()=>{if(!env)throw Error('Choose audio first.');const cuts=A.suggestSections(env);if(!cuts.length){toast('No clear quiet gaps found. Split a section at the playhead instead.');return;}commit(p=>{const bounds=[0,...cuts,p.duration];p.sections=bounds.slice(0,-1).map((start,i)=>({id:M.uid('section'),label:`Part ${i+1}`,start,end:bounds[i+1],source:'quiet-gap estimate',reviewed:false}));},{draw:false});toast('Suggested cuts at quiet gaps. Listen and choose your own section labels.');});
on('rough-timing','click',()=>{if(!env||!project?.words.length)throw Error('Add audio and lyrics first.');const section=project.sections.find(s=>audio.currentTime>=s.start&&audio.currentTime<s.end)||project.sections[0];commit(p=>{const words=p.words.filter(w=>w.start>=section.start&&w.start<section.end);if(words.some(w=>w.reviewed))throw Error('This section has reviewed words. Adjust them individually to keep your work.');A.estimateWords(words,section.start,section.end,env);});toast('Rough energy-based positions placed in the current section. These are not aligned to recognized words.');});
on('tracks','change',e=>{const el=e.target;commit(p=>{if(el.dataset.trackMute)p.tracks.find(t=>t.id===el.dataset.trackMute).muted=el.checked;if(el.dataset.trackVolume)p.tracks.find(t=>t.id===el.dataset.trackVolume).volume=Number(el.value);if(el.dataset.trackOffset)p.tracks.find(t=>t.id===el.dataset.trackOffset).offset=Number(el.value);},{draw:false});syncLayers(true);});
on('tracks','click',e=>{const b=e.target.closest('[data-track-remove]');if(b)commit(p=>p.tracks=p.tracks.filter(t=>t.id!==b.dataset.trackRemove),{draw:false});});
function showTap(){const w=project.words[tapState.index];$('tap-next').textContent=w?`Next: “${w.text}”`:'All words tapped. Finish to keep these starts.';$('tap').disabled=!w;}
on('tap-mode','click',async()=>{requireProject();if(!project.words.length)throw Error('Add lyrics first.');const index=Math.max(0,project.words.findIndex(w=>w.id===selected));tapState={index,first:index,starts:[]};$('tap-panel').hidden=false;showTap();toast('Press play, then tap T at the beginning of each word.');});
function tap(){if(!tapState)return;const time=M.round(audio.currentTime);if(!project.words[tapState.index])return;const previous=tapState.starts.at(-1)??(tapState.first?project.words[tapState.first-1].start:-.001);if(time<=previous||time>=project.duration-.001)throw Error('Play forward before tapping the next word.');tapState.starts.push(time);tapState.index++;showTap();}
on('tap','click',tap);
on('tap-stop','click',()=>{
  if(tapState?.starts.length){const state=tapState;commit(p=>{const first=state.first,last=first+state.starts.length-1;if(first>0){p.words[first-1].end=state.starts[0];p.words[first-1].reviewed=false;}
    state.starts.forEach((start,k)=>{const w=p.words[first+k];w.start=start;w.end=state.starts[k+1]??Math.min(p.duration,Math.max(start+.001,audio.currentTime));w.reviewed=false;w.timingSource='manual tap';});
    // Untapped remaining words stay placeholders, redistributed after the final tap.
    const rest=p.words.slice(last+1),start=p.words[last].end;if(rest.length){if(p.duration-start<rest.length*.002)throw Error('Not enough time left. Undo tapping and try an earlier start.');rest.forEach((w,i)=>{w.start=M.round(start+(p.duration-start)*i/rest.length);w.end=M.round(start+(p.duration-start)*(i+1)/rest.length);w.reviewed=false;w.timingSource='spacing after manual taps';});}
  });}tapState=null;$('tap-panel').hidden=true;toast('Taps saved. Listen again to check word starts and ends.');
});
document.addEventListener('keydown',action(e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.metaKey||e.ctrlKey||e.altKey)return;if(e.code==='Space'){e.preventDefault();return play();}if(e.key.toLowerCase()==='t'&&tapState){e.preventDefault();tap();}}));
for(const name of ['edit','preview','export'])on(name+'-tab','click',()=>setView(name));
on('save-file','click',saveCopy);on('download-project','click',saveCopy);on('download-bundle','click',exportKit);
on('download-lrc','click',()=>{requireProject();Store.download(new Blob([M.toLRC(project)],{type:'text/plain'}),`${project.id}.lrc`);toast('Saved word-start timings. The project file holds IDs, artwork, and review status.');});
audio.addEventListener('play',()=>{$('play').textContent='Ⅱ';$('play').setAttribute('aria-label','Pause');if($('loop-word').checked&&current())loopUntil=current().end;});
audio.addEventListener('pause',()=>{$('play').textContent='▶';$('play').setAttribute('aria-label','Play');syncLayers();});
audio.addEventListener('error',()=>{if(audio.getAttribute('src'))toast('The browser could not play this audio file.',true);});
window.addEventListener('resize',paintWave);
window.addEventListener('beforeunload',e=>{if(tapState?.starts.length){e.preventDefault();e.returnValue='';}});
let lastPaint=0;
function tick(now){
  if(project){
    if(!audio.paused&&$('loop-word').checked&&current()&&audio.currentTime>=current().end)seek(current().start);
    preview.tick();syncLayers();
    if(now-lastPaint>45){updateClock();paintWave();lastPaint=now;document.querySelectorAll('[data-chip]').forEach(el=>{const w=project.words.find(w=>w.id===el.dataset.chip);el.classList.toggle('playing',!!w&&audio.currentTime>=w.start&&audio.currentTime<w.end);});}
  }requestAnimationFrame(tick);
}
requestAnimationFrame(tick);renderLibrary().catch(()=>toast('Local storage is unavailable. Save project copies while you work.',true));
// Read-only diagnostics used by the local integration tests.
window.songStudio={get project(){return M.clone(project);},get preview(){return preview;},get audio(){return audio;},get ready(){return previewQueue;}};

function followLyric(id){
  const pane=$('live-lyrics');let active=null;
  for(const el of pane.querySelectorAll('[data-live-word]')){const match=el.dataset.liveWord===id;el.classList.toggle('active',match);if(match){el.setAttribute('aria-current','true');active=el;}else el.removeAttribute('aria-current');}
  if(active&&$('follow-lyrics').checked){const a=active.getBoundingClientRect(),b=pane.getBoundingClientRect();if(a.top<b.top+12||a.bottom>b.bottom-12)pane.scrollTop+=a.top-b.top-pane.clientHeight/2+a.height/2;}
}
on('live-lyrics','click',e=>{const button=e.target.closest('[data-live-word]');if(!button)return;selected=button.dataset.liveWord;renderInspector();seek(current().start);document.querySelectorAll('[data-chip]').forEach(el=>el.classList.toggle('selected',el.dataset.chip===selected));});
