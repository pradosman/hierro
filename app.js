import { EXERCISES, MUSCLES, UPPER, LOWER, TEMPLATES } from './data.js';
import { readXlsx, parseProgram, guessExercise, norm, titleCase, TYPE_NAMES, parseExerciseTable, parseTsv } from './import.js';

// ---------- Guardado ----------
const KEY = 'hierro.v1';
const clone = o => JSON.parse(JSON.stringify(o));
const uid = () => Math.random().toString(36).slice(2, 10);

function freshState() {
  return {
    v: 2,
    settings: { bar: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25], rest: 120, sound: true, theme: 'system' },
    custom: [], userLib: [], weights: [], program: null, nextDay: 0, active: null, restEnd: null, restTotal: 0, history: [],
  };
}
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return Object.assign(freshState(), JSON.parse(raw)); } catch (e) { console.error(e); }
  return freshState();
}
let S = load();
// Gym profiles: each one has its own bar, plates and equipment types. Older saves get one built from the old settings.
const EQ_TYPES = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight'];
const newGym = (name, from) => ({ id: uid(), name, bar: from ? from.bar : 20, plates: (from ? from.plates : [25, 20, 15, 10, 5, 2.5, 1.25]).slice(), equip: Object.fromEntries(EQ_TYPES.map(t => [t, from ? from.equip[t] !== false : true])) });
if (!Array.isArray(S.gyms) || !S.gyms.length) { const g = newGym('Commercial Gym'); g.bar = S.settings.bar || 20; if (Array.isArray(S.settings.plates) && S.settings.plates.length) g.plates = S.settings.plates.slice(); S.gyms = [g]; S.gymId = g.id; }
const gym = id => S.gyms.find(g => g.id === (id || S.gymId)) || S.gyms[0];
const gymPieces = g => EQ_TYPES.filter(t => g.equip[t] !== false).length + g.plates.length;
const applyTheme = () => { const t = S.settings.theme; if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; };
applyTheme();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Could not save. The phone is out of space.'); } };

const ui = { tab: 'dash', screen: S.active ? 'active' : null, sheet: null, day: 0, cur: 0, focus: null, fresh: false, colMode: 'auto', pv: 0, plates: true, cal: false, dashPage: 0, recMode: '1rm', wRange: '1W', infoTab: 'inst', warmMode: 'smart', noteTab: 'session', range: '1W', metric: 'sets', dashMode: 'all', tmCycle: false, lib: null, progOpen: true, back: false, done: null, openHist: null };

