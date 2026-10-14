// Local, rule-based sketches in Annotator's native timed-stroke format.
// No image service, model, downloaded images, or text-based artwork remapping.
import {annotation,clone,round} from './model.mjs';

export const concepts=[
  ['star','Star'],['sun','Sun'],['moon','Moon'],['cloud','Cloud'],['rain','Rain'],
  ['heart','Heart'],['flower','Flower'],['tree','Tree'],['mountain','Mountains'],
  ['water','Waves'],['house','Home'],['bird','Bird'],['music','Music note'],
  ['book','Book'],['pencil','Pencil'],['globe','World'],['dance','Dancer'],
  ['cat','Cat'],['dog','Dog'],['fish','Fish'],['bolt','Lightning'],['smile','Smile']
];
const vocabulary={
  star:'star stars spark sparks sparkle sparkles sparkling glimmer glimmers shine shining twinkle wish wishes magic bright',
  sun:'sun sunshine sunlight sunny light lights day morning warm warmth yellow',
  moon:'moon moonlight lunar night nighttime dream dreams dreaming sleep',
  cloud:'cloud clouds cloudy sky skies air wind breeze float floating',
  rain:'rain rainy raining raindrop raindrops storm drizzle weather',
  heart:'heart hearts love loves loving loved kindness kind care caring friend friends friendship together',
  flower:'flower flowers bloom blooms blooming blossom garden gardens beautiful beauty',
  tree:'tree trees leaf leaves forest forests grow grows growing green nature',
  mountain:'mountain mountains hill hills climb climbing tall high adventure',
  water:'water wave waves sea ocean river rivers lake lakes stream streams blue',
  house:'house houses home homes family families shelter',
  bird:'bird birds fly flies flying flight wing wings freedom free',
  music:'music song songs sing sings singing sound sounds melody rhythm tune tunes listen hear',
  book:'book books read reads reading learn learns learning story stories words word school',
  pencil:'pencil pencils draw draws drawing art paint paints painting create creative write writing',
  globe:'world worlds earth planet planets globe round around geography',
  dance:'dance dances dancer dancers dancing move moves moving jump jumping play playing',
  cat:'cat cats kitten kittens kitty meow',dog:'dog dogs puppy puppies woof',
  fish:'fish fishes swim swims swimming underwater',bolt:'lightning thunder electric electricity energy power',
  smile:'smile smiles smiling happy happiness joy joyful laugh laughs laughing fun'
};
export function matchConcept(text){
  const word=String(text).normalize('NFKC').toLocaleLowerCase('en').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,'').replace(/['’]s$/,'');
  return Object.entries(vocabulary).find(([,words])=>words.split(' ').includes(word))?.[0]||null;
}
const arc=(x,y,rx,ry,start=0,end=Math.PI*2,n=50)=>Array.from({length:n+1},(_,i)=>[x+Math.cos(start+(end-start)*i/n)*rx,y+Math.sin(start+(end-start)*i/n)*ry]);
function pathsFor(kind,variant){
  const p=[];const line=(...points)=>p.push(points),curve=(...args)=>p.push(arc(...args));
  switch(kind){
    case 'star':{
      const n=variant%2?4:5,pts=[];for(let i=0;i<=n*2;i++){const a=-Math.PI/2+i*Math.PI/n,r=i%2?.15:.34;pts.push([.5+Math.cos(a)*r,.5+Math.sin(a)*r]);}p.push(pts);
      if(variant%3===2){line([.14,.16],[.14,.28]);line([.08,.22],[.2,.22]);}break;
    }
    case 'sun':curve(.5,.5,.19,.19);for(let i=0;i<8;i++){const a=i*Math.PI/4;line([.5+Math.cos(a)*.27,.5+Math.sin(a)*.27],[.5+Math.cos(a)*.36,.5+Math.sin(a)*.36]);}break;
    case 'moon':curve(.49,.47,.31,.33,.45*Math.PI,1.65*Math.PI);curve(.65,.36,.24,.26,.56*Math.PI,1.65*Math.PI);break;
    case 'cloud':line([.25,.63],[.2,.62]);curve(.24,.51,.13,.12,Math.PI*.5,Math.PI*1.5);curve(.45,.43,.19,.2,Math.PI,Math.PI*2);curve(.7,.51,.14,.13,-Math.PI*.55,Math.PI*.5);line([.7,.64],[.25,.64]);break;
    case 'rain':p.push(...pathsFor('cloud',0).map(points=>points.map(([x,y])=>[x,y-.13])));for(let i=0;i<4;i++)line([.28+i*.14,.63],[.24+i*.14,.77]);break;
    case 'heart':{
      const points=[];for(let i=0;i<=100;i++){const t=i*Math.PI*2/100;points.push([.5+Math.pow(Math.sin(t),3)*.33,.49-(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))*.023]);}p.push(points);break;
    }
    case 'flower':
      for(let i=0;i<6;i++){const a=i*Math.PI/3;curve(.5+Math.cos(a)*.15,.37+Math.sin(a)*.15,.095,.095);}
      curve(.5,.37,.075,.075);line([.5,.57],[.5,.87]);line([.5,.73],[.34,.64],[.34,.74],[.5,.79]);break;
    case 'tree':curve(.36,.35,.17,.17,Math.PI*.5,Math.PI*1.8);curve(.54,.3,.17,.17,Math.PI*1.1,Math.PI*2);curve(.68,.4,.14,.16,Math.PI*1.45,Math.PI*2.6);line([.64,.55],[.36,.55]);line([.45,.56],[.43,.84],[.6,.84],[.57,.56]);break;
    case 'mountain':line([.13,.8],[.39,.2],[.68,.8]);line([.52,.54],[.66,.3],[.89,.8],[.13,.8]);line([.3,.41],[.4,.47],[.49,.42]);break;
    case 'water':for(let j=0;j<3;j++)p.push(Array.from({length:60},(_,i)=>[.13+i*.74/59,.34+j*.16+Math.sin(i/59*Math.PI*4+variant*.5)*.045]));break;
    case 'house':line([.13,.46],[.5,.16],[.86,.46]);line([.23,.4],[.23,.83],[.78,.83],[.78,.4]);line([.43,.83],[.43,.58],[.6,.58],[.6,.83]);line([.29,.49],[.37,.49],[.37,.59],[.29,.59],[.29,.49]);break;
    case 'bird':curve(.49,.51,.24,.14,0,Math.PI*1.8);curve(.66,.35,.1,.1,Math.PI*.4,Math.PI*2);line([.75,.33],[.86,.38],[.74,.41]);line([.25,.51],[.12,.36],[.2,.59],[.29,.6]);line([.4,.43],[.47,.56],[.58,.48]);line([.65,.32],[.66,.32]);break;
    case 'music':line([.4,.69],[.4,.23],[.72,.17],[.72,.61]);line([.4,.33],[.72,.27]);curve(.32,.72,.095,.065);curve(.64,.65,.095,.065);break;
    case 'book':line([.5,.28],[.23,.18],[.15,.2],[.15,.75],[.25,.73],[.5,.82],[.76,.73],[.85,.75],[.85,.2],[.76,.18],[.5,.28],[.5,.82]);line([.24,.37],[.41,.43]);line([.24,.49],[.41,.55]);line([.6,.43],[.77,.37]);break;
    case 'pencil':line([.19,.81],[.25,.59],[.65,.19],[.8,.34],[.4,.74],[.19,.81]);line([.25,.59],[.4,.74]);line([.59,.25],[.74,.4]);line([.32,.66],[.67,.32]);line([.15,.86],[.71,.86]);break;
    case 'globe':curve(.5,.5,.33,.33);curve(.5,.5,.14,.33);curve(.5,.5,.33,.12);line([.17,.5],[.83,.5]);break;
    case 'dance':curve(.5,.24,.095,.095);line([.5,.35],[.49,.59],[.28,.82]);line([.49,.59],[.73,.78]);line([.48,.45],[.29,.48],[.2,.31]);line([.5,.44],[.7,.33],[.75,.18]);break;
    case 'cat':line([.23,.43],[.2,.17],[.4,.3]);line([.6,.3],[.8,.17],[.77,.43]);curve(.5,.53,.28,.25,-Math.PI*.2,Math.PI*1.2);line([.35,.47],[.36,.47]);line([.64,.47],[.65,.47]);line([.46,.56],[.54,.56],[.5,.6],[.46,.56]);line([.5,.6],[.43,.66]);line([.5,.6],[.57,.66]);for(const y of [.56,.64]){line([.29,y],[.12,y-.04]);line([.71,y],[.88,y-.04]);}break;
    case 'dog':curve(.5,.5,.23,.28);line([.3,.28],[.16,.3],[.12,.6],[.24,.64],[.31,.39]);line([.7,.28],[.84,.3],[.88,.6],[.76,.64],[.69,.39]);line([.39,.43],[.4,.43]);line([.6,.43],[.61,.43]);line([.43,.58],[.57,.58],[.5,.65],[.43,.58]);curve(.5,.68,.1,.05,0,Math.PI);break;
    case 'fish':curve(.45,.5,.27,.19);line([.7,.44],[.88,.28],[.88,.73],[.7,.56]);line([.32,.44],[.33,.44]);line([.45,.32],[.54,.22],[.61,.36]);break;
    case 'bolt':line([.56,.13],[.24,.57],[.47,.57],[.4,.89],[.78,.4],[.55,.4],[.56,.13]);break;
    case 'smile':curve(.5,.5,.32,.32);curve(.38,.43,.015,.025);curve(.62,.43,.015,.025);curve(.5,.53,.18,.16,.1*Math.PI,.9*Math.PI);break;
    default:throw Error('Choose a picture for this word.');
  }return p;
}
function seedNumber(text){let h=2166136261;for(const c of text)h=Math.imul(h^c.codePointAt(0),16777619);return h>>>0;}
function strokeFromPath(path,start,color,variant,seed,index){
  const points=[path[0]];
  for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i],n=Math.max(2,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.015));
    for(let j=1;j<=n;j++)points.push([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n]);
  }
  const length=points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-points[i][0],p[1]-points[i][1]),0),duration=round(Math.max(.18,length*1.6));
  const angle=(variant%3-1)*.035,scale=variant%2?.94:1;
  return {shape:'circle',size:.05,color,start,duration,points:points.map(([x,y],i)=>{
    const wobble=Math.sin(i*.43+(seed%97)+index)*.0017,dx=(x-.5)*scale,dy=(y-.5)*scale;
    return [i/(points.length-1),[.5+dx*Math.cos(angle)-dy*Math.sin(angle)+wobble,.5+dx*Math.sin(angle)+dy*Math.cos(angle)+wobble],.3];
  })};
}
export function suggestDrawing(word,{concept=matchConcept(word.text),variant=0,color='#eb7448'}={}){
  if(!concept)return null;if(!/^#[0-9a-f]{6}$/i.test(color))throw Error('Choose a valid ink color.');
  const paths=pathsFor(concept,variant),seed=seedNumber(word.id),strokes=[];let time=0;
  paths.forEach((path,i)=>{const stroke=strokeFromPath(path,round(time),color,variant,seed,i);strokes.push(stroke);time+=stroke.duration+.04;});
  return {concept,label:concepts.find(([id])=>id===concept)[1],word:word.text,variant,
    source:'local drawing template',drawing:{version:2,isCompressed:false,duration:round(time),strokes}};
}
export function useSuggestion(project,wordId,suggestion){
  if(!project.words.some(w=>w.id===wordId)||!suggestion)throw Error('Choose a word and a drawing first.');
  const a=annotation(project,wordId);
  if(a.drawing.strokes.length){a.drawingHistory ||= [];if(a.drawingHistory.length>=1000)throw Error('Drawing history is full. Save a project copy first.');a.drawingHistory.push(clone(a.drawing));}
  a.drawing=clone(suggestion.drawing);a.drawingSuggestion={source:suggestion.source,concept:suggestion.concept,word:suggestion.word,variant:suggestion.variant};
  return a;
}
export function restoreDrawing(project,wordId){
  const a=project.annotations[wordId];if(!a?.drawingHistory?.length)throw Error('No previous drawing for this word.');
  a.drawing=a.drawingHistory.pop();delete a.drawingSuggestion;
}
export function sketchEmptyKeywords(project){
  const result={added:0,kept:0,unmatched:[]};
  for(const word of project.words.filter(w=>w.keyword)){
    if(project.annotations[word.id]?.drawing.strokes.length){result.kept++;continue;}
    const suggestion=suggestDrawing(word);
    if(suggestion){useSuggestion(project,word.id,suggestion);result.added++;}else result.unmatched.push(word.text);
  }return result;
}
