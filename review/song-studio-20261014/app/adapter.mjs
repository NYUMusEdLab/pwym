import {toAnnotator,clone} from './model.mjs';
import {suggestDrawing} from './doodles.mjs';
import {illustrationAt} from './visual-state.mjs';
// This harness deliberately runs the original SongLoader and Timing classes.
// Only transport and annotation lookup are adapted for local, permanent word IDs.
export async function loadThroughAnnotator(bundle){
  const {SongLoader,Util}=window.Annotator;
  const slug=bundle.song.slug,files={
    'local/default-songset.json':bundle.catalog,
    [`local/${slug}/${slug}.json`]:bundle.song,
    [`local/${slug}/${slug}_events.json`]:bundle.events
  };
  const original=Util.get;
  Util.get=url=>url in files?Promise.resolve(JSON.stringify(files[url])):Promise.reject(Error('Harness refused nonlocal asset: '+url));
  try{const loader=new SongLoader({assetBase:'local/'});await loader.init();return await loader.findAndLoadSong(slug);}finally{Util.get=original;}
}
export class Preview {
  constructor(audio,canvasParent,onKeyword,onLyric){
    this.audio=audio;this.onKeyword=onKeyword;this.onLyric=onLyric;
    this.graffiti=new window.Annotator.Graffiti(560,300,canvasParent);
    this.parent=canvasParent;
  }
  async load(project,importedBundle=null){
    this.project=project;const expected=toAnnotator(project);
    if(importedBundle){
      if(importedBundle.schema!=='musedlab.annotator-bundle'||importedBundle.version!==1||
        JSON.stringify(importedBundle.events)!==JSON.stringify(expected.events)||
        JSON.stringify(importedBundle.catalog)!==JSON.stringify(expected.catalog)||
        JSON.stringify({...importedBundle.song,audioURL:expected.song.audioURL})!==JSON.stringify(expected.song)||
        JSON.stringify(importedBundle.session)!==JSON.stringify(expected.session))
        throw Error('The bundle and its canonical project disagree. Re-export from Song Studio.');
    }
    this.bundle=clone(importedBundle||expected);this.song=await loadThroughAnnotator(this.bundle);
    this.timing=new window.Annotator.Timing();
    // Avoid the original attachMedia listener accumulating each time an edit recompiles events.
    this.timing._mediaSync=this.audio;
    this.timing.setEventCallback('lyric',e=>this.onLyric(e),()=>this.onLyric(null));
    this.timing.setEventCallback('keyword',e=>{this.active=e;},e=>{if(this.active===e)this.active=null;});
    this.timing.addEvents(this.song.events,'song');this.active=null;
    this.intro=suggestDrawing({id:'intro-music',text:'music'},{concept:'music',color:'#387257'}).drawing;
    this.visualKey=null;this.visualProgress=null;this.tick();
  }
  tick(){
    this.timing?._updateEvents();if(!this.project)return;
    const visual=illustrationAt(this.project,this.audio.currentTime||0),key=visual?.word.id||'intro',progress=visual?.progress??1;
    if(key===this.visualKey&&progress===this.visualProgress)return;
    if(key!==this.visualKey){
      this.graffiti.drawing=clone(visual?.annotation.drawing||this.intro);
      this.graffiti.playbackMode=visual?.annotation.animation||'timed';
      this.parent.style.background=visual?.annotation.background||'#f9f5e9';
      this.graffiti.canvas.setAttribute('aria-label',visual?`Drawing for ${visual.word.text}`:'Intro illustration: music note');
      this.onKeyword(visual?{data:{wordId:visual.word.id}}:null);
    }
    this.visualKey=key;this.visualProgress=progress;this.graffiti.draw(progress);
  }
}
