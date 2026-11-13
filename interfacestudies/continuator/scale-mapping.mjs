// Mapping reused from the published MusEDLab Scale Rows engine.
/* 字母琴 · Scale Rows — engine
   仁工夫工具坊 — clean-room implementation, written from a behavioural spec.

   What this module knows:
     · scales as semitone sets (Chinese 五声/七声 modes first, Western after)
     · the physical QWERTY rows, addressed by KeyboardEvent.code
     · row schemes: how each row is offset in scale degrees
     · the mapping  (key, scale, root, scheme, shift) → MIDI note + labels
     · jianpu / solfège / letter-name labelling, with 宫 as the optional 1
     · a sound layer (soundfont samples, with a synth fallback when offline)
     · media providers for mainland video/audio sites, files and embed codes

   It has no opinion about the page. The page imports what it needs.        */

/* ────────────────────────────────────────────────────────────────────────
   1. Scales
   `steps` are semitones above the root, one octave, ascending.
   `gong` is where 宫 (do of the parent 宫 scale) sits relative to the root,
   in semitones, so jianpu can be written 以宫为1 for the Chinese modes.
   ──────────────────────────────────────────────────────────────────────── */
export const SCALE_GROUPS = [
  { id: 'wusheng', zh: '中国五声调式', en: 'Chinese pentatonic modes' },
  { id: 'qisheng', zh: '中国七声音阶', en: 'Chinese heptatonic scales' },
  { id: 'west',    zh: '西方常用',     en: 'Western, common' },
  { id: 'blues',   zh: '蓝调 · 爵士',  en: 'Blues and jazz' },
  { id: 'other',   zh: '其他',         en: 'Other' }
];

export const SCALES = {
  /* 五声 — all five rotations of the same 宫 set */
  gong:  { group: 'wusheng', zh: '宫调式', en: 'Gōng mode (major pentatonic)', steps: [0, 2, 4, 7, 9],  gong: 0 },
  shang: { group: 'wusheng', zh: '商调式', en: 'Shāng mode',                    steps: [0, 2, 5, 7, 10], gong: -2 },
  jue:   { group: 'wusheng', zh: '角调式', en: 'Jué mode',                      steps: [0, 3, 5, 8, 10], gong: -4 },
  zhi:   { group: 'wusheng', zh: '徵调式', en: 'Zhǐ mode',                      steps: [0, 2, 5, 7, 9],  gong: -7 },
  yu:    { group: 'wusheng', zh: '羽调式', en: 'Yǔ mode (minor pentatonic)',   steps: [0, 3, 5, 7, 10], gong: -9 },

  /* 七声 — 宫 with the two 偏音 in their three classical placements */
  qingyue: { group: 'qisheng', zh: '清乐七声（加清角、变宫）', en: 'Qīngyuè heptatonic (= major)',      steps: [0, 2, 4, 5, 7, 9, 11], gong: 0 },
  yayue:   { group: 'qisheng', zh: '雅乐七声（加变徵、变宫）', en: 'Yǎyuè heptatonic (= lydian)',      steps: [0, 2, 4, 6, 7, 9, 11], gong: 0, marks: { 3: 'bianzhi', 6: 'biangong' } },
  yanyue:  { group: 'qisheng', zh: '燕乐七声（加清角、闰）',   en: 'Yànyuè heptatonic (= mixolydian)', steps: [0, 2, 4, 5, 7, 9, 10], gong: 0 },
  liusheng:{ group: 'qisheng', zh: '六声（加清角）',           en: 'Liùshēng hexatonic (pentatonic + qīngjiǎo)',            steps: [0, 2, 4, 5, 7, 9],     gong: 0 },

  /* Western */
  major:         { group: 'west', zh: '大调（自然）', en: 'Major',                steps: [0, 2, 4, 5, 7, 9, 11] },
  minor:         { group: 'west', zh: '小调（自然）', en: 'Natural minor',        steps: [0, 2, 3, 5, 7, 8, 10] },
  harmonicMinor: { group: 'west', zh: '和声小调',     en: 'Harmonic minor',       steps: [0, 2, 3, 5, 7, 8, 11], marks: { 6: 'raised7' } },
  melodicMinor:  { group: 'west', zh: '旋律小调（上行）', en: 'Melodic minor (asc.)', steps: [0, 2, 3, 5, 7, 9, 11] },
  dorian:        { group: 'west', zh: '多利亚',       en: 'Dorian',               steps: [0, 2, 3, 5, 7, 9, 10] },
  mixolydian:    { group: 'west', zh: '混合利底亚',   en: 'Mixolydian',           steps: [0, 2, 4, 5, 7, 9, 10] },
  lydian:        { group: 'west', zh: '利底亚',       en: 'Lydian',               steps: [0, 2, 4, 6, 7, 9, 11] },
  phrygian:      { group: 'west', zh: '弗里几亚',     en: 'Phrygian',             steps: [0, 1, 3, 5, 7, 8, 10] },

  /* Blues / jazz */
  bluesMinor:    { group: 'blues', zh: '小调蓝调（六声）', en: 'Blues (minor, 6 notes)', steps: [0, 3, 5, 6, 7, 10] },
  bluesMajor:    { group: 'blues', zh: '大调蓝调（六声）', en: 'Blues (major, 6 notes)', steps: [0, 2, 3, 4, 7, 9] },
  phrygDom:      { group: 'blues', zh: '弗里几亚属音阶',   en: 'Phrygian dominant',      steps: [0, 1, 4, 5, 7, 8, 10] },
  harmonicMajor: { group: 'blues', zh: '和声大调',         en: 'Harmonic major',         steps: [0, 2, 4, 5, 7, 8, 11] },
  altered:       { group: 'blues', zh: '变化属音阶',       en: 'Altered',                steps: [0, 1, 3, 4, 6, 8, 10] },

  /* Other */
  wholeTone:  { group: 'other', zh: '全音阶',         en: 'Whole tone',             steps: [0, 2, 4, 6, 8, 10] },
  octatonic:  { group: 'other', zh: '八声音阶（半-全）', en: 'Octatonic (half–whole)', steps: [0, 1, 3, 4, 6, 7, 9, 10] },
  chromatic:  { group: 'other', zh: '半音阶',         en: 'Chromatic',              steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }
};

