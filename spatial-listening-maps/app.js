import {STORAGE_KEY, clamp, uid, newProject, newSection, newToken, duplicateSection, parseProject, serializeProject, formatTime, makePracticeProject} from './model.js';
import {LocalAudio} from './audio.js';

const $ = id => document.getElementById(id);
const audio = new LocalAudio();
let project = newProject(), selectedTokenId = null, loop = false, comparing = false, compareId = null, drawing = false, draft = [], cursor = {x:0,depth:0.5}, drag = null, saveBlocked = false, loading = false, loadGeneration = 0, statusTimer;
try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) project = parseProject(saved); }
catch { saveBlocked = true; setTimeout(()=>announce('Saved map could not be restored. Its stored data is preserved. Import a backup or start a new project to resume autosaving.',true),0); }
const section = () => project.sections.find(s=>s.id===project.activeSectionId);
const token = () => section().tokens.find(t=>t.id===selectedTokenId);
function announce(message, sticky = false) {
  $('status').textContent = message; $('status').classList.add('visible'); clearTimeout(statusTimer);
  if (!sticky) statusTimer=setTimeout(()=>$('status').classList.remove('visible'),5500);
}
function save() {
  project.updatedAt=new Date().toISOString();
  if(saveBlocked) { $('save-state').textContent='Autosave paused · export a backup'; return; }
  try { localStorage.setItem(STORAGE_KEY,serializeProject(project)); $('save-state').textContent='Saved on this device'; }
  catch { $('save-state').textContent='Not saved · export a backup'; announce('Browser storage is unavailable or full. Export your map to keep these changes.',true); }
}
function fillSelect(element, items, current) {
  element.replaceChildren(...items.map(item=>new Option(item.label,item.value)));
  element.value=current;
}
function setPanel(name, open = true) {
  for(const tab of document.querySelectorAll('[data-panel]')) {
    const active=tab.dataset.panel===name;
    tab.setAttribute('aria-selected',String(active)); tab.tabIndex=active?0:-1;
    $(tab.dataset.panel+'-panel').hidden=!active;
  }
  if(open) { $('inspector').hidden=false; $('toggle-panel').setAttribute('aria-expanded','true'); }
}
function renderSectionControls() {
  const s=section();
  fillSelect($('section-select'),project.sections.map(s=>({value:s.id,label:s.name || 'Unnamed section'})),s.id);
  $('section-range').textContent=`${formatTime(s.start,true)} — ${formatTime(s.end,true)}`;
  $('map-name').textContent=s.name || 'Unnamed section';
  $('section-name').value=s.name; $('section-start').value=s.start; $('section-end').value=s.end;
  $('section-start').max=s.end-0.1; $('section-end').max=project.audio?.duration || 86400;
  $('section-notes').value=s.notes;
  $('remove-section').disabled=project.sections.length===1;
  const choices=project.sections.filter(x=>x.id!==s.id);
  if(!choices.some(x=>x.id===compareId)) compareId=choices[0]?.id || null;
  if(!compareId) comparing=false;
  fillSelect($('compare-select'),choices.map(x=>({value:x.id,label:x.name})),compareId);
  $('comparison').hidden=!comparing; $('compare-settings').hidden=!comparing; $('current-caption').hidden=!comparing;
  $('compare').setAttribute('aria-pressed',String(comparing));
  document.querySelector('.app').classList.toggle('comparing',comparing);
  $('current-caption').textContent=`${s.name} · editing`;
  const ref=project.sections.find(x=>x.id===compareId);
  if(ref) $('reference-caption').textContent=`${ref.name} · ${formatTime(ref.start)}–${formatTime(ref.end)} · reference`;
}
function position(element,t) {
  element.style.left=`${(t.x+1)*50}%`; element.style.top=`${(1-t.depth)*100}%`; element.style.setProperty('--token-color',t.color);
}
function soundDescription(t) {
  const side=Math.abs(t.x)<0.03?'center':`${Math.round(Math.abs(t.x)*100)}% ${t.x<0?'left':'right'}`;
  return `${t.label || 'Unnamed sound'}, ${side}, ${Math.round(t.depth*100)}% toward far, ${Math.round(t.spread*100)}% stereo spread, ${t.confidence}`;
}
function paintTokens(container, tokens, interactive) {
  container.replaceChildren();
  for(const t of tokens) {
    const spread=document.createElement('span'); spread.className='spread'; spread.dataset.spread=t.id; position(spread,t); spread.style.width=`${6+t.spread*80}%`; container.append(spread);
    const el=document.createElement(interactive?'button':'span');
    el.className=`token ${t.confidence}${interactive&&t.id===selectedTokenId?' selected':''}`;
    el.textContent=t.label || 'Unnamed sound'; el.dataset.token=t.id; position(el,t);
    el.setAttribute('aria-label',soundDescription(t));
    if(interactive) {el.setAttribute('aria-pressed',String(t.id===selectedTokenId));el.title='Drag or use arrow keys to move; Shift for larger steps';}
    container.append(el);
  }
}
function paintTrace(svg,traces,preview=[]) {
  svg.replaceChildren();
  for(const [i,points] of [...traces.map(t=>t.points),...(preview.length?[preview]:[])].entries()) {
    const line=document.createElementNS('http://www.w3.org/2000/svg','polyline');
    line.setAttribute('points',points.map(p=>`${(p.x+1)*500},${(1-p.depth)*1000}`).join(' '));
    if(i===traces.length)line.setAttribute('class','draft');
    svg.append(line);
  }
}
function renderMaps() {
  paintTokens($('tokens'),section().tokens,true); paintTrace($('traces'),section().traces,draft);
  $('empty-stage').hidden=section().tokens.length>0 || drawing || comparing;
  const ref=project.sections.find(x=>x.id===compareId);
  if(comparing&&ref){paintTokens($('reference-tokens'),ref.tokens,false);paintTrace($('reference-traces'),ref.traces);}
  $('undo-trace').disabled=section().traces.length===0 && draft.length===0;
}
function updateTokenView(t) {
  for(const el of $('tokens').querySelectorAll('[data-token],[data-spread]')) {
    if(el.dataset.token===t.id || el.dataset.spread===t.id) {
      position(el,t);
      if(el.dataset.token) {el.textContent=t.label || 'Unnamed sound';el.classList.toggle('confident',t.confidence==='confident');el.setAttribute('aria-label',soundDescription(t));}
      else el.style.width=`${6+t.spread*80}%`;
    }
  }
  updateOutputs();
}
function updateOutputs() {
  const t=token(); if(!t)return;
  $('x-value').value=Math.abs(t.x)<0.01?'Center':`${Math.round(Math.abs(t.x)*100)}% ${t.x<0?'L':'R'}`;
  $('depth-value').value=`${Math.round(t.depth*100)}% far`;
  $('spread-value').value=`${Math.round(t.spread*100)}%`;
  $('token-x').setAttribute('aria-valuetext',$('x-value').value);
  $('token-depth').setAttribute('aria-valuetext',$('depth-value').value);
  $('token-spread').setAttribute('aria-valuetext',`${Math.round(t.spread*100)} percent stereo spread`);
}
function renderEditor() {
  if(!token())selectedTokenId=section().tokens[0]?.id || null;
  const t=token(); $('sound-empty').hidden=!!t; $('sound-editor').hidden=!t;
  if(!t)return;
  fillSelect($('token-select'),section().tokens.map(t=>({value:t.id,label:t.label || 'Unnamed sound'})),t.id);
  for(const [id,key] of [['label','label'],['x','x'],['depth','depth'],['spread','spread'],['confidence','confidence'],['note','note'],['color','color']]) $('token-'+id).value=t[key];
  updateOutputs();
}
function renderAudio() {
  const ready=!!audio.buffer;
  $('audio-name').textContent=project.audio?.name || 'Bring a recording you want to understand';
  $('audio-state').textContent=ready?'Local audio ready':project.audio?'Relink audio to listen':'Audio stays on your device';
  $('audio-dot').classList.toggle('ready',ready);
  $('load-audio').textContent=loading?'Reading audio…':project.audio?.kind==='local'&&!ready?'Relink local audio':'Load local audio';
  $('load-audio').disabled=loading;
  $('practice').textContent=project.audio?.kind==='practice'?'Reload practice audio':'Try practice audio';
  for(const id of ['play','restart','seek','loop','mark-start','mark-end'])$(id).disabled=!ready || loading;
  $('seek').max=audio.duration || project.audio?.duration || Math.max(...project.sections.map(s=>s.end));
  $('duration').textContent=formatTime(audio.duration || project.audio?.duration || 0);
  $('loop').setAttribute('aria-pressed',String(loop));
  tick();
}
function renderAll() {
  $('project-title').value=project.title; renderSectionControls();renderEditor();renderMaps();renderAudio();
  if(saveBlocked)$('save-state').textContent='Autosave paused · export a backup';
}
function selectToken(id, focus=false) {
  selectedTokenId=id; renderEditor();
  for(const el of $('tokens').querySelectorAll('[data-token]')) { const yes=el.dataset.token===id;el.classList.toggle('selected',yes);el.setAttribute('aria-pressed',String(yes));if(yes&&focus)el.focus(); }
  setPanel('sound',false);
}
async function selectSection(id) {
  draft=[];project.activeSectionId=id;selectedTokenId=null;
  if(audio.buffer) {await audio.setLoop(loop?section():null);await audio.seek(section().start);}
  renderAll();save();
}
function hasWork() {return project.audio || project.sections.some(s=>s.tokens.length||s.traces.length||s.notes);}
function backupAndReplace(next) {
  try {localStorage.setItem(STORAGE_KEY+'.previous',serializeProject(project));}catch{}
  loadGeneration++;loading=false;audio.unload();project=next;selectedTokenId=null;loop=false;comparing=false;draft=[];saveBlocked=false;setDrawing(false);save();renderAll();
}
function confirmReplacement() {return !hasWork() || confirm('Replace this map? Export it first if you want a portable copy. The previous map will be available from Restore previous map in Help.');}

