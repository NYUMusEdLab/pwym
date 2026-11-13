// Minimal staff pitch cards, not a facsimile or full score engraving.
export function staffCard(pitch,spelling,duration){
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 52 72');svg.setAttribute('aria-label',`${spelling||pitch}, ${duration} quarter-note units`);svg.style.width='48px';svg.style.height='66px';
 const add=(tag,a,text)=>{const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(a))e.setAttribute(k,v);if(text)e.textContent=text;svg.append(e);};
 const parsed=/^([A-G])([#b-]*)(\d)$/.exec(spelling||'');const steps={C:0,D:1,E:2,F:3,G:4,A:5,B:6};const fallback=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][((pitch%12)+12)%12]+(Math.floor(pitch/12)-1);const s=parsed||/^([A-G])([#b-]*)(\d)$/.exec(fallback);const high=pitch>=84;const degree=steps[s[1]]+Number(s[3])*7-(high?7:0);const bass=pitch<55,baseline=bass?18:30,y=48-(degree-baseline)*3;
 for(let i=0;i<5;i++)add('line',{x1:3,x2:49,y1:48-i*6,y2:48-i*6,stroke:'#7b8d7c','stroke-width':.7});
 add('text',{x:0,y:29,'font-size':18},bass?'𝄢':'𝄞');
 if(high)add('text',{x:7,y:12,'font-size':7},'8');for(let yy=54;yy<=y;yy+=6)add('line',{x1:22,x2:39,y1:yy,y2:yy,stroke:'#456'});
 for(let yy=18;yy>=y;yy-=6)add('line',{x1:22,x2:39,y1:yy,y2:yy,stroke:'#456'});
 add('ellipse',{cx:30,cy:y,rx:4.7,ry:3,fill:duration>=2?'white':'#173c2d',stroke:'#173c2d','stroke-width':1.3,transform:`rotate(-20 30 ${y})`});
 if(duration<4)add('line',{x1:34,x2:34,y1:y,y2:y-20,stroke:'#173c2d','stroke-width':1});
 if(duration<1){const flags=Math.max(1,Math.round(Math.log2(1/duration)));for(let j=0;j<flags;j++)add('path',{d:`M34 ${y-20+j*4}q11 7 2 13`,fill:'none',stroke:'#173c2d'});}if([.375,.75,1.5,3,6].includes(duration))add('circle',{cx:40,cy:y,r:1.1,fill:'#173c2d'});
 if(s[2])add('text',{x:17,y:y+4,'font-size':12},s[2].replace(/#/g,'♯').replace(/[-b]/g,'♭'));
 return svg;
}
