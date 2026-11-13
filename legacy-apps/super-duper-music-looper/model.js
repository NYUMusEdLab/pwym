(function(root){
const definitions=[
 ['HipHop Beat 43','#d3646c',[[32,104]],.30,'drums'],
 ['HipHop Beat 44','#d3646c',[[96,104]],.32,'drums'],
 ['HipHop Turn 06','#d3646c',[[46,47],[78,79]],.32,'tom'],
 ['Shaker','#47b946',[[64,104]],.23,'shaker'],
 ['Synth Bass 61','#7878c9',[[48,104]],.32,'bass'],
 ['Acoustic Strumming 07','#55da53',[[0,104]],.24,'guitar'],
 ['Piano 06','#ce7373',[[0,104]],.40,'piano'],
 ['Piano 07','#ce7373',[[16,48],[80,104]],.70,'piano2'],
 ['Rock-Pop 13 Strings 02','#6f9b59',[],.43,'strings'],
 ['Sound Effect 06','#63d157',[[32,46]],.23,'fx']
];
function initial(){return {version:1,tempo:100,key:0,master:1,tracks:definitions.map(([name,color,regions,volume,kind])=>({name,color,regions:regions.map(r=>r.slice()),volume,kind})),actions:[],decisions:[]};}
function edit(regions,start,end,erase=false){start=Math.max(0,Math.floor(start));end=Math.max(start+1,Math.ceil(end));if(erase){return regions.flatMap(([a,b])=>b<=start||a>=end?[[a,b]]:[[a,Math.min(b,start)],[Math.max(a,end),b]].filter(([x,y])=>y>x));}let all=[...regions.map(x=>x.slice()),[start,end]].sort((a,b)=>a[0]-b[0]),out=[];for(const [a,b] of all){let last=out[out.length-1];if(last&&a<=last[1])last[1]=Math.max(last[1],b);else out.push([a,b]);}return out;}
function endBeat(s){return Math.max(4,...s.tracks.flatMap(t=>t.regions.map(r=>r[1])));}
function active(t,beat){return t.regions.some(([a,b])=>beat>=a&&beat<b);}
const api={initial,edit,endBeat,active,definitions};if(typeof module!=='undefined')module.exports=api;else root.LooperModel=api;
})(typeof window!=='undefined'?window:globalThis);