// ---------- Ayudas ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { if (v === '' || v == null) return null; const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const kg = n => (n == null ? '' : String(Math.round(n * 100) / 100));
// Every exercise we can resolve by id. With a database of your own loaded, lists show only yours (and your custom ones).
const allEx = () => EXERCISES.concat(S.userLib || [], S.custom);
const listEx = () => ((S.userLib || []).length ? S.userLib.concat(S.custom) : EXERCISES.concat(S.custom));
const LEGACY = { Back: 'Lats', Shoulders: 'Side Delts', Pecho: 'Chest', Espalda: 'Lats', Hombro: 'Side Delts', 'Bíceps': 'Biceps', 'Tríceps': 'Triceps', 'Cuádriceps': 'Quads', Isquios: 'Hamstrings', 'Glúteo': 'Glutes', Gemelo: 'Calves', Abdomen: 'Abs' };
const fixEx = e => (e && LEGACY[e.muscle] ? { ...e, muscle: LEGACY[e.muscle], sec: (e.sec || []).map(m => LEGACY[m] || m) } : e);
const exMod = id => (S.exMods || {})[id] || {};
const withMods = e => (e && exMod(e.id).inc != null ? { ...e, inc: exMod(e.id).inc } : e);
const exById = id => withMods(fixEx(allEx().find(e => e.id === id))) || { id, name: 'Deleted exercise', muscle: 'Chest', sec: [], equip: 'Machine', inc: 2.5 };
const isWork = s => s.type !== 'w';
const e1rm = (w, r, rir) => w * (1 + (r + (rir || 0)) / 30);
const dayLabel = ts => new Date(ts).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
const mins = ms => Math.max(1, Math.round(ms / 60000));
const clock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const hms = s => `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const roundTo = (n, step) => (step > 0 ? Math.round(n / step) * step : Math.round(n));
const DAY = 864e5;
function weekStart(ts) { const d = new Date(ts); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); }

let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 2600);
}

// ---------- Iconos (dibujados para esta app) ----------
const svg = (d, fill) => `<svg viewBox="0 0 24 24" width="24" height="24" fill="${fill ? 'currentColor' : 'none'}" stroke="${fill ? 'none' : 'currentColor'}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  dash: svg('<rect x="4" y="4" width="7" height="9" rx="1"/><rect x="13" y="4" width="7" height="5" rx="1"/><rect x="4" y="15" width="7" height="5" rx="1"/><rect x="13" y="11" width="7" height="9" rx="1"/>'),
  workout: svg('<path d="M7 9v6M4.5 10.5v3M17 9v6M19.5 10.5v3M7 12h10"/>'),
  levels: svg('<path d="M12 3c3 2.5 4.5 6 4.5 9.500L15 16H9l-1.500-3.500C7.500 9 9 5.500 12 3z"/><circle cx="12" cy="10" r="1.6"/><path d="M10 19l2 2 2-2"/>'),
  more: svg('<circle cx="12" cy="12" r="9"/><path d="M8 12h.01M12 12h.01M16 12h.01"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  cal: svg('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>'),
  timer: svg('<circle cx="12" cy="13.500" r="7"/><path d="M12 10v4M10 3h4"/>'),
  check: svg('<path d="M5 12.500l4.500 4.500L19 7.500"/>'),
  dots: svg('<path d="M12 5h.01M12 12h.01M12 19h.01"/>'),
  down: svg('<path d="M6 9l6 6 6-6"/>'),
  up: svg('<path d="M6 15l6-6 6 6"/>'),
  right: svg('<path d="M9 5l7 7-7 7"/>'),
  sliders: svg('<path d="M4 7h10M18 7h2M4 12h4M12 12h8M4 17h12M20 17h0"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="17" r="2"/>'),
  info: svg('<path d="M6 19v-6M12 19V5M18 19v-9"/>'),
  warm: svg('<circle cx="12" cy="12" r="8"/><path d="M12 9v6"/>'),
  swap: svg('<path d="M4 9h13l-3-3M20 15H7l3 3"/>'),
  note: svg('<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 9h6M9 13h6"/>'),
  wand: svg('<path d="M5 19L15 9M14 4v3M12.500 5.500h3M19 9v3M17.500 10.500h3M7 5v2M6 6h2"/>'),
  kbd: svg('<rect x="3" y="5" width="18" height="11" rx="2"/><path d="M7 9h.01M11 9h.01M15 9h.01M8 12.500h8M9 20l3-2.500 3 2.500"/>'),
  bksp: svg('<path d="M9 6h10a1 1 0 011 1v10a1 1 0 01-1 1H9l-5-6 5-6z"/><path d="M12 10l4 4M16 10l-4 4"/>'),
  edit: svg('<path d="M5 19h4L19 9l-4-4L5 15v4z"/>'),
  sort: svg('<path d="M8 5v14l-3-3M16 19V5l3 3"/>'),
  trash: svg('<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>'),
  trophy: svg('<path d="M8 4h8v5a4 4 0 01-8 0V4zM8 6H5v1a3 3 0 003 3M16 6h3v1a3 3 0 01-3 3M12 13v4M8.500 20h7"/>'),
  flip: svg('<path d="M5 9a7 7 0 0112-3l2 2M19 15a7 7 0 01-12 3l-2-2M19 4v4h-4M5 20v-4h4"/>'),
  rocket: svg('<path d="M12 3c3 2.500 4.500 6 4.500 9.500L15 16H9l-1.500-3.500C7.500 9 9 5.500 12 3z"/><path d="M10 19l2 2 2-2"/>'),
  puzzle: svg('<path d="M9 4h3a2 2 0 114 0h3v5a2 2 0 100 4v6h-5a2 2 0 10-4 0H5v-5a2 2 0 110-4V4h4z"/>', true),
  pin: svg('<path d="M8 3h8l-1 6 3 4H6l3-4-1-6zM12 13v8"/>', true),
  next: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  target: svg('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.500"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
  plates: svg('<path d="M4 12h16M8 7v10M16 7v10M5.500 9.500v5M18.500 9.500v5"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  hist: svg('<rect x="5" y="4" width="13" height="15" rx="2"/><path d="M8.500 8.500h6M8.500 12h3"/><circle cx="16.500" cy="16.500" r="4" fill="var(--fill)"/><path d="M16.500 14.500v2l1.500 1"/>'),
  enter: svg('<path d="M4 6v12M8 12h12M15 7l5 5-5 5"/>'),
  route: svg('<circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 6h6a3 3 0 010 6h-4a3 3 0 000 6h6"/>'),
  scale: svg('<rect x="5" y="5" width="14" height="14" rx="3"/><path d="M9.500 9h5"/><circle cx="12" cy="9" r=".5"/>'),
  globe: svg('<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.500 2.500 2.500 13.500 0 16M12 4c-2.500 2.500-2.500 13.500 0 16"/>'),
  search: svg('<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/>'),
  play: svg('<path d="M8 5.500v13l11-6.500z"/>', true),
  gym: svg('<rect x="5" y="4" width="14" height="16" rx="1"/><path d="M9 8h.01M12 8h.01M15 8h.01M9 12h.01M12 12h.01M15 12h.01M10 20v-4h4v4"/>'),
};
const EQUIP_GLYPH = {
  Barbell: '<path d="M6 20h28M10 13v14M14 10v20M30 13v14M26 10v20"/>',
  Dumbbell: '<path d="M14 20h12M11 14v12M14 12v16M29 14v12M26 12v16"/>',
  Machine: '<path d="M10 32V8h8v24M14 12h0M14 16h0M14 20h0M18 14h10v8M24 32v-6h6v6"/>',
  Cable: '<path d="M10 32V8h18M24 8v12"/><circle cx="24" cy="23" r="3"/><path d="M19 30h10"/>',
  Bodyweight: '<circle cx="20" cy="10" r="3.500"/><path d="M20 14v10M12 17h16M20 24l-5 8M20 24l5 8"/>',
};
const CUES = {
  Barbell: ['Set the bar at a height you can unrack without strain. Load both sides evenly and lock the collars.', 'Brace before every rep. Keep the bar on the same path each time. End the set when your form changes.'],
  Dumbbell: ['Pick a pair you can bring into position safely. Set the bench angle before you sit down.', 'Move both sides at the same speed. Control the way down. Do not swing the weight.'],
  Machine: ['Adjust the seat and pads so the joint that moves lines up with the pivot of the machine.', 'Start each rep from a full stretch. Push or pull smoothly. Do not let the stack slam.'],
  Cable: ['Set the pulley height and choose the handle first. Stand or sit so the cable pulls in line with the movement.', 'Keep tension on the cable for the whole rep. Do not lean back to move more weight.'],
  Bodyweight: ['Find a stable bar, bench or floor space. Warm up the joints you will load.', 'Use the full range you can control. Add weight only when the top of the rep range feels easy.'],
};
const thumb = (exId, cls = '') => {
  const ex = exById(exId);
  return `<span class="thumb ${cls}" aria-hidden="true"><svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${EQUIP_GLYPH[ex.equip] || EQUIP_GLYPH.Barbell}</svg></span>`;
};

// ---------- Figura del cuerpo ----------
// Dibujo propio. Media figura (lado izquierdo); la otra mitad es un espejo.
const rr = (x, y, w, h, r = 2.5) => `M${x + r} ${y} h${w - 2 * r} a${r} ${r} 0 0 1 ${r} ${r} v${h - 2 * r} a${r} ${r} 0 0 1 -${r} ${r} h-${w - 2 * r} a${r} ${r} 0 0 1 -${r} -${r} v-${h - 2 * r} a${r} ${r} 0 0 1 ${r} -${r} z`;
const HEAD = '<ellipse cx="100" cy="30" rx="17" ry="22"/>';
const HALF_BASE = '<path d="M100 44 L91 44 L90 60 Q78 66 62 68 Q46 71 42 88 L38 128 Q36 150 30 172 L22 206 Q15 214 12 225 L14 237 Q18 241 22 236 L24 245 Q28 247 30 240 L34 222 L40 206 Q48 180 52 156 L56 134 Q58 152 60 168 Q57 190 58 210 Q56 250 62 290 Q64 310 64 326 Q62 350 66 378 L68 396 Q62 404 60 411 L85 411 Q87 400 84 392 Q88 360 88 330 Q90 312 90 296 Q96 250 100 224 Z"/>';
const DELT = 'M60 71 Q47 73 45 89 Q44 98 47 105 Q57 99 62 85 Q65 77 60 71 Z';
const ARM = 'M44 109 Q50 104 55.500 109 L54 137 Q50 147 44.500 143 Q40 126 44 109 Z';
const FOREARM = 'M40 150 Q47 152 51.500 148 L42 198 Q36 204 30.500 200 Q34 175 40 150 Z';
const PARTS = {
  front: {
    Neck: ['M93 46 L99.500 46 L99.500 58 L92.500 56 Z'],
    'Upper Traps': ['M91 57.500 Q84 63 73 67 L90 68 Z'],
    'Front Delts': ['M60 71 Q54.500 72 53 80 Q52 92 54.500 100 Q60 94 62 85 Q65 77 60 71 Z'],
    'Side Delts': ['M52 73 Q46 76 45 89 Q44 98 47 105 Q50 103 52 100 Q49.500 90 51 80 Z'],
    Chest: ['M68 72 Q66 72 65 78 Q62 92 68 102 Q76 110 88 108 Q97 106 97.500 100 L97.500 75 Q97.500 72 94 72 Z'],
    Biceps: [ARM],
    Forearms: [FOREARM],
    Serratus: ['M67 107 L80 112 L80 116.500 L67 113.500 Z', 'M67 116 L80 119 L80 123.500 L67 122.500 Z'],
    Obliques: ['M67 125 Q74 127.500 81 126.500 L82 170 Q72 166 67 150 Z'],
    Abs: [rr(85, 112, 12.500, 11), rr(85, 125.500, 12.500, 11), rr(85, 139, 12.500, 11), 'M85 153.500 h12.500 v26 q-9 -3 -12.500 -13 z'],
    Abductors: ['M60.500 182 Q62 175 66 173 L65 210 Q61.500 204 60.500 194 Z'],
    Adductors: ['M94.500 222 Q99 221 99 228 L96.500 268 Q93.500 246 94.500 222 Z'],
    Quads: ['M61 215 Q69 208 76 212 L76 298 Q70 301 67 296 Q58 256 61 215 Z', 'M79 212 Q88 210 92 219 Q93 260 87 296 Q83 300 79 298 Z'],
    Tibs: ['M79 320 Q84 318 85 324 Q86 350 81 380 L77 380 Z'],
    Calves: ['M66 319 Q71 314 76 318 L75 380 L70 380 Q64 348 66 319 Z'],
  },
  back: {
    Neck: ['M93 46 L99.500 46 L99.500 53 L93 53 Z'],
    'Upper Traps': ['M92 54.500 L97.500 54.500 L97.500 75 L74 70 Q85 65 92 54.500 Z'],
    'Upper Back': ['M71 72.500 L97.500 77.500 L97.500 104 L86 97 Z'],
    'Rear Delts': [DELT],
    Lats: ['M66 82 L84 98 L95 108 L95 150 Q80 146 70 132 Q63 108 66 82 Z'],
    'Lower Back': ['M84 155 L97.500 153 L97.500 176 L84 174 Z'],
    Triceps: [ARM],
    Forearms: [FOREARM],
    Glutes: ['M66 181 Q82 175 97.500 181 L97.500 214 Q84 222 68 214 Q62 198 66 181 Z'],
    Hamstrings: ['M64 223 Q78 227 93 221 Q94 262 86 296 Q76 300 68 296 Q60 258 64 223 Z'],
    Calves: ['M66 317 Q76 309 85 319 Q88 345 80 367 L72 367 Q62 345 66 317 Z'],
  },
};
function body(levels, side, cls = '', box = '0 0 200 420') {
  const half = Object.entries(PARTS[side]).map(([m, paths]) => {
    const lv = levels[m] || 0;
    const style = lv > 0 ? `class="lit" style="fill-opacity:${(0.35 + 0.65 * Math.min(1, lv)).toFixed(2)}"` : 'class="dim"';
    return paths.map(d => `<path d="${d}" ${style}/>`).join('');
  }).join('');
  return `<svg class="body ${cls}" viewBox="${box}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Body, ${side} view">
    <g class="sil">${HEAD}${HALF_BASE}<g transform="translate(200 0) scale(-1 1)">${HALF_BASE}</g></g>
    <g class="mus">${half}<g transform="translate(200 0) scale(-1 1)">${half}</g></g></svg>`;
}
const FRONT = ['Chest', 'Front Delts', 'Side Delts', 'Biceps', 'Abs', 'Obliques', 'Serratus', 'Quads', 'Adductors', 'Abductors', 'Tibs'];
// Recorte de la figura alrededor de cada músculo, para las tarjetas pequeñas.
const TORSO = '40 44 120 112', ARMS = '22 44 156 146', MID = '40 92 120 112', THIGH = '45 190 110 103', SHIN = '45 296 110 103';
const CROP = { Chest: TORSO, 'Upper Back': TORSO, Lats: '40 64 120 112', 'Upper Traps': '45 30 110 103', Neck: '50 22 100 93', Serratus: '40 70 120 112', 'Front Delts': ARMS, 'Side Delts': ARMS, 'Rear Delts': ARMS, Biceps: '22 62 156 146', Triceps: '22 62 156 146', Forearms: '0 122 110 103', Abs: MID, Obliques: MID, 'Lower Back': MID, Quads: THIGH, Hamstrings: THIGH, Adductors: THIGH, Abductors: '45 150 110 103', Glutes: '45 150 110 103', Calves: SHIN, Tibs: SHIN };
const miniBody = m => body({ [m]: 1 }, FRONT.includes(m) ? 'front' : 'back', 'mini', CROP[m] || '0 0 200 420');

// ---------- Regla de progreso ----------
function lastSets(exId) {
  const same = S.settings.prevRef === 'same' && S.active ? S.active.dayName : null;
  for (let i = S.history.length - 1; i >= 0; i--) {
    if (same && S.history[i].dayName !== same) continue;
    const item = S.history[i].items.find(x => x.ex === exId);
    if (item) { const sets = item.sets.filter(isWork); if (sets.length) return sets; }
  }
  return null;
}
// A program exercise may carry setsT: one { type, lo, hi, rir, rest } per set. Without it, every set uses the exercise values.
const setRows = it => (it.setsT && it.setsT.length ? it.setsT : Array.from({ length: it.sets }, () => ({ type: 'n', lo: it.lo, hi: it.hi, rir: it.rir, rest: it.rest })));
// Keeps the plain fields (sets, lo, hi, rir, rest) in step with the per-set list, for the code that only needs a summary.
function syncItem(it) { if (!it.setsT || !it.setsT.length) return it; const f = it.setsT.find(q => q.lo != null) || it.setsT[0]; it.sets = it.setsT.length; it.lo = f.lo != null ? f.lo : (it.lo || 8); it.hi = f.hi != null ? f.hi : (it.hi || 12); it.rir = f.rir != null ? f.rir : (it.rir || 0); it.rest = f.rest != null ? f.rest : (it.rest || S.settings.rest); return it; }
function suggest(item, workIdx, set) {
  const prev = lastSets(item.ex);
  if (!prev) return { tw: null, tr: null, prev: null };
  const p = prev[Math.min(workIdx, prev.length - 1)];
  const inc = exById(item.ex).inc;
  const LO = T(item, set, 'lo'), HI = T(item, set, 'hi'), RIR = T(item, set, 'rir');
  const rir = p.rir == null ? RIR : p.rir;
  const eff = p.r + rir - RIR; // reps que valdrían con la reserva pedida
  if (!p.w || !inc) return { tw: p.w || 0, tr: Math.max(LO, eff + 1), prev: p };
  if (eff >= HI) {
    // Expand Rep Range: when one weight step is a big jump, ask for a few more reps first.
    if (S.settings.expandRange !== false && inc / p.w > 0.08 && eff < HI + 3) return { tw: p.w, tr: eff + 1, prev: p };
    return { tw: p.w + inc, tr: LO, prev: p };
  }
  if (eff <= LO - 2) return { tw: Math.max(0, p.w - inc), tr: LO, prev: p };
  if (eff < LO) return { tw: p.w, tr: LO, prev: p };
  return { tw: p.w, tr: Math.min(HI, eff + 1), prev: p };
}
function retarget(item, fill) {
  let wi = 0;
  item.sets.forEach(s => {
    if (!isWork(s)) return;
    const t = suggest(item, wi++, s);
    if (S.settings.weightMatch === true) { if (wi === 1) item._tw = t.tw; else if (item._tw != null && t.tw != null) t.tw = item._tw; }
    s.tw = t.tw; s.tr = t.tr; s.prev = t.prev ? { w: t.prev.w, r: t.prev.r, rir: t.prev.rir } : null;
    if (fill && !s.done) { const smart = S.settings.smart !== false, pw = t.prev ? t.prev.w : null, pr = t.prev ? t.prev.r : null;
      s.w = smart ? (t.tw != null ? kg(t.tw) : '') : (pw != null ? kg(pw) : '');
      const mid = s.noRange ? '' : Math.round((T(item, s, 'lo') + T(item, s, 'hi')) / 2);
      s.r = String(smart ? (t.tr != null && !s.noRange ? t.tr : (pr != null && s.noRange ? pr : mid)) : (pr != null ? pr : mid));
      s.rir = S.settings.rirTrack === false ? '' : String(T(item, s, 'rir')); }
  });
}
const T = (it, s, f) => (s && s['t' + f] != null ? s['t' + f] : it[f]);
const progItem = () => { const a = S.active; if (!a || a.dayIdx == null || !S.program || !S.program.days[a.dayIdx]) return null; return S.program.days[a.dayIdx].items.find(x => x.ex === a.items[ui.cur].ex) || null; };
// Warm-up plan for one exercise, from the scheme in Settings and the weight of its first working set.
function warmPlan(it) {
  const first = it.sets.find(isWork), top = first && num(first.w); if (!top) return [];
  const ex = exById(it.ex), step = S.settings.simpleWarm !== false && ex.equip === 'Barbell' ? 5 : (ex.inc || 2.5);
  return (S.settings.warmScheme || [[50, 8], [70, 5], [85, 2]]).map(([p, r]) => [Math.max(step, roundTo(top * p / 100, step)), r]).filter(([w]) => w < top);
}
const newSet = type => ({ type: type || 'n', w: '', r: '', rir: '', partial: false, done: false, tw: null, tr: null, prev: null });
function newItem(src) {
  const item = { ex: src.ex, lo: src.lo, hi: src.hi, rir: src.rir, rest: src.rest, ssNext: !!src.ssNext, note: '', sets: [] };
  setRows(src).forEach(q => { const set = newSet(q.type || 'n');
    if (q.lo != null) { set.tlo = q.lo; set.thi = q.hi; } else if (src.setsT) set.noRange = true;
    if (q.rir != null) set.trir = q.rir;
    if (q.rest != null) set.trest = q.rest;
    item.sets.push(set); });
  retarget(item, true);
  return item;
}

// ---------- Entreno ----------
function startWorkout(dayIdx) {
  const d = dayIdx == null ? null : S.program.days[dayIdx];
  S.active = { dayIdx, dayName: d ? d.name : 'Empty Workout', start: Date.now(), items: d ? d.items.map(newItem) : [] };
  if (S.settings.warmAuto) S.active.items.forEach(it => { const plan = warmPlan(it); if (plan.length) it.sets = plan.map(([w, r]) => ({ ...newSet('w'), w: kg(w), r: String(r) })).concat(it.sets); });
  ui.screen = 'active'; ui.cur = 0; ui.focus = null; ui.sheet = null;
  unlockAudio(); save(); wake();
}
function completeSet(i, s) {
  const item = S.active.items[i], set = item.sets[s];
  if (set.done) { set.done = false; return true; }
  const body0 = !exById(item.ex).inc;
  const w = num(set.w) ?? (body0 ? 0 : null);
  const r = num(set.r);
  if (w == null) { toast('Enter the weight.'); return false; }
  if (!r || r < 1) { toast('Enter the reps.'); return false; }
  set.w = kg(w); set.r = String(Math.round(r));
  set.done = true;
  if (isWork(set) && S.settings.smartLive !== false) item.sets.forEach((q, k) => { if (k > s && !q.done && isWork(q) && String(q.w || '') === '') q.w = set.w; });
  if (isWork(set)) {
    const items = S.active.items; let lo = i, hi = i;
    while (lo > 0 && items[lo - 1].ssNext) lo--;
    while (hi < items.length - 1 && items[hi].ssNext) hi++;
    const open = k => items[k].sets.some(q => !q.done);
    if (hi > lo && i < hi && S.settings.ssAuto !== false) { ui.cur = i + 1; ui.focus = null; }                      // next exercise of the superset, no rest
    else { const lastOfEx = !open(i) && hi === lo;
      if (S.settings.useRest !== false && item.restOn !== false && (!lastOfEx || S.settings.restBetweenEx === true)) startRest(T(item, set, 'rest'));
      if (hi > lo) { const back = [...Array(hi - lo + 1).keys()].map(k => lo + k).find(open); if (back != null && S.settings.ssAuto !== false) { ui.cur = back; ui.focus = null; } }
      // Exercise Auto-Next: when this exercise is finished, move to the next one that still has sets left.
      if (hi === lo && S.settings.autoNext !== false && !open(i)) { const nx = items.findIndex((x, k) => k > i && x.sets.some(q => !q.done)); if (nx >= 0) { ui.cur = nx; ui.focus = null; } } }
  } else {
    // Warm-up sets only start a rest after the last one, and only when that setting is on.
    const next = item.sets[s + 1];
    if ((!next || isWork(next)) && S.settings.useRest !== false && S.settings.restAfterWarm !== false && item.restOn !== false) startRest(T(item, set, 'rest'));
  }
  return true;
}
function bestOf(sets) {
  let best = null;
  sets.filter(isWork).forEach(s => {
    const score = s.w ? e1rm(s.w, s.r, s.rir) : s.r;
    if (!best || score > best.score) best = { score, w: s.w, r: s.r };
  });
  return best;
}
function recordFor(exId) {
  let best = null;
  S.history.forEach(h => h.items.filter(x => x.ex === exId).forEach(x => {
    const b = bestOf(x.sets);
    if (b && (!best || b.score > best.score)) best = { ...b, date: h.start };
  }));
  return best;
}
const sessionStats = h => {
  let sets = 0, vol = 0;
  const bw = S.settings.bwContrib !== false && (S.weights || []).length ? weightsSorted().slice(-1)[0].kg : 0;
  h.items.forEach(it => { const add = bw && exById(it.ex).equip === 'Bodyweight' ? bw : 0; it.sets.filter(isWork).forEach(s => { sets++; vol += (s.w + add) * s.r; }); });
  return { sets, vol: Math.round(vol) };
};
function finishWorkout() {
  const a = S.active;
  const items = a.items.map(it => ({
    ex: it.ex, note: it.note,
    sets: it.sets.filter(s => s.done).map(s => ({ type: s.type, w: num(s.w) || 0, r: num(s.r), rir: num(s.rir), partial: !!s.partial })),
  })).filter(it => it.sets.length);
  if (!items.length) {
    if (!confirm('No sets are checked. Discard this workout?')) return;
    S.active = null; stopRest(); ui.screen = null; ui.sheet = null; return;
  }
  const records = [];
  items.forEach(it => {
    const best = bestOf(it.sets), old = recordFor(it.ex);
    if (best && (!old || best.score > old.score + 0.01)) records.push({ ex: it.ex, kind: 'Strength Record', val: `${best.w ? kg(best.w) + ' kg × ' : ''}${best.r}` });
    const vol = it.sets.filter(isWork).reduce((n, s) => n + s.w * s.r, 0);
    const oldVol = Math.max(0, ...S.history.flatMap(h => h.items.filter(x => x.ex === it.ex).map(x => x.sets.filter(isWork).reduce((n, s) => n + s.w * s.r, 0))));
    if (vol > oldVol && vol > 0) records.push({ ex: it.ex, kind: 'Volume Record', val: `${Math.round(vol).toLocaleString('en-US')} kg` });
  });
  const entry = { id: uid(), start: a.start, end: Date.now(), note: a.note || '', dayName: a.dayName, dayIdx: a.dayIdx, prog: a.dayIdx != null, items };
  S.history.push(entry);
  if (a.dayIdx != null && S.program) markDay(a.dayIdx, true);
  S.active = null; stopRest();
  // What changed against the plan: swapped exercises or a different number of sets.
  const plan = a.dayIdx != null && S.program && S.program.days[a.dayIdx] ? S.program.days[a.dayIdx] : null;
  const sess = a.items.map(it => syncItem({ ex: it.ex, sets: it.sets.filter(isWork).length, lo: it.lo, hi: it.hi, rir: it.rir, rest: it.rest, ssNext: !!it.ssNext, setsT: it.sets.filter(isWork).map(q => ({ type: q.type, lo: q.noRange ? null : T(it, q, 'lo'), hi: q.noRange ? null : T(it, q, 'hi'), rir: T(it, q, 'rir'), rest: T(it, q, 'rest') })) }));
  const changed = !!plan && JSON.stringify(plan.items.map(x => [x.ex, x.sets])) !== JSON.stringify(sess.map(x => [x.ex, x.sets]));
  ui.done = { entry, records, changed, sess, dayIdx: a.dayIdx }; ui.screen = 'complete'; ui.sheet = null; ui.focus = null;
}

// ---------- Descanso ----------
let audio;
function unlockAudio() { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch (e) { /* sin sonido */ } }
function beep() {
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  if (!S.settings.sound || !audio) return;
  [0, 0.25, 0.5].forEach(d => {
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = 880; o.connect(g); g.connect(audio.destination);
    g.gain.setValueAtTime(0.25, audio.currentTime + d);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + d + 0.18);
    o.start(audio.currentTime + d); o.stop(audio.currentTime + d + 0.2);
  });
}
function startRest(sec) { unlockAudio(); S.restTotal = sec; S.restEnd = Date.now() + sec * 1000; }
function stopRest() { S.restEnd = null; }
function tick() {
  if (!S.active) return;
  const el = document.getElementById('elapsed'); if (!el) return;
  el.textContent = hms((Date.now() - S.active.start) / 1000);
  const rest = document.getElementById('restTime'), bar = document.getElementById('restBar');
  let left = S.restEnd ? (S.restEnd - Date.now()) / 1000 : 0;
  if (S.restEnd && left <= 0) { if (left > -3) beep(); stopRest(); save(); left = 0; toast('Rest is over.'); }
  rest.textContent = clock(Math.ceil(left));
  bar.style.transform = `scaleX(${S.restEnd ? Math.min(1, left / (S.restTotal || 1)) : 0})`;
}
setInterval(tick, 250);
let lock;
async function wake() { try { if (S.active && S.settings.keepAwake !== false && navigator.wakeLock) lock = await navigator.wakeLock.request('screen'); } catch (e) { /* no pasa nada */ } }
document.addEventListener('visibilitychange', () => { if (!document.hidden) { wake(); tick(); } });

// ---------- Datos para gráficas ----------
function muscleSets(from, to) {
  const out = Object.fromEntries(MUSCLES.map(m => [m, 0]));
  S.history.filter(h => h.start >= from && h.start < to).forEach(h => h.items.forEach(it => {
    const ex = exById(it.ex), n = it.sets.filter(isWork).length;
    if (ex.w) { Object.entries(ex.w).forEach(([m, k]) => { if (m in out) out[m] += n * k; }); return; }
    if (ex.muscle in out) out[ex.muscle] += n;
    (ex.sec || []).forEach(m => { if (m in out) out[m] += n / 2; });
  }));
  return out;
}
// Progress inside the current program cycle. "All Workouts" also counts workouts outside the program.
// The cycle remembers which days of the program are done. When all are done, the next cycle starts.
function cyc() {
  if (!S.cycle) { const days = S.program ? S.program.days : [], hs = S.history.filter(h => h.prog), n = days.length, cur = n ? hs.slice(hs.length - (hs.length % n)) : [];
    S.cycle = { n: n ? Math.floor(hs.length / n) + 1 : 1, start: cur.length ? cur[0].start : Date.now(), done: {} };
    cur.forEach(h => { if (days[h.dayIdx]) S.cycle.done[days[h.dayIdx].id] = true; }); }
  return S.cycle;
}
const newCycle = n => { S.cycle = { n: n || 1, start: Date.now(), done: {} }; S.nextDay = 0; };
function markDay(dayIdx, done) {
  const days = S.program.days, c = cyc(); if (!days[dayIdx]) return;
  if (done) c.done[days[dayIdx].id] = true; else delete c.done[days[dayIdx].id];
  if (days.every(d => c.done[d.id])) { newCycle(c.n + 1); toast('Cycle complete. Cycle ' + S.cycle.n + ' starts.'); return; }
  const next = days.findIndex(d => !c.done[d.id]); S.nextDay = next < 0 ? 0 : next;
}
function cycleProgress() {
  const c = cyc(), days = (S.program ? S.program.days : []).filter(d => !d.rest);
  const hs = S.history.filter(h => h.start >= c.start && (ui.dashMode === 'all' || h.prog));
  const muscles = new Set(), exs = new Set(); let sets = 0;
  hs.forEach(h => h.items.forEach(it => { exs.add(it.ex); muscles.add(exById(it.ex).muscle); sets += it.sets.filter(isWork).length; }));
  const t = { muscles: new Set(), exs: new Set(), sets: 0 };
  days.forEach(d => d.items.forEach(it => { t.exs.add(it.ex); t.muscles.add(exById(it.ex).muscle); t.sets += it.sets; }));
  return { muscles: [muscles.size, t.muscles.size], sets: [sets, t.sets], exs: [exs.size, t.exs.size] };
}
// Best recent result per exercise, for the Recent Records page.
function recentRecords() {
  const best = {};
  S.history.slice(-12).forEach(h => h.items.forEach(it => it.sets.filter(isWork).forEach(s => {
    const v = ui.recMode === 'vol' ? s.w * s.r : ui.recMode === 'reps' ? s.r : e1rm(s.w, s.r, 0);
    if (v > 0 && (!best[it.ex] || v > best[it.ex])) best[it.ex] = v;
  })));
  const rows = Object.entries(best).slice(-7), mx = Math.max(1, ...rows.map(r => r[1]));
  return rows.map(([id, v]) => ({ name: exById(id).name, pct: Math.max(4, (v / mx) * 100), label: ui.recMode === 'reps' ? `${v} reps` : `${kg(Math.round(v * 10) / 10)} kg` }));
}
// Scale weight: raw entries and a smoothed trend (each new entry moves the trend 25 % of the way).
const weightsSorted = () => (S.weights || []).slice().sort((a, b) => a.t - b.t);
function weightTrend() { let tr = null; return weightsSorted().map(w => { tr = tr == null ? w.kg : tr + (w.kg - tr) * 0.25; return { t: w.t, kg: Math.round(tr * 10) / 10 }; }); }
function lineSvg(vals, cls) {
  if (vals.length < 2) return vals.length ? `<svg class="spark ${cls}" viewBox="0 0 140 42"><circle cx="134" cy="21" r="3"/></svg>` : '<div class="spark"></div>';
  const lo = Math.min(...vals), hi = Math.max(...vals), sp = hi - lo || 1;
  const pts = vals.map((v, i) => [6 + i * (128 / (vals.length - 1)), hi === lo ? 21 : 34 - ((v - lo) / sp) * 26]);
  return `<svg class="spark ${cls}" viewBox="0 0 140 42"><polyline points="${pts.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ')}"/>${pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3"/>`).join('')}</svg>`;
}
const cycleNo = () => cyc().n;
const doneThisCycle = dayIdx => !!(S.program && S.program.days[dayIdx] && cyc().done[S.program.days[dayIdx].id]);

// ---------- Screens ----------
function paint() {
  const keep = [...document.querySelectorAll('[data-keep]')].map(el => [el.dataset.keep, el.scrollLeft]);
  const full = ui.screen;
  const view = full ? { active: viewActive, complete: viewComplete, preview: viewPreview, wsettings: viewWSettings, scsettings: viewScSettings, dashcfg: viewDashCfg, exlib: viewExLib, weight: viewWeight, program: viewProgram, analytics: viewAnalytics, history: viewHistory }[full]
    : { dash: viewDash, workout: viewWorkout, levels: viewLevels, more: viewMore }[ui.tab];
  const app = document.getElementById('view');
  app.className = full ? 'screen-' + full : 'tab-' + ui.tab;
  app.innerHTML = view();
  document.getElementById('tabs').hidden = !!full && !['analytics', 'weight', 'wsettings', 'scsettings', 'dashcfg', 'exlib'].includes(full);
  document.querySelectorAll('#tabs [data-tab]').forEach(b => b.setAttribute('aria-current', b.dataset.tab === ui.tab ? 'page' : 'false'));
  const m = document.getElementById('modal');
  m.innerHTML = ui.sheet ? `<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${viewSheet()}</div>` : '';
  m.hidden = !ui.sheet;
  keep.forEach(([k, x]) => { const el = document.querySelector(`[data-keep="${k}"]`); if (el) el.scrollLeft = x; });
  tick();
}

// ---------- Motion ----------
// Screens slide in from the right and slide back out. Sheets rise from the bottom and can be dragged down.
// A screen can also be closed by dragging from the left edge.
const EASE = 'cubic-bezier(.32,.72,0,1)', PUSH_MS = 380, SHEET_MS = 320;
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// Runs fn once when the animation ends. A timer backs it up, because a page in the background never finishes its animations.
function after(anim, ms, fn) { let done = false; const run = () => { if (done) return; done = true; fn(); }; anim.onfinish = run; setTimeout(run, ms + 90); return anim; }
const depth = () => (ui.screen ? (ui.prev ? 2 : 1) : 0);
const navState = { screen: ui.screen, tab: ui.tab, depth: depth(), sheet: !!ui.sheet, keys: false };
const scrolls = [];
let preScroll = 0, quiet = false;   // preScroll: where the page was before the action. quiet: draw with no movement.
const SWIPE = ['preview', 'program', 'analytics', 'history', 'weight', 'wsettings', 'scsettings', 'dashcfg', 'exlib'];

// A frozen copy of what is on screen now, fixed in place, to animate while the new screen is drawn underneath or on top.
function ghost(el, top) {
  const g = el.cloneNode(true); g.removeAttribute('id'); g.classList.add('ghost'); g.style.top = top + 'px';
  g.querySelectorAll('.keypad, .startbar').forEach(x => x.remove());
  document.body.appendChild(g); return g;
}
function render() {
  const app = document.getElementById('view'), modal = document.getElementById('modal');
  const still = quiet || calm(), before = { ...navState };
  const oldView = still ? null : app.cloneNode(true), oldModal = !still && before.sheet ? modal.cloneNode(true) : null;
  paint();
  const now = { screen: ui.screen, tab: ui.tab, depth: depth(), sheet: !!ui.sheet, keys: !!document.querySelector('.keypad') };
  Object.assign(navState, now);
  if (still) return;

  // 1. Screen change: push (deeper, or a new screen at the same level) or pop (back).
  if (now.screen !== before.screen) {
    const push = now.depth > before.depth || (now.depth === before.depth && now.screen);
    document.querySelectorAll('.ghost').forEach(x => x.remove());
    const g = ghost(oldView, -preScroll); g.className = oldView.className + ' ghost';
    if (push) {
      scrolls.push(preScroll);
      g.animate([{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(-28%)', opacity: 0.55 }], { duration: PUSH_MS, easing: EASE, fill: 'forwards' });
      app.classList.add('moving', 'top');
      after(app.animate([{ left: '100%' }, { left: '0%' }], { duration: PUSH_MS, easing: EASE }), PUSH_MS, () => { app.classList.remove('moving', 'top'); g.remove(); });
    } else {
      const y = scrolls.pop() || 0; window.scrollTo(0, y);
      g.style.zIndex = 8; g.classList.add('shadow');
      after(g.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(100%)' }], { duration: PUSH_MS, easing: EASE, fill: 'forwards' }), PUSH_MS, () => g.remove());
      app.classList.add('moving');
      after(app.animate([{ left: '-28%', opacity: 0.55 }, { left: '0%', opacity: 1 }], { duration: PUSH_MS, easing: EASE }), PUSH_MS, () => app.classList.remove('moving'));
    }
  } else if (!now.screen && now.tab !== before.tab) {
    app.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });   // tabs: a quick fade, no slide
  }

  // 2. Sheet: rises when it opens, drops when it closes. No movement when only its content changes.
  const sheet = modal.querySelector('.sheet');
  if (now.sheet && !before.sheet && sheet) {
    sheet.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], { duration: SHEET_MS, easing: EASE });
    modal.animate([{ backgroundColor: 'rgba(0,0,0,0)' }, { backgroundColor: 'rgba(0,0,0,.55)' }], { duration: SHEET_MS, easing: 'ease-out' });
  } else if (!now.sheet && before.sheet && oldModal) {
    oldModal.removeAttribute('id'); oldModal.hidden = false; oldModal.classList.add('modal-ghost'); document.body.appendChild(oldModal);
    const os = oldModal.querySelector('.sheet');
    if (os) os.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }], { duration: SHEET_MS - 60, easing: EASE, fill: 'forwards' });
    after(oldModal.animate([{ backgroundColor: 'rgba(0,0,0,.55)' }, { backgroundColor: 'rgba(0,0,0,0)' }], { duration: SHEET_MS - 60, easing: 'ease-in', fill: 'forwards' }), SHEET_MS - 60, () => oldModal.remove());
  }

  // 3. The number pad slides up the first time it shows.
  const pad = document.querySelector('.keypad');
  if (pad && !before.keys) pad.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], { duration: 240, easing: EASE });
}

// What is under the current screen: the screen we came from, or the tab. Used while dragging back from the edge.
function underHtml() {
  const s0 = ui.screen, p0 = ui.prev, target = p0 && (p0 !== 'active' || S.active) ? p0 : null;
  ui.screen = target; ui.prev = null;
  const views = { active: viewActive, complete: viewComplete, preview: viewPreview, wsettings: viewWSettings, scsettings: viewScSettings, dashcfg: viewDashCfg, exlib: viewExLib, weight: viewWeight, program: viewProgram, analytics: viewAnalytics, history: viewHistory };
  const tabs = { dash: viewDash, workout: viewWorkout, levels: viewLevels, more: viewMore };
  let html = '', cls = '';
  try { html = (target ? views[target] : tabs[ui.tab])(); cls = target ? 'screen-' + target : 'tab-' + ui.tab; } finally { ui.screen = s0; ui.prev = p0; }
  return { html, cls };
}

// Drag from the left edge to go back. Drag a sheet down by its top to close it.
let drag = null;
document.addEventListener('pointerdown', e => {
  if (drag || calm()) return;
  const sheet = e.target.closest && e.target.closest('#modal .sheet');
  if (sheet) {
    const r = sheet.getBoundingClientRect();
    if (e.clientY - r.top < 64 && !e.target.closest('button, input, textarea, select, a, label')) drag = { kind: 'sheet', el: sheet, y0: e.clientY, t0: e.timeStamp, dy: 0, h: r.height };
    return;
  }
  if (!ui.sheet && SWIPE.includes(ui.screen) && e.clientX < 26) {
    const app = document.getElementById('view'), u = underHtml(), under = document.createElement('main');
    under.className = u.cls + ' ghost under'; under.innerHTML = u.html; under.style.top = -(scrolls[scrolls.length - 1] || 0) + 'px';
    under.querySelectorAll('.keypad, .startbar').forEach(x => x.remove());
    document.body.appendChild(under); app.classList.add('moving', 'top');
    drag = { kind: 'back', el: app, under, x0: e.clientX, t0: e.timeStamp, dx: 0, w: window.innerWidth };
  }
}, { passive: true });
document.addEventListener('pointermove', e => {
  if (!drag) return;
  if (drag.kind === 'sheet') { drag.dy = Math.max(0, e.clientY - drag.y0); drag.el.style.transform = `translateY(${drag.dy}px)`; }
  else { drag.dx = Math.max(0, e.clientX - drag.x0); const k = Math.min(1, drag.dx / drag.w); drag.el.style.left = drag.dx + 'px'; drag.under.style.transform = `translateX(${-28 * (1 - k)}%)`; drag.under.style.opacity = 0.55 + 0.45 * k; }
}, { passive: true });
function endDrag(e) {
  if (!drag) return; const d = drag; drag = null;
  const speed = (d.kind === 'sheet' ? d.dy : d.dx) / Math.max(1, e.timeStamp - d.t0);   // px per ms
  if (d.kind === 'sheet') {
    const go = d.dy > d.h * 0.3 || (d.dy > 40 && speed > 0.6);
    const a = d.el.animate([{ transform: `translateY(${d.dy}px)` }, { transform: go ? 'translateY(100%)' : 'translateY(0)' }], { duration: go ? 220 : 260, easing: EASE, fill: 'forwards' });
    after(a, go ? 220 : 260, () => { d.el.style.transform = ''; a.cancel(); if (go) { quiet = true; close(); save(); render(); quiet = false; navState.sheet = false; } });
    return;
  }
  const go = d.dx > d.w * 0.35 || (d.dx > 30 && speed > 0.5);
  const a = d.el.animate([{ left: d.dx + 'px' }, { left: go ? '100%' : '0px' }], { duration: go ? 240 : 280, easing: EASE, fill: 'forwards' });
  d.under.animate([{ transform: d.under.style.transform || 'translateX(-28%)' }, { transform: go ? 'translateX(0)' : 'translateX(-28%)' }], { duration: go ? 240 : 280, easing: EASE, fill: 'forwards' });
  after(a, go ? 240 : 280, () => {
    a.cancel(); d.el.style.left = ''; d.el.classList.remove('moving', 'top');
    if (go) { const y = scrolls.pop() || 0; quiet = true; actions.closeScreen(); save(); render(); quiet = false; window.scrollTo(0, y); }
    d.under.remove();
  });
}
document.addEventListener('pointerup', endDrag, { passive: true });
document.addEventListener('pointercancel', endDrag, { passive: true });

// Big wide title on the left, round buttons on the right. Same on every tab.
const hero = (title, btns = '') => `<header class="hero"><h1 class="wide">${title}</h1><div class="hbtns">${btns}</div></header>`;
const hbtn = (act, icon, label, extra = '') => `<button class="hbtn" data-act="${act}" ${extra} aria-label="${label}">${icon}</button>`;

const ring = (val, target, color, big) => {
  const r = big ? 56 : 30, c = 2 * Math.PI * r, size = (r + 5) * 2, p = target ? Math.min(1, val / target) : 0;
  return `<div class="ring ${big ? 'big' : ''}"><svg viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="track"/>
    ${p > 0 ? `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${color}" stroke-dasharray="${(c * p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>` : ''}</svg>
    <div><b>${val}</b><span>${Math.max(0, target - val)} left</span></div></div>`;
};

const DASH_FOCUS = { cycle: 'Cycle Workouts', records: 'Recent Records' };
const DASH_CARDS = [['Insights & Analytics', [['workouts', 'Workouts'], ['weight', 'Weight Trend']]], ['Habits', [['weighin', 'Weigh-In'], ['habitWorkouts', 'Workouts']]], ['Body Metrics', [['scale', 'Scale Weight']]], ['Muscle Groups', [['muscles', 'Top Muscle Groups']]]];
const dashCfg = () => { const d = S.settings.dash || {}; return { focus: (d.focus || ['cycle', 'records']).filter(k => DASH_FOCUS[k]), off: d.off || {} }; };
function viewDash() {
  const cfg = dashCfg(), on = k => !cfg.off[k];
  const pages = cfg.focus.filter(k => on('f_' + k)); ui.dashPage = Math.min(ui.dashPage, Math.max(0, pages.length - 1));
  const w = cycleProgress();
  const last = S.history.slice(-7);
  const setsArr = last.map(h => sessionStats(h).sets);
  const mx = Math.max(1, ...setsArr);
  const today = new Date().setHours(0, 0, 0, 0), ws = weekStart(Date.now());
  const grid = Array.from({ length: 30 }, (_, i) => { const t = today - (29 - i) * DAY; return S.history.some(h => h.start >= t && h.start < t + DAY); });
  const thisWeek = new Set(S.history.filter(h => h.start >= ws).map(h => new Date(h.start).toDateString())).size;
  const trend = weightTrend(), ws7 = weightsSorted().slice(-7);
  const wgrid = Array.from({ length: 30 }, (_, i) => { const t = today - (29 - i) * DAY; return (S.weights || []).some(x => x.t >= t && x.t < t + DAY); });
  const wWeek = new Set((S.weights || []).filter(x => x.t >= ws).map(x => new Date(x.t).toDateString())).size;
  const m7 = muscleSets(Date.now() - 7 * DAY, Date.now() + DAY);
  const top2 = Object.entries(m7).sort((a, b) => b[1] - a[1]).slice(0, 2);
  const focus = {
    records: () => `<section class="top dashtop">
      <h2 class="rec-title">Recent Records</h2>
      <div class="recbars">${recentRecords().map(r => `<div><span>${esc(r.name)}</span><i><b style="width:${r.pct}%"></b>${r.label}</i></div>`).join('') || '<p class="muted">Log a workout to see your records.</p>'}</div>
      <div class="seg" role="group">${[['vol', 'Volume'], ['reps', 'Reps'], ['1rm', '1-RM']].map(([k, l]) => `<button data-act="recMode" data-m="${k}" aria-pressed="${ui.recMode === k}">${l}</button>`).join('')}</div>
    </section>`,
    cycle: () => `<section class="top dashtop">
      <h2>Cycle Workouts</h2>
      <div class="rings">${ring(w.muscles[0], w.muscles[1], 'var(--blue-soft)')}${ring(w.sets[0], w.sets[1], 'var(--coral)', true)}${ring(w.exs[0], w.exs[1], 'var(--cyan)')}</div>
      <div class="ring-labels">
        <div><b>Muscles</b><span>${w.muscles[1]} target</span></div>
        <div><b>Sets</b><span>${w.sets[1]} target</span></div>
        <div><b>Exercises</b><span>${w.exs[1]} target</span></div>
      </div>
      <div class="seg" role="group"><button data-act="dashMode" data-m="prog" aria-pressed="${ui.dashMode === 'prog'}">Active Program</button><button data-act="dashMode" data-m="all" aria-pressed="${ui.dashMode === 'all'}">All Workouts</button></div>
    </section>`,
  };
  const card = {
    workouts: () => `<button class="card tile" data-act="open" data-screen="analytics" data-metric="sets"><b>Workouts</b><span>Last 7 Workouts</span>
          <div class="bars">${setsArr.map(v => `<i style="height:${Math.max(8, (v / mx) * 100)}%"></i>`).join('')}</div>
          <p><b>${setsArr.length ? setsArr[setsArr.length - 1] : 0}</b> sets ${I.right}</p></button>`,
    weight: () => `<button class="card tile" data-act="open" data-screen="weight"><b>Weight Trend</b><span>Last 7 Days</span>
          ${lineSvg(trend.slice(-7).map(x => x.kg), '')}<p><b>${trend.length ? trend[trend.length - 1].kg.toFixed(1) : '--'}</b> kg ${I.right}</p></button>`,
    weighin: () => `<button class="card tile" data-act="sheet" data-type="weight"><b>Weigh-In</b><span>Last 30 Days</span>
          <div class="dotgrid">${wgrid.map(o => `<i class="${o ? 'on g' : ''}"></i>`).join('')}</div><p><b>${wWeek}/7</b> this week ${I.right}</p></button>`,
    habitWorkouts: () => `<button class="card tile" data-act="open" data-screen="history"><b>Workouts</b><span>Last 30 Days</span>
          <div class="dotgrid">${grid.map(o => `<i class="${o ? 'on' : ''}"></i>`).join('')}</div><p><b>${thisWeek}</b> this week ${I.right}</p></button>`,
    scale: () => `<button class="card tile" data-act="sheet" data-type="weight"><b>Scale Weight</b><span>Last 7 Entries</span>${lineSvg(ws7.map(x => x.kg), 'green')}<p><b>${ws7.length ? ws7[ws7.length - 1].kg.toFixed(1) : '--'}</b> kg ${I.right}</p></button>`,
    muscles: () => top2.map(([m, v]) => `<button class="card tile" data-act="tab" data-tab="levels"><b>${m}</b><span>Last 7 Days</span><div class="spark"></div><p><b>${v ? kg(v) : '--'}</b> sets ${I.right}</p></button>`).join(''),
  };
  const LINK = { 'Body Metrics': 'data-act="open" data-screen="weight"', 'Muscle Groups': 'data-act="tab" data-tab="levels"' };
  const sections = DASH_CARDS.map(([title, cards]) => { const vis = cards.filter(([k]) => on(k)); if (!vis.length) return '';
    return `<div class="h2row"><h2>${title.replace('&', '&amp;')}</h2>${LINK[title] ? `<button class="link" ${LINK[title]}>See All</button>` : ''}</div><div class="two">${vis.map(([k]) => card[k]()).join('')}</div>`; }).join('');
  return `${hero('Dashboard', hbtn('open', I.sliders, 'Customize dashboard', 'data-screen="dashcfg"'))}
    ${pages.length ? focus[pages[ui.dashPage]]() : ''}
    ${pages.length > 1 ? `<div class="pager">${pages.map((k, i) => `<button data-act="dashPage" data-p="${i}" class="${ui.dashPage === i ? 'on' : ''}" aria-label="${DASH_FOCUS[k]}"></button>`).join('')}</div>` : ''}
    <section class="pad dashsecs">${sections || '<p class="muted">Every card is hidden. Turn some back on with the button at the top.</p>'}</section>`;
}

function viewDashCfg() {
  const cfg = dashCfg(), on = k => !cfg.off[k];
  return `<header class="bar"><button class="ic" data-act="closeScreen" aria-label="Back">${I.back}</button><h1>Customize Dashboard</h1><button class="ic savebtn" data-act="closeScreen">Save</button></header>
    <section class="pad">
      <h2>Primary Focus</h2>
      <div class="two">${cfg.focus.map((k, i) => `<div class="card ftile"><b>${DASH_FOCUS[k]}</b><input type="checkbox" class="swc" data-bind="dashOn" data-k="f_${k}" ${on('f_' + k) ? 'checked' : ''} aria-label="Show ${DASH_FOCUS[k]}">
        <button class="ic" data-act="dashSwap" aria-label="Move ${DASH_FOCUS[k]} ${i ? 'left' : 'right'}">${i ? I.back : I.right}</button></div>`).join('')}</div>
      ${DASH_CARDS.map(([title, cards]) => `<h2>${title.replace('&', '&amp;')}</h2><div class="card rows">${cards.map(([k, label]) => `<label class="mrow srow"><span><b>${label}</b></span><input type="checkbox" data-bind="dashOn" data-k="${k}" ${on(k) ? 'checked' : ''}></label>`).join('')}</div>`).join('')}
      <button class="btn" data-act="dashReset">Reset to App Defaults</button>
    </section>`;
}

const chips = exIds => { const ms = [...new Set(exIds.flatMap(id => { const e = exById(id); return [e.muscle, ...(e.sec || [])]; }))].sort(); return `<div class="chips">${ms.map(m => `<span>${m}</span>`).join('')}</div>`; };
// One exercise: main muscle filled, helper muscles outlined.
const chipsEx = id => { const e = exById(id); return `<div class="chips"><span>${e.muscle}</span>${(e.sec || []).map(m => `<span class="o">${m}</span>`).join('')}</div>`; };

function viewWorkout() {
  const ws = weekStart(Date.now()), today = new Date().setHours(0, 0, 0, 0);
  const DN = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const pill = (t, i) => { const d = new Date(t), did = S.history.some(h => h.start >= t && h.start < t + DAY);
    return `<div class="daypill ${did ? 'did' : ''} ${t === today ? 'today' : ''}"><b>${d.getDate()}</b><span>${DN[i]}</span></div>`; };
  const weekRow = start => [0, 1, 2, 3, 4, 5, 6].map(i => pill(new Date(start).setDate(new Date(start).getDate() + i), i)).join('');
  let strip = weekRow(ws);
  if (ui.cal) {
    // Eight past weeks up to this one, newest at the bottom, with a label when the month changes.
    const rows = []; let lastM = -1;
    for (let k = 8; k >= 0; k--) { const st = new Date(ws); st.setDate(st.getDate() - 7 * k); const m = new Date(st.getTime() + 6 * DAY).getMonth();
      if (m !== lastM) { rows.push(`<p class="mlabel">${new Date(st.getTime() + 6 * DAY).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }).replace(' ', " '")}</p>`); lastM = m; }
      rows.push(`<div class="week">${weekRow(st.getTime())}</div>`); }
    strip = rows.join('');
  }
  const p = S.program;
  const row = (d, i) => { const done = doneThisCycle(i);
    if (d.rest) return `<button class="wrow restrow ${done ? 'dimmed' : ''}" data-act="restToggle" data-i="${i}" aria-pressed="${done}"><div><b>Rest Day</b></div><span class="box ${done ? 'on' : ''}">${done ? I.check : ''}</span></button>`;
    return `<button class="wrow ${done ? 'dimmed' : ''}" data-act="daySheet" data-i="${i}">
    <div><b>${esc(d.name)}</b>
    <p>${d.items.length ? esc(d.items.map(it => exById(it.ex).name).join(', ')) : 'No exercises yet'}</p>
    ${chips(d.items.map(it => it.ex))}</div>
    <span class="box ${done ? 'on' : ''}">${done ? I.check : ''}</span></button>`; };
  return `${hero('Workout', hbtn('toggleCal', I.cal, 'Calendar', ui.cal ? 'aria-pressed="true"' : '') + hbtn('plusSheet', I.plus, 'Add') + hbtn('sheet', I.dots, 'More', 'data-type="wmore"'))}
    ${ui.cal ? `<div class="cal top">${strip}</div>` : `<div class="week top">${strip}</div>`}
    <section class="pad">
      ${S.active ? `<button class="btn primary" data-act="resume">Resume Workout</button>` : ''}
      <div class="h2row"><h2>Active Program</h2>${p ? `<span class="link">Cycle ${cycleNo()}</span>` : ''}</div>
      ${p ? `<div class="card prog">
        <div class="prog-head"><span class="sq amber">${I.puzzle}</span>
          <button class="grow" data-act="editProgram"><b>${esc(p.name)}</b><span>${p.days.filter(d => !d.rest).length} workouts</span></button>
          <button class="ic" data-act="toggleProg" aria-label="Collapse">${ui.progOpen ? I.up : I.down}</button></div>
        ${ui.progOpen ? p.days.map(row).join('') : ''}
      </div>` : `<div class="card empty"><p class="muted">No active program. Pick one from the library below.</p></div>`}
      ${S.settings.hideLib ? '' : `<div class="h2row"><h2>Workout Library</h2></div>`}
      ${(S.settings.hideLib ? [] : TEMPLATES).map((t, i) => `<div class="card prog">
        <div class="prog-head"><span class="sq ${['red', 'blue', 'green'][i % 3]}">${I.puzzle}</span>
          <button class="grow" data-act="toggleLib" data-i="${i}"><b>${esc(t.name)}</b><span>${t.days.length} workouts</span></button>
          <button class="ic" data-act="toggleLib" data-i="${i}" aria-label="Expand">${ui.lib === i ? I.up : I.down}</button></div>
        ${ui.lib === i ? t.days.map(d => `<div class="wrow"><div><b>${esc(d.name)}</b><p>${esc(d.items.map(it => exById(it.ex).name).join(', '))}</p>${chips(d.items.map(it => it.ex))}</div></div>`).join('')
          + `<div class="wrow"><button class="btn primary" data-act="useTemplate" data-i="${i}">Set as Active Program</button></div>` : ''}
      </div>`).join('')}
    </section>`;
}

const rirClass = n => (n == null ? '' : n <= 1 ? 'r-red' : n <= 3 ? 'r-amber' : n <= 5 ? 'r-green' : 'r-blue');
const rirBadge = n => (n == null || n === '' ? '' : `<i class="rir ${rirClass(+n)}">${+n >= 6 ? '6+' : n}</i>`);

function viewProgram() {
  const p = S.program; ui.day = Math.min(ui.day, p.days.length - 1);
  const d = p.days[ui.day];
  const tm = {};
  (ui.tmCycle ? p.days : [d]).forEach(x => x.items.forEach(it => { const e = exById(it.ex); [e.muscle, ...(e.sec || [])].filter(m => MUSCLES.includes(m)).forEach(m => { tm[m] = tm[m] || { ex: 0, sets: 0 }; tm[m].ex++; tm[m].sets += it.sets; }); }));
  return `<header class="bar"><button class="ic" data-act="closeScreen" aria-label="Back">${I.back}</button><h1>${esc(p.name)}</h1><button class="ic" data-act="progMenu" aria-label="Program options">${I.sliders}</button></header>
    <div class="tabsrow" data-keep="days">${p.days.map((x, i) => `<button data-act="day" data-i="${i}" aria-selected="${i === ui.day}">${esc(x.name)}</button>`).join('')}<button data-act="addDay" aria-label="Add workout">+</button></div>
    <div class="pills" data-keep="ppills">
      <button data-act="sheet" data-type="gyms">${I.gym}${esc(gym().name)} ${I.down}</button>
      <button data-act="renameDay">${I.edit}Rename</button>
      <button data-act="reorder">${I.sort}Re-order</button>
      <button data-act="dupDay">${I.note}Duplicate</button>
      <button data-act="start" data-i="${ui.day}">${I.workout}Start</button>
      <button data-act="delDay">${I.trash}Delete</button></div>
    <section class="pad">
      <div class="h2row first"><h2>Target Muscles</h2><div class="seg mini"><button data-act="tmMode" data-v="" aria-pressed="${!ui.tmCycle}">Day</button><button data-act="tmMode" data-v="1" aria-pressed="${!!ui.tmCycle}">Cycle</button></div></div>
      <div class="hscroll" data-keep="tm">${Object.entries(tm).sort((a, b) => b[1].sets - a[1].sets).map(([m, v]) => `<div class="mcard">${miniBody(m)}<div><b>${m}</b><span>${v.ex} exercises</span><span>${v.sets} sets</span></div></div>`).join('') || '<p class="muted">Add exercises to see them here.</p>'}</div>
      <div class="h2row"><h2>${d.items.length} Exercises</h2><button class="link" data-act="pick" data-for="day">Add Exercises</button></div>
    </section>
    ${d.items.map((it, i) => { const e = exById(it.ex); return `<section class="pex">
      <div class="pex-head">${thumb(it.ex, 'tall')}<div class="grow"><b>${esc(e.name)}</b>${it.ssNext ? '<em class="sstag">Superset with next</em>' : ''}${chipsEx(it.ex)}</div><button class="ic" data-act="itemMenu" data-i="${i}" aria-label="Options for ${esc(e.name)}">${I.dots}</button></div>
      <button class="wk" data-act="itemEdit" data-i="${i}"><b>1 Cycle</b>
        ${setRows(it).map((q, k) => `<span><i class="n">${k + 1}</i>${q.lo != null ? q.lo + '-' + q.hi + ' reps' : TYPE_NAMES[q.type] || 'Set'}${q.type !== 'n' && q.lo != null ? ' <em class="stype">' + (TYPE_NAMES[q.type] || '').replace(' Set', '') + '</em>' : ''} ${rirBadge(q.rir != null ? q.rir : it.rir)}</span>`).join('')}</button>
      <button class="wk note" data-act="itemEdit" data-i="${i}"><b>Rest Timer</b><span>${clock(it.rest)}</span></button>
    </section>`; }).join('')}`;
}

const estMin = d => Math.round(d.items.reduce((n, it) => n + setRows(it).reduce((x, q) => x + (q.rest != null ? q.rest : it.rest) + 130, 0), 0) / 60);
function viewPreview() {
  const p = S.program; ui.pv = Math.min(ui.pv, p.days.length - 1);
  const d = p.days[ui.pv], tm = {};
  d.items.forEach(it => { const e = exById(it.ex); [e.muscle, ...(e.sec || [])].filter(m => MUSCLES.includes(m)).forEach(m => { tm[m] = tm[m] || { ex: 0, sets: 0 }; tm[m].ex++; tm[m].sets += it.sets; }); });
  return `<header class="bar three"><button class="ic" data-act="closeScreen" aria-label="Back">${I.back}</button><h1>${esc(d.name)}</h1><span><button class="ic" data-act="sheet" data-type="gyms" aria-label="Gym profiles">${I.gym}</button><button class="ic" data-act="editProgram" data-i="${ui.pv}" aria-label="Edit workout">${I.dots}</button></span></header>
    <section class="pad">
      <h2>Target Muscles</h2>
      <div class="hscroll" data-keep="pvtm">${Object.entries(tm).sort((a, b) => b[1].sets - a[1].sets).map(([m, v]) => `<div class="mcard">${miniBody(m)}<div><b>${m}</b><span>${v.ex} exercises</span><span>${v.sets} sets</span></div></div>`).join('') || '<p class="muted">No exercises yet.</p>'}</div>
      <div class="h2row"><div><h2>${d.items.length} Exercises</h2><p class="muted">Estimated workout time is ${estMin(d)} min</p></div><button class="hbtn big" data-act="editProgram" data-i="${ui.pv}" aria-label="Add exercises">${I.plus}</button></div>
    </section>
    ${d.items.map(it => { const e = exById(it.ex); return `<div class="pvrow">${thumb(it.ex, 'pv')}<div class="grow"><b>${esc(e.name)}</b>${it.ssNext ? '<em class="sstag">Superset with next</em>' : ''}
      ${setRows(it).map((q, k) => `<span><i class="n">${k + 1}</i>${q.lo != null ? q.lo + '-' + q.hi + ' reps' : TYPE_NAMES[q.type] || 'Set'}${q.type !== 'n' && q.lo != null ? ' <em class="stype">' + (TYPE_NAMES[q.type] || '').replace(' Set', '') + '</em>' : ''} ${rirBadge(q.rir != null ? q.rir : it.rir)}</span>`).join('')}${chipsEx(it.ex)}</div></div>`; }).join('')}
    <div class="startbar"><button class="btn primary" data-act="start" data-i="${ui.pv}">${S.active ? 'Resume Workout' : 'Start Workout'}</button></div>`;
}

function viewActive() {
  const a = S.active;
  ui.cur = a.items.length ? Math.min(ui.cur, a.items.length - 1) : 0;
  const it = a.items[ui.cur], ex = it && exById(it.ex);
  const strip = a.items.map((x, i) => { const dn = x.sets.filter(s => s.done).length; return `<button class="tile ${i === ui.cur ? 'cur' : ''} ${x.ssNext ? 'ss' : ''}" data-act="cur" data-i="${i}" aria-label="${esc(exById(x.ex).name)}">${thumb(x.ex, 'lg')}<i><b style="width:${x.sets.length ? (dn / x.sets.length) * 100 : 0}%"></b></i></button>`; }).join('');
  let n = 0;
  const doneCount = it ? it.sets.filter(s => s.done).length : 0;
  return `<header class="live"><button class="ic" data-act="wmenu" aria-label="Workout menu">${I.menu}</button><span id="elapsed" class="t" ${S.settings.showTimer === false ? 'style="visibility:hidden"' : ''}>0:00:00</span>
      <span class="rest">${I.timer}<span id="restTime" class="t">0:00</span></span><button class="restbar" data-act="restSkip" aria-label="Skip rest"><b id="restBar"></b></button></header>
    <div class="strip" data-keep="strip">${strip}<button class="tile add" data-act="pick" data-for="session" aria-label="Add exercise">${I.plus}<i></i></button></div>
    ${it ? `<div class="exname"><h2>${esc(ex.name)}</h2><p>${it.ssNext || (ui.cur > 0 && a.items[ui.cur - 1].ssNext) ? 'Superset • ' : ''}Set ${Math.min(doneCount + 1, it.sets.length)} of ${it.sets.length}</p></div>
    <div class="pills" data-keep="apills">
      <button class="round" data-act="autofill" aria-label="Fill with today's target">${I.wand}</button>
      <button data-act="exInfo">${I.info}Info</button>
      <button data-act="warmSheet">${I.warm}Warm Up</button>
      <button data-act="sheet" data-type="targets">${I.target}Targets</button>
      <button data-act="sheet" data-type="swap">${I.swap}Swap</button>
      <button data-act="noteSheet">${I.note}Note</button>
      <button data-act="sheet" data-type="superset">${I.sort}Superset</button>
      <button data-act="sheet" data-type="equip">${I.gym}Equipment</button>
      <button data-act="sheet" data-type="exMore">${I.dots}More</button></div>
        <div class="grid">
      <div class="row head"><span>Set</span><button data-act="colMode">${ui.colMode === 'prev' ? 'Previous' : 'Auto'} ${I.swap}</button><span>kg</span><span>Reps</span>
        <button class="box ${it.sets.length && doneCount === it.sets.length ? 'on' : ''}" data-act="checkAll" aria-label="Check all sets">${it.sets.length && doneCount === it.sets.length ? I.check : ''}</button></div>
      ${it.sets.map((s, j) => {
        if (s.type === 'w' && s.done && S.settings.hideWarmDone !== false) return '';
        const label = s.type === 'w' ? 'W' : ++n;
        let mid = '-';
        if (s.type === 'w') mid = 'Warm Up';
        else if (ui.colMode === 'prev') mid = s.prev ? `${s.prev.w ? kg(s.prev.w) + ' kg x ' : ''}${s.prev.r}${s.prev.rir != null ? `<small>${s.prev.rir} RIR</small>` : ''}` : '-';
        else mid = `${s.tw && !s.noRange ? kg(s.tw) + ' kg x ' + s.tr + '+' : s.noRange ? TYPE_NAMES[s.type] || 'Set' : T(it, s, 'lo') + '-' + T(it, s, 'hi') + ' reps'}<small>${s.type !== 'n' && !s.noRange ? (TYPE_NAMES[s.type] || '').replace(' Set', '') + ' • ' : ''}${T(it, s, 'rir')} RIR</small>`;
        const f = ui.focus && ui.focus.s === j ? ui.focus.f : null;
        return `<div class="row ${s.done ? 'done' : ''}">
          <button class="num" data-act="setMenu" data-s="${j}" aria-label="Set options">${label}</button>
          <span class="mid">${mid}</span>
          <button class="cell ${f === 'w' ? 'focus' : ''}" data-act="focus" data-s="${j}" data-f="w" aria-label="Weight">${esc(s.w) || '&nbsp;'}</button>
          <button class="cell ${f === 'r' ? 'focus' : ''}" data-act="focus" data-s="${j}" data-f="r" aria-label="Reps">${esc(s.r) || '&nbsp;'}${s.partial ? '<em>P</em>' : ''}${rirBadge(s.rir)}</button>
          <button class="box ${s.done ? 'on' : ''}" data-act="check" data-s="${j}" aria-pressed="${s.done}" aria-label="Set done">${s.done ? I.check : ''}</button>
        </div>`; }).join('')}
      ${S.settings.hideWarmDone !== false && it.sets.some(q => q.type === 'w' && q.done) ? `<p class="warmdone">${it.sets.filter(q => q.type === 'w' && q.done).length} warm-up sets done</p>` : ''}
      <button class="num add" data-act="addSet" aria-label="Add set">${I.plus}</button>
    </div>
    <button class="notecard" data-act="noteSheet"><b>Program Note</b>${I.pin}<span>${esc((progItem() || {}).note) || 'Standard Set'}</span></button>` : `<div class="pad"><p class="muted">This workout is empty. Tap + to add an exercise.</p></div>`}
    ${ui.focus && it ? keypad(it, ex) : ''}`;
}

function keypad(it, ex) {
  const set = it.sets[ui.focus.s];
  let topRow;
  const isW = ui.focus.f === 'w';
  if (isW && ex.equip === 'Barbell' && ui.plates) {
    const w = num(set.w), bar = gym().bar; let side = w != null ? (w - bar) / 2 : -1; const cnt = {};
    if (side >= 0) gym().plates.slice().sort((a, b) => b - a).forEach(p => { while (side >= p - 1e-9) { cnt[p] = (cnt[p] || 0) + 1; side -= p; } });
    const col = p => (p >= 25 ? 'var(--red)' : p >= 20 ? 'var(--blue)' : p >= 15 ? 'var(--amber)' : p >= 10 ? 'var(--green)' : 'var(--mid)');
    const list = Object.keys(cnt).map(Number).sort((a, b) => b - a);
    topRow = `<div class="platerow"><span class="barbell">${list.map(p => `<i style="background:${col(p)};height:${14 + Math.min(26, p)}px"></i>`).join('')}</span>
      <div>${list.map(p => `<span><i style="background:${col(p)}"></i>${cnt[p]} x ${kg(p)}</span>`).join('')}<span><i class="barico"></i>${kg(bar)}</span>${side > 0.01 ? `<span>${kg(side * 2)} left over</span>` : ''}</div></div>`;
  } else if (isW) { topRow = '';
  } else {
    topRow = `<div class="rirrow">${[0, 1, 2, 3, 4, 5, 6].map(v => `<button class="rir ${rirClass(v)} ${String(set.rir) === String(v) ? 'sel' : ''}" data-act="rir" data-v="${v}" aria-label="${v} reps in reserve">${v === 6 ? '6+' : v}</button>`).join('')}<button class="rir q" data-act="rirHelp" aria-label="What is this">?</button></div>`;
  }
  const k = v => `<button data-act="key" data-k="${v}">${v}</button>`;
  return `<div class="keypad">${topRow}
    <div class="keys">
      <div class="nums">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(k).join('')}<button data-act="key" data-k=".">${ui.focus.f === 'w' ? '.' : ''}</button>${k(0)}<button data-act="key" data-k="back" aria-label="Delete">${I.bksp}</button></div>
      <div class="side">
        <button data-act="hideKeys" aria-label="Hide keypad">${I.kbd}</button>
        ${isW ? `<button data-act="togglePlates" ${ex.equip === 'Barbell' ? '' : 'disabled'} aria-label="Plate calculator">${I.plates}</button>
        <div class="fp step"><button data-act="step" data-dir="-1" aria-label="Less weight">${I.minus}</button><button data-act="step" data-dir="1" aria-label="More weight">${I.plus}</button></div>
        <button class="ok soft" data-act="ok" aria-label="Next">${I.next}</button>`
        : `<button data-act="clearRir">RIR</button>
        <div class="fp"><button data-act="fp" data-v="f" aria-pressed="${!set.partial}">F</button><button data-act="fp" data-v="p" aria-pressed="${!!set.partial}">P</button></div>
        <button class="ok" data-act="ok" aria-label="Confirm">${I.check}</button>`}
      </div>
    </div></div>`;
}

function viewComplete() {
  const { entry, records } = ui.done, st = sessionStats(entry);
  const lv = {};
  entry.items.forEach(it => { const e = exById(it.ex); lv[e.muscle] = 1; (e.sec || []).forEach(m => { lv[m] = lv[m] || 0.5; }); });
  return `<header class="bar"><button class="ic" data-act="closeScreen" aria-label="Close">${I.x}</button><h1>Workout Complete</h1><span class="ic"></span></header>
    <div class="bodies">${body(lv, 'front')}${body(lv, 'back')}</div>
    ${records.length ? `<div class="hscroll recs" data-keep="recs">${records.map(r => `<div class="rec">${I.trophy}<div class="v"><b>${esc(r.val)}</b><span>New!</span></div><b>${esc(exById(r.ex).name)}</b><span>${r.kind}</span></div>`).join('')}</div>` : ''}
    <section class="pad"><h2>Workout Details</h2>
      <div class="card list"><div><span>Workout</span><b>${esc(entry.dayName)}</b></div><div><span>Duration</span><b>${mins(entry.end - entry.start)} min</b></div><div><span>Sets</span><b>${st.sets}</b></div><div><span>Volume</span><b>${st.vol.toLocaleString('en-US')} kg</b></div></div>
      ${entry.prog && ui.done.changed ? `<label class="field switch tsw"><span><b>Update Workout Plan</b>Save these changes as the new default for this workout</span><input type="checkbox" data-bind="planUp"></label>` : ''}
      <button class="btn primary" data-act="doneComplete">Done</button></section>`;
}

function viewLevels() {
  const now = Date.now(), raw = muscleSets(now - 28 * DAY, now + DAY);
  const avg = Object.fromEntries(MUSCLES.map(m => [m, raw[m] / 4]));
  const lv = Object.fromEntries(MUSCLES.map(m => [m, avg[m] / 12]));
  const max = Math.max(4, ...Object.values(avg));
  const sec = (title, list) => `<h2>${title}</h2><div class="card rows">${list.map(m => `<div class="lvl">${miniBody(m)}<div class="grow"><b>${m}</b><span>${kg(Math.round(avg[m] * 10) / 10)} sets</span></div><i><b style="width:${(avg[m] / max) * 100}%"></b></i></div>`).join('')}</div>`;
  return `${hero('Levels')}
    <section class="top figure">
      ${body(lv, ui.back ? 'back' : 'front')}
      <button class="fab" data-act="flip" aria-label="Flip body">${I.flip}</button>
      <p class="legend"><i></i>Average weekly sets over <u>1-month</u></p></section>
    <section class="pad">${sec('Upper Body Levels', UPPER)}${sec('Lower Body Levels', LOWER)}</section>`;
}

function viewAnalytics() {
  const R = { '1W': [7, 1], '1M': [4, 7], '3M': [12, 7], '6M': [26, 7], '1Y': [12, 30], All: [12, 30] }[ui.range] || [7, 1], [nb, span] = R;
  const end = span === 1 ? new Date().setHours(0, 0, 0, 0) + DAY : weekStart(Date.now()) + 7 * DAY;
  const key = ui.metric === 'sets' ? 'sets' : 'vol', unit = ui.metric === 'sets' ? 'sets' : 'kg', Name = ui.metric === 'sets' ? 'Sets' : 'Volume';
  const buckets = Array.from({ length: nb }, (_, i) => { const from = end - (nb - i) * span * DAY; const hs = S.history.filter(h => h.start >= from && h.start < from + span * DAY);
    const d = new Date(from); return { from, v: hs.reduce((n, h) => n + sessionStats(h)[key], 0), label: span === 1 ? d.toLocaleDateString('en-US', { weekday: 'short' }) : span === 7 ? `${d.getMonth() + 1}/${d.getDate()}` : d.toLocaleDateString('en-US', { month: 'short' }) }; });
  const total = buckets.reduce((n, b) => n + b.v, 0), used = buckets.filter(b => b.v > 0).length;
  const raw = Math.max(10, ...buckets.map(b => b.v)), mx = Math.ceil(raw / 10) * 10;
  const fmt = v => Math.round(v).toLocaleString('en-US');
  const dfmt = t => new Date(t).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  const every = Math.ceil(nb / 7);
  const months = {};
  S.history.slice().reverse().forEach(h => { const k = new Date(h.start).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); (months[k] = months[k] || []).push(h); });
  return `<header class="bar"><button class="ic" data-act="closeScreen" aria-label="Back">${I.back}</button><h1>Workouts</h1><span class="ic"></span></header>
    <div class="tabsrow even ic2"><button data-act="metric" data-m="sets" aria-selected="${ui.metric === 'sets'}">${I.next}Sets</button><button data-act="metric" data-m="vol" aria-selected="${ui.metric === 'vol'}">${I.plates}Volume</button></div>
    <section class="top chartbox">
      <div class="stats"><div><span>Average ${Name}</span><b>${used ? fmt(total / used) : '--'} <small>${unit}</small></b></div><div><span>Total ${Name}</span><b>${fmt(total)} <small>${unit}</small></b></div></div>
      <p class="range">${dfmt(buckets[0].from)} - ${dfmt(end - DAY)}, ${new Date(end - DAY).getFullYear()}</p>
      <div class="chart2"><div class="grid2"><i></i><i></i><i></i></div>
        <div class="bigbars">${buckets.map((b, i) => `<div><i style="height:${(b.v / mx) * 100}%"></i><span>${i % every === 0 ? b.label : ''}</span></div>`).join('')}</div>
        <div class="yax"><span>${fmt(mx)}</span><span>${fmt(mx / 2)}</span><span>0</span></div></div>
      <div class="seg wide3">${['1W', '1M', '3M', '6M', '1Y', 'All'].map(r => `<button data-act="range" data-r="${r}" aria-pressed="${ui.range === r}">${r}</button>`).join('')}</div>
    </section>
    <section class="pad">
      <div class="card legendcard"><i class="lgd"></i>${Name}</div>
      ${Object.entries(months).map(([k, hs]) => `<h2>${k}</h2>${hs.map(h => { const st = sessionStats(h); return `<button class="card hrow" data-act="openDetail" data-id="${h.id}"><div><b>${ui.metric === 'sets' ? st.sets + ' sets' : fmt(st.vol) + ' kg'}</b><span>${new Date(h.start).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}</span></div>${I.right}</button>`; }).join('')}`).join('') || '<p class="muted">No workouts yet.</p>'}
    </section>`;
}

function viewHistory() {
  return `<header class="bar"><button class="ic" data-act="closeScreen" aria-label="Back">${I.back}</button><h1>History</h1><span class="ic"></span></header>
    <section class="pad">${S.history.length ? S.history.slice().reverse().map(h => { const st = sessionStats(h), open = ui.openHist === h.id;
      return `<div class="card prog"><button class="wrow" data-act="openHist" data-id="${h.id}"><div><b>${esc(h.dayName)}</b><p>${esc(dayLabel(h.start))}</p><p>${mins(h.end - h.start)} min, ${st.sets} sets, ${st.vol.toLocaleString('en-US')} kg</p></div>${open ? I.up : I.down}</button>
        ${open ? h.items.map(it => `<div class="wrow"><div><b>${esc(exById(it.ex).name)}</b><p>${it.sets.map(s => `${s.type === 'w' ? 'W ' : ''}${s.w ? kg(s.w) + ' x ' : ''}${s.r}${s.rir != null ? ' (' + s.rir + ' RIR)' : ''}`).join(' · ')}</p>${it.note ? `<p>${esc(it.note)}</p>` : ''}</div></div>`).join('') + `<div class="wrow"><button class="btn danger" data-act="delHist" data-id="${h.id}">Delete Workout</button></div>` : ''}</div>`; }).join('')
      : '<p class="muted">Finished workouts show up here.</p>'}</section>`;
}

const mrow = (act, icon, label, extra = '', right = I.right) => `<button class="mrow" data-act="${act}" ${extra}>${icon}<span>${label}</span>${right}</button>`;
const SC_DEFS = {
  weight: ['sheet', 'scale', 'Weight', 'data-type="weight"'], levels: ['tab', 'levels', 'Levels', 'data-tab="levels"'], gym: ['sheet', 'gym', 'Gym', 'data-type="gyms"'], history: ['open', 'hist', 'History', 'data-screen="history"'],
  empty: ['startFree', 'enter', 'Empty Workout', ''], program: ['emptyProgram', 'route', 'New Program', ''], workout: ['addDay', 'workout', 'New Workout', ''], exercise: ['newExSheet', 'plus', 'Custom Exercise', ''],
};
const SC_COLORS = ['', 'var(--blue)', 'var(--coral)', 'var(--amber)', 'var(--green)', 'var(--violet)'];
function scOrder() { const all = Object.keys(SC_DEFS), saved = (S.settings.scOrder || []).filter(k => SC_DEFS[k]); return saved.concat(all.filter(k => !saved.includes(k))); }
const scTint = k => { const c = SC_COLORS[(S.settings.scColor || {})[k] || 0]; return c ? `style="background:${c};color:#fff"` : ''; };
function viewScSettings() {
  const order = scOrder(), mode = ui.scMode || 'order', nd = S.program && S.program.days.length ? S.program.days[Math.min(S.nextDay, S.program.days.length - 1)] : null;
  return `<header class="bar"><button class="ic" data-act="closeScreen" aria-label="Back">${I.back}</button><h1>Shortcuts</h1><button class="ic savebtn" data-act="closeScreen">Save</button></header>
    <section class="pad">
      <h2>Up Next Banner</h2>
      <label class="upnext bannerrow"><div><b>Up Next${nd ? ' • ' + esc(nd.name) : ''}</b><p>${nd ? esc(nd.items.map(it => exById(it.ex).name).join(', ')) : 'Shows the next workout of your program'}</p></div><input type="checkbox" class="swc" data-bind="flag" data-f="scUpNext" ${S.settings.scUpNext === false ? '' : 'checked'}></label>
      <div class="h2row"><h2>Shortcuts</h2><div class="seg mini"><button data-act="scMode" data-v="order" aria-pressed="${mode === 'order'}">Order</button><button data-act="scMode" data-v="color" aria-pressed="${mode === 'color'}">Color</button></div></div>
      <div class="card rows">${order.map((k, i) => { const [, icon, label] = SC_DEFS[k];
        return `<div class="mrow srow"><i class="scico" ${scTint(k)}>${I[icon]}</i><span><b>${label}</b>${i < 4 ? 'Top Shortcut' : 'List Shortcut'}</span>${mode === 'order'
          ? `<button class="ic" data-act="scMove" data-k="${k}" data-dir="-1" aria-label="Move ${label} up">${I.up}</button><button class="ic" data-act="scMove" data-k="${k}" data-dir="1" aria-label="Move ${label} down">${I.down}</button>`
          : `<button class="editbtn" data-act="scColor" data-k="${k}">Color</button>`}</div>`; }).join('')}</div>
    </section>`;
}
const sw = (f, icon, title, text, def = true) => `<label class="mrow srow">${icon}<span><b>${title}</b>${text}</span><input type="checkbox" data-bind="flag" data-f="${f}" ${(S.settings[f] === undefined ? def : S.settings[f]) ? 'checked' : ''}></label>`;
const nav = (act, icon, title, text, extra = '') => `<button class="mrow srow" data-act="${act}" ${extra}>${icon}<span><b>${title}</b>${text}</span>${I.right}</button>`;
function viewWSettings() {
  return `<header class="bar"><button class="ic" data-act="closeScreen" aria-label="Back">${I.back}</button><h1>Workout</h1><span class="ic"></span></header>
    <section class="pad">
      <h2>General</h2>
      <div class="card rows">
        ${nav('sheet', I.timer, 'Rest Timer', 'Configure rest timer settings', 'data-type="rest"')}
        ${nav('sheet', I.wand, 'Smart Progression', 'Configure smart progression settings', 'data-type="smart"')}
        ${nav('sheet', I.warm, 'Warm-Up', 'Configure warm-up settings', 'data-type="warmcfg"')}
        <div class="mrow srow">${I.hist}<span><b>Previous Reference</b>${S.settings.prevRef === 'same' ? 'Same workout' : 'Any workout'}</span><button class="editbtn" data-act="prevRef">Edit</button></div>
        ${sw('propagate', I.next, 'Propagate Changes', 'Weight and rep edits also change the later sets that had the same weight and reps')}
        ${sw('rirTrack', I.target, 'RIR Tracking', 'Fill in the RIR of each set from your program')}
        ${sw('ssAuto', I.sort, 'Superset Auto-Scroll', 'Move between the exercises of a superset after each set')}
        ${sw('autoNext', I.enter, 'Exercise Auto-Next', 'Move to the next exercise when one is completed')}
      </div>
      <h2>Display</h2>
      <div class="card rows">
        ${sw('keepAwake', I.info, 'Keep Alive', 'Keep the phone awake during a workout')}
        ${sw('showTimer', I.timer, 'Workout Timer', 'Show the elapsed time during a workout')}
        ${sw('bwContrib', I.scale, 'Bodyweight Contribution', 'Count your scale weight in the volume of bodyweight exercises')}
      </div>
    </section>`;
}

// ---------- Weight Trend screen
function viewWeight() {
  const R = { '1W': 7, '1M': 30, '3M': 91, '6M': 182, '1Y': 365, All: 0 }[ui.wRange];
  const raw = weightsSorted(), trend = weightTrend(), end = new Date().setHours(0, 0, 0, 0) + DAY;
  const from = R ? end - R * DAY : (raw.length ? new Date(raw[0].t).setHours(0, 0, 0, 0) : end - 7 * DAY);
  const inR = a => a.filter(w => w.t >= from && w.t < end), tr = inR(trend), sc = inR(raw);
  const fmt1 = v => (v == null ? '--' : v.toFixed(1));
  const avg = tr.length ? tr.reduce((n, w) => n + w.kg, 0) / tr.length : null;
  const diff = tr.length > 1 ? tr[tr.length - 1].kg - tr[0].kg : (tr.length ? 0 : null);
  const top = Math.max(50, Math.ceil(Math.max(0, ...sc.map(w => w.kg), ...tr.map(w => w.kg)) / 50) * 50);
  const X = t => ((t - from) / (end - from)) * 100, Y = v => 100 - (v / top) * 100;
  const path = a => a.map(w => `${X(w.t).toFixed(2)},${Y(w.kg).toFixed(2)}`).join(' ');
  const dfmt = t => new Date(t).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  const days = Math.round((end - from) / DAY), ticks = Math.min(7, days);
  const labels = Array.from({ length: ticks }, (_, i) => { const t = from + Math.round((i * days) / ticks) * DAY; return days <= 7 ? new Date(t).toLocaleDateString('en-US', { weekday: 'short' }) : dfmt(t); });
  const at = t => { const b = trend.filter(w => w.t <= t); return b.length ? b[b.length - 1].kg : null; };
  const now = trend.length ? trend[trend.length - 1] : null;
  const change = n => { const a = now ? at(now.t - n * DAY) : null; return now && a != null ? now.kg - a : null; };
  const word = v => (v == null ? 'No data' : Math.abs(v) < 0.05 ? 'No change' : v > 0 ? 'Increase' : 'Decrease');
  const wk = change(21) != null ? change(21) / 3 : change(7);
  return `<header class="bar"><button class="ic" data-act="closeScreen" aria-label="Back">${I.back}</button><h1>Weight Trend</h1><button class="ic" data-act="sheet" data-type="weight" aria-label="Add weigh-in">${I.plus}</button></header>
    <section class="top chartbox">
      <div class="stats"><div><span>Average</span><b>${fmt1(avg)} <small>kg</small></b></div><div><span>Difference</span><b>${diff == null ? '--' : (diff > 0 ? '+' : '') + diff.toFixed(1)} <small>kg</small></b></div></div>
      <p class="range">${dfmt(from)} - ${dfmt(end - DAY)}, ${new Date(end - DAY).getFullYear()}</p>
      <div class="chart2"><div class="grid2"><i></i><i></i><i></i></div>
        <div class="linebox"><svg viewBox="0 0 100 100" preserveAspectRatio="none">${sc.length > 1 ? `<polyline class="l-scale" points="${path(sc)}"/>` : ''}${tr.length > 1 ? `<polyline class="l-trend" points="${path(tr)}"/>` : ''}</svg>
          ${tr.map(w => `<i class="dot" style="left:${X(w.t).toFixed(2)}%;top:${Y(w.kg).toFixed(2)}%"></i>`).join('')}
          <div class="xax">${labels.map(l => `<span>${l}</span>`).join('')}</div></div>
        <div class="yax"><span>${top}</span><span>${top / 2}</span><span>0</span></div></div>
      <div class="seg wide3">${['1W', '1M', '3M', '6M', '1Y', 'All'].map(r => `<button data-act="wRange" data-r="${r}" aria-pressed="${ui.wRange === r}">${r}</button>`).join('')}</div>
    </section>
    <section class="pad">
      <div class="card legendcard two-l"><span><i class="k-scale"></i>Scale Weight</span><span><i class="k-trend"></i>Trend Weight</span></div>
      <h2>Insights &amp; Data</h2>
      <div class="card wchanges"><b>Weight Changes</b>${[3, 7, 14, 30, 90].map(n => { const v = change(n); return `<div><span>${n}-day</span>${lineSvg(trend.filter(w => now && w.t >= now.t - n * DAY).map(w => w.kg), 'mini')}<em>${v == null ? '--' : Math.abs(v).toFixed(1)} kg</em><small>${word(v)}</small></div>`; }).join('')}</div>
      <div class="card kpi"><div class="kbox"><b>${fmt1(now ? now.kg : null)}</b><span>kg</span></div><div><b>Current Weight</b><p>Your trend weight. It smooths the day-to-day jumps of the scale.</p></div></div>
      <div class="card kpi"><div class="kbox"><b>${wk == null ? '--' : (wk > 0 ? '+' : '') + wk.toFixed(2)}</b><span>kg per week</span></div><div><b>Weekly Weight Change</b><p>How fast your trend weight has moved over the last three weeks.</p></div></div>
      <div class="h2row"><h2>Weigh-Ins</h2><button class="link" data-act="sheet" data-type="weight">Add</button></div>
      <div class="card list">${raw.slice().reverse().slice(0, 30).map(w => `<div><span>${new Date(w.t).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span><b>${w.kg.toFixed(1)} kg</b></div>`).join('') || '<div><span>No weigh-ins yet.</span></div>'}</div>
    </section>`;
}

function viewExLib() {
  const tab = ui.libTab || 'all', q = (ui.libQ || '').toLowerCase(), mus = ui.libMuscle || 'All';
  const done = new Set(S.history.flatMap(h => h.items.map(i => i.ex)));
  const inTab = e => tab === 'all' || (tab === 'performed' && done.has(e.id)) || (tab === 'depri' && exMod(e.id).depri) || (tab === 'modified' && (exMod(e.id).inc != null || String(e.id).startsWith('c-')));
  const list = listEx().map(fixEx).filter(e => inTab(e) && (mus === 'All' || e.muscle === mus || (e.sec || []).includes(mus)) && e.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
  const row = e => `<button class="pk" data-act="exDetail" data-ex="${esc(e.id)}">${thumb(e.id, 'tall')}<div><b>${esc(e.name)}</b><span>${e.muscle}${(e.sec || []).length ? ' • ' + e.sec.join(', ') : ''}</span>${done.has(e.id) ? `<span>Performed ${S.history.filter(h => h.items.some(i => i.ex === e.id)).length} time${S.history.filter(h => h.items.some(i => i.ex === e.id)).length === 1 ? '' : 's'}</span>` : ''}</div>${I.right}</button>`;
  return `<header class="bar"><button class="ic" data-act="closeScreen" aria-label="Back">${I.back}</button><h1>Exercises</h1><button class="ic" data-act="newExSheet" aria-label="Custom exercise">${I.plus}</button></header>
    <div class="tabsrow" data-keep="libtabs">${[['all', 'All'], ['performed', 'Performed'], ['depri', 'Deprioritized'], ['modified', 'Modified']].map(([k, l]) => `<button data-act="libTab" data-t="${k}" aria-selected="${tab === k}">${l}</button>`).join('')}</div>
    <section class="pad liblist">
      <div class="mtiles" data-keep="libm">${MUSCLES.map(x => `<button data-act="libMuscle" data-m="${x}" aria-pressed="${mus === x}">${miniBody(x)}<span>${x}</span></button>`).join('')}</div>
      <div id="libList">${GROUPS.map(([title, eqs]) => { const g = list.filter(e => eqs.includes(e.equip)); return g.length ? `<div class="h2row psec"><h3>${title}</h3><span class="muted">${g.length}</span></div>${g.map(row).join('')}` : ''; }).join('') || `<div class="card emptycard">${I.info}<p>${{ all: 'No exercise matches.', performed: 'Exercises you log will show here.', depri: 'Deprioritized exercises will show here. They are left out of swap suggestions.', modified: 'Custom exercises and the ones you change will show here.' }[tab]}</p></div>`}</div>
    </section>
    <div class="startbar libsearch"><label class="search">${I.search}<input type="search" placeholder="Search for an exercise" aria-label="Search for an exercise" data-bind="libQ" value="${esc(ui.libQ || '')}"></label></div>`;
}

function viewMore() {
  const n = S.history.length, th = S.settings.theme || 'system';
  const tile = (t, label) => `<button class="ttile t-${t}" data-act="theme" data-t="${t}" aria-pressed="${th === t}" aria-label="${label} theme"><b>Aa</b><span><i></i><i></i><i></i><i></i></span></button>`;
  return `${hero('More')}
    <div class="top profile"><span class="avatar wide">H</span><div><b>Hierro</b><span>${n} workout${n === 1 ? '' : 's'} logged on this phone</span></div></div>
    <section class="pad">
      <h2>General</h2>
      <div class="card rows">${mrow('sheet', I.scale, 'Units', 'data-type="units"')}${mrow('sheet', I.timer, 'Rest Timer', 'data-type="rest"')}${mrow('sheet', I.globe, 'Language', 'data-type="about"', '<b class="val">English</b>')}</div>
      <h2>Feature Settings</h2>
      <div class="card rows">${mrow('open', I.dash, 'Dashboard', 'data-screen="dashcfg"')}${mrow('open', I.workout, 'Workout', 'data-screen="wsettings"')}${mrow('open', I.plus, 'Shortcuts', 'data-screen="scsettings"')}${mrow('open', I.scale, 'Weight Trend', 'data-screen="weight"')}${mrow('open', I.info, 'Exercises', 'data-screen="exlib"')}${mrow('sheet', I.gym, 'Gym Profiles', 'data-type="gyms"')}</div>
      <h2>Theme</h2>
      <div class="themes">${tile('light', 'Light')}${tile('dark', 'Dark')}${tile('system', 'System')}</div>
      <h2>Data Management</h2>
      <div class="card rows">${mrow('sheet', I.info, 'Import Exercise Database', 'data-type="exImport"')}${mrow('export', I.down, 'Data Export')}<label class="mrow">${I.up}<span>Data Import</span>${I.right}<input type="file" accept="application/json,.json" data-bind="import" hidden></label>${mrow('wipe', I.trash, 'Delete All Data')}</div>
      <h2>Other</h2>
      <div class="card rows">${mrow('open', I.cal, 'Workout History', 'data-screen="history"')}${mrow('sheet', I.info, 'About', 'data-type="about"')}</div>
      <p class="muted center">Version 1.0 · Data lives only on this phone</p>
    </section>`;
}

// ---------- Bottom sheets ----------
const opt = (act, icon, text, extra = '') => `<button class="opt" data-act="${act}" ${extra}>${icon}<span>${text}</span></button>`;
function viewSheet() {
  const m = ui.sheet;
  const nextIdx = S.program && S.program.days.length ? Math.min(S.nextDay, S.program.days.length - 1) : -1;
  if (m.type === 'plus') {
    const order = scOrder().filter(k => k !== 'workout' || S.program), nd = nextIdx >= 0 ? S.program.days[nextIdx] : null;
    const top = order.slice(0, 4), rest = order.slice(4);
    return `<div class="shead"><button class="ic" data-act="close" aria-label="Close">${I.x}</button><h2>Shortcuts</h2><button class="ic" data-act="open" data-screen="scsettings" aria-label="Shortcut settings">${I.sliders}</button></div>
      <div class="shortcuts">${top.map(k => { const [act, icon, label, extra] = SC_DEFS[k]; return `<button data-act="${act}" ${extra}><i ${scTint(k)}>${I[icon]}</i>${label}</button>`; }).join('')}</div>
      ${S.settings.scUpNext === false ? '' : S.active ? `<button class="upnext" data-act="resume"><div><b>In Progress • ${esc(S.active.dayName)}</b><p>Tap to resume your workout</p></div>${I.right}</button>`
        : nd ? `<button class="upnext" data-act="daySheet" data-i="${nextIdx}"><div><b>Up Next • ${esc(nd.name)}</b><p>${esc(nd.items.map(it => exById(it.ex).name).join(', '))}</p>${chips(nd.items.map(it => it.ex))}</div>${I.right}</button>` : ''}
      <div class="srows">${rest.map(k => { const [act, icon, label, extra] = SC_DEFS[k]; return mrow(act, I[icon], label, extra); }).join('')}</div>`;
  }
  if (m.type === 'day') { const d = S.program.days[m.i]; return `<h2>${esc(d.name)}</h2><p class="muted">${d.items.length} exercises</p>
    <button class="btn primary" data-act="start" data-i="${m.i}">Start Workout</button><button class="btn" data-act="editProgram" data-i="${m.i}">Edit</button>`; }
  if (m.type === 'wmenu') return `<h2 class="center">Workout Options</h2>${opt('minimize', I.down, 'Minimize workout')}${opt('finish', I.check, 'Finish workout')}${opt('open', I.timer, 'Workout settings', 'data-screen="wsettings"')}${opt('sheet', I.gym, 'Gym settings', 'data-type="equip"')}${opt('discard', I.trash, 'Discard workout', 'style="color:var(--red)"')}`;
  if (m.type === 'discard') return `<h2>Discard this workout?</h2><p class="muted">Your progress will be lost and this workout will not be saved.</p><button class="btn red" data-act="discardYes">Discard</button><button class="btn danger plain" data-act="close">Go Back</button>`;
  if (m.type === 'targets') { const it = S.active.items[ui.cur]; let n = 0;
    const cell = (j, f, v, off) => `<input inputmode="numeric" data-bind="tset" data-s="${j}" data-f="${f}" value="${v}" ${off ? 'disabled' : ''} aria-label="${f}">`;
    return `<div class="shead"><button class="ic" data-act="close" aria-label="Close">${I.x}</button><h2>Workout Targets<small>${esc(exById(it.ex).name)}</small></h2><span></span></div>
      <div class="banner">${I.target}<p><b>Today's targets</b>These changes are for this workout only. Edit the program to change them for good.</p></div>
      <div class="ttable"><div class="trow head"><span>Set</span><span>Reps Min</span><span>Reps Max</span><span>Rest</span><span>RIR</span></div>
      ${it.sets.map((q, j) => isWork(q) ? `<div class="trow"><span class="num">${++n}</span>${cell(j, 'lo', T(it, q, 'lo'))}${cell(j, 'hi', T(it, q, 'hi'))}${cell(j, 'rest', T(it, q, 'rest'), it.restOn === false)}<button data-act="trir" data-s="${j}" aria-label="Change RIR">${rirBadge(T(it, q, 'rir'))}</button></div>` : '').join('')}
      <button class="num add" data-act="addSetKeep" aria-label="Add set">${I.plus}</button></div>
      <label class="field switch tsw"><span><b>Set Rest Timers</b>Start a rest timer after every set of this exercise.</span><input type="checkbox" data-bind="restOn" ${it.restOn === false ? '' : 'checked'}></label>
      <button class="btn primary" data-act="retargetClose">Save</button>`; }
  if (m.type === 'exMore') return `<h2>${esc(exById(S.active.items[ui.cur].ex).name)}</h2>${opt('addSet', I.plus, 'Add set')}${opt('delEx', I.trash, 'Remove exercise', 'style="color:var(--red)"')}`;
  if (m.type === 'setMenu') return `<h2>Set Type</h2>${opt('setType', I.workout, 'Standard Set', `data-s="${m.s}" data-t="n"`)}${opt('setType', I.warm, 'Warm Up', `data-s="${m.s}" data-t="w"`)}${opt('delSet', I.trash, 'Delete Set', `data-s="${m.s}"`)}`;
  if (m.type === 'info') { const it = S.active.items[ui.cur], ex = exById(it.ex), rec = recordFor(ex.id), tab = ui.infoTab;
    const past = S.history.slice().reverse().map(h => ({ h, x: h.items.find(q => q.ex === ex.id) })).filter(p => p.x);
    const body1 = tab === 'inst' ? `<div class="media">${thumb(ex.id, 'hero')}</div>${ex.url ? `<a class="btn video" href="${esc(ex.url)}" target="_blank" rel="noopener">${I.play}Watch Video</a>` : ''}
        <div class="h2row first"><h2>Setting up</h2></div><p class="muted">${CUES[ex.equip][0]}</p>
        <h2>Performing</h2><p class="muted">${CUES[ex.equip][1]}</p>`
      : tab === 'det' ? `<h2>Target Muscles</h2><div class="hscroll">${[[ex.muscle, 'Primary'], ...(ex.sec || []).map(x => [x, 'Secondary'])].map(([mm, k]) => `<div class="mcard">${miniBody(mm)}<div><b>${mm}</b><span>${k}</span></div></div>`).join('')}</div>
        <h2>Properties</h2><div class="card list"><div><span>Weight step</span><b>${ex.inc ? kg(ex.inc) + ' kg' : 'Bodyweight'}</b></div><div><span>Target</span><b>${it.lo}-${it.hi} reps, ${it.rir} RIR</b></div><div><span>Best set</span><b>${rec ? `${rec.w ? kg(rec.w) + ' kg x ' : ''}${rec.r}` : 'None yet'}</b></div></div>
        <h2>Resistance Equipment</h2><div class="card equipcard">${thumb(ex.id)}<b>${ex.equip}</b></div>`
      : `<div class="pills"><button>1-RM ${I.down}</button><button>Most Recent ${I.down}</button></div>
        ${past.length ? past.map(p => `<div class="card hrow"><div><b>${p.x.sets.filter(isWork).map(q => `${q.w ? kg(q.w) + ' x ' : ''}${q.r}`).join(', ')}</b><span>${new Date(p.h.start).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}</span></div></div>`).join('')
          : `<div class="card emptycard">${I.hist}<p>You haven't logged this exercise yet. Its history will show here after your first workout with it.</p></div>`}`;
    return `<div class="shead"><button class="ic" data-act="close" aria-label="Close">${I.x}</button><h2>${esc(ex.name)}</h2><span></span></div>
      <div class="tabsrow even intabs">${[['inst', 'Instructions'], ['det', 'Details'], ['hist', 'History']].map(([k, l]) => `<button data-act="infoTab" data-t="${k}" aria-selected="${tab === k}">${l}</button>`).join('')}</div>
      <div class="infobody">${body1}</div>`; }
  if (m.type === 'superset') { const last = ui.cur >= S.active.items.length - 1, it = S.active.items[ui.cur];
    return `<div class="shead"><button class="ic" data-act="close" aria-label="Close">${I.x}</button><h2>Superset</h2><span></span></div>
      <label class="field switch tsw first"><span><b>Superset with next</b>${last ? 'This is the last exercise of the workout.' : 'Alternate sets with ' + esc(exById(S.active.items[ui.cur + 1].ex).name) + ' and rest after both.'}</span><input type="checkbox" data-bind="ssNext" ${it.ssNext ? 'checked' : ''} ${last ? 'disabled' : ''}></label>`; }
  if (m.type === 'exImport') return `<div class="shead"><button class="ic" data-act="close" aria-label="Close">${I.x}</button><h2>Exercise Database</h2><span></span></div>
      <p class="muted">${(S.userLib || []).length ? `${S.userLib.length} exercises of yours are loaded.` : 'Load your own exercises: name, video link, equipment and muscles.'}</p>
      <label class="btn primary">Choose Spreadsheet (.xlsx)<input type="file" accept=".xlsx" data-bind="exFile" hidden></label>
      <label class="field">Or paste the table here<textarea id="exPaste" rows="4" placeholder="Copy the rows in your sheet and paste them here"></textarea></label>
      <button class="btn" data-act="exPaste">Read Pasted Table</button>
      ${(S.userLib || []).length ? `<button class="btn danger" data-act="exClear">Remove My Database</button>` : ''}`;
  if (m.type === 'exPreview') { const l = m.list, by = {}; l.forEach(e => { by[e.muscle] = (by[e.muscle] || 0) + 1; });
    return `<div class="shead"><button class="ic" data-act="close" aria-label="Close">${I.x}</button><h2>Exercise Database</h2><span></span></div>
      <div class="card list"><div><span>Exercises</span><b>${l.length}</b></div><div><span>With video</span><b>${l.filter(e => e.url).length}</b></div><div><span>Repeated or empty rows skipped</span><b>${m.skipped}</b></div></div>
      <div class="chips wrap">${Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<span>${k} ${n}</span>`).join('')}</div>
      <button class="btn primary" data-act="exAccept">Use These ${l.length} Exercises</button><button class="btn" data-act="close">Cancel</button>`; }
  if (m.type === 'progPreview') { const pr = m.prog, st = pr.stats;
    return `<div class="shead"><button class="ic" data-act="close" aria-label="Close">${I.x}</button><h2>Import Program</h2><span></span></div>
      <h3 class="subh">${esc(pr.name)}</h3>
      <div class="card list"><div><span>Workouts</span><b>${st.workouts}</b></div><div><span>Rest days</span><b>${st.rests}</b></div><div><span>Sets</span><b>${st.sets}</b></div><div><span>Exercises</span><b>${st.exercises}</b></div><div><span>New exercises to create</span><b>${m.fresh.length}</b></div></div>
      ${m.fresh.length ? `<h3 class="subh">New exercises</h3><p class="muted">Muscle and equipment are guessed from the name. You can fix them later in Exercises.</p><div class="card list scrolly">${m.fresh.map(e => `<div><span>${esc(e.name)}</span><b>${e.muscle} · ${e.equip}</b></div>`).join('')}</div>` : ''}
      <button class="btn primary" data-act="progAccept">Set as Active Program</button><button class="btn" data-act="close">Cancel</button>`; }
  if (m.type === 'wmore') return `<div class="shead"><button class="ic" data-act="close" aria-label="Close">${I.x}</button><h2>More</h2><span></span></div>
      <div class="srows">${mrow('startFree', I.enter, 'Start Empty Workout')}<label class="mrow">${I.up}<span>Import Program<small>From a spreadsheet (.xlsx)</small></span>${I.right}<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-bind="progFile" hidden></label>${mrow('open', I.hist, 'Workout History', 'data-screen="history"')}${mrow('sheet', I.sliders, 'Customize Sections', 'data-type="sections"')}${S.program ? mrow('progMenu', I.edit, 'Edit Program') : ''}<div class="mrow">${I.gym}<span>Archive<small>Archive is empty</small></span>${I.right}</div></div>`;
  if (m.type === 'sections') return `<div class="shead"><button class="ic" data-act="close" aria-label="Close">${I.x}</button><h2>Customize Sections</h2><span></span></div>
      <label class="field switch tsw first"><span><b>Active Program</b>Show your current program on the Workout tab</span><input type="checkbox" checked disabled></label>
      <label class="field switch tsw"><span><b>Workout Library</b>Show the starter programs under your active program</span><input type="checkbox" data-bind="showLib" ${S.settings.hideLib ? '' : 'checked'}></label>
      <button class="btn primary" data-act="close">Done</button>`;
  if (m.type === 'swap') { const it = S.active.items[ui.cur], ex = exById(it.ex);
    const line = e => `${e.muscle}${(e.sec || []).length ? ' • ' + e.sec.join(', ') : ''}`;
    const subs = listEx().map(fixEx).filter(e => e.id !== ex.id && e.muscle === ex.muscle && !exMod(e.id).depri).sort((a, b) => (b.equip === ex.equip) - (a.equip === ex.equip) || a.name.localeCompare(b.name)).slice(0, 6);
    return `<div class="shead"><button class="ic" data-act="close" aria-label="Close">${I.x}</button><h2>Swap</h2><span></span></div>
      <div class="pk cur">${thumb(ex.id, 'tall')}<div><b>${esc(ex.name)}</b><span>${line(ex)}</span></div></div>
      <h3 class="subh">Smart Substitutions</h3>
      ${subs.map(e => `<div class="pk">${thumb(e.id, 'tall')}<div><b>${esc(e.name)}</b><span>${line(e)}</span></div><button class="hbtn" data-act="swapTo" data-ex="${esc(e.id)}" aria-label="Swap to ${esc(e.name)}">${I.swap}</button></div>`).join('') || '<p class="muted">No close substitutes for this one.</p>'}
      <button class="btn" data-act="pick" data-for="swap" data-muscle="${esc(ex.muscle)}">Find Other Replacements</button>`; }
  if (m.type === 'warm') { const it = S.active.items[ui.cur], plan = warmPlan(it);
    return `<div class="shead"><button class="ic" data-act="close" aria-label="Close">${I.x}</button><h2>Warm Up</h2><span></span></div>
      <div class="h2row first"><h2>Set Calculator</h2><div class="seg mini"><button data-act="warmMode" data-v="smart" aria-pressed="${ui.warmMode === 'smart'}">Smart</button><button data-act="warmMode" data-v="scheme" aria-pressed="${ui.warmMode === 'scheme'}">Scheme</button></div></div>
      ${plan.length ? `<div class="card list">${plan.map(([w, r], i) => `<div><span>Warm-up ${i + 1}</span><b>${kg(w)} kg x ${r}</b></div>`).join('')}</div><button class="btn primary" data-act="warmup">Add warm-up sets</button>`
        : `<div class="card emptycard">${I.warm}<p>${ui.warmMode === 'smart' ? 'Smart warm-ups show here once the first set has a weight.' : 'Enter the weight of your first set to build a 50 / 70 / 85 % scheme.'}</p></div>`}
      <h2>More Options</h2>${mrow('warmEmpty', I.plus, 'Add empty warm-up set')}`; }
  if (m.type === 'note') { const k = ui.noteTab, pi = progItem();
    const val = k === 'session' ? (S.active.note || '') : k === 'exercise' ? (S.active.items[ui.cur].note || '') : (pi ? pi.note || '' : '');
    const label = { session: 'Session Note', exercise: 'Exercise Note', program: 'Program Note' }[k];
    const hint = { session: 'Saved with this workout in your history.', exercise: 'Saved with this exercise in this workout.', program: pi ? 'Shown every time this exercise comes up in the program.' : 'This workout is not part of a program.' }[k];
    return `<div class="shead"><button class="ic" data-act="close" aria-label="Close">${I.x}</button><h2>Note</h2><span></span></div>
      <div class="tabsrow even intabs">${[['session', 'Session'], ['exercise', 'Exercise'], ['program', 'Program']].map(([t, l]) => `<button data-act="noteTab" data-t="${t}" aria-selected="${k === t}">${l}${t === 'session' ? '' : I.pin}</button>`).join('')}</div>
      <label class="field"><span class="lrow"><b>${label}</b><em id="noteCount">${val.length}/300</em></span><textarea data-bind="note" maxlength="300" rows="3" placeholder="Note about this ${k}" ${k === 'program' && !pi ? 'disabled' : ''}>${esc(val)}</textarea></label>
      <p class="muted">${hint}</p><button class="btn primary" data-act="close">Save</button>`; }
  if (m.type === 'pick') {
    const EQ = ['All', ...Object.keys(EQUIP_GLYPH)];
    return `<div class="ptop"><button class="hbtn" data-act="close" aria-label="Close">${I.x}</button><button class="hbtn" data-act="newExSheet" aria-label="Custom exercise">${I.plus}</button>
        <div class="tray">${I.workout}<span>${m.added ? m.added + ' added' : m.for === 'swap' ? 'Pick a replacement' : ''}</span></div><button class="hbtn" data-act="close" aria-label="Done">${I.down}</button></div>
      <div class="pills" data-keep="pf">
        <button data-act="pickGym" aria-pressed="${m.gymOnly !== false}">${I.gym}${m.gymOnly !== false ? esc(gym().name) : 'All Equipment'} ${I.down}</button>
        <button data-act="pickMuscle" data-m="All" aria-pressed="${(m.muscle || 'All') === 'All'}">All muscles</button>
        ${m.muscle && m.muscle !== 'All' ? `<button aria-pressed="true" data-act="pickMuscle" data-m="All">${m.muscle} ${I.x}</button>` : ''}</div>
      <div class="mtiles" data-keep="pm">${MUSCLES.map(x => `<button data-act="pickMuscle" data-m="${x}" aria-pressed="${m.muscle === x}">${miniBody(x)}<span>${x}</span></button>`).join('')}</div>
      <div id="pickList">${pickList()}</div>
      <div class="pbottom"><label class="search">${I.search}<input type="search" placeholder="Search for an exercise" aria-label="Search for an exercise" data-bind="pickQ" value="${esc(m.q)}"></label><button class="btn primary" data-act="close">Done</button></div>`;
  }
  if (m.type === 'newEx') return `<h2>Custom Exercise</h2>
    <label class="field">Name<input id="nxName"></label>
    <label class="field">Muscle<select id="nxMuscle">${MUSCLES.map(x => `<option>${x}</option>`).join('')}</select></label>
    <label class="field">Equipment<select id="nxEquip">${Object.keys(EQUIP_GLYPH).map(x => `<option>${x}</option>`).join('')}</select></label>
    <label class="field">Weight step (kg)<input id="nxInc" inputmode="decimal" value="2.5"></label>
    <button class="btn primary" data-act="saveEx">Save</button>`;
  if (m.type === 'itemEdit') { const it = S.program.days[ui.day].items[m.i]; if (!it.setsT || !it.setsT.length) it.setsT = setRows(it).map(q => ({ ...q }));
    const cell = (j, f, v) => `<input inputmode="numeric" data-bind="pset" data-i="${m.i}" data-s="${j}" data-f="${f}" value="${v != null ? v : ''}" aria-label="${f}">`;
    return `<div class="shead"><button class="ic" data-act="close" aria-label="Close">${I.x}</button><h2>${esc(exById(it.ex).name)}</h2><span></span></div>
      <div class="ttable"><div class="trow head"><span>Set</span><span>Reps Min</span><span>Reps Max</span><span>Rest</span><span>RIR</span></div>
      ${it.setsT.map((q, j) => `<div class="trow"><button class="num" data-act="psetType" data-i="${m.i}" data-s="${j}" aria-label="${TYPE_NAMES[q.type] || 'Standard Set'}. Tap to change.">${{ w: 'W', f: 'F', d: 'D', m: 'M' }[q.type] || j + 1}</button>${cell(j, 'lo', q.lo)}${cell(j, 'hi', q.hi)}${cell(j, 'rest', q.rest != null ? q.rest : it.rest)}<button data-act="psetRir" data-i="${m.i}" data-s="${j}" aria-label="Change RIR">${rirBadge(q.rir != null ? q.rir : it.rir)}</button></div>`).join('')}
      <div class="row2"><button class="num add" data-act="psetAdd" data-i="${m.i}" aria-label="Add set">${I.plus}</button>${it.setsT.length > 1 ? `<button class="num add" data-act="psetDel" data-i="${m.i}" aria-label="Remove last set">${I.minus}</button>` : ''}</div></div>
      <label class="field">Program Note<textarea data-bind="pnote" data-i="${m.i}" rows="2" maxlength="300" placeholder="Note for this exercise">${esc(it.note || '')}</textarea></label>
      <button class="btn primary" data-act="close">Done</button>`; }
  if (m.type === 'itemMenu') return `<h2>${esc(exById(S.program.days[ui.day].items[m.i].ex).name)}</h2>${opt('itemEdit', I.edit, 'Edit Sets', `data-i="${m.i}"`)}${opt('itemSs', I.sort, S.program.days[ui.day].items[m.i].ssNext ? 'Remove Superset' : 'Superset with next', `data-i="${m.i}"`)}${opt('moveItem', I.up, 'Move Up', `data-i="${m.i}" data-dir="-1"`)}${opt('moveItem', I.down, 'Move Down', `data-i="${m.i}" data-dir="1"`)}${opt('delItem', I.trash, 'Remove Exercise', `data-i="${m.i}"`)}`;
  if (m.type === 'reorder') return `<h2>Re-order</h2>${S.program.days[ui.day].items.map((it, i) => `<div class="opt"><span class="grow">${esc(exById(it.ex).name)}</span><button class="ic" data-act="moveKeep" data-i="${i}" data-dir="-1" aria-label="Move up">${I.up}</button><button class="ic" data-act="moveKeep" data-i="${i}" data-dir="1" aria-label="Move down">${I.down}</button></div>`).join('')}<button class="btn primary" data-act="close">Done</button>`;
  if (m.type === 'progMenu') return `<h2>Program</h2><label class="field">Name<input data-bind="progName" value="${esc(S.program.name)}"></label>${opt('editProgram', I.edit, 'Edit Program')}${opt('addDay', I.plus, 'Add Workout')}${opt('delProgram', I.trash, 'Remove Program')}<button class="btn primary" data-act="close">Done</button>`;
  if (m.type === 'rename') return `<h2>Rename</h2><label class="field">Workout name<input data-bind="dayName" value="${esc(S.program.days[ui.day].name)}"></label><button class="btn primary" data-act="close">Done</button>`;
  if (m.type === 'weight') { const today0 = new Date().setHours(0, 0, 0, 0), cur = (S.weights || []).find(w => w.t >= today0 && w.t < today0 + DAY);
    return `<div class="shead"><button class="ic" data-act="close" aria-label="Close">${I.x}</button><h2>${new Date().toLocaleDateString('en-US')}<small>Scale Weight</small></h2><button class="ic" data-act="weightDel" aria-label="Delete today's entry">${I.trash}</button></div>
      <label class="field"><b class="flabel">Weight</b><span class="unitin"><input id="wIn" inputmode="decimal" value="${cur ? cur.kg : ''}" placeholder="0.0"><em>kg</em></span></label>
      <button class="btn primary" data-act="weightSave">Save</button>`; }
  if (m.type === 'weightList') { const ws = weightsSorted().reverse();
    return `<div class="shead"><button class="ic" data-act="close" aria-label="Close">${I.x}</button><h2>Scale Weight</h2><button class="ic" data-act="sheet" data-type="weight" aria-label="Add entry">${I.plus}</button></div>
      ${ws.length ? `<div class="card list">${ws.map(w => `<div><span>${new Date(w.t).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span><b>${w.kg.toFixed(1)} kg</b></div>`).join('')}</div>` : `<div class="card emptycard">${I.scale}<p>No weigh-ins yet. Add your first one with the + button.</p></div>`}`; }
  if (m.type === 'units') return `<h2>Units</h2><div class="card rows"><div class="mrow">${I.scale}<span>Weight</span><b>kg</b></div><div class="mrow">${I.timer}<span>Rest</span><b>seconds</b></div></div><button class="btn primary" data-act="close">Done</button>`;
  if (m.type === 'about') return `<h2>About</h2><p class="muted">Hierro is a personal strength training log. Everything you enter stays on this phone.</p><div class="card list"><div><span>Workouts logged</span><b>${S.history.length}</b></div><div><span>Exercises</span><b>${allEx().length}</b></div></div><button class="btn primary" data-act="close">Done</button>`;
  if (m.type === 'exdetail') { const ex = exById(m.ex), rec = recordFor(ex.id), past = S.history.slice().reverse().map(h => ({ h, x: h.items.find(q => q.ex === ex.id) })).filter(p => p.x).slice(0, 8);
    return `<div class="shead"><button class="ic" data-act="close" aria-label="Close">${I.x}</button><h2>${esc(ex.name)}</h2><span></span></div>
      <div class="media small">${thumb(ex.id, 'hero')}</div>${ex.url ? `<a class="btn video" href="${esc(ex.url)}" target="_blank" rel="noopener">${I.play}Watch Video</a>` : ''}
      <h3 class="subh">Target Muscles</h3><div class="hscroll">${[[ex.muscle, 'Primary'], ...(ex.sec || []).map(x => [x, 'Secondary'])].map(([mm, k]) => `<div class="mcard">${miniBody(mm)}<div><b>${mm}</b><span>${k}</span></div></div>`).join('')}</div>
      <h3 class="subh">Properties</h3>
      <div class="card rows">
        <div class="mrow srow">${I.gym}<span><b>Resistance Equipment</b>${esc(ex.mat || ex.equip)}</span></div>
        <label class="mrow srow">${I.plates}<span><b>Weight Step</b>${exMod(ex.id).inc != null ? 'Modified' : 'Default'}</span><input class="numin" inputmode="decimal" data-bind="exInc" data-ex="${esc(ex.id)}" value="${kg(ex.inc)}" aria-label="Weight step in kg"></label>
        <label class="mrow srow">${I.down}<span><b>Deprioritize</b>Leave it out of swap suggestions and list it last</span><input type="checkbox" data-bind="exDepri" data-ex="${esc(ex.id)}" ${exMod(ex.id).depri ? 'checked' : ''}></label>
      </div>
      <h3 class="subh">History</h3>
      ${past.length ? `<div class="card list"><div><span>Best set</span><b>${rec ? `${rec.w ? kg(rec.w) + ' kg x ' : ''}${rec.r}` : '--'}</b></div>${past.map(p => `<div><span>${new Date(p.h.start).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</span><b>${p.x.sets.filter(isWork).map(q => `${q.w ? kg(q.w) + ' x ' : ''}${q.r}`).join(', ')}</b></div>`).join('')}</div>` : `<div class="card emptycard">${I.hist}<p>You haven't logged this exercise yet.</p></div>`}
      ${String(ex.id).startsWith('c-') ? `<button class="btn danger" data-act="exDelete" data-ex="${esc(ex.id)}">Delete Custom Exercise</button>` : ''}`; }
  if (m.type === 'gyms') return `<div class="shead"><button class="ic" data-act="close" aria-label="Close">${I.x}</button><h2>Gym Profiles</h2><span></span></div>
      <h3 class="subh">${S.gyms.length} Gym${S.gyms.length === 1 ? '' : 's'}</h3>
      ${S.gyms.map(g => `<div class="pk gymrow"><button class="grow gname" data-act="gymDefault" data-id="${g.id}">${I.gym}<div><b>${esc(g.name)}</b><span>${gymPieces(g)} pieces of equipment</span>${g.id === gym().id ? '<span>Default</span>' : ''}</div></button><button class="hbtn" data-act="gymOpen" data-id="${g.id}" aria-label="Edit ${esc(g.name)}">${I.edit}</button></div>`).join('')}
      <button class="btn" data-act="gymAdd">Add New Gym Profile</button>`;
  if (m.type === 'equip') { const g = gym(m.id), f = (m.q || '').toLowerCase(), all = ui.eqAll;
    const ROWS = [['Free Weights', [['Barbell', 'Barbell', `${kg(g.bar)} kg bar`, 'bar'], ['plates', 'Weight Plates', g.plates.map(p => kg(p) + ' kg').join(', '), 'plates'], ['Dumbbell', 'Dumbbells', 'Any pair you have', null]]], ['Machines', [['Machine', 'Machines', 'Plate-loaded and pin-loaded', null], ['Cable', 'Cables', 'Pulleys and handles', null]]], ['Other', [['Bodyweight', 'Bodyweight', 'Bars, benches and floor', null]]]];
    const on = k => (k === 'plates' ? g.equip.Barbell !== false : g.equip[k] !== false);
    return `<div class="shead"><button class="ic" data-act="${m.back ? 'gymBack' : 'close'}" aria-label="${m.back ? 'Back' : 'Close'}">${m.back ? I.back : I.x}</button><h2>${esc(g.name)}</h2><span></span></div>
      <div class="pills"><button data-act="gymRename" data-id="${g.id}">${I.edit}Rename Gym</button><button data-act="gymDup" data-id="${g.id}">${I.note}Duplicate</button>${g.id === gym().id ? '' : `<button data-act="gymDefault" data-id="${g.id}">${I.check}Set as Default</button>`}${S.gyms.length > 1 ? `<button data-act="gymDel" data-id="${g.id}">${I.trash}Delete</button>` : ''}</div>
      ${m.rename ? `<label class="field">Gym name<input data-bind="gymName" data-id="${g.id}" value="${esc(g.name)}"></label>` : ''}
      <div class="h2row first"><h2>Equipment</h2><div class="seg mini"><button data-act="eqAll" data-v="" aria-pressed="${!all}">Selected</button><button data-act="eqAll" data-v="1" aria-pressed="${!!all}">All</button></div></div>
      ${ROWS.map(([title, rows]) => { const vis = rows.filter(r => (all || on(r[0])) && r[1].toLowerCase().includes(f)); if (!vis.length) return '';
        return `<div class="h2row psec"><h3>${title}</h3></div>${vis.map(([k, label, detail, edit]) => `<div class="pk eqrow"><span class="thumb"><svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${EQUIP_GLYPH[k === 'plates' ? 'Barbell' : k]}</svg></span><div><b>${label}</b><span>${detail}</span>
          ${edit === 'bar' ? `<label class="inl">Bar weight (kg)<input inputmode="decimal" data-bind="gymF" data-id="${g.id}" data-f="bar" value="${kg(g.bar)}"></label>` : edit === 'plates' ? `<label class="inl">Edit Weights (kg)<input data-bind="gymF" data-id="${g.id}" data-f="plates" value="${g.plates.map(kg).join(' ')}"></label>` : ''}</div>
          ${k === 'plates' ? '' : `<button class="box ${on(k) ? 'on' : ''}" data-act="eqToggle" data-id="${g.id}" data-k="${k}" aria-pressed="${on(k)}" aria-label="${label}">${on(k) ? I.check : ''}</button>`}</div>`).join('')}`; }).join('')}
      <div class="pbottom"><label class="search">${I.search}<input type="search" placeholder="Filter equipment by name" aria-label="Filter equipment by name" data-bind="eqQ" value="${esc(m.q || '')}"></label></div>`; }
  if (m.type === 'smart') return `<div class="shead"><button class="ic" data-act="close" aria-label="Close">${I.x}</button><h2>Smart Progression</h2><span></span></div>
    <div class="card rows">
      ${sw('smart', I.wand, 'Smart Progression', 'Fill each set with the weight and reps to beat')}
      ${sw('smartLive', I.enter, 'Apply in session', 'After you finish a set, fill the weight of the later sets that are still empty')}
      ${sw('expandRange', I.sort, 'Expand Rep Range', 'When one weight step is a big jump, ask for a few more reps before adding weight')}
      ${sw('weightMatch', I.plates, 'Weight Match', 'Use the weight of the first set for every set of the exercise', false)}
    </div>
    <button class="btn primary" data-act="close">Done</button>`;
  if (m.type === 'warmcfg') { const sch = S.settings.warmScheme || [[50, 8], [70, 5], [85, 2]];
    return `<div class="shead"><button class="ic" data-act="close" aria-label="Close">${I.x}</button><h2>Warm-Up</h2><span></span></div>
    <h3 class="subh">Behavior</h3>
    <div class="card rows">
      <div class="mrow srow">${I.wand}<span><b>Warm-Up Automation</b>${S.settings.warmAuto ? 'Smart Warm-Up' : 'Off'}</span><button class="editbtn" data-act="warmAuto">Edit</button></div>
      <div class="mrow srow scheme">${I.warm}<span><b>Warm-Up Scheme</b>Percent of your first working set, and reps</span></div>
      ${sch.map(([p, r], i) => `<div class="mrow srow schrow"><span><b>Warm-up ${i + 1}</b></span><input class="numin" inputmode="numeric" data-bind="wscheme" data-i="${i}" data-f="0" value="${p}" aria-label="Percent"><em>%</em><input class="numin" inputmode="numeric" data-bind="wscheme" data-i="${i}" data-f="1" value="${r}" aria-label="Reps"><em>reps</em></div>`).join('')}
      ${sw('hideWarmDone', I.check, 'Hide Completed Sets', 'Hide warm-up sets from the table once they are done')}
      ${sw('simpleWarm', I.plates, 'Simplify Warm-Up Plates', 'Round barbell warm-up weights to the nearest 5 kg')}
    </div>
    <button class="btn primary" data-act="close">Done</button>`; }
  if (m.type === 'rest') return `<div class="shead"><button class="ic" data-act="close" aria-label="Close">${I.x}</button><h2>Rest Timer</h2><span></span></div>
    <h3 class="subh">Behavior</h3>
    <div class="card rows">
      ${sw('useRest', I.timer, 'Use Rest Timers', 'Start a countdown after each set')}
      ${sw('sound', I.info, 'Notifications', 'Play a sound when the rest is over')}
      <label class="mrow srow">${I.hist}<span><b>Timer Duration</b>Seconds of rest for exercises you add</span><input class="numin" inputmode="numeric" data-bind="setting" data-f="rest" value="${S.settings.rest}" aria-label="Rest in seconds"></label>
      ${sw('restAfterWarm', I.warm, 'Rest After Last Warm-up Set', 'Start a rest after the last warm-up set')}
      ${sw('restBetweenEx', I.enter, 'Rest Between Exercises', 'Start a rest when you finish an exercise and move to the next', false)}
    </div>
    <button class="btn primary" data-act="close">Done</button>`;
  return '';
}
const GROUPS = [['Free Weights', ['Barbell', 'Dumbbell']], ['Machines', ['Machine']], ['Cables', ['Cable']], ['Bodyweight', ['Bodyweight']]];
function pickList() {
  const m = ui.sheet, q = (m.q || '').toLowerCase();
  const ok = e => (!m.muscle || m.muscle === 'All' || e.muscle === m.muscle || (e.sec || []).includes(m.muscle)) && (m.gymOnly === false || gym().equip[e.equip] !== false) && e.name.toLowerCase().includes(q);
  const list = listEx().map(fixEx).filter(ok).sort((x, y) => (!!exMod(x.id).depri - !!exMod(y.id).depri) || x.name.localeCompare(y.name));
  const row = e => `<div class="pk">${thumb(e.id, 'tall')}<div><b>${esc(e.name)}</b><span>${e.muscle}${(e.sec || []).length ? ' • ' + e.sec.join(', ') : ''}</span></div><button class="hbtn" data-act="choose" data-ex="${esc(e.id)}" aria-label="Add ${esc(e.name)}">${I.plus}</button></div>`;
  return GROUPS.map(([title, eqs]) => { const g = list.filter(e => eqs.includes(e.equip)); if (!g.length) return ''; const open = m.open === title || q || g.length <= 4;
    return `<div class="h2row psec"><h3>${title}</h3>${g.length > 4 ? `<button class="link" data-act="pickOpen" data-g="${title}">${open && !q ? 'See Less' : `See ${g.length - 4} More`}</button>` : ''}</div>${(open ? g : g.slice(0, 4)).map(row).join('')}`; }).join('')
    || '<p class="muted">No match. Use + at the top to create it.</p>';
}

// Matches every exercise of an imported program to one we know; the rest become new custom exercises.
function matchProgram(prog) {
  const known = {}; allEx().forEach(e => { known[norm(e.name)] = e.id; });
  (S.userLib || []).concat(S.custom).forEach(e => { known[norm(e.name)] = e.id; });
  const fresh = {};
  prog.days.forEach(d => d.items.forEach(it => { const k = norm(it.name);
    if (!known[k]) { const g = guessExercise(it.name, it.note); fresh[k] = { id: 'c-' + uid(), name: titleCase(it.name), ...g }; known[k] = fresh[k].id; }
    it.exId = known[k]; }));
  return Object.values(fresh);
}
async function readFile(el, then) {
  const f = el.files && el.files[0]; el.value = ''; if (!f) return;
  try { then(await readXlsx(await f.arrayBuffer())); save(); render(); }
  catch (e) { console.error(e); toast('Could not read that file. It must be an .xlsx spreadsheet.'); }
}

// ---------- Actions ----------
const close = () => { ui.sheet = null; };
const curItem = () => S.active.items[ui.cur];
const SWITCH = 'This replaces your active program. Your history stays. Continue?';
const actions = {
  tab(d) { ui.tab = d.tab; ui.screen = null; close(); window.scrollTo(0, 0); },
  close,
  sheet(d) { ui.sheet = { type: d.type }; },
  open(d) { if (ui.screen && ui.screen !== d.screen) ui.prev = ui.screen; ui.screen = d.screen; if (d.metric) ui.metric = d.metric; close(); window.scrollTo(0, 0); },
  doneComplete() { const d = ui.done; if (d && d.planUp && d.changed && S.program && S.program.days[d.dayIdx]) { const old = S.program.days[d.dayIdx].items; S.program.days[d.dayIdx].items = d.sess.filter(x => x.sets > 0).map(x => ({ ...x, note: (old.find(o => o.ex === x.ex) || {}).note })); toast('Workout plan updated.'); } actions.closeScreen(); },
  closeScreen() { ui.screen = ui.prev && (ui.prev !== 'active' || S.active) ? ui.prev : null; ui.prev = null; ui.done = null; close(); window.scrollTo(0, 0); },
  dashMode(d) { ui.dashMode = d.m; },
  dashPage(d) { ui.dashPage = +d.p; },
  recMode(d) { ui.recMode = d.m; },
  metric(d) { ui.metric = d.m; },
  range(d) { ui.range = d.r; },
  tmMode(d) { ui.tmCycle = !!d.v; },
  flip() { ui.back = !ui.back; },
  wRange(d) { ui.wRange = d.r; },
  libTab(d) { ui.libTab = d.t; },
  libMuscle(d) { ui.libMuscle = ui.libMuscle === d.m ? 'All' : d.m; },
  exDetail(d) { ui.sheet = { type: 'exdetail', ex: d.ex }; },
  exDelete(d) { if (!confirm('Delete this custom exercise? Past workouts keep their numbers.')) return; S.custom = S.custom.filter(e => e.id !== d.ex); close(); },
  dupDay() { const d = S.program.days[ui.day], copy = clone(d); copy.id = uid(); copy.name = d.name + ' Copy'; S.program.days.splice(ui.day + 1, 0, copy); ui.day += 1; toast('Workout duplicated.'); },
  dashSwap() { const c = dashCfg(); S.settings.dash = { focus: c.focus.slice().reverse(), off: c.off }; ui.dashPage = 0; },
  dashReset() { delete S.settings.dash; ui.dashPage = 0; toast('Dashboard reset.'); },
  scMode(d) { ui.scMode = d.v; },
  scMove(d) { const o = scOrder(), i = o.indexOf(d.k), j = i + +d.dir; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; S.settings.scOrder = o; },
  scColor(d) { const c = S.settings.scColor = S.settings.scColor || {}; c[d.k] = ((c[d.k] || 0) + 1) % SC_COLORS.length; },
  prevRef() { S.settings.prevRef = S.settings.prevRef === 'same' ? 'any' : 'same'; },
  weightSave() { const v = num(document.getElementById('wIn').value); if (!v || v <= 0) return toast('Enter your weight.'); const t0 = new Date().setHours(0, 0, 0, 0); S.weights = (S.weights || []).filter(w => !(w.t >= t0 && w.t < t0 + DAY)); S.weights.push({ t: Date.now(), kg: Math.round(v * 10) / 10 }); close(); toast('Weight saved.'); },
  weightDel() { const t0 = new Date().setHours(0, 0, 0, 0); S.weights = (S.weights || []).filter(w => !(w.t >= t0 && w.t < t0 + DAY)); close(); },
  theme(d) { S.settings.theme = d.t; applyTheme(); },
  plusSheet() { ui.sheet = { type: 'plus' }; },
  toggleCal() { ui.cal = !ui.cal; },
  toggleProg() { ui.progOpen = !ui.progOpen; },
  exPaste() { const t = document.getElementById('exPaste').value; const r = parseExerciseTable(parseTsv(t)); if (!r.list.length) return toast('No exercises found in that text.'); ui.sheet = { type: 'exPreview', list: r.list, skipped: r.skipped }; },
  exAccept() { S.userLib = ui.sheet.list; close(); toast(S.userLib.length + ' exercises loaded.'); },
  exClear() { if (confirm('Remove your exercise database? Programs and history that use it keep the ids but lose the names.')) { S.userLib = []; close(); } },
  progAccept() {
    if (S.active) return toast('Finish or discard the workout in progress first.');
    if (S.program && !confirm(SWITCH)) return;
    const m = ui.sheet; m.fresh.forEach(e => S.custom.push(e));
    S.program = { name: m.prog.name, days: m.prog.days.map(d => ({ id: uid(), name: d.name, rest: !!d.rest, items: d.items.map(it => syncItem({ ex: it.exId, note: it.note, setsT: it.sets.map(q => ({ ...q })) })) })) };
    newCycle(1); ui.lib = null; ui.progOpen = true; close(); ui.tab = 'workout'; ui.screen = null; window.scrollTo(0, 0); toast('Program imported.');
  },
  restToggle(d) { markDay(+d.i, !doneThisCycle(+d.i)); close(); },
  toggleLib(d) { ui.lib = ui.lib === +d.i ? null : +d.i; },
  daySheet(d) { ui.pv = +d.i; ui.screen = 'preview'; close(); window.scrollTo(0, 0); },
  useTemplate(d) {
    if (S.program && !confirm(SWITCH)) return;
    const t = clone(TEMPLATES[d.i]); S.program = { name: t.name, days: t.days.map(x => ({ id: uid(), ...x })) }; newCycle(1); ui.lib = null; ui.progOpen = true; window.scrollTo(0, 0);
  },
  emptyProgram() {
    if (S.program && !confirm(SWITCH)) return;
    S.program = { name: 'My Program', days: [{ id: uid(), name: 'Workout A', items: [] }] }; newCycle(1); ui.day = 0; ui.screen = 'program'; close();
  },
  editProgram(d) { if (d.i != null) ui.day = +d.i; ui.screen = 'program'; close(); window.scrollTo(0, 0); },
  progMenu() { ui.sheet = { type: 'progMenu' }; },
  delProgram() { if (confirm('Remove this program? Your history stays.')) { S.program = null; ui.screen = null; close(); } },
  day(d) { ui.day = +d.i; },
  addDay() { S.program.days.push({ id: uid(), name: 'Workout ' + 'ABCDEFGH'[S.program.days.length % 8], items: [] }); ui.day = S.program.days.length - 1; ui.screen = 'program'; close(); },
  renameDay() { ui.sheet = { type: 'rename' }; },
  reorder() { ui.sheet = { type: 'reorder' }; },
  delDay() { if (S.program.days.length < 2) return toast('A program needs at least one workout.'); if (confirm('Delete this workout from the program?')) { S.program.days.splice(ui.day, 1); ui.day = 0; S.nextDay = 0; } },
  itemMenu(d) { ui.sheet = { type: 'itemMenu', i: +d.i }; },
  itemEdit(d) { ui.sheet = { type: 'itemEdit', i: +d.i }; },
  itemSs(d) { const arr = S.program.days[ui.day].items, it = arr[+d.i]; if (+d.i >= arr.length - 1 && !it.ssNext) { close(); return toast('There is no next exercise to pair with.'); } it.ssNext = !it.ssNext; close(); },
  psetType(d) { const it = S.program.days[ui.day].items[+d.i], q = it.setsT[+d.s], o = ['n', 'f', 'd', 'm']; q.type = o[(o.indexOf(q.type) + 1) % o.length]; toast(TYPE_NAMES[q.type]); },
  psetRir(d) { const it = S.program.days[ui.day].items[+d.i], q = it.setsT[+d.s]; q.rir = ((q.rir != null ? q.rir : it.rir) + 1) % 7; syncItem(it); },
  psetAdd(d) { const it = S.program.days[ui.day].items[+d.i]; it.setsT.push({ ...it.setsT[it.setsT.length - 1] }); syncItem(it); },
  psetDel(d) { const it = S.program.days[ui.day].items[+d.i]; if (it.setsT.length > 1) it.setsT.pop(); syncItem(it); },
  delItem(d) { S.program.days[ui.day].items.splice(+d.i, 1); close(); },
  moveItem(d) { actions.moveKeep(d); close(); },
  moveKeep(d) { const arr = S.program.days[ui.day].items, i = +d.i, j = i + +d.dir; if (j >= 0 && j < arr.length) [arr[i], arr[j]] = [arr[j], arr[i]]; },
  start(d) { if (S.program && S.program.days[+d.i] && S.program.days[+d.i].rest) { markDay(+d.i, true); close(); return toast('Rest day done.'); }
    if (S.active) { ui.screen = 'active'; close(); return toast('A workout is already in progress.'); } startWorkout(+d.i); },
  startFree() { if (S.active) { ui.screen = 'active'; close(); return; } startWorkout(null); },
  resume() { ui.screen = 'active'; close(); },
  minimize() { ui.screen = null; ui.focus = null; close(); },
  wmenu() { ui.sheet = { type: 'wmenu' }; },
  finish() { finishWorkout(); },
  discard() { ui.sheet = { type: 'discard' }; },
  discardYes() { S.active = null; stopRest(); ui.screen = null; ui.focus = null; close(); },
  retargetClose() { retarget(curItem(), false); close(); },
  togglePlates() { ui.plates = !ui.plates; },
  step(d) { const set = curItem().sets[ui.focus.s], inc = exById(curItem().ex).inc || 2.5; set.w = kg(Math.max(0, (num(set.w) || 0) + +d.dir * inc)); ui.fresh = false; },
  cur(d) { ui.cur = +d.i; ui.focus = null; },
  colMode() { ui.colMode = ui.colMode === 'prev' ? 'auto' : 'prev'; },
  focus(d) { unlockAudio(); ui.focus = { s: +d.s, f: d.f }; ui.fresh = true; ui.prop = null; curItem().sets.forEach(q => { delete q._p; }); },
  hideKeys() { ui.focus = null; },
  key(d) {
    const set = curItem().sets[ui.focus.s], f = ui.focus.f; let v = ui.fresh ? '' : String(set[f] || '');
    if (d.k === 'back') v = ui.fresh ? '' : v.slice(0, -1);
    else if (d.k === '.') { if (f !== 'w' || v.includes('.')) return; v = (v || '0') + '.'; }
    else if (v.replace('.', '').length < 5) v += d.k;
    const old = String(set[f] || ''); set[f] = v; ui.fresh = false;
    if (S.settings.propagate !== false) { const sets = curItem().sets; if (ui.prop == null || ui.prop.s !== ui.focus.s || ui.prop.f !== f) ui.prop = { s: ui.focus.s, f, old }; sets.forEach((q, k) => { if (k > ui.focus.s && !q.done && isWork(q) && (String(q[f] || '') === ui.prop.old || q._p === ui.prop.s + f)) { q[f] = v; q._p = ui.prop.s + f; } }); }
  },
  rir(d) { const set = curItem().sets[ui.focus.s]; set.rir = String(set.rir) === d.v ? '' : d.v; },
  clearRir() { curItem().sets[ui.focus.s].rir = ''; toast('RIR = reps in reserve. Pick a number above.'); },
  rirHelp() { toast('RIR: how many more reps you could have done. 0 is failure.'); },
  fp(d) { curItem().sets[ui.focus.s].partial = d.v === 'p'; },
  ok() {
    const it = curItem(), { s, f } = ui.focus;
    if (f === 'w') { ui.focus = { s, f: 'r' }; ui.fresh = true; return; }
    if (!it.sets[s].done && !completeSet(ui.cur, s)) return;
    const n = it.sets.findIndex((x, i) => i > s && !x.done);
    if (n >= 0) { ui.focus = { s: n, f: 'r' }; ui.fresh = true; } else ui.focus = null;
  },
  check(d) { unlockAudio(); completeSet(ui.cur, +d.s); },
  checkAll() { unlockAudio(); const it = curItem(), all = it.sets.every(s => s.done); it.sets.forEach((s, j) => { if (all) s.done = false; else if (!s.done) completeSet(ui.cur, j); }); },
  addSet() { const it = curItem(); it.sets.push(newSet()); retarget(it, true); },
  setMenu(d) { ui.sheet = { type: 'setMenu', s: +d.s }; },
  setType(d) { const it = curItem(); it.sets[d.s].type = d.t; retarget(it, false); close(); },
  delSet(d) { curItem().sets.splice(+d.s, 1); ui.focus = null; close(); },
  autofill() { retarget(curItem(), true); toast("Filled with today's target."); },
  exInfo() { ui.sheet = { type: 'info' }; ui.infoTab = 'inst'; },
  infoTab(d) { ui.infoTab = d.t; },
  warmSheet() { ui.sheet = { type: 'warm' }; },
  warmMode(d) { ui.warmMode = d.v; },
  warmAuto() { S.settings.warmAuto = !S.settings.warmAuto; },
  warmEmpty() { const it = curItem(); it.sets.unshift(newSet('w')); close(); },
  noteSheet() { ui.sheet = { type: 'note' }; },
  noteTab(d) { ui.noteTab = d.t; },
  addSetKeep() { const it = curItem(); it.sets.push(newSet()); retarget(it, true); },
  trir(d) { const it = curItem(), q = it.sets[d.s]; q.trir = (T(it, q, 'rir') + 1) % 7; if (!q.done) q.rir = String(q.trir); },
  warmup() {
    const it = curItem(), plan = warmPlan(it);
    if (!plan.length) return toast('Enter the weight of your first set first.');
    const warm = plan.map(([w, r]) => ({ ...newSet('w'), w: kg(w), r: String(r) }));
    it.sets = warm.concat(it.sets.filter(isWork)); ui.focus = null; close();
  },
  delEx() { if (confirm('Remove this exercise from the workout?')) { S.active.items.splice(ui.cur, 1); ui.cur = Math.max(0, ui.cur - 1); ui.focus = null; } },
  restSkip() { stopRest(); },
  pick(d) { ui.sheet = { type: 'pick', for: d.for, muscle: d.muscle || 'All', equip: 'All', q: '', added: 0 }; ui.focus = null; },
  pickMuscle(d) { ui.sheet.muscle = ui.sheet.muscle === d.m ? 'All' : d.m; },
  pickGym() { ui.sheet.gymOnly = ui.sheet.gymOnly === false; },
  gymOpen(d) { ui.sheet = { type: 'equip', id: d.id, back: true }; },
  gymBack() { ui.sheet = { type: 'gyms' }; },
  gymAdd() { const g = newGym('New Gym'); S.gyms.push(g); ui.sheet = { type: 'equip', id: g.id, back: true, rename: true }; },
  gymDup(d) { const g = newGym(gym(d.id).name + ' Copy', gym(d.id)); S.gyms.push(g); ui.sheet = { type: 'equip', id: g.id, back: true, rename: true }; },
  gymRename() { ui.sheet.rename = !ui.sheet.rename; },
  gymDefault(d) { S.gymId = d.id; toast(gym().name + ' is now your default gym.'); },
  gymDel(d) { if (S.gyms.length < 2 || !confirm('Delete this gym profile?')) return; S.gyms = S.gyms.filter(g => g.id !== d.id); if (S.gymId === d.id) S.gymId = S.gyms[0].id; ui.sheet = { type: 'gyms' }; },
  eqAll(d) { ui.eqAll = !!d.v; },
  eqToggle(d) { const g = gym(d.id); g.equip[d.k] = g.equip[d.k] === false; },
  pickOpen(d) { ui.sheet.open = ui.sheet.open === d.g ? null : d.g; },
  newExSheet() { ui.sheet = { type: 'newEx', back: ui.sheet && ui.sheet.type === 'pick' ? ui.sheet : null }; },
  saveEx() {
    const name = document.getElementById('nxName').value.trim();
    if (!name) return toast('Enter a name.');
    const equip = document.getElementById('nxEquip').value;
    const ex = { id: 'c-' + uid(), name, muscle: document.getElementById('nxMuscle').value, sec: [], equip, inc: equip === 'Bodyweight' ? 0 : (num(document.getElementById('nxInc').value) ?? 2.5) };
    S.custom.push(ex); const back = ui.sheet.back; ui.sheet = back;
    if (back) choose(ex.id); else { toast('Exercise saved.'); if (ui.screen === 'exlib') ui.libTab = 'modified'; }
  },
  choose(d) { choose(d.ex); },
  swapTo(d) { const it = curItem(); it.ex = d.ex; retarget(it, true); close(); toast('Swapped to ' + exById(d.ex).name + '.'); },
  openHist(d) { ui.openHist = ui.openHist === d.id ? null : d.id; },
  openDetail(d) { ui.openHist = d.id; ui.screen = 'history'; window.scrollTo(0, 0); },
  delHist(d) { if (confirm('Delete this workout? This cannot be undone.')) S.history = S.history.filter(h => h.id !== d.id); },
  export() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }));
    a.download = `hierro-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000); toast('Backup saved.');
  },
  wipe() { if (confirm('Delete ALL data? Your program and history will be lost.')) { S = freshState(); const g = newGym('Commercial Gym'); S.gyms = [g]; S.gymId = g.id; ui.tab = 'dash'; ui.screen = null; } },
};
function choose(exId) {
  const m = ui.sheet, base = { ex: exId, sets: 3, lo: 8, hi: 12, rir: 2, rest: S.settings.rest };
  if (m.for === 'swap') { const it = curItem(); it.ex = exId; retarget(it, true); close(); return; }
  if (m.for === 'day') S.program.days[ui.day].items.push(base);
  else if (m.for === 'session') { S.active.items.push(newItem(base)); ui.cur = S.active.items.length - 1; }
  m.added = (m.added || 0) + 1; toast('Added ' + exById(exId).name + '.');
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) { if (e.target.id === 'modal') { preScroll = window.scrollY; close(); render(); } return; }
  const fn = actions[el.dataset.act]; if (!fn) return;
  preScroll = window.scrollY;
  fn(el.dataset, el); save(); render();
});

