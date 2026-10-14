import {clone,uid,validateProject} from './model.mjs';
export function inspectTimings(data,project){
  if(data.schema!=='musedlab.song-timings'||data.version!==1||!Array.isArray(data.words)||!data.words.length||data.words.length>3000)throw Error('Unsupported timing-service result.');
  if(!Number.isFinite(data.duration)||Math.abs(data.duration-project.duration)>.15)throw Error('This result has a different audio duration. Open the original audio first.');
  let end=0,missing=0;
  for(const w of data.words){
    if(typeof w.text!=='string'||!w.text.trim()||/\s/.test(w.text)||!Number.isInteger(w.line)||w.line<0)throw Error('Invalid lyric word in timing result.');
    if(w.start===null&&w.end===null){missing++;continue;}
    if(!Number.isFinite(w.start)||!Number.isFinite(w.end)||w.start<end-.0001||w.end<=w.start||w.end>data.duration+.001)throw Error('Invalid or overlapping timing result.');
    end=w.end;
  }
  if(!Array.isArray(data.sections)||!data.sections.length||data.sections.length>20)throw Error('Invalid section results.');
  end=0;
  for(const s of data.sections){if(typeof s.label!=='string'||s.label.length>100||!Number.isFinite(s.start)||!Number.isFinite(s.end)||Math.abs(s.start-end)>.002||s.end<=s.start||s.end>data.duration+.001)throw Error('Invalid section boundary.');end=s.end;}
  if(Math.abs(end-project.duration)>.15)throw Error('Sections do not cover the audio.');
  const matches=project.words.length===data.words.length&&project.words.every((w,i)=>w.text===data.words[i].text);
  return {matches,missing,count:data.words.length,sections:data.sections.length};
}
export function applyTimings(project,data,{words=true,sections=false,replace=false}={}){
  const info=inspectTimings(data,project),p=clone(project);
  if(words){
    if(info.missing)throw Error('Some words have no valid timing. Apply sections only, or correct and rerun alignment.');
    if(!info.matches&&!replace&&p.words.length)throw Error('Lyrics differ. Explicitly choose to archive and replace the existing words.');
    if(!info.matches){p.archivedWords.push(...p.words);p.words=data.words.map(w=>({id:uid('word'),text:w.text,line:w.line,keyword:false}));}
    p.words.forEach((w,i)=>Object.assign(w,{start:data.words[i].start,end:Math.min(data.words[i].end,p.duration),timingSource:'Fresh Annotator alignment estimate',reviewed:false}));
    p.lyricsSource='Fresh Annotator timing service; unreviewed';
  }
  if(sections){p.sections=data.sections.map(s=>({id:uid('section'),label:s.label,start:s.start,end:s.end,source:'Fresh Annotator section estimate',reviewed:false}));p.sections.at(-1).end=p.duration;}
  p.timingAnalysis={engine:clone(data.engine),audioSha256:data.audioSha256,review:clone(data.review)};
  return validateProject(p);
}
