// Audio is independent of all token geometry. No panner, isolation, or stem graph.
export class LocalAudio {
  constructor() { this.context = null; this.buffer = null; this.source = null; this.offset = 0; this.startedAt = 0; this.loop = null; this.playing = false; this.generation = 0; this.onEnded = () => {}; }
  get duration() { return this.buffer?.duration || 0; }
  ensureContext() {
    if (!this.context) {
      this.context = new AudioContext();
      this.output = this.context.createGain(); this.output.gain.value = 0.7;
      this.output.connect(this.context.destination);
    }
    return this.context;
  }
  async decode(file) {
    const bytes = await file.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    const fingerprint = [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
    const buffer = await this.ensureContext().decodeAudioData(bytes);
    if (!Number.isFinite(buffer.duration) || buffer.duration < 0.1 || buffer.duration > 86400) throw new Error('Use an audio file between 0.1 seconds and 24 hours.');
    return {buffer, metadata:{kind:'local',name:file.name,size:file.size,type:file.type || 'audio/unknown',duration:buffer.duration,fingerprint}};
  }
  setBuffer(buffer) { this.pause(); this.buffer = buffer; this.offset = 0; this.loop = null; }
  currentTime() {
    if (!this.playing) return this.offset;
    let t = this.offset + this.context.currentTime - this.startedAt;
    if (this.loop && t >= this.loop.end) t = this.loop.start + (t - this.loop.start) % (this.loop.end - this.loop.start);
    return Math.min(this.duration, t);
  }
  stopSource() {
    if (this.source) { this.source.onended = null; this.source.stop(); this.source.disconnect(); this.source = null; }
  }
  async play() {
    if (!this.buffer || this.playing) return;
    const generation = ++this.generation;
    await this.ensureContext().resume();
    if (this.playing || generation !== this.generation || !this.buffer) return;
    if (this.offset >= this.duration) this.offset = this.loop?.start || 0;
    if (this.loop && (this.offset < this.loop.start || this.offset >= this.loop.end)) this.offset = this.loop.start;
    const source = this.context.createBufferSource(); source.buffer = this.buffer;
    if (this.loop) { source.loop = true; source.loopStart = this.loop.start; source.loopEnd = this.loop.end; }
    source.connect(this.output); this.source = source; this.startedAt = this.context.currentTime; this.playing = true;
    source.onended = () => { if (this.source === source) { this.offset = this.duration; this.playing = false; this.source = null; source.disconnect(); this.onEnded(); } };
    source.start(0,this.offset);
  }
  pause() { this.generation++; this.offset = this.currentTime(); this.playing = false; this.stopSource(); }
  async seek(time) {
    const wasPlaying = this.playing; this.pause();
    this.offset = Math.max(0,Math.min(this.duration,time));
    if (this.loop) this.offset = Math.max(this.loop.start,Math.min(this.loop.end - 0.001,this.offset));
    if (wasPlaying) await this.play();
  }
  async setLoop(section) {
    const wasPlaying = this.playing; this.pause();
    this.loop = section ? {start:section.start,end:section.end} : null;
    if (this.loop && (this.offset < this.loop.start || this.offset >= this.loop.end)) this.offset = this.loop.start;
    if (wasPlaying) await this.play();
  }
  unload() { this.pause(); this.buffer = null; this.offset = 0; this.loop = null; }
  practice() {
    const ctx = this.ensureContext(), sr = ctx.sampleRate, buffer = ctx.createBuffer(2,sr * 12,sr);
    for (let c=0;c<2;c++) {
      const data=buffer.getChannelData(c);
      for (let i=0;i<data.length;i++) {
        const t=i/sr, second=t>=6, beat=t%0.75, bell=t%1.5;
        const bass=Math.sin(2*Math.PI*110*t)*Math.exp(-beat*9)*0.24;
        const tone=(Math.sin(2*Math.PI*(second?660:550)*t)+0.25*Math.sin(2*Math.PI*1320*t))*Math.exp(-bell*4)*0.13;
        const texture=Math.sin(2*Math.PI*(c?221:220)*t)*Math.sin(Math.PI*t/12)*0.035;
        data[i]=(bass*(c === (second?1:0)?1:0.35)+tone*(c === (second?0:1)?1:0.3)+texture)*Math.min(1,t*30,(12-t)*30);
      }
    }
    this.setBuffer(buffer); return buffer;
  }
}
