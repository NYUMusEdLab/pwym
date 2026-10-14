export const SCHEMA = 'musedlab.song-creator';
export const clone = value => structuredClone(value);
export const uid = prefix => `${prefix}-${crypto.randomUUID()}`;
export const round = n => Math.round(n * 1000) / 1000;
export const blankDrawing = () => ({version:2,isCompressed:false,duration:0,strokes:[]});
export function createProject(title, duration, track) {
  return {schema:SCHEMA,version:1,id:uid('song'),title,duration:round(duration),
    lyricsSource:'user supplied',fixture:false,tracks:track?[track]:[],words:[],archivedWords:[],
    sections:[{id:uid('section'),label:'My song',start:0,end:round(duration),source:'manual',reviewed:false}],
    annotations:{},updatedAt:new Date().toISOString()};
}
export function splitLyrics(text) {
  return text.trim().split(/\n/).filter(x=>x.trim()).flatMap((line,i)=>
    line.trim().split(/\s+/u).map(text=>({text,line:i})));
}
export function setLyrics(project,text,source='user supplied') {
  const tokens=splitLyrics(text);
  if(tokens.length>3000) throw Error('Please use at most 3,000 words in one song.');
  project.archivedWords.push(...clone(project.words)); // never repurpose an old word ID
  project.words=tokens.map((t,i)=>({id:uid('word'),...t,start:round(i*project.duration/tokens.length),
    end:round((i+1)*project.duration/tokens.length),keyword:false,
    timingSource:'even-spacing estimate',reviewed:false}));
  project.lyricsSource=source;
}
export function editWord(project,id,patch) {
  const w=project.words.find(w=>w.id===id); if(!w) throw Error('Word not found.');
  const candidate={...w,...patch,id:w.id};
  const i=project.words.indexOf(w);
  if(!candidate.text?.trim() || (/\s/.test(candidate.text)&&w.sourceUnit!=='phrase')) throw Error('Use one word here; use Add word for another.');
  if(!Number.isFinite(candidate.start)||!Number.isFinite(candidate.end)||candidate.start<0||candidate.end<=candidate.start||candidate.end>project.duration+.001)
    throw Error('The end must follow the start, within the song.');
  if(i>0&&candidate.start<project.words[i-1].end-.0001) throw Error('This starts before the previous word ends. Adjust that word first.');
  if(i<project.words.length-1&&candidate.end>project.words[i+1].start+.0001) throw Error('This ends after the next word starts. Adjust that word first.');
  if(patch.start!==undefined||patch.end!==undefined||patch.text!==undefined) {
    candidate.reviewed=false; candidate.timingSource=patch.text!==undefined?'edited lyric; recheck timing':'manual adjustment';
  }
  if(patch.text!==undefined&&patch.text!==w.text&&w.keywordTerm)candidate.keywordTerm=patch.text;
  Object.assign(w,candidate); return w;
}
export function insertWord(project,afterId,text) {
  if(!text.trim()||/\s/.test(text.trim())) throw Error('Enter one word.');
  const i=project.words.findIndex(w=>w.id===afterId), prev=project.words[i];
  const start=prev?round((prev.start+prev.end)/2):0;
  const end=prev?prev.end:(project.words[0]?.start||project.duration);
  if(end-start<.002) throw Error('Make a little room on the timeline first.');
  if(prev){prev.end=start;prev.reviewed=false;prev.timingSource='manual split';}
  const w={id:uid('word'),text:text.trim(),line:prev?.line||0,start,end,keyword:false,timingSource:'manual split',reviewed:false};
  project.words.splice(i+1,0,w); return w;
}
export function removeWord(project,id) {
  const i=project.words.findIndex(w=>w.id===id); if(i<0)return;
  project.archivedWords.push(...project.words.splice(i,1)); // artwork retained by ID
}
export function toggleKeyword(project,id) {
  const word=project.words.find(w=>w.id===id); if(word) word.keyword=!word.keyword;
}
export function setSectionBoundary(project,index,value) {
  const s=project.sections[index];
  if(index<1||value<=project.sections[index-1].start||value>=s.end) throw Error('Keep section boundaries in order.');
  s.start=round(value);project.sections[index-1].end=s.start;
  s.reviewed=project.sections[index-1].reviewed=false;
  s.source=project.sections[index-1].source='manual adjustment';
}
const safeId = x => typeof x==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(x)&&!['__proto__','constructor','prototype'].includes(x);
function finite(n,min,max){return Number.isFinite(n)&&n>=min&&n<=max;}
function checkDrawing(d) {
  if(!d||d.version!==2||d.isCompressed!==false||!finite(d.duration,0,86400)||!Array.isArray(d.strokes)||d.strokes.length>10000) throw Error('Unsupported drawing. Use uncompressed version 2 strokes.');
  for(const s of d.strokes){
    if(!['circle','square','spray'].includes(s.shape)||!/^#[0-9a-f]{6}$/i.test(s.color)||!finite(s.size,0,100)||!finite(s.start,0,86400)||!finite(s.duration,0,86400)||!Array.isArray(s.points)||s.points.length>100000) throw Error('Invalid drawing stroke.');
    for(const p of s.points)if(!Array.isArray(p)||!finite(p[0],0,1)||!Array.isArray(p[1])||!finite(p[1][0],-100,100)||!finite(p[1][1],-100,100)||!finite(p[2],0,100))throw Error('Invalid drawing point.');
  }
}
export function validateProject(p) {
  if(p?.schema!==SCHEMA||p.version!==1)throw Error('Choose a Song Studio project (version 1).');
  if(!safeId(p.id)||typeof p.title!=='string'||p.title.length>200||!finite(p.duration,.01,1200))throw Error('Invalid song name, ID, or duration (maximum 20 minutes).');
  if(!Array.isArray(p.words)||p.words.length>3000||!Array.isArray(p.archivedWords)||p.archivedWords.length>30000)throw Error('Invalid word list.');
  const ids=new Set();let end=0;
  for(const w of [...p.words,...p.archivedWords]) {
    if(!safeId(w.id)||ids.has(w.id)||typeof w.text!=='string'||!w.text.trim()||w.text.length>200||!Number.isInteger(w.line)||w.line<0||typeof w.keyword!=='boolean'||typeof w.reviewed!=='boolean'||typeof w.timingSource!=='string')throw Error('Invalid or repeated word ID.');
    ids.add(w.id);
  }
  for(const w of p.words){
    if(!finite(w.start,0,p.duration)||!finite(w.end,w.start+.0005,p.duration+.001)||w.start<end-.0001)throw Error('Word timings must be ordered, non-overlapping, and inside the song.');
    end=w.end;
  }
  if(!Array.isArray(p.sections)||!p.sections.length||p.sections.length>300)throw Error('Add at least one section.');
  end=0;const sectionIds=new Set();
  for(const s of p.sections){
    if(!safeId(s.id)||sectionIds.has(s.id)||typeof s.label!=='string'||s.label.length>100||!s.label.trim()||Math.abs(s.start-end)>.002||!finite(s.end,s.start+.0005,p.duration+.001)||typeof s.reviewed!=='boolean')throw Error('Sections must cover the song in order, without gaps.');
    sectionIds.add(s.id);end=s.end;
  }
  if(Math.abs(end-p.duration)>.002)throw Error('The last section must reach the end of the song.');
  if(!p.annotations||typeof p.annotations!=='object'||Array.isArray(p.annotations))throw Error('Invalid annotations.');
  for(const [id,a] of Object.entries(p.annotations)){
    if(!ids.has(id)||!a||typeof a.note!=='string'||a.note.length>10000||!/^#[0-9a-f]{6}$/i.test(a.background)||!['unison','timed'].includes(a.animation))throw Error('Invalid annotation.');
    checkDrawing(a.drawing);
    if(a.drawingHistory!==undefined){
      if(!Array.isArray(a.drawingHistory)||a.drawingHistory.length>1000)throw Error('Invalid drawing history.');
      a.drawingHistory.forEach(checkDrawing);
    }
  }
  if(!Array.isArray(p.tracks)||p.tracks.length>8)throw Error('Use at most 8 audio tracks.');
  const tids=new Set();for(const t of p.tracks){
    if(!safeId(t.id)||tids.has(t.id)||typeof t.name!=='string'||!finite(t.duration,.01,1200)||!finite(t.offset,-1200,1200)||!finite(t.volume,0,1)||typeof t.muted!=='boolean')throw Error('Invalid audio track.');
    if(t.data!==undefined&&!/^data:audio\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/.test(t.data))throw Error('Only embedded local audio is accepted.');
    tids.add(t.id);
  }
  if(p.tracks.length&&(p.tracks[0].offset!==0||Math.abs(p.tracks[0].duration-p.duration)>.01))throw Error('The lead track must begin at zero and match the song duration.');
  return p;
}
export function annotation(project,id) {
  return project.annotations[id] ||= {note:'',background:'#f9f5e9',animation:'timed',drawing:blankDrawing()};
}
export function formatLRC(t,angle=false) {
  const ms=Math.round(t*1000),minutes=Math.floor(ms/60000),seconds=Math.floor(ms/1000)%60;
  const stamp=`${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;
  return angle?`<${stamp}>`:`[${stamp}]`;
}
export function toLRC(p) {
  if(p.duration>=6000)throw Error('LRC supports at most 99 minutes.');
  let lastLine=-1,result='[re:Song Studio; word starts only; JSON preserves IDs and artwork]\n';
  for(const w of p.words){const newLine=w.line!==lastLine;result+=(newLine&&lastLine!==-1?'\n':'')+formatLRC(w.start,!newLine)+w.text+' ';lastLine=w.line;}
  return result.trimEnd()+'\n';
}
export function fromLRC(text,duration) {
  const words=[];let line=0;
  for(const raw of text.split(/\r?\n/)){
    const matches=[...raw.matchAll(/[<\[](\d{2}):(\d{2})\.(\d{2,3})[>\]]([^<>\[\]]*)/g)];
    if(!matches.length)continue;
    for(const m of matches){
      const tokens=m[4].trim().split(/\s+/).filter(Boolean);
      if(tokens.length!==1)throw Error('This LRC needs a timestamp before every word. Line-only LRC cannot supply word timings.');
      words.push({id:uid('word'),text:tokens[0],line,start:Number(m[1])*60+Number(m[2])+Number('0.'+m[3]),keyword:false,timingSource:'imported LRC; unreviewed',reviewed:false});
    }line++;
  }
  if(!words.length)throw Error('No word-timed lyrics found.');
  words.forEach((w,i)=>w.end=words[i+1]?.start??duration);return words;
}
// Convert word timestamps from local Whisper/WhisperX JSON. Never interpolate missing model timings.
export function fromTranscript(data,duration) {
  const segments=data.segments||[{words:data.word_segments||data.words}];let line=0,words=[];
  for(const s of segments){
    if(!Array.isArray(s.words))throw Error('This transcript has no word timings. Paste its text and tap the words instead.');
    for(const w of s.words){
      const text=(w.word||w.text||'').trim();
      if(!text||!finite(w.start,0,duration)||!finite(w.end,w.start+.0005,duration)||/\s/.test(text))throw Error('Some model words are untimed or invalid. Correct or split them before importing.');
      words.push({id:uid('word'),text,line,start:round(w.start),end:round(w.end),keyword:false,timingSource:'imported model estimate',reviewed:false});
    }line++;
  }
  if(!words.length)throw Error('The model returned no timed words.');return words;
}
export function toAnnotator(p) {
  validateProject(p);
  const slug=p.id;
  // One lyric event per word deliberately avoids text-based repeated-word splitting in the legacy lyrics UI.
  const events=p.words.map(w=>({type:'lyric',start:w.start,end:w.end,
    data:{text:w.text,wordId:w.id,line:w.line,timingSource:w.timingSource,reviewed:w.reviewed},
    events:w.keyword?[{type:'keyword',start:w.start,end:w.end,events:[],
      data:{term:w.keywordTerm||w.text,definition:p.annotations[w.id]?.definition||'',prompts:p.annotations[w.id]?.prompts||[],wordId:w.id,keywordId:`keyword-${w.id}`,annotationId:w.id}}]:[]}));
  const song={version:2,slug,title:p.title,composer:'',performer:'',credits:{artists:p.source?.artists||'Local creation',album:p.source?.album||'Song Studio'},
    duration:p.duration,audioURL:`${slug}/audio-0`,options:{loadEventsFrom:'_events.json',isSeparateLyricsBlocks:false},
    structure:p.sections.map(s=>({section:s.label,start:s.start,end:s.end,sectionId:s.id,reviewed:s.reviewed,source:s.source})),
    keywords:p.words.filter(w=>w.keyword).map(w=>({term:w.text,wordId:w.id,definition:'',prompts:[]}))};
  const session={version:2,sessionTitle:p.title,options:{songSlug:slug},drawings:{},drawingOverrides:{},backgrounds:{},notes:{},recordings:{},
    creator:{schema:SCHEMA,version:1,annotationsByWordId:clone(p.annotations),archivedWords:clone(p.archivedWords)}};
  // The legacy projection is disposable. The canonical stable-ID map above remains authoritative.
  for(const w of p.words.filter(w=>w.keyword)){
    const a=p.annotations[w.id];if(!a)continue;
    const key=legacyKey(w);
    session.drawingOverrides[key]={drawing:clone(a.drawing),background:a.background};
  }
  const catalog={app:'freshed-graffiti',version:'1.5',songs:[{slug,title:p.title}],prompts:[]};
  return {schema:'musedlab.annotator-bundle',version:1,catalog,song,events,session,project:clone(p),lrc:toLRC(p)};
}
export function legacyKey(w){return w.text.toLowerCase().replace(/[.,\-\/#!$%\^&\*;:{}=\-_`~()]/g,'').replace(/\s/g,'-')+'@'+Number(w.start).toFixed(3);}
export function importProject(value){return clone(validateProject(value.schema==='musedlab.annotator-bundle'?value.project:value));}
export function fixtureProject(){
  const p=createProject('Little sparks',16,{id:'track-fixture',name:'Generated melody · no vocals',duration:16,offset:0,volume:.65,muted:false,mime:'audio/wav',fixture:true});
  p.fixture=true;p.lyricsSource='invented fixture lyrics; not transcribed';
  setLyrics(p,'Little sparks light the sky\nWe can draw as we fly\nLittle sparks dance with me\nMake a world that we can see',p.lyricsSource);
  p.words.forEach((w,i)=>{w.start=round(.5+i*.5);w.end=round(w.start+.42);w.keyword=['sparks','sky','draw','dance','world'].includes(w.text);w.timingSource='synthetic fixture timing';});
  p.sections=[{id:uid('section'),label:'Verse',start:0,end:8,source:'fixture label',reviewed:false},{id:uid('section'),label:'Chorus',start:8,end:16,source:'fixture label',reviewed:false}];
  const a=annotation(p,p.words[1].id);a.note='A tiny spark can become a big idea.';
  a.drawing={version:2,isCompressed:false,duration:1,strokes:[{shape:'circle',color:'#eb7448',size:.45,start:0,duration:1,points:[[0,[.5,.18],.3],[.2,[.59,.42],.3],[.4,[.85,.45],.3],[.6,[.63,.6],.3],[.8,[.7,.85],.3],[1,[.5,.7],.3]]}]};
  return p;
}

// Refresh generated provenance labels in previously saved example projects.
export function normalizeSourceNames(p) {
  if(p.source?.kind!=='fresh-example')return p;
  const rename=value=>typeof value==='string'?value.replace(/F[R]esh/g,'Fresh Annotator'):value;
  p.lyricsSource=rename(p.lyricsSource);
  for(const w of [...(p.words||[]),...(p.archivedWords||[])])w.timingSource=rename(w.timingSource);
  for(const section of p.sections||[])section.source=rename(section.source);
  for(const a of Object.values(p.annotations||{}))if(a.drawingSource)a.drawingSource.kind=rename(a.drawingSource.kind);
  p.source.drawings=rename(p.source.drawings);
  return p;
}
