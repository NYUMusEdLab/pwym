import {importProject,fixtureProject} from './model.mjs';
import {fixtureAudio,blobFromDataURL,mixdown} from './audio.mjs';
import {Preview} from './adapter.mjs';
const $=id=>document.getElementById(id),audio=$('audio');let project,url;
const preview=new Preview(audio,$('preview-stage'),e=>{$('note').textContent=e?project.annotations[e.data.wordId]?.note||'':'';},e=>{$('lyric').textContent=e?.data.text||'♪';});
async function load(p,fixture=false){
  audio.pause();project=importProject(p);if(url)URL.revokeObjectURL(url);
  const blobs=new Map();for(const t of project.tracks){if(t.data)blobs.set(t.id,blobFromDataURL(t.data));else if(fixture)blobs.set(t.id,fixtureAudio());}
  const mixed=await mixdown(project,blobs);url=URL.createObjectURL(mixed);audio.src=url;await preview.load(project,p.schema==='musedlab.annotator-bundle'?p:null);
  $('preview-markers').replaceChildren();for(const w of project.words.filter(w=>w.keyword)){const b=document.createElement('button');b.textContent=`★ ${w.text} · ${w.start.toFixed(3)}s`;b.onclick=()=>{audio.currentTime=w.start;preview.tick();};$('preview-markers').append(b);}
  $('status').textContent=`Loaded “${project.title}” locally. ${fixture?'Generated tones and invented lyrics; no transcription demonstrated.':''}`;
  $('proof').textContent=JSON.stringify({sourceRevision:'6a54f4675ec3878727a4555046d64ed3afd3f146',loader:'original SongLoader / _events.json',lyrics:preview.song.events.length,keywords:preview.song.events.filter(e=>e.events.length).length,reviewedWords:project.words.filter(w=>w.reviewed).length,annotationBinding:'data.wordId → annotationsByWordId'},null,2);
}
$('file').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>250*1024*1024)throw Error('File is too large.');await load(JSON.parse(await f.text()));}catch(error){$('status').textContent=error.message;}};
$('demo').onclick=()=>load(fixtureProject(),true).catch(e=>$('status').textContent=e.message);
$('seek').onclick=()=>{if(!project)return;const time=Number($('seek-time').value);if(Number.isFinite(time)){audio.currentTime=Math.max(0,Math.min(project.duration,time));preview.tick();}};
function frame(){preview.tick();requestAnimationFrame(frame);}requestAnimationFrame(frame);
window.harness={get project(){return project;},preview,audio};
