(function(root){
'use strict';
// Original PNG artwork; scene selection, motion and beat coupling are reconstructed.
function frameState(beat,playing,reduced=false){
 const b=playing&&!reduced?Math.max(0,Number.isFinite(beat)?beat:0):0;
 const scene=Math.floor(b/8)%4,phase=(b%2)/2;
 const frame=scene===0?Math.floor(b*6)%12:Math.round((1-Math.abs(phase*2-1))*20);
 return {scene,frame,beat:b};
}
function create(canvas,assets){
 const images=assets.groups.map(g=>{const i=new Image();i.src=g.image;return i;});
 const bg=new Image();bg.src=assets.background;
 let last=null;
 function draw(beat,playing,reduced=false){
  const s=frameState(beat,playing,reduced),ratio=Math.min(3,root.devicePixelRatio||1);
  if(canvas.width!==Math.round(80*ratio)||canvas.height!==Math.round(60*ratio)){canvas.width=Math.round(80*ratio);canvas.height=Math.round(60*ratio);}
  const c=canvas.getContext('2d');c.setTransform(canvas.width/80,0,0,canvas.height/60,0,0);c.clearRect(0,0,80,60);
  c.fillStyle='#5544ad';c.fillRect(0,0,80,60);
  if(bg.complete&&bg.naturalWidth)c.drawImage(bg,0,0,80,60);
  const g=assets.groups[s.scene],im=images[s.scene],f=g.frames[s.frame];
  if(im.complete&&im.naturalWidth&&f){
   const [x,y,w,h]=f.atlas_rect;
   c.drawImage(im,x,y,w,h,16,6,48,48);
   if(playing&&!reduced){c.globalAlpha=.55;const k=g.frames[(s.frame+Math.floor(g.frames.length/2))%g.frames.length];c.drawImage(im,...k.atlas_rect,2+Math.sin(s.beat)*3,4,22,22);c.drawImage(im,...k.atlas_rect,55+Math.cos(s.beat)*3,34,22,22);c.globalAlpha=1;}
  }
  last=s;return s;
 }
 images.forEach(i=>i.onload=()=>{if(last)draw(last.beat,false);});
 return {draw,getState:()=>last};
}
const api={frameState,create};if(typeof module!=='undefined')module.exports=api;else root.XPressVision=api;
})(typeof window!=='undefined'?window:globalThis);