export const DEFAULT_SCALE = 'gong';

/* ────────────────────────────────────────────────────────────────────────
   2. The physical keyboard
   Rows are stored bottom-up, because degree 1 lives on the bottom row and
   pitch rises as the hand moves up the keyboard. Codes are layout-independent
   (KeyboardEvent.code), labels assume a US-QWERTY legend, which is what the
   laptops in a mainland classroom carry.
   ──────────────────────────────────────────────────────────────────────── */
export const ROWS = [
  /* row 0 — bottom */ [['KeyZ', 'Z'], ['KeyX', 'X'], ['KeyC', 'C'], ['KeyV', 'V'], ['KeyB', 'B'], ['KeyN', 'N'], ['KeyM', 'M'], ['Comma', ','], ['Period', '.'], ['Slash', '/']],
  /* row 1 — home   */ [['KeyA', 'A'], ['KeyS', 'S'], ['KeyD', 'D'], ['KeyF', 'F'], ['KeyG', 'G'], ['KeyH', 'H'], ['KeyJ', 'J'], ['KeyK', 'K'], ['KeyL', 'L'], ['Semicolon', ';'], ['Quote', "'"]],
  /* row 2          */ [['KeyQ', 'Q'], ['KeyW', 'W'], ['KeyE', 'E'], ['KeyR', 'R'], ['KeyT', 'T'], ['KeyY', 'Y'], ['KeyU', 'U'], ['KeyI', 'I'], ['KeyO', 'O'], ['KeyP', 'P'], ['BracketLeft', '['], ['BracketRight', ']'], ['Backslash', '\\']],
  /* row 3 — top    */ [['Digit1', '1'], ['Digit2', '2'], ['Digit3', '3'], ['Digit4', '4'], ['Digit5', '5'], ['Digit6', '6'], ['Digit7', '7'], ['Digit8', '8'], ['Digit9', '9'], ['Digit0', '0'], ['Minus', '-'], ['Equal', '=']]
];

/* how far each row is indented on a real keyboard, in key-widths */
export const ROW_INDENT = [1.25, 0.75, 0.5, 0];

const POSITION = new Map();
ROWS.forEach((row, r) => row.forEach(([code], c) => POSITION.set(code, { row: r, col: c })));

export function keyPosition(code) { return POSITION.get(code) || null; }

/* ────────────────────────────────────────────────────────────────────────
   3. Row schemes — what each row is offset by, in scale degrees.
   'oct' means one full octave of the current scale, whatever its size.
   ──────────────────────────────────────────────────────────────────────── */
export const SCHEMES = {
  /* bottom row walks the scale; the rows above start on the 3rd, 5th and
     octave, so any vertical column is a chord of stacked scale-thirds. */
  harmony: { zh: '和声行（1·3·5·8）', en: 'Harmony rows (1·3·5·8)', offsets: [0, 2, 4, 'oct'] },
  /* each row is the row below, one octave up — a four-octave staircase */
  ladder:  { zh: '阶梯（每行高一个八度）', en: 'Ladder (one octave per row)', offsets: [0, 'oct', 'oct2', 'oct3'] },
  /* alternating roots and fifths, good for 五度 drones and open harmony */
  fifths:  { zh: '五度行（1·5·8·12）', en: 'Fifths rows (1·5·8·12)', offsets: [0, 4, 'oct', 'oct+4'] },
  /* two identical octaves: a class can share one keyboard, two hands, two parts */
  twin:    { zh: '双行（两手同一八度）', en: 'Twin rows (two hands, same octave)', offsets: [0, 0, 'oct', 'oct'] }
};

