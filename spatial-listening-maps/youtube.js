// Official embedded player only: no media extraction, audio routing or token geometry.
export function parseYouTubeURL(input) {
  let url;
  try { url = new URL(input.trim()); } catch { throw new Error('Paste a full YouTube video link, such as https://www.youtube.com/watch?v=…'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) throw new Error('Use a standard YouTube video link.');
  const host = url.hostname.toLowerCase();
  let id = null;
  if (['youtu.be','www.youtu.be'].includes(host)) id = url.pathname.slice(1);
  else if (['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'].includes(host)) {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else id = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)\/?$/)?.[1];
  } else if (['youtube-nocookie.com','www.youtube-nocookie.com'].includes(host)) id = url.pathname.match(/^\/embed\/([^/]+)\/?$/)?.[1];
  if (!/^[A-Za-z0-9_-]{11}$/.test(id || '')) throw new Error('This is not a supported YouTube video link. Use a single video, not a playlist or channel.');
  return {videoId:id, url:`https://www.youtube.com/watch?v=${id}`};
}
let apiPromise;
function loadAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve,reject) => {
    const script = document.createElement('script');
    let timer;
    const fail = () => { clearTimeout(timer); script.remove(); apiPromise=null; reject(new Error('YouTube could not connect. Check your connection or content blocker, then try again. Local audio is still available.')); };
    window.onYouTubeIframeAPIReady = () => { clearTimeout(timer); resolve(window.YT); };
    script.src='https://www.youtube.com/iframe_api'; script.onerror=fail;
    timer=setTimeout(fail,15000); document.head.append(script);
  });
  return apiPromise;
}
const errorMessages = {
  2:'YouTube could not read this video link.',
  5:'This video cannot play in this browser. Try another browser or local audio.',
  100:'This video is private, removed, or unavailable.',
  101:'The owner does not allow this video to play in other websites. Choose another video or local audio.',
  150:'The owner does not allow this video to play in other websites. Choose another video or local audio.',
  153:'YouTube could not identify this page. Open the app in a regular browser with its normal referrer settings.'
};
export class YouTubeAudio {
  constructor(host) {
    this.host=host; this.player=null; this.ready=false; this.duration=0; this.loop=null; this.generation=0;
    this.onEnded=()=>{}; this.onError=()=>{}; this.onStatus=()=>{}; this.lastLoopSeek=0;
  }
  get playing() { return !!this.player && [1,3].includes(this.player.getPlayerState?.()); }
  currentTime() { const t=Number(this.player?.getCurrentTime?.()); return Number.isFinite(t)?Math.max(0,t):0; }
  async load(videoId) {
    this.unload(); this.error=''; const generation=this.generation;
    const YT=await loadAPI();
    if(generation!==this.generation) throw new Error('Connection canceled.');
    const mount=document.createElement('div'); this.host.replaceChildren(mount);
    return new Promise((resolve,reject)=>{
      let settled=false, metadataTimer, deadline;
      const cleanup=()=>{clearInterval(metadataTimer);clearTimeout(deadline);this.cancelLoad=null;};
      const fail=message=>{if(generation!==this.generation||this.error)return;const wasSettled=settled;settled=true;cleanup();clearInterval(this.monitor);this.error=message;this.ready=false;this.pause();if(!wasSettled)reject(new Error(message));else this.onError(message);};
      this.cancelLoad=()=>{cleanup();if(!settled){settled=true;reject(new Error('Connection canceled.'));}};
      const sameVideo=()=>{
        let current;
        try { current=parseYouTubeURL(this.player?.getVideoUrl?.()||'').videoId; } catch { return true; }
        if(current===videoId)return true;
        fail('The player switched to a different video. Your map still belongs to the original recording. Reconnect it, or choose New for another video.');return false;
      };
      const metadata=()=>{
        if(generation!==this.generation||settled)return;
        const duration=Number(this.player?.getDuration?.());
        if(!Number.isFinite(duration)||duration<=0)return;
        if(duration<.1||duration>86400)return fail('Use a prerecorded video between 0.1 seconds and 24 hours.');
        cleanup();settled=true;this.duration=duration;this.ready=true;resolve({kind:'youtube',videoId,name:`YouTube · ${videoId}`,duration});
      };
      this.player=new YT.Player(mount,{
        host:'https://www.youtube-nocookie.com',width:'100%',height:'200',videoId,
        playerVars:{playsinline:1,controls:1,autoplay:0,origin:location.origin,rel:0},
        events:{
          onReady:()=>{if(generation!==this.generation)return;this.onStatus('If the duration is not available yet, press Play in the video to finish connecting.');metadata();},
          onStateChange:e=>{
            if(generation!==this.generation)return;
            if(!sameVideo())return;
            metadata();
            if(e.data===0&&this.ready){if(this.loop){this.player.seekTo(this.loop.start,true);this.player.playVideo();}else this.onEnded();}
          },
          onError:e=>fail(errorMessages[e.data]||'YouTube playback failed. Reconnect, choose another video, or use local audio.'),
          onAutoplayBlocked:()=>{if(generation===this.generation)this.onStatus('Your browser needs a tap on Play inside the video. The app controls will stay connected.');}
        }
      });
      const iframe=this.player.getIframe?.(); if(iframe){iframe.title='YouTube recording for listening analysis';iframe.referrerPolicy='strict-origin-when-cross-origin';}
      metadataTimer=setInterval(metadata,200);
      deadline=setTimeout(()=>fail('No video duration was received. Press Connect YouTube to retry, then Play inside the video. Use a prerecorded video that allows embedding.'),60000);
      this.monitor=setInterval(()=>{
        if(!this.ready||!sameVideo())return;
        const duration=Number(this.player?.getDuration?.());
        if(duration>0&&Math.abs(duration-this.duration)>2){clearInterval(this.monitor);fail('This video duration changed. Live streams are not supported; use a finished recording. Your saved map is unchanged.');return;}
        if(!this.loop||!this.playing)return;
        const t=this.currentTime(),now=performance.now();
        if((t>=this.loop.end||t<this.loop.start-.3)&&now-this.lastLoopSeek>1000){this.lastLoopSeek=now;this.player.seekTo(this.loop.start,true);}
      },80);
    });
  }
  play() { if(!this.ready)return;if(this.currentTime()>=this.duration || this.loop&&(this.currentTime()<this.loop.start||this.currentTime()>=this.loop.end))this.seek(this.loop?.start||0);this.player.playVideo(); }
  pause() { this.player?.pauseVideo?.(); }
  seek(time) {
    if(!this.ready)return;
    let target=Math.max(0,Math.min(this.duration,time));
    if(this.loop)target=Math.max(this.loop.start,Math.min(this.loop.end-.001,target));
    const wasPlaying=this.playing;this.lastLoopSeek=performance.now();this.player.seekTo(target,true);
    // seekTo from a cued state starts playback. Keep app seeking explicitly paused.
    if(!wasPlaying)this.player.pauseVideo();
  }
  setLoop(section) { this.loop=section?{start:section.start,end:section.end}:null;if(this.loop&&(this.currentTime()<section.start||this.currentTime()>=section.end))this.seek(section.start); }
  unload() { this.generation++;this.cancelLoad?.();clearInterval(this.monitor);this.player?.destroy?.();this.player=null;this.ready=false;this.duration=0;this.loop=null;this.host.replaceChildren(); }
}
