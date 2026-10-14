// Pure review operations, shared by the browser and tests. Keep model output as evidence.
export const clone=x=>structuredClone(x);
export function openAnalysis(input){
  if(input?.schema!=='musedlab.song-timings'||input.version!==1||!Number.isFinite(input.duration)||input.duration<=0||input.duration>601||!Array.isArray(input.words)||!input.words.length||input.words.length>3000||!Array.isArray(input.sections)||input.sections.length>20)throw Error('Choose a timing-service JSON result or a saved correction draft.');
  if(!/^[a-f0-9]{64}$/.test(input.audioSha256||''))throw Error('This result has no valid audio fingerprint.');
  for(const w of input.words)if(typeof w.text!=='string'||!w.text.trim()||/\s/.test(w.text)||w.text.length>200||!Number.isInteger(w.line)||w.line<0)throw Error('The result contains invalid lyric words.');
  for(const s of input.sections)if(typeof s.label!=='string'||s.label.length>100)throw Error('The result contains an invalid section label.');
  if(input.originalAnalysis&&(!Array.isArray(input.originalAnalysis.words)||!Array.isArray(input.originalAnalysis.sections)))throw Error('This correction draft has an invalid original analysis.');
  const d=clone(input);
  d.originalAnalysis ||= {words:clone(d.words),sections:clone(d.sections),engine:clone(d.engine)};
  d.words.forEach((w,i)=>{w.reviewId ||= `original-${i}`;w.issues=Array.isArray(w.issues)?w.issues:[];w.reviewed=w.reviewed===true;});
  d.reflection ||= '';return d;
}
export function problems(d){
  const words=d.words.map((w,i)=>{
    const errors=[];
    if(!Number.isFinite(w.start)||!Number.isFinite(w.end))errors.push('Needs a start and end');
    else{
      if(w.start<0||w.end>d.duration+.001||w.end<=w.start)errors.push('Check start and end');
      for(let j=i+1;j<d.words.length;j++)if(Number.isFinite(d.words[j].start)){if(w.end>d.words[j].start+.0001)errors.push('Overlaps the next word');break;}
      // Compare with nearest prior timed word even when an intervening word is missing.
      for(let j=i-1;j>=0;j--)if(Number.isFinite(d.words[j].end)){if(w.start<d.words[j].end-.0001)errors.push('Overlaps the previous word');break;}
    }
    return {index:i,errors,attention:errors.length>0||!w.reviewed};
  });
  const sections=[];let end=0;
  if(!d.sections.length)sections.push('Add at least one section.');
  d.sections.forEach((s,i)=>{if(!s.label.trim()||!Number.isFinite(s.start)||!Number.isFinite(s.end)||Math.abs(s.start-end)>.002||s.end<=s.start||s.end>d.duration+.001)sections.push(`Check section ${i+1}`);end=s.end;});
  if(Math.abs(end-d.duration)>.002)sections.push('Sections must cover the whole song.');
  return {words,sections,invalidWords:words.filter(w=>w.errors.length).length,remaining:words.filter(w=>w.attention).length};
}
export function editWord(d,index,patch){
  const w=d.words[index];if(!w)throw Error('Choose a word.');
  if(patch.text!==undefined&&(!patch.text.trim()||/\s/.test(patch.text.trim())||patch.text.length>200))throw Error('Use one word. Choose Add word to insert another.');
  for(const k of ['start','end'])if(k in patch&&patch[k]!==null&&(!Number.isFinite(patch[k])||patch[k]<0||patch[k]>d.duration))throw Error('Use a time within the song.');
  if(Object.entries(patch).every(([key,value])=>w[key]===value))return;
  Object.assign(w,patch);w.reviewed=false;w.timingSource='student-corrected timing';w.edited=true;
}
export function addWord(d,index,text){
  if(d.words.length>=3000)throw Error('This pilot supports up to 3,000 words.');
  if(!text?.trim()||/\s/.test(text.trim())||text.length>200)throw Error('Enter one word to add.');
  d.words.splice(index,0,{reviewId:`added-${crypto.randomUUID()}`,text:text.trim(),line:d.words[index]?.line??d.words.at(-1)?.line??0,start:null,end:null,issues:['added_by_student'],reviewed:false,edited:true,timingSource:'student-added word'});
}
export function removeWord(d,index){if(d.words.length<=1)throw Error('Keep at least one lyric word.');d.removedWords ||= [];d.removedWords.push(clone(d.words[index]));d.words.splice(index,1);}
export function markReviewed(d,index){const issue=problems(d).words[index];if(issue.errors.length)throw Error(issue.errors.join('. ')+'.');d.words[index].reviewed=true;}
export function editSection(d,index,label,start){
  const s=d.sections[index];if(!s)throw Error('Choose a section.');
  if(!label.trim()||label.length>100)throw Error('Give this section a short name.');
  if(index===0&&start!==0)throw Error('The first section starts at zero.');
  if(!Number.isFinite(start)||start<0||start>=s.end||(index>0&&start<=d.sections[index-1].start))throw Error('Keep this boundary between its neighboring sections.');
  s.label=label.trim();s.start=start;s.reviewed=true;s.source='student-reviewed section';
  if(index>0){d.sections[index-1].end=start;d.sections[index-1].reviewed=false;}
}
export function output(d,{draft=false}={}){
  const p=problems(d);if(!draft&&(p.invalidWords||p.sections.length))throw Error('Fix the missing or invalid timings before exporting for Song Studio.');
  const out=clone(d);out.words.forEach((w,i)=>w.index=i);
  out.review={...out.review,required:p.remaining>0,untimedWords:out.words.filter(w=>!Number.isFinite(w.start)||!Number.isFinite(w.end)).length,flaggedWords:p.remaining,reviewedWords:out.words.filter(w=>w.reviewed).length};
  out.studentReview={version:1,draft,updatedAt:new Date().toISOString(),editedWords:out.words.filter(w=>w.edited).length,reflection:out.reflection};
  return out;
}
