import * as M from './model.mjs';
import {decodeBlob} from './audio.mjs';

// One explicit public-catalog import. No remote session IDs, notes, or recordings.
export const EXAMPLE={slug:'proof-in-the-passage',title:'The Proof is in the Passage',
  base:'https://s3.amazonaws.com/musedlab-freshed/songs/',
  seed:'examples/proof-in-the-passage.drawings.json'};
const clean=s=>s.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,'').replace(/\s+/g,' ').trim();
const slug=s=>s.toLowerCase().replace(/\s/g,'-');
function color(value,fallback='#f9f5e9'){
  if(/^#[\da-f]{6}$/i.test(value))return value;
  const rgb=String(value).match(/^rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)$/);
  return rgb?'#'+rgb.slice(1).map(v=>Math.min(255,Number(v)).toString(16).padStart(2,'0')).join(''):fallback;
}
export function importFreshExample(song,lrc,seed,decompress,audioDuration=song.duration){
  if(song.slug!==EXAMPLE.slug||!Array.isArray(song.keywords)||!seed.drawings)throw Error('The Fresh Annotator example is unavailable or has changed.');
  const track={id:M.uid('track'),name:song.title,duration:M.round(audioDuration),offset:0,volume:1,muted:false,mime:'audio/mpeg'};
  const p=M.createProject(song.title,track.duration,track),chunks=[];
  lrc.split(/\r?\n/).forEach((raw,line)=>{
    for(const match of raw.matchAll(/[<\[](\d{2}):(\d{2})\.(\d{2,3})[>\]]([^<>\[\]]*)/g))
      chunks.push({text:match[4].trim(),line,start:M.round(Number(match[1])*60+Number(match[2])+Number('0.'+match[3]))});
  });
  chunks.forEach((chunk,i)=>{
    if(!chunk.text)return;
    const keyword=song.keywords.find(k=>clean(k.term)===clean(chunk.text));
    const phrase=/\s/.test(chunk.text),word={id:M.uid('word'),...chunk,end:chunks[i+1]?.start??song.duration,
      keyword:!!keyword,reviewed:false,sourceUnit:phrase?'phrase':'word',
      timingSource:phrase?'Fresh Annotator phrase boundary; internal word times unavailable':'imported Fresh Annotator word timing'};
    if(keyword)word.keywordTerm=keyword.term;
    p.words.push(word);
    if(keyword){
      const key=slug(keyword.term),stored=seed.drawings[key],a=M.annotation(p,word.id);
      a.definition=keyword.definition||'';a.prompts=M.clone(keyword.prompts||[]);
      if(stored){
        const drawing=stored.isCompressed?decompress(M.clone(stored)):M.clone(stored);
        drawing.strokes.forEach(s=>s.color=color(s.color,'#000000'));
        // Historical seeds have duration=0 with nonzero stroke times. Preserve all
        // stroke geometry/timing; complete the duration and retain Fresh Annotator's unison mode.
        drawing.duration=Math.max(drawing.duration,...drawing.strokes.map(s=>s.start+s.duration));
        a.drawing=drawing;a.background=color(seed.backgrounds?.[key]);a.animation='unison';
        a.drawingSource={kind:'recovered Fresh Annotator default',key,authorshipVerified:false};
      }
    }
  });
  if(!p.words.length)throw Error('The Fresh Annotator example has no readable lyric timings.');
  p.sections=song.structure.map((s,i)=>({id:M.uid('section'),label:s.section+(s.count?' '+s.count:''),start:s.start,end:s.end,source:'imported Fresh Annotator section',reviewed:false}));
  const catalogEnd=p.sections.at(-1).end;
  if(p.duration>catalogEnd+.002)p.sections.push({id:M.uid('section'),label:'Audio tail',start:catalogEnd,end:p.duration,source:'audio continues after the original Fresh Annotator sections',reviewed:false});
  p.lyricsSource='original Fresh Annotator word and phrase timings; unreviewed';
  p.source={kind:'fresh-example',slug:song.slug,title:song.title,artists:song.credits?.artists||'',album:song.credits?.album||'',
    metadataURL:EXAMPLE.base+song.slug+'/'+song.slug+'.json',lyricsURL:EXAMPLE.base+song.slug+'/'+song.slug+'.lrc',audioURL:EXAMPLE.base+song.audioURL,
    drawings:'Recovered default drawings already approved for the Fresh Annotator restoration; authorship and unchanged historical state unverified.',
    phraseUnits:p.words.filter(w=>w.sourceUnit==='phrase').length,catalogDuration:song.duration};
  return M.validateProject(p);
}
export async function loadFreshExample(decompress){
  const root=EXAMPLE.base+EXAMPLE.slug+'/'+EXAMPLE.slug;
  async function get(url,type){
    const response=await fetch(url,{credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(45000)});
    if(!response.ok)throw Error('Could not load the public Fresh Annotator example. Please try again.');
    return response[type]();
  }
  const [song,lrc,seed,audio]=await Promise.all([get(root+'.json','json'),get(root+'.lrc','text'),get(EXAMPLE.seed,'json'),get(root+'.mp3','blob')]);
  const buffer=await decodeBlob(audio);
  return {project:importFreshExample(song,lrc,seed,decompress,buffer.duration),audio};
}