$('project-title').addEventListener('input',()=>{project.title=$('project-title').value;save();});
$('section-select').addEventListener('change',()=>selectSection($('section-select').value));
$('compare-select').addEventListener('change',()=>{compareId=$('compare-select').value;renderSectionControls();renderMaps();});
$('compare').onclick=()=>{if(project.sections.length<2)return announce('Add or duplicate a section to compare two maps.');comparing=!comparing;setDrawing(false);renderSectionControls();renderMaps();};
$('toggle-panel').onclick=()=>{if(comparing){comparing=false;renderSectionControls();$('inspector').hidden=false;}else $('inspector').hidden=!$('inspector').hidden;$('toggle-panel').setAttribute('aria-expanded',String(!$('inspector').hidden));};
for(const tab of document.querySelectorAll('[data-panel]')) {
  tab.onclick=()=>setPanel(tab.dataset.panel);
  tab.onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const tabs=[...document.querySelectorAll('[data-panel]')];const next=tabs[(tabs.indexOf(tab)+(e.key==='ArrowRight'?1:2))%3];setPanel(next.dataset.panel);next.focus();}};
}
function addSound() {
  if(section().tokens.length>=100)return announce('This section already has 100 sounds.');
  const t=newToken(`Sound ${section().tokens.length+1}`,section().tokens.length);section().tokens.push(t);selectedTokenId=t.id;setDrawing(false);setPanel('sound');renderEditor();renderMaps();save();$('token-label').focus();$('token-label').select();
}
for(const id of ['add-sound','empty-add','panel-add'])$(id).onclick=addSound;
$('token-select').onchange=()=>selectToken($('token-select').value);
for(const key of ['label','x','depth','spread','confidence','note','color']) {
  $('token-'+key).addEventListener('input',e=>{const t=token();if(!t)return;t[key]=['x','depth','spread'].includes(key)?Number(e.target.value):e.target.value;updateTokenView(t);if(key==='label')$('token-select').selectedOptions[0].textContent=t.label||'Unnamed sound';save();});
}
$('remove-sound').onclick=()=>{const t=token();if(!t)return;section().tokens=section().tokens.filter(x=>x.id!==t.id);selectedTokenId=null;renderEditor();renderMaps();save();announce(`Removed ${t.label} from this section.`);};
$('section-name').oninput=()=>{section().name=$('section-name').value;$('map-name').textContent=section().name;$('section-select').selectedOptions[0].textContent=section().name;save();};
async function setBoundary(key,value) {
  const s=section(), end=key==='end'?value:s.end, start=key==='start'?value:s.start;
  if(!Number.isFinite(value)||start<0||end-start<0.1-1e-9||end>(project.audio?.duration || 86400)+0.001){announce('Use times within the recording, with end at least 0.1 seconds after start.');renderSectionControls();return;}
  s[key]=value;
  if(audio.buffer&&loop) await audio.setLoop(s);
  renderSectionControls();save();
}
$('section-start').onchange=()=>setBoundary('start',Number($('section-start').value));
$('section-end').onchange=()=>setBoundary('end',Number($('section-end').value));
$('mark-start').onclick=()=>setBoundary('start',Math.round(audio.currentTime()*1000)/1000);
$('mark-end').onclick=()=>setBoundary('end',Math.round(audio.currentTime()*1000)/1000);
$('section-notes').oninput=()=>{section().notes=$('section-notes').value;save();};
$('add-section').onclick=async()=>{
  if(project.sections.length>=100)return announce('This project already has 100 sections.');
  const duration=project.audio?.duration || 86400, start=clamp(audio.currentTime(),0,duration-0.1), end=Math.min(duration,start+15);
  const s=newSection(start,end,`Section ${project.sections.length+1}`);project.sections.push(s);await selectSection(s.id);setPanel('section');$('section-name').focus();$('section-name').select();
};
$('duplicate').onclick=async()=>{if(project.sections.length>=100)return announce('This project already has 100 sections.');const s=duplicateSection(section());project.sections.push(s);await selectSection(s.id);setPanel('section');announce('Map duplicated. Change its name and times to follow the sounds into another section.');};
$('remove-section').onclick=async()=>{if(project.sections.length<=1)return;if(!confirm('Delete this section and its sounds, traces, and notes?'))return;project.sections=project.sections.filter(s=>s.id!==project.activeSectionId);await selectSection(project.sections[0].id);};
$('cue-section').onclick=$('restart').onclick=async()=>{if(audio.buffer)await audio.seek(section().start);else announce('Relink the recording to cue this section.');};