// Text fields save without a redraw, so the cursor stays put.
const binds = {
  note(el) { const k = ui.noteTab, pi = progItem(); if (k === 'session') S.active.note = el.value; else if (k === 'exercise') curItem().note = el.value; else if (pi) pi.note = el.value; const c = document.getElementById('noteCount'); if (c) c.textContent = el.value.length + '/300'; },
  tset(el, d) { const n = num(el.value); if (n == null || n < 0) return; const it = curItem(), q = it.sets[d.s]; q['t' + d.f] = Math.round(n); if (T(it, q, 'hi') < T(it, q, 'lo')) q.thi = T(it, q, 'lo'); },
  restOn(el) { curItem().restOn = el.checked; },
  showLib(el) { S.settings.hideLib = !el.checked; },
  gymName(el, d) { const v = el.value.trim(); if (v) gym(d.id).name = v; },
  gymF(el, d) { const g = gym(d.id); if (d.f === 'bar') { const n = num(el.value); if (n != null && n >= 0) g.bar = n; } else { const p = el.value.split(/[\s;,]+/).map(num).filter(n => n > 0); if (p.length) g.plates = p; } },
  eqQ(el) { ui.sheet.q = el.value; },
  ssNext(el) { curItem().ssNext = el.checked; render(); },
  wscheme(el, d) { const n = num(el.value); if (n == null || n <= 0) return; const sch = S.settings.warmScheme = (S.settings.warmScheme || [[50, 8], [70, 5], [85, 2]]).map(x => x.slice()); sch[+d.i][+d.f] = Math.round(n); },
  dashOn(el, d) { const c = dashCfg(); c.off[d.k] = !el.checked; if (el.checked) delete c.off[d.k]; S.settings.dash = c; },
  exInc(el, d) { const n = num(el.value); if (n == null || n < 0) return; const m = S.exMods = S.exMods || {}; const base = fixEx(allEx().find(e => e.id === d.ex)); m[d.ex] = { ...(m[d.ex] || {}) }; if (base && base.inc === n) delete m[d.ex].inc; else m[d.ex].inc = n; },
  exDepri(el, d) { const m = S.exMods = S.exMods || {}; m[d.ex] = { ...(m[d.ex] || {}), depri: el.checked }; },
  libQ(el) { ui.libQ = el.value; render(); const i = document.querySelector('[data-bind=libQ]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } },
  pset(el, d) { const n = num(el.value); if (n == null || n < 0) return; const it = S.program.days[ui.day].items[+d.i], q = it.setsT[+d.s]; q[d.f] = Math.round(n); if (q.hi != null && q.lo != null && q.hi < q.lo) q.hi = q.lo; syncItem(it); },
  pnote(el, d) { S.program.days[ui.day].items[+d.i].note = el.value; },
  progFile(el) { readFile(el, rows => { const prog = parseProgram(rows); if (!prog.stats.workouts) return toast('No workouts found in that spreadsheet.'); ui.sheet = { type: 'progPreview', prog, fresh: matchProgram(prog) }; }); },
  exFile(el) { readFile(el, rows => { const r = parseExerciseTable(rows); if (!r.list.length) return toast('No exercises found in that spreadsheet.'); ui.sheet = { type: 'exPreview', list: r.list, skipped: r.skipped }; }); },
  flag(el, d) { S.settings[d.f] = el.checked; if (d.f === 'keepAwake') { if (el.checked) wake(); else if (lock) { try { lock.release(); } catch (e) { /* ya estaba suelto */ } lock = null; } } },
  planUp(el) { if (ui.done) ui.done.planUp = el.checked; },
  aitem(el, d) { const n = num(el.value); if (n == null || n < 0) return; const it = curItem(); it[d.f] = Math.round(n); if (it.hi < it.lo) it.hi = it.lo; },
  itemRest(el) { const n = num(el.value); if (n != null) curItem().rest = Math.max(0, Math.round(n)); },
  progName(el) { S.program.name = el.value; },
  dayName(el) { S.program.days[ui.day].name = el.value; },
  pitem(el, d) {
    const n = num(el.value); if (n == null || n < 0) return;
    const it = S.program.days[ui.day].items[d.i]; it[d.f] = Math.round(n);
    it.sets = Math.min(12, Math.max(1, it.sets)); if (it.hi < it.lo) it.hi = it.lo;
  },
  setting(el, d) {
    const s = S.settings;
    if (d.f === 'sound') s.sound = el.checked;
    else if (d.f === 'plates') { const p = el.value.split(/[\s;]+/).map(num).filter(n => n > 0); if (p.length) s.plates = p; }
    else { const n = num(el.value); if (n != null && n >= 0) s[d.f] = n; }
  },
  pickQ(el) { ui.sheet.q = el.value; document.getElementById('pickList').innerHTML = pickList(); },
  import(el) {
    const f = el.files[0]; if (!f) return;
    f.text().then(t => {
      const data = JSON.parse(t);
      if (!data || !Array.isArray(data.history)) throw new Error('format');
      if (!confirm('This replaces all your data with the backup. Continue?')) return;
      S = Object.assign(freshState(), data); if (!Array.isArray(S.gyms) || !S.gyms.length) { const g = newGym('Commercial Gym'); S.gyms = [g]; S.gymId = g.id; } save(); render(); toast('Backup loaded.');
    }).catch(() => toast('That file is not a Hierro backup.'));
  },
};
function onField(e) {
  const el = e.target.closest('[data-bind]'); if (!el) return;
  const b = el.dataset.bind, live = ['note', 'pickQ', 'progName', 'dayName', 'gymName', 'libQ', 'pnote'];
  if ((e.type === 'input') !== live.includes(b)) return;
  binds[b](el, el.dataset); save();
}
document.addEventListener('input', onField);
document.addEventListener('change', onField);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
const tabBtn = (id, label) => `<button data-act="tab" data-tab="${id}">${I[id]}<span>${label}</span></button>`;
document.getElementById('tabs').innerHTML = tabBtn('dash', 'Dashboard') + tabBtn('workout', 'Workout')
  + `<button class="fabplus" data-act="plusSheet" aria-label="Add">${I.plus}</button>` + tabBtn('levels', 'Levels') + tabBtn('more', 'More');
render(); wake();
