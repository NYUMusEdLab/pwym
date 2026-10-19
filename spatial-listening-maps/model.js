export const SCHEMA = 'org.nyumusedlab.spatial-listening-map';
export const VERSION = 1;
export const STORAGE_KEY = 'spatial-listening-maps.project.v1';
export const COLORS = ['#aee8d2', '#f3c588', '#bdc4ff', '#efaabe', '#a2d7f6', '#dadb92'];
export const uid = () => globalThis.crypto.randomUUID();
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export function newSection(start = 0, end = 30, name = 'First listen') {
  return { id: uid(), name, start, end, tokens: [], traces: [], notes: '' };
}
export function newProject() {
  const section = newSection();
  return { schema: SCHEMA, schemaVersion: VERSION, appVersion: '0.1.0', id: uid(), title: 'Untitled listening map', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), audio: null, sections: [section], activeSectionId: section.id };
}
export function newToken(label = 'New sound', index = 0) {
  return { id: uid(), soundId: uid(), label, x: 0, depth: 0.5, spread: 0.15, color: COLORS[index % COLORS.length], confidence: 'tentative', note: '' };
}
export function duplicateSection(section) {
  const copy = structuredClone(section);
  copy.id = uid(); copy.name = `${section.name} · copy`;
  copy.tokens.forEach(t => { t.id = uid(); });
  copy.traces.forEach(t => { t.id = uid(); });
  return copy;
}
function fail(message) { throw new Error(message); }
function str(value, label, max = 500) {
  if (typeof value !== 'string' || value.length > max) fail(`${label} must be text up to ${max} characters.`);
  return value;
}
function num(value, label, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(`${label} is outside its supported range.`);
  return value;
}
function arr(value, label, max) {
  if (!Array.isArray(value) || value.length > max) fail(`${label} has too many items or is not a list.`);
  return value;
}
function color(v) { if (typeof v !== 'string' || !/^#[a-f0-9]{6}$/i.test(v)) fail('Invalid token color.'); return v; }
function unique(items, label) { if (new Set(items.map(x => x.id)).size !== items.length) fail(`Duplicate ${label} IDs.`); }
// Reconstruct known fields: never merge untrusted JSON into live application objects.
export function validateProject(raw) {
  if (!raw || raw.schema !== SCHEMA || raw.schemaVersion !== VERSION) fail('Unsupported map format or version. Expected Spatial Listening Maps v1.');
  let audio = null;
  if (raw.audio !== null) {
    const a = raw.audio;
    if (!a || !['local', 'practice'].includes(a.kind)) fail('Invalid audio reference.');
    audio = { kind:a.kind, name:str(a.name,'Audio name',255), size:num(a.size,'Audio size',0,2e9), type:str(a.type,'Audio type',100), duration:num(a.duration,'Audio duration',0.1,86400), fingerprint: a.fingerprint === null ? null : str(a.fingerprint,'Audio fingerprint',64) };
    if (a.kind === 'local' && !/^[a-f0-9]{64}$/.test(audio.fingerprint || '')) fail('Local audio needs a SHA-256 identity for safe relinking.');
  }
  const sections = arr(raw.sections,'Sections',100).map(s => {
    if (!s) fail('Invalid section.');
    const start = num(s.start,'Section start',0,86400), end = num(s.end,'Section end',0.01,86400);
    if (end - start < 0.1 - 1e-9) fail('Each section must be at least 0.1 seconds long.');
    if (audio && end > audio.duration + 0.001) fail('A section ends beyond the referenced recording.');
    const tokens = arr(s.tokens,'Sounds per section',100).map(t => {
      if (!t || !['tentative','confident'].includes(t.confidence)) fail('Invalid listening confidence.');
      return {id:str(t.id,'Token ID',100),soundId:str(t.soundId,'Sound ID',100),label:str(t.label,'Sound label',80),x:num(t.x,'Left/right',-1,1),depth:num(t.depth,'Near/far',0,1),spread:num(t.spread,'Width',0,1),color:color(t.color),confidence:t.confidence,note:str(t.note,'Sound note',1000)};
    });
    unique(tokens,'token');
    const traces = arr(s.traces,'Traces',100).map(t => ({id:str(t.id,'Trace ID',100),points:arr(t.points,'Trace points',1000).map(p=>({x:num(p.x,'Trace x',-1,1),depth:num(p.depth,'Trace depth',0,1)}))}));
    unique(traces,'trace');
    return {id:str(s.id,'Section ID',100),name:str(s.name,'Section name',100),start,end,tokens,traces,notes:str(s.notes,'Section notes',5000)};
  });
  if (!sections.length) fail('The map needs at least one section.');
  unique(sections,'section');
  if (!sections.some(s=>s.id === raw.activeSectionId)) fail('The selected section is missing.');
  return {schema:SCHEMA,schemaVersion:VERSION,appVersion:'0.1.0',id:str(raw.id,'Project ID',100),title:str(raw.title,'Title',200),createdAt:str(raw.createdAt,'Created time',100),updatedAt:str(raw.updatedAt,'Updated time',100),audio,sections,activeSectionId:raw.activeSectionId};
}
export function parseProject(text) {
  if (text.length > 2_000_000) fail('Map file exceeds the 2 MB limit.');
  return validateProject(JSON.parse(text));
}
export function serializeProject(project) { return JSON.stringify(validateProject(project), null, 2); }
export function formatTime(seconds, decimals = false) {
  const safe = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(safe / 60), secs = safe % 60;
  return `${mins}:${(decimals ? secs.toFixed(1) : Math.floor(secs).toString()).padStart(decimals ? 4 : 2,'0')}`;
}
export function sectionAt(project, time) { return project.sections.filter(s => time >= s.start && time < s.end); }
export function makePracticeProject() {
  const p = newProject(); p.title = 'A small conversation · practice';
  p.audio = {kind:'practice',name:'Original synthesized practice · 12 seconds',size:0,type:'audio/generated',duration:12,fingerprint:null};
  const first = newSection(0,6,'Opening'), second = newSection(6,12,'Answer');
  first.tokens = [newToken('Low pulse',0),newToken('Bell-like tone',1),newToken('Soft texture',2)];
  Object.assign(first.tokens[0],{x:-0.5,depth:0.25,spread:0.12});
  Object.assign(first.tokens[1],{x:0.5,depth:0.65,spread:0.18});
  Object.assign(first.tokens[2],{x:0,depth:0.82,spread:0.8});
  second.tokens = duplicateSection(first).tokens;
  Object.assign(second.tokens[0],{x:0.15,depth:0.3});
  Object.assign(second.tokens[1],{x:-0.45,depth:0.55,spread:0.3});
  first.notes = 'Illustrative starting map, not an answer key. What sounds closer? Which sound feels spread out?';
  second.notes = 'What changes in the second half? These positions are editable listening interpretations.';
  p.sections = [first,second]; p.activeSectionId = first.id;
  return p;
}