function setDrawing(active) {
  drawing=active;draft=[];drag=null;
  $('draw').setAttribute('aria-pressed',String(active));$('stage').classList.toggle('drawing',active);$('finish-trace').hidden=!active;$('draw-cursor').hidden=!active;
  $('stage-hint').textContent=active?'Draw a trace. Keyboard: focus stage, arrows move, Enter adds points, Finish trace saves.':'Drag sounds, or select one and use arrow keys. Wider marks mean wider stereo spread.';
  position($('draw-cursor'),{...cursor,color:'#215c50'});renderMaps();
}
$('draw').onclick=()=>{setDrawing(!drawing);if(drawing)$('stage').focus();};
function finishTrace() {
  if(draft.length>1){if(section().traces.length>=100)return announce('This section already has 100 traces. Undo one to make room.');section().traces.push({id:uid(),points:draft.map(p=>({...p}))});save();}
  draft=[];renderMaps();
}
$('finish-trace').onclick=()=>{finishTrace();$('stage').focus();};
$('undo-trace').onclick=()=>{if(draft.length)draft=[];else section().traces.pop();renderMaps();save();};
function fromPointer(e) {const r=$('field').getBoundingClientRect();return {x:clamp((e.clientX-r.left)/r.width*2-1,-1,1),depth:clamp(1-(e.clientY-r.top)/r.height,0,1)};}
$('stage').addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  const mark=e.target.closest('[data-token]');
  if(drawing){e.preventDefault();draft=[fromPointer(e)];drag={type:'trace',pointer:e.pointerId};}
  else if(mark){e.preventDefault();selectToken(mark.dataset.token);mark.focus();const p=fromPointer(e);drag={type:'token',id:mark.dataset.token,pointer:e.pointerId,offsetX:token().x-p.x,offsetDepth:token().depth-p.depth};}
  else return;
  $('stage').setPointerCapture(e.pointerId);
});
$('stage').addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.pointer)return;
  const p=fromPointer(e);
  if(drag.type==='trace'){if(draft.length<1000)draft.push(p);paintTrace($('traces'),section().traces,draft);}
  else {p.x=clamp(p.x+drag.offsetX,-1,1);p.depth=clamp(p.depth+drag.offsetDepth,0,1);Object.assign(token(),p);updateTokenView(token());$('token-x').value=p.x;$('token-depth').value=p.depth;}
});
function endDrag(e){if(!drag||e.pointerId!==drag.pointer)return;if(drag.type==='trace')finishTrace();else save();drag=null;}
$('stage').addEventListener('pointerup',endDrag);
$('stage').addEventListener('pointercancel',endDrag);
$('stage').addEventListener('keydown',e=>{
  const step=e.shiftKey?0.1:0.02, p=drawing?cursor:token();
  if(drawing&&e.key==='Escape'){draft=[];renderMaps();e.preventDefault();return;}
  if(drawing&&e.key==='Enter'){e.preventDefault();if(draft.length<1000)draft.push({...cursor});paintTrace($('traces'),section().traces,draft);return;}
  if(!p||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
  if(!drawing&&!e.target.closest('[data-token]'))return;
  e.preventDefault();p.x=clamp(p.x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0),-1,1);p.depth=clamp(p.depth+(e.key==='ArrowUp'?step:e.key==='ArrowDown'?-step:0),0,1);
  if(drawing)position($('draw-cursor'),{...cursor,color:'#215c50'});
  else {updateTokenView(p);$('token-x').value=p.x;$('token-depth').value=p.depth;save();}
});
$('tokens').addEventListener('focusin',e=>{const el=e.target.closest('[data-token]');if(el&&el.dataset.token!==selectedTokenId)selectToken(el.dataset.token);});
$('tokens').addEventListener('click',e=>{const el=e.target.closest('[data-token]');if(el)selectToken(el.dataset.token);});

