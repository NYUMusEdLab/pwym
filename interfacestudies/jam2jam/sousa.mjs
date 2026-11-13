// Literal settings recovered from the two Illinois Sousa application bundles.
// No stock JamSkolan MIDI may be passed off as a Sousa example.
export const SOUSA_PROFILES=[
 {id:'sousa-major',name:'A♭ major',sourceEdition:'Sousa4 Ab major',loopBeats:130,key:8,pitchClasses:[0,2,3,5,7,8,10]},
 {id:'sousa-pentatonic',name:'A♭ pentatonic',sourceEdition:'Sousa3 Ab pentatonic',loopBeats:130,key:8,pitchClasses:[0,3,5,8,10]}
].map(p=>({...p,engine:'skolan',sourceScene:'sunshine',tempo:180,tempoDeviation:80,tempoMultiplier:1.1,programs:{bass:33,pads:72,keys:74,drums:0},available:true}));
