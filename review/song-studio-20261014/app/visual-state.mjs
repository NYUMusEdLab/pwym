// Recompute from the timeline so backward seeks and jumps cannot retain future artwork.
export function illustrationAt(project,time){
  let word=null;
  for(const w of project.words){if(w.start>time)break;if(w.keyword&&project.annotations[w.id]?.drawing?.strokes?.length)word=w;}
  return word?{word,annotation:project.annotations[word.id],progress:time>=word.end?1:Math.max(.05,Math.min(1,(time-word.start)/(word.end-word.start)))}:null;
}