async function togglePlayback(){if(!audio.buffer)return;try{if(audio.playing)audio.pause();else await audio.play();tick();}catch{announce('Playback could not start. Try Play again or relink the audio.');}}
$('play').onclick=togglePlayback;
$('seek').addEventListener('input',async()=>{await audio.seek(Number($('seek').value));tick();});
$('loop').onclick=async()=>{loop=!loop;await audio.setLoop(loop?section():null);$('loop').setAttribute('aria-pressed',String(loop));tick();};
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat&&!$('help-dialog').open&&!e.target.closest('input,textarea,select,button,a,[contenteditable]')){e.preventDefault();togglePlayback();}});
$('load-audio').onclick=()=>$('audio-file').click();
$('audio-file').onchange=async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  if(file.size>150*1024*1024)return announce('This prototype accepts audio files up to 150 MB. Use a shorter excerpt.');
  const generation=++loadGeneration;
  loading=true;audio.pause();renderAudio();
  try {
    const {buffer,metadata}=await audio.decode(file);
    if(generation!==loadGeneration)return;
    if(project.audio&&(project.audio.kind!=='local'||project.audio.fingerprint!==metadata.fingerprint))throw new Error('This is a different recording. Relink the exact original file, or start a new project for this audio. Your map is unchanged.');
    if(!project.audio){
      if(project.sections.length===1&&!section().tokens.length&&!section().notes&&!section().traces.length){section().start=0;section().end=metadata.duration;}
      else if(project.sections.some(s=>s.end>metadata.duration))throw new Error('Some sections extend beyond this recording. Shorten those section times before linking it.');
    }
    project.audio=metadata;audio.setBuffer(buffer);if(loop)await audio.setLoop(section());await audio.seek(section().start);save();renderAll();announce('Audio linked locally. No audio was uploaded.');
  } catch(err){announce(err.message?.includes('recording')||err.message?.includes('sections')?err.message:'This audio could not be decoded. Try a browser-supported WAV, MP3, M4A, OGG, or FLAC file.',true);}
  finally {if(generation===loadGeneration){loading=false;renderAudio();}}
};
$('practice').onclick=()=>{
  if(project.audio?.kind==='practice'){audio.practice();if(loop)audio.setLoop(section());audio.seek(section().start);renderAudio();announce('Practice audio regenerated on this device.');return;}
  if(!confirmReplacement())return;backupAndReplace(makePracticeProject());audio.practice();renderAll();announce('Practice map loaded. Its positions are illustrative starting points, not an answer key.');
};
$('new-project').onclick=()=>{if(confirmReplacement()){backupAndReplace(newProject());announce('New listening map ready.');}};
function download(text,filename,type='application/json') {const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export').onclick=()=>{try{download(serializeProject(project),(project.title.replace(/[^\p{L}\p{N}\-_ ]/gu,'').trim()||'listening-map')+'.slmap.json');announce('Map exported. Audio is not included; keep the original recording to relink.');}catch(err){announce(err.message,true);}};
$('import').onclick=()=>$('map-file').click();
$('map-file').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{if(f.size>2_000_000)throw new Error('Map file exceeds the 2 MB limit.');const next=parseProject(await f.text());if(!confirmReplacement())return;backupAndReplace(next);announce('Map imported. Relink the original recording to listen.');}catch(err){announce(`Map not imported: ${err.message}`,true);}};
$('restore-backup').onclick=()=>{try{const raw=localStorage.getItem(STORAGE_KEY+'.previous');if(!raw)return announce('No previous map is available.');const next=parseProject(raw);if(confirmReplacement()){backupAndReplace(next);$('help-dialog').close();announce('Previous map restored. Relink its audio.');}}catch{announce('Previous map could not be restored. Import a JSON backup.',true);}};
$('help').onclick=()=>{const restore=$('restore-backup');restore.hidden=false;document.querySelector('.dialog-body').append(restore);$('help-dialog').showModal();};
$('close-help').onclick=()=>$('help-dialog').close();
audio.onEnded=()=>{tick();announce('Recording ended.');};
function tick() {
  const t=audio.currentTime(), s=section();
  $('current-time').textContent=formatTime(t,true);$('seek').value=t;
  $('seek').setAttribute('aria-valuetext',`${formatTime(t,true)} of ${formatTime(audio.duration || project.audio?.duration || 0)}`);
  $('play').textContent=audio.playing?'Ⅱ':'▶';$('play').setAttribute('aria-label',audio.playing?'Pause recording':'Play recording');
  const d=Number($('seek').max)||1;$('section-band').style.left=`${s.start/d*100}%`;$('section-band').style.width=`${(s.end-s.start)/d*100}%`;
  $('play-context').textContent=!audio.buffer?(project.audio?'Audio is not linked. Your map is saved; choose the original recording.':'Load a local file, or explore the original synthesized practice.'):(t>=s.start&&t<s.end?`${loop?'Looping':'Selected map'}: ${s.name} · ${formatTime(s.start,true)}–${formatTime(s.end,true)}`:`Outside “${s.name}” · cue its start or select a matching section.`);
}
function frame(){tick();requestAnimationFrame(frame);}
if(window.innerWidth<850){$('inspector').hidden=true;$('toggle-panel').setAttribute('aria-expanded','false');}
renderAll();requestAnimationFrame(frame);
window.addEventListener('pagehide',()=>{audio.pause();if(!saveBlocked)save();});