export const DEFAULT_SCHEME = 'harmony';

function resolveOffset(spec, size) {
  if (typeof spec === 'number') return spec;
  const m = /^oct(\d)?(?:\+(\d+))?$/.exec(spec);
  if (!m) return 0;
  return size * (m[1] ? Number(m[1]) : 1) + (m[2] ? Number(m[2]) : 0);
}

/* ────────────────────────────────────────────────────────────────────────
   4. The mapping
   ──────────────────────────────────────────────────────────────────────── */
/* A position is (row, col) on either surface: the physical QWERTY rows or the
   touch grid. Both feed the same mapping. */
export function noteForPosition(row, col, cfg) {
  const scale = SCALES[cfg.scale] || SCALES[DEFAULT_SCALE];
  const size = scale.steps.length;
  const scheme = SCHEMES[cfg.scheme] || SCHEMES[DEFAULT_SCHEME];
  const index = col + resolveOffset(scheme.offsets[row] === undefined ? 0 : scheme.offsets[row], size);
  const degree = ((index % size) + size) % size;
  const octave = Math.floor(index / size);
  const shift = cfg.shift || 0;
  const midi = cfg.rootMidi + scale.steps[degree] + 12 * octave + shift;
  return { midi, degree, octave, shift, semis: scale.steps[degree] + 12 * octave + shift };
}

export function noteForKey(code, cfg) {
  const pos = keyPosition(code);
  if (!pos) return null;
  return { code, ...noteForPosition(pos.row, pos.col, cfg) };
}

/* Touch cells carry ids of the form  t:<row>:<col>  so the page can treat a
   finger on the grid exactly like a finger on a physical key. */
export function touchId(row, col) { return 't:' + row + ':' + col; }
export function isTouchId(id) { return typeof id === 'string' && id.startsWith('t:'); }

export function noteForId(id, cfg) {
  if (isTouchId(id)) {
    const [, r, c] = id.split(':');
    return { code: id, ...noteForPosition(Number(r), Number(c), cfg) };
  }
  return noteForKey(id, cfg);
}

/* The touch grid: `rows` rows (bottom-up, like the QWERTY rows) of one scale
   octave plus its top note, so the tonic sits at both ends of every row. */
export function touchGrid(cfg, rows = 4) {
  const scale = SCALES[cfg.scale] || SCALES[DEFAULT_SCALE];
  const cols = scale.steps.length + 1;
  const out = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) row.push({ id: touchId(r, c), row: r, col: c, note: noteForPosition(r, c, cfg) });
    out.push(row);
  }
  return out;
}

/* every mapped key at once — what the on-screen keyboard draws */
export function mapAll(cfg) {
  const out = new Map();
  for (const row of ROWS) for (const [code] of row) out.set(code, noteForKey(code, cfg));
  return out;
}

/* ────────────────────────────────────────────────────────────────────────
   5. Labels
   ──────────────────────────────────────────────────────────────────────── */
const JIANPU = ['1', '♯1', '2', '♭3', '3', '4', '♯4', '5', '♭6', '6', '♭7', '7'];
const SOLFA  = ['do', 'di', 're', 'me', 'mi', 'fa', 'fi', 'sol', 'le', 'la', 'te', 'si'];
const NAMES_SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const NAMES_FLAT  = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

/* jianpu relative to a reference midi (root, or 宫 when asked for) */
export function jianpuLabel(midi, refMidi) {
  const d = midi - refMidi;
  const pc = ((d % 12) + 12) % 12;
  const oct = Math.floor(d / 12);
  return { num: JIANPU[pc], solfa: SOLFA[pc], dots: oct };
}

export function letterName(midi, flats) {
  const pc = ((midi % 12) + 12) % 12;
  return (flats ? NAMES_FLAT : NAMES_SHARP)[pc] + (Math.floor(midi / 12) - 1);
}

/* the reference for "1": the root, or 宫 for a Chinese mode when 以宫为1 is on */
export function referenceMidi(cfg) {
  const scale = SCALES[cfg.scale] || SCALES[DEFAULT_SCALE];
  if (cfg.gongAsOne && typeof scale.gong === 'number') return cfg.rootMidi + scale.gong;
  return cfg.rootMidi;
}

/* jianpu text for a note, with octave dots rendered as combining characters
   — one dot above per octave up, one below per octave down, capped at two */
export function jianpuText(midi, refMidi) {
  const j = jianpuLabel(midi, refMidi);
  const up = '̇', down = '̣';
  const n = Math.max(-2, Math.min(2, j.dots));
  return j.num + (n > 0 ? up.repeat(n) : down.repeat(-n));
}

