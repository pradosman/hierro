import { EXERCISES, MUSCLES, TEMPLATES } from './data.js';

// ---------- Guardado ----------
const KEY = 'hierro.v1';
const clone = o => JSON.parse(JSON.stringify(o));
const uid = () => Math.random().toString(36).slice(2, 10);

function freshState() {
  return {
    v: 2,
    settings: { bar: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25], rest: 120, sound: true },
    custom: [], program: null, nextDay: 0, active: null, restEnd: null, restTotal: 0, history: [],
  };
}
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return Object.assign(freshState(), JSON.parse(raw)); } catch (e) { console.error(e); }
  return freshState();
}
let S = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('No se pudo guardar. El móvil no tiene sitio.'); } };

const ui = { tab: 'dash', screen: S.active ? 'active' : null, sheet: null, day: 0, cur: 0, focus: null, fresh: false, colMode: 'prev', range: '1S', metric: 'sets', dashMode: 'all', lib: null, progOpen: true, back: false, done: null, openHist: null };

// ---------- Ayudas ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { if (v === '' || v == null) return null; const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const kg = n => (n == null ? '' : String(Math.round(n * 100) / 100).replace('.', ','));
const allEx = () => EXERCISES.concat(S.custom);
const exById = id => allEx().find(e => e.id === id) || { id, name: 'Ejercicio borrado', muscle: 'Pecho', sec: [], equip: 'Máquina', inc: 2.5 };
const isWork = s => s.type !== 'w';
const e1rm = (w, r, rir) => w * (1 + (r + (rir || 0)) / 30);
const dayLabel = ts => new Date(ts).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
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
  gym: svg('<rect x="5" y="4" width="14" height="16" rx="1"/><path d="M9 8h.01M12 8h.01M15 8h.01M9 12h.01M12 12h.01M15 12h.01M10 20v-4h4v4"/>'),
};
const EQUIP_GLYPH = {
  Barra: '<path d="M6 20h28M10 13v14M14 10v20M30 13v14M26 10v20"/>',
  Mancuernas: '<path d="M14 20h12M11 14v12M14 12v16M29 14v12M26 12v16"/>',
  'Máquina': '<path d="M10 32V8h8v24M14 12h0M14 16h0M14 20h0M18 14h10v8M24 32v-6h6v6"/>',
  Polea: '<path d="M10 32V8h18M24 8v12"/><circle cx="24" cy="23" r="3"/><path d="M19 30h10"/>',
  'Peso corporal': '<circle cx="20" cy="10" r="3.500"/><path d="M20 14v10M12 17h16M20 24l-5 8M20 24l5 8"/>',
};
const thumb = (exId, cls = '') => {
  const ex = exById(exId);
  return `<span class="thumb ${cls}" aria-hidden="true"><svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${EQUIP_GLYPH[ex.equip] || EQUIP_GLYPH.Barra}</svg></span>`;
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
    _: ['M91 57 Q84 63 73 67 L90 68 Z', FOREARM, 'M95.500 226 Q99 223 99 229 L96 262 Q94 245 95.500 226 Z', 'M79 320 Q84 318 85 324 Q86 350 81 380 L77 380 Z'],
    Hombro: [DELT],
    Pecho: ['M68 72 Q66 72 65 78 Q62 92 68 102 Q76 110 88 108 Q97 106 97.500 100 L97.500 75 Q97.500 72 94 72 Z'],
    'Bíceps': [ARM],
    Abdomen: [rr(85, 112, 12.500, 11), rr(85, 125.500, 12.500, 11), rr(85, 139, 12.500, 11), 'M85 153.500 h12.500 v26 q-9 -3 -12.500 -13 z', 'M66 110 Q74 114 81 114 L82 170 Q72 166 66 150 Z'],
    'Cuádriceps': ['M61 215 Q69 208 76 212 L76 298 Q70 301 67 296 Q58 256 61 215 Z', 'M79 212 Q88 210 93 219 Q94 260 87 296 Q83 300 79 298 Z'],
    Gemelo: ['M66 319 Q71 314 76 318 L75 380 L70 380 Q64 348 66 319 Z'],
  },
  back: {
    _: [FOREARM],
    Espalda: ['M92 54 L97.500 54 L97.500 102 L72 72 Q85 66 92 54 Z', 'M66 82 L95 108 L95 150 Q80 146 70 132 Q63 108 66 82 Z', 'M84 155 L97.500 153 L97.500 176 L84 174 Z'],
    Hombro: [DELT],
    'Tríceps': [ARM],
    'Glúteo': ['M66 181 Q82 175 97.500 181 L97.500 214 Q84 222 68 214 Q62 198 66 181 Z'],
    Isquios: ['M64 223 Q78 227 93 221 Q94 262 86 296 Q76 300 68 296 Q60 258 64 223 Z'],
    Gemelo: ['M66 317 Q76 309 85 319 Q88 345 80 367 L72 367 Q62 345 66 317 Z'],
  },
};
function body(levels, side, cls = '', box = '0 0 200 420') {
  const half = Object.entries(PARTS[side]).map(([m, paths]) => {
    const lv = m === '_' ? 0 : (levels[m] || 0);
    const style = lv > 0 ? `class="lit" style="fill-opacity:${(0.35 + 0.65 * Math.min(1, lv)).toFixed(2)}"` : 'class="dim"';
    return paths.map(d => `<path d="${d}" ${style}/>`).join('');
  }).join('');
  return `<svg class="body ${cls}" viewBox="${box}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Figura ${side === 'front' ? 'de frente' : 'de espalda'}">
    <g class="sil">${HEAD}${HALF_BASE}<g transform="translate(200 0) scale(-1 1)">${HALF_BASE}</g></g>
    <g class="mus">${half}<g transform="translate(200 0) scale(-1 1)">${half}</g></g></svg>`;
}
const FRONT = ['Pecho', 'Hombro', 'Bíceps', 'Abdomen', 'Cuádriceps'];
// Recorte de la figura alrededor de cada músculo, para las tarjetas pequeñas.
const CROP = { Pecho: '55 52 90 76', Hombro: '22 40 156 190', 'Bíceps': '22 62 156 190', 'Tríceps': '22 62 156 190', Abdomen: '55 98 90 92', Espalda: '45 44 110 140', 'Cuádriceps': '45 196 110 116', Isquios: '45 204 110 108', 'Glúteo': '50 160 100 76', Gemelo: '45 296 110 96' };
const miniBody = m => body({ [m]: 1 }, FRONT.includes(m) ? 'front' : 'back', 'mini', CROP[m]);

// ---------- Regla de progreso ----------
function lastSets(exId) {
  for (let i = S.history.length - 1; i >= 0; i--) {
    const item = S.history[i].items.find(x => x.ex === exId);
    if (item) { const sets = item.sets.filter(isWork); if (sets.length) return sets; }
  }
  return null;
}
function suggest(item, workIdx) {
  const prev = lastSets(item.ex);
  if (!prev) return { tw: null, tr: null, prev: null };
  const p = prev[Math.min(workIdx, prev.length - 1)];
  const inc = exById(item.ex).inc;
  const rir = p.rir == null ? item.rir : p.rir;
  const eff = p.r + rir - item.rir; // reps que valdrían con la reserva pedida
  if (!p.w || !inc) return { tw: p.w || 0, tr: Math.max(item.lo, eff + 1), prev: p };
  if (eff >= item.hi) return { tw: p.w + inc, tr: item.lo, prev: p };
  if (eff <= item.lo - 2) return { tw: Math.max(0, p.w - inc), tr: item.lo, prev: p };
  if (eff < item.lo) return { tw: p.w, tr: item.lo, prev: p };
  return { tw: p.w, tr: Math.min(item.hi, eff + 1), prev: p };
}
function retarget(item, fill) {
  let wi = 0;
  item.sets.forEach(s => {
    if (!isWork(s)) return;
    const t = suggest(item, wi++);
    s.tw = t.tw; s.tr = t.tr; s.prev = t.prev ? { w: t.prev.w, r: t.prev.r, rir: t.prev.rir } : null;
    if (fill && !s.done) { s.w = t.tw != null ? kg(t.tw) : ''; s.r = t.tr != null ? String(t.tr) : ''; }
  });
}
const newSet = type => ({ type: type || 'n', w: '', r: '', rir: '', partial: false, done: false, tw: null, tr: null, prev: null });
function newItem(src) {
  const item = { ex: src.ex, lo: src.lo, hi: src.hi, rir: src.rir, rest: src.rest, note: '', sets: [] };
  for (let i = 0; i < src.sets; i++) item.sets.push(newSet());
  retarget(item, true);
  return item;
}

// ---------- Entreno ----------
function startWorkout(dayIdx) {
  const d = dayIdx == null ? null : S.program.days[dayIdx];
  S.active = { dayIdx, dayName: d ? d.name : 'Entreno libre', start: Date.now(), items: d ? d.items.map(newItem) : [] };
  ui.screen = 'active'; ui.cur = 0; ui.focus = null; ui.sheet = null;
  unlockAudio(); save(); wake();
}
function completeSet(i, s) {
  const item = S.active.items[i], set = item.sets[s];
  if (set.done) { set.done = false; return true; }
  const body0 = !exById(item.ex).inc;
  const w = num(set.w) ?? (body0 ? 0 : null);
  const r = num(set.r);
  if (w == null) { toast('Escribe el peso.'); return false; }
  if (!r || r < 1) { toast('Escribe las repeticiones.'); return false; }
  set.w = kg(w); set.r = String(Math.round(r));
  set.done = true;
  if (isWork(set)) startRest(item.rest);
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
  h.items.forEach(it => it.sets.filter(isWork).forEach(s => { sets++; vol += s.w * s.r; }));
  return { sets, vol: Math.round(vol) };
};
function finishWorkout() {
  const a = S.active;
  const items = a.items.map(it => ({
    ex: it.ex, note: it.note,
    sets: it.sets.filter(s => s.done).map(s => ({ type: s.type, w: num(s.w) || 0, r: num(s.r), rir: num(s.rir), partial: !!s.partial })),
  })).filter(it => it.sets.length);
  if (!items.length) {
    if (!confirm('No has marcado ninguna serie. ¿Tirar este entreno?')) return;
    S.active = null; stopRest(); ui.screen = null; ui.sheet = null; return;
  }
  const records = [];
  items.forEach(it => {
    const best = bestOf(it.sets), old = recordFor(it.ex);
    if (best && (!old || best.score > old.score + 0.01)) records.push({ ex: it.ex, kind: 'Récord de fuerza', val: `${best.w ? kg(best.w) + ' kg × ' : ''}${best.r}` });
    const vol = it.sets.filter(isWork).reduce((n, s) => n + s.w * s.r, 0);
    const oldVol = Math.max(0, ...S.history.flatMap(h => h.items.filter(x => x.ex === it.ex).map(x => x.sets.filter(isWork).reduce((n, s) => n + s.w * s.r, 0))));
    if (vol > oldVol && vol > 0) records.push({ ex: it.ex, kind: 'Récord de volumen', val: `${Math.round(vol).toLocaleString('es-ES')} kg` });
  });
  const entry = { id: uid(), start: a.start, end: Date.now(), dayName: a.dayName, dayIdx: a.dayIdx, prog: a.dayIdx != null, items };
  S.history.push(entry);
  if (a.dayIdx != null && S.program) S.nextDay = (a.dayIdx + 1) % S.program.days.length;
  S.active = null; stopRest();
  ui.done = { entry, records }; ui.screen = 'complete'; ui.sheet = null; ui.focus = null;
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
  if (S.restEnd && left <= 0) { if (left > -3) beep(); stopRest(); save(); left = 0; toast('Descanso terminado.'); }
  rest.textContent = clock(Math.ceil(left));
  bar.style.transform = `scaleX(${S.restEnd ? Math.min(1, left / (S.restTotal || 1)) : 0})`;
}
setInterval(tick, 250);
let lock;
async function wake() { try { if (S.active && navigator.wakeLock) lock = await navigator.wakeLock.request('screen'); } catch (e) { /* no pasa nada */ } }
document.addEventListener('visibilitychange', () => { if (!document.hidden) { wake(); tick(); } });

// ---------- Datos para gráficas ----------
function muscleSets(from, to) {
  const out = Object.fromEntries(MUSCLES.map(m => [m, 0]));
  S.history.filter(h => h.start >= from && h.start < to).forEach(h => h.items.forEach(it => {
    const ex = exById(it.ex), n = it.sets.filter(isWork).length;
    if (ex.muscle in out) out[ex.muscle] += n;
    (ex.sec || []).forEach(m => { if (m in out) out[m] += n / 2; });
  }));
  return out;
}
function weekProgress() {
  const from = weekStart(Date.now());
  const hs = S.history.filter(h => h.start >= from && (ui.dashMode === 'all' || h.prog));
  const muscles = new Set(), exs = new Set(); let sets = 0;
  hs.forEach(h => h.items.forEach(it => { exs.add(it.ex); muscles.add(exById(it.ex).muscle); sets += it.sets.filter(isWork).length; }));
  const t = { muscles: new Set(), exs: new Set(), sets: 0 };
  (S.program ? S.program.days : []).forEach(d => d.items.forEach(it => { t.exs.add(it.ex); t.muscles.add(exById(it.ex).muscle); t.sets += it.sets; }));
  return { muscles: [muscles.size, t.muscles.size], sets: [sets, t.sets], exs: [exs.size, t.exs.size] };
}
const cycleNo = () => (S.program && S.program.days.length ? Math.floor(S.history.filter(h => h.prog).length / S.program.days.length) + 1 : 1);
function doneThisCycle(dayIdx) {
  const n = S.program.days.length, hs = S.history.filter(h => h.prog);
  return hs.slice(hs.length - (hs.length % n)).some(h => h.dayIdx === dayIdx);
}

// ---------- Pantallas ----------
function render() {
  const keep = [...document.querySelectorAll('[data-keep]')].map(el => [el.dataset.keep, el.scrollLeft]);
  const full = ui.screen;
  const view = full ? { active: viewActive, complete: viewComplete, program: viewProgram, analytics: viewAnalytics, history: viewHistory }[full]
    : { dash: viewDash, workout: viewWorkout, levels: viewLevels, more: viewMore }[ui.tab];
  const app = document.getElementById('view');
  app.className = full ? 'screen-' + full : 'tab-' + ui.tab;
  app.innerHTML = view();
  document.getElementById('tabs').hidden = !!full;
  document.querySelectorAll('#tabs [data-tab]').forEach(b => b.setAttribute('aria-current', b.dataset.tab === ui.tab ? 'page' : 'false'));
  const m = document.getElementById('modal');
  m.innerHTML = ui.sheet ? `<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${viewSheet()}</div>` : '';
  m.hidden = !ui.sheet;
  keep.forEach(([k, x]) => { const el = document.querySelector(`[data-keep="${k}"]`); if (el) el.scrollLeft = x; });
  tick();
}

const ring = (val, target, color, big) => {
  const r = big ? 54 : 30, c = 2 * Math.PI * r, size = (r + 5) * 2, p = target ? Math.min(1, val / target) : 0;
  return `<div class="ring ${big ? 'big' : ''}"><svg viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="track"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${color}" stroke-dasharray="${(c * p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>
    <div><b>${val}</b><span>${Math.max(0, target - val)} faltan</span></div></div>`;
};

function viewDash() {
  const w = weekProgress();
  const date = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const last = S.history.slice(-7);
  const setsArr = last.map(h => sessionStats(h).sets), volArr = last.map(h => sessionStats(h).vol);
  const mx = Math.max(1, ...setsArr);
  const line = () => {
    if (volArr.length < 2) return '<div class="spark empty"></div>';
    const lo = Math.min(...volArr), hi = Math.max(...volArr), sp = hi - lo || 1;
    const pts = volArr.map((v, i) => [6 + i * (128 / (volArr.length - 1)), 34 - ((v - lo) / sp) * 26]);
    return `<svg class="spark" viewBox="0 0 140 42"><polyline points="${pts.map(p => p.join(',')).join(' ')}"/>${pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3"/>`).join('')}</svg>`;
  };
  return `<header class="hero"><p class="wide small">${esc(date)}</p><h1 class="wide">Panel</h1></header>
    <section class="top">
      <h2>Entrenos de la semana</h2>
      <div class="rings">${ring(w.muscles[0], w.muscles[1], 'var(--blue-soft)')}${ring(w.sets[0], w.sets[1], 'var(--coral)', true)}${ring(w.exs[0], w.exs[1], 'var(--cyan)')}</div>
      <div class="ring-labels">
        <div><b>Músculos</b><span>${w.muscles[1]} objetivo</span></div>
        <div><b>Series</b><span>${w.sets[1]} objetivo</span></div>
        <div><b>Ejercicios</b><span>${w.exs[1]} objetivo</span></div>
      </div>
      <div class="seg" role="group"><button data-act="dashMode" data-m="all" aria-pressed="${ui.dashMode === 'all'}">Todos</button><button data-act="dashMode" data-m="prog" aria-pressed="${ui.dashMode === 'prog'}">Programa activo</button></div>
    </section>
    <section class="pad">
      <h2>Datos y análisis</h2>
      <div class="two">
        <button class="card tile" data-act="open" data-screen="analytics" data-metric="sets">
          <b>Entrenos</b><span>Últimos 7 entrenos</span>
          <div class="bars">${setsArr.length ? setsArr.map(v => `<i style="height:${Math.max(8, (v / mx) * 100)}%"></i>`).join('') : ''}</div>
          <p><b>${setsArr.length ? setsArr[setsArr.length - 1] : 0}</b> series ${I.right}</p>
        </button>
        <button class="card tile" data-act="open" data-screen="analytics" data-metric="vol">
          <b>Volumen</b><span>Últimos 7 entrenos</span>
          ${line()}
          <p><b>${volArr.length ? volArr[volArr.length - 1].toLocaleString('es-ES') : 0}</b> kg ${I.right}</p>
        </button>
      </div>
    </section>`;
}

const chips = exIds => { const ms = [...new Set(exIds.flatMap(id => { const e = exById(id); return [e.muscle, ...(e.sec || [])]; }))]; return `<div class="chips">${ms.map(m => `<span>${m}</span>`).join('')}</div>`; };

function viewWorkout() {
  const ws = weekStart(Date.now()), today = new Date().setHours(0, 0, 0, 0);
  const strip = [0, 1, 2, 3, 4, 5, 6].map(i => {
    const t = ws + i * DAY, d = new Date(t), did = S.history.some(h => h.start >= t && h.start < t + DAY);
    return `<div class="daypill ${did ? 'did' : ''} ${t === today ? 'today' : ''}"><span>${'LMXJVSD'[i]}</span><b>${d.getDate()}</b></div>`;
  }).join('');
  const p = S.program;
  return `<header class="bar"><button class="ic" data-act="open" data-screen="history" aria-label="Historial">${I.cal}</button><h1>Entreno</h1><button class="ic" data-act="plusSheet" aria-label="Añadir">${I.plus}</button></header>
    <div class="week top">${strip}</div>
    <section class="pad">
      ${S.active ? `<button class="btn primary" data-act="resume">Volver al entreno en curso</button>` : ''}
      <div class="h2row"><h2>Programa activo</h2>${p ? `<span class="link">Ciclo ${cycleNo()}</span>` : ''}</div>
      ${p ? `<div class="card prog">
        <div class="prog-head"><span class="sq blue">${I.rocket}</span>
          <button class="grow" data-act="editProgram"><b>${esc(p.name)}</b><span>${p.days.length} entrenos</span></button>
          <button class="ic" data-act="toggleProg" aria-label="Plegar">${ui.progOpen ? I.up : I.down}</button></div>
        ${ui.progOpen ? p.days.map((d, i) => `<button class="wrow" data-act="daySheet" data-i="${i}">
          <div><b>${esc(d.name)}</b>${i === S.nextDay ? '<em>Siguiente</em>' : ''}
          <p>${d.items.length ? esc(d.items.map(it => exById(it.ex).name).join(', ')) : 'Sin ejercicios'}</p>
          ${chips(d.items.map(it => it.ex))}</div>
          <span class="box ${doneThisCycle(i) ? 'on' : ''}">${doneThisCycle(i) ? I.check : ''}</span></button>`).join('') : ''}
      </div>` : `<div class="card"><p class="muted">No tienes programa activo. Elige uno de la biblioteca.</p></div>`}
      <div class="h2row"><h2>Biblioteca</h2></div>
      ${TEMPLATES.map((t, i) => `<div class="card prog">
        <div class="prog-head"><span class="sq red">${I.up}</span>
          <button class="grow" data-act="toggleLib" data-i="${i}"><b>${esc(t.name)}</b><span>${t.days.length} entrenos</span></button>
          <button class="ic" data-act="toggleLib" data-i="${i}" aria-label="Abrir">${ui.lib === i ? I.up : I.down}</button></div>
        ${ui.lib === i ? t.days.map(d => `<div class="wrow"><div><b>${esc(d.name)}</b><p>${esc(d.items.map(it => exById(it.ex).name).join(', '))}</p>${chips(d.items.map(it => it.ex))}</div></div>`).join('')
          + `<div class="wrow"><button class="btn primary" data-act="useTemplate" data-i="${i}">Usar este programa</button></div>` : ''}
      </div>`).join('')}
    </section>`;
}

const rirClass = n => (n == null ? '' : n <= 1 ? 'r-red' : n <= 3 ? 'r-amber' : n <= 5 ? 'r-green' : 'r-blue');
const rirBadge = n => (n == null || n === '' ? '' : `<i class="rir ${rirClass(+n)}">${+n >= 6 ? '6+' : n}</i>`);

function viewProgram() {
  const p = S.program; ui.day = Math.min(ui.day, p.days.length - 1);
  const d = p.days[ui.day];
  const tm = {};
  d.items.forEach(it => { const e = exById(it.ex); [e.muscle, ...(e.sec || [])].forEach(m => { tm[m] = tm[m] || { ex: 0, sets: 0 }; tm[m].ex++; tm[m].sets += it.sets; }); });
  return `<header class="bar"><button class="ic" data-act="closeScreen" aria-label="Volver">${I.back}</button><h1>${esc(p.name)}</h1><button class="ic" data-act="progMenu" aria-label="Opciones del programa">${I.sliders}</button></header>
    <div class="tabsrow" data-keep="days">${p.days.map((x, i) => `<button data-act="day" data-i="${i}" aria-selected="${i === ui.day}">${esc(x.name)}</button>`).join('')}<button data-act="addDay" aria-label="Añadir entreno">+</button></div>
    <div class="pills" data-keep="ppills">
      <button data-act="renameDay">${I.edit}Renombrar</button>
      <button data-act="start" data-i="${ui.day}">${I.workout}Empezar</button>
      <button data-act="delDay">${I.trash}Borrar</button></div>
    <section class="pad">
      <h2>Músculos objetivo</h2>
      <div class="hscroll" data-keep="tm">${Object.entries(tm).sort((a, b) => b[1].sets - a[1].sets).map(([m, v]) => `<div class="mcard">${miniBody(m)}<div><b>${m}</b><span>${v.ex} ejercicios</span><span>${v.sets} series</span></div></div>`).join('') || '<p class="muted">Añade ejercicios para verlos.</p>'}</div>
      <div class="h2row"><h2>${d.items.length} ejercicios</h2><button class="link" data-act="pick" data-for="day">Añadir ejercicios</button></div>
    </section>
    ${d.items.map((it, i) => { const e = exById(it.ex); return `<section class="pex">
      <div class="pex-head">${thumb(it.ex)}<div class="grow"><b>${esc(e.name)}</b>${chips([it.ex])}</div><button class="ic" data-act="itemMenu" data-i="${i}" aria-label="Opciones de ${esc(e.name)}">${I.dots}</button></div>
      <button class="wk" data-act="itemEdit" data-i="${i}"><b>Series</b>
        ${Array.from({ length: it.sets }, (_, k) => `<span><i class="n">${k + 1}</i>${it.lo}–${it.hi} reps ${rirBadge(it.rir)}</span>`).join('')}
        <small>Descanso ${clock(it.rest)}</small></button>
    </section>`; }).join('')}`;
}

function viewActive() {
  const a = S.active;
  if (!a.items.length) ui.cur = 0; else ui.cur = Math.min(ui.cur, a.items.length - 1);
  const it = a.items[ui.cur], ex = it && exById(it.ex);
  const strip = a.items.map((x, i) => { const dn = x.sets.filter(s => s.done).length; return `<button class="tile ${i === ui.cur ? 'cur' : ''}" data-act="cur" data-i="${i}" aria-label="${esc(exById(x.ex).name)}">${thumb(x.ex, 'lg')}<i><b style="width:${x.sets.length ? (dn / x.sets.length) * 100 : 0}%"></b></i></button>`; }).join('');
  let n = 0;
  const doneCount = it ? it.sets.filter(s => s.done).length : 0;
  return `<header class="live"><button class="ic" data-act="wmenu" aria-label="Menú del entreno">${I.menu}</button><span id="elapsed" class="t">0:00:00</span>
      <span class="rest">${I.timer}<span id="restTime" class="t">0:00</span></span><button class="restbar" data-act="restSkip" aria-label="Saltar descanso"><b id="restBar"></b></button></header>
    <div class="strip" data-keep="strip">${strip}<button class="tile add" data-act="pick" data-for="session" aria-label="Añadir ejercicio">${I.plus}<i></i></button></div>
    ${it ? `<div class="exname"><h2>${esc(ex.name)}</h2><p>Serie ${Math.min(doneCount + 1, it.sets.length)} de ${it.sets.length}</p></div>
    <div class="pills" data-keep="apills">
      <button class="round" data-act="autofill" aria-label="Rellenar con el objetivo">${I.wand}</button>
      <button data-act="exInfo">${I.info}Info</button>
      <button data-act="warmup">${I.warm}Calentar</button>
      <button data-act="pick" data-for="swap" data-muscle="${esc(ex.muscle)}">${I.swap}Cambiar</button>
      <button data-act="noteSheet">${I.note}Nota</button>
      <button data-act="delEx">${I.trash}Quitar</button></div>
    ${it.note ? `<p class="exnote">${esc(it.note)}</p>` : ''}
    <div class="grid">
      <div class="row head"><span>Serie</span><button data-act="colMode">${ui.colMode === 'prev' ? 'Anterior' : 'Auto'} ${I.swap}</button><span>Kg</span><span>Reps</span>
        <button class="box ${it.sets.length && doneCount === it.sets.length ? 'on' : ''}" data-act="checkAll" aria-label="Marcar todas">${it.sets.length && doneCount === it.sets.length ? I.check : ''}</button></div>
      ${it.sets.map((s, j) => {
        const label = s.type === 'w' ? 'C' : ++n;
        let mid = '–';
        if (s.type === 'w') mid = 'Calentar';
        else if (ui.colMode === 'prev') mid = s.prev ? `${s.prev.w ? kg(s.prev.w) + ' kg x ' : ''}${s.prev.r}${s.prev.rir != null ? `<small>${s.prev.rir} RIR</small>` : ''}` : '–';
        else mid = s.tr != null ? `${s.tw ? kg(s.tw) + ' kg x ' : ''}${s.tr}+` : `${it.lo}–${it.hi} reps`;
        const f = ui.focus && ui.focus.s === j ? ui.focus.f : null;
        return `<div class="row ${s.done ? 'done' : ''}">
          <button class="num" data-act="setMenu" data-s="${j}" aria-label="Opciones de la serie">${label}</button>
          <span class="mid">${mid}</span>
          <button class="cell ${f === 'w' ? 'focus' : ''}" data-act="focus" data-s="${j}" data-f="w" aria-label="Peso">${esc(s.w) || '&nbsp;'}</button>
          <button class="cell ${f === 'r' ? 'focus' : ''}" data-act="focus" data-s="${j}" data-f="r" aria-label="Repeticiones">${esc(s.r) || '&nbsp;'}${s.partial ? '<em>P</em>' : ''}${rirBadge(s.rir)}</button>
          <button class="box ${s.done ? 'on' : ''}" data-act="check" data-s="${j}" aria-pressed="${s.done}" aria-label="Serie hecha">${s.done ? I.check : ''}</button>
        </div>`; }).join('')}
      <button class="num add" data-act="addSet" aria-label="Añadir serie">${I.plus}</button>
    </div>` : `<div class="pad"><p class="muted">Este entreno está vacío. Toca + para añadir un ejercicio.</p></div>`}
    ${ui.focus && it ? keypad(it, ex) : ''}`;
}

function keypad(it, ex) {
  const set = it.sets[ui.focus.s];
  let topRow;
  if (ui.focus.f === 'w' && ex.equip === 'Barra') {
    const w = num(set.w), bar = S.settings.bar; let side = w != null ? (w - bar) / 2 : -1; const cnt = {};
    if (side >= 0) S.settings.plates.slice().sort((a, b) => b - a).forEach(p => { while (side >= p - 1e-9) { cnt[p] = (cnt[p] || 0) + 1; side -= p; } });
    const col = p => (p >= 25 ? 'var(--red)' : p >= 20 ? 'var(--blue)' : p >= 15 ? 'var(--amber)' : p >= 10 ? 'var(--green)' : 'var(--mid)');
    const list = Object.keys(cnt).map(Number).sort((a, b) => b - a);
    topRow = `<div class="platerow"><span class="barbell">${list.map(p => `<i style="background:${col(p)};height:${14 + Math.min(26, p)}px"></i>`).join('')}</span>
      <div>${list.map(p => `<span><i style="background:${col(p)}"></i>${cnt[p]} x ${kg(p)}</span>`).join('')}<span><i class="barico"></i>${kg(bar)}</span>${side > 0.01 ? `<span>sobran ${kg(side * 2)}</span>` : ''}</div></div>`;
  } else {
    topRow = `<div class="rirrow">${[0, 1, 2, 3, 4, 5, 6].map(v => `<button class="rir ${rirClass(v)} ${String(set.rir) === String(v) ? 'sel' : ''}" data-act="rir" data-v="${v}" aria-label="${v} en reserva">${v === 6 ? '6+' : v}</button>`).join('')}<button class="rir q" data-act="rirHelp" aria-label="Qué es esto">?</button></div>`;
  }
  const k = v => `<button data-act="key" data-k="${v}">${v}</button>`;
  return `<div class="keypad">${topRow}
    <div class="keys">
      <div class="nums">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(k).join('')}<button data-act="key" data-k=",">${ui.focus.f === 'w' ? ',' : ''}</button>${k(0)}<button data-act="key" data-k="back" aria-label="Borrar">${I.bksp}</button></div>
      <div class="side">
        <button data-act="hideKeys" aria-label="Cerrar teclado">${I.kbd}</button>
        <button data-act="clearRir">RIR</button>
        <div class="fp"><button data-act="fp" data-v="f" aria-pressed="${!set.partial}">F</button><button data-act="fp" data-v="p" aria-pressed="${!!set.partial}">P</button></div>
        <button class="ok" data-act="ok" aria-label="Confirmar">${I.check}</button>
      </div>
    </div></div>`;
}

function viewComplete() {
  const { entry, records } = ui.done, st = sessionStats(entry);
  const lv = {};
  entry.items.forEach(it => { const e = exById(it.ex); lv[e.muscle] = 1; (e.sec || []).forEach(m => { lv[m] = lv[m] || 0.5; }); });
  return `<header class="bar"><button class="ic" data-act="closeScreen" aria-label="Cerrar">${I.x}</button><h1>Entreno terminado</h1><span class="ic"></span></header>
    <div class="bodies">${body(lv, 'front')}${body(lv, 'back')}</div>
    ${records.length ? `<div class="hscroll recs" data-keep="recs">${records.map(r => `<div class="rec">${I.trophy}<div class="v"><b>${esc(r.val)}</b><span>¡Nuevo!</span></div><b>${esc(exById(r.ex).name)}</b><span>${r.kind}</span></div>`).join('')}</div>` : ''}
    <section class="pad"><h2>Detalles del entreno</h2>
      <div class="card list"><div><span>Entreno</span><b>${esc(entry.dayName)}</b></div><div><span>Duración</span><b>${mins(entry.end - entry.start)} min</b></div><div><span>Series</span><b>${st.sets}</b></div><div><span>Volumen</span><b>${st.vol.toLocaleString('es-ES')} kg</b></div></div>
      <button class="btn primary" data-act="closeScreen">Hecho</button></section>`;
}

function viewLevels() {
  const now = Date.now(), raw = muscleSets(now - 28 * DAY, now + DAY);
  const avg = Object.fromEntries(MUSCLES.map(m => [m, raw[m] / 4]));
  const lv = Object.fromEntries(MUSCLES.map(m => [m, avg[m] / 12]));
  const max = Math.max(4, ...Object.values(avg));
  const sec = (title, list) => `<h2>${title}</h2>${list.map(m => `<div class="card lvl">${miniBody(m)}<div class="grow"><b>${m}</b><span>${kg(Math.round(avg[m] * 10) / 10)} series</span></div><i><b style="width:${(avg[m] / max) * 100}%"></b></i></div>`).join('')}`;
  return `<section class="top figure"><h1 class="center">Niveles de series</h1>
      ${body(lv, ui.back ? 'back' : 'front')}
      <button class="fab" data-act="flip" aria-label="Girar figura">${I.flip}</button>
      <p class="legend"><i></i>Media de series por semana en <u>1 mes</u></p></section>
    <section class="pad">${sec('Tren superior', ['Pecho', 'Espalda', 'Hombro', 'Bíceps', 'Tríceps', 'Abdomen'])}${sec('Tren inferior', ['Cuádriceps', 'Isquios', 'Glúteo', 'Gemelo'])}</section>`;
}

function viewAnalytics() {
  const R = { '1S': [7, 1], '1M': [4, 7], '3M': [12, 7] }[ui.range], [nb, span] = R;
  const end = span === 1 ? new Date().setHours(0, 0, 0, 0) + DAY : weekStart(Date.now()) + 7 * DAY;
  const buckets = Array.from({ length: nb }, (_, i) => { const from = end - (nb - i) * span * DAY; const hs = S.history.filter(h => h.start >= from && h.start < from + span * DAY);
    const v = hs.reduce((n, h) => n + sessionStats(h)[ui.metric === 'sets' ? 'sets' : 'vol'], 0);
    const d = new Date(from); return { v, label: span === 1 ? d.toLocaleDateString('es-ES', { weekday: 'short' }).slice(0, 3) : `${d.getDate()}/${d.getMonth() + 1}` }; });
  const total = buckets.reduce((n, b) => n + b.v, 0), mx = Math.max(1, ...buckets.map(b => b.v)), unit = ui.metric === 'sets' ? 'series' : 'kg';
  const top = {};
  S.history.filter(h => h.start >= Date.now() - 30 * DAY).forEach(h => h.items.forEach(it => { top[it.ex] = (top[it.ex] || 0) + (ui.metric === 'sets' ? it.sets.filter(isWork).length : it.sets.filter(isWork).reduce((n, s) => n + s.w * s.r, 0)); }));
  const fmt = v => Math.round(v).toLocaleString('es-ES');
  return `<header class="bar"><button class="ic" data-act="closeScreen" aria-label="Volver">${I.back}</button><h1>Entrenos</h1><span class="ic"></span></header>
    <div class="tabsrow even"><button data-act="metric" data-m="sets" aria-selected="${ui.metric === 'sets'}">Series</button><button data-act="metric" data-m="vol" aria-selected="${ui.metric === 'vol'}">Volumen</button></div>
    <section class="pad">
      <div class="stats"><div><span>Media</span><b>${fmt(total / nb)} <small>${unit}</small></b></div><div><span>Total</span><b>${fmt(total)} <small>${unit}</small></b></div></div>
      <div class="bigbars">${buckets.map(b => `<div><i style="height:${(b.v / mx) * 100}%"></i><span>${b.label}</span></div>`).join('')}</div>
      <div class="seg wide3">${['1S', '1M', '3M'].map(r => `<button data-act="range" data-r="${r}" aria-pressed="${ui.range === r}">${r}</button>`).join('')}</div>
      <h2>Top 5 ejercicios por ${ui.metric === 'sets' ? 'series' : 'volumen'}</h2><p class="muted">Últimos 30 días</p>
      <div class="card list">${Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, v]) => `<div><span>${esc(exById(id).name)}</span><b>${fmt(v)} ${unit}</b></div>`).join('') || '<div><span>Aún no hay entrenos.</span></div>'}</div>
    </section>`;
}

function viewHistory() {
  return `<header class="bar"><button class="ic" data-act="closeScreen" aria-label="Volver">${I.back}</button><h1>Historial</h1><span class="ic"></span></header>
    <section class="pad">${S.history.length ? S.history.slice().reverse().map(h => { const st = sessionStats(h), open = ui.openHist === h.id;
      return `<div class="card prog"><button class="wrow" data-act="openHist" data-id="${h.id}"><div><b>${esc(h.dayName)}</b><p>${esc(dayLabel(h.start))}</p><p>${mins(h.end - h.start)} min, ${st.sets} series, ${st.vol.toLocaleString('es-ES')} kg</p></div>${open ? I.up : I.down}</button>
        ${open ? h.items.map(it => `<div class="wrow"><div><b>${esc(exById(it.ex).name)}</b><p>${it.sets.map(s => `${s.type === 'w' ? 'C ' : ''}${s.w ? kg(s.w) + ' x ' : ''}${s.r}${s.rir != null ? ' (' + s.rir + ')' : ''}`).join(' · ')}</p>${it.note ? `<p>${esc(it.note)}</p>` : ''}</div></div>`).join('') + `<div class="wrow"><button class="btn danger" data-act="delHist" data-id="${h.id}">Borrar este entreno</button></div>` : ''}</div>`; }).join('')
      : '<p class="muted">Aquí salen tus entrenos cuando termines el primero.</p>'}</section>`;
}

function viewMore() {
  const s = S.settings;
  return `<header class="bar"><span class="ic"></span><h1>Más</h1><span class="ic"></span></header>
    <section class="pad">
      <h2>Material</h2>
      <div class="card form">
        <label>Peso de la barra, en kg<input inputmode="decimal" data-bind="setting" data-f="bar" value="${kg(s.bar)}"></label>
        <label>Discos que tienes, en kg<input data-bind="setting" data-f="plates" value="${s.plates.map(kg).join(' ')}"></label></div>
      <h2>Descanso</h2>
      <div class="card form">
        <label>Descanso para ejercicios nuevos, en segundos<input inputmode="numeric" data-bind="setting" data-f="rest" value="${s.rest}"></label>
        <label class="switch">Pitido al acabar el descanso<input type="checkbox" data-bind="setting" data-f="sound" ${s.sound ? 'checked' : ''}></label></div>
      <h2>Tus datos</h2>
      <p class="muted">Los datos viven solo en este móvil. Guarda una copia de vez en cuando.</p>
      <button class="btn" data-act="export">Guardar copia</button>
      <label class="btn">Cargar copia<input type="file" accept="application/json,.json" data-bind="import" hidden></label>
      <button class="btn danger" data-act="wipe">Borrar todo</button>
    </section>`;
}

// ---------- Hojas (ventanas de abajo) ----------
const opt = (act, icon, text, extra = '') => `<button class="opt" data-act="${act}" ${extra}>${icon}<span>${text}</span></button>`;
function viewSheet() {
  const m = ui.sheet;
  if (m.type === 'plus') return `${S.active ? opt('resume', I.workout, 'Volver al entreno en curso') : (S.program && S.program.days.length ? opt('start', I.workout, `Empezar ${esc(S.program.days[Math.min(S.nextDay, S.program.days.length - 1)].name)}`, `data-i="${Math.min(S.nextDay, S.program.days.length - 1)}"`) : '') + opt('startFree', I.plus, 'Entreno vacío')}
    ${opt('emptyProgram', I.edit, 'Programa nuevo')}${opt('newExSheet', I.gym, 'Ejercicio nuevo')}`;
  if (m.type === 'day') { const d = S.program.days[m.i]; return `<h2>${esc(d.name)}</h2><p class="muted">${d.items.length} ejercicios</p>
    <button class="btn primary" data-act="start" data-i="${m.i}">Empezar entreno</button><button class="btn" data-act="editProgram" data-i="${m.i}">Editar</button>`; }
  if (m.type === 'wmenu') return `${opt('finish', I.check, 'Terminar entreno')}${opt('minimize', I.down, 'Salir sin terminar')}${opt('pick', I.plus, 'Añadir ejercicio', 'data-for="session"')}${opt('discard', I.trash, 'Tirar este entreno')}`;
  if (m.type === 'setMenu') return `<h2>Serie</h2>${opt('setType', I.workout, 'Serie normal', `data-s="${m.s}" data-t="n"`)}${opt('setType', I.warm, 'Calentamiento', `data-s="${m.s}" data-t="w"`)}${opt('delSet', I.trash, 'Quitar serie', `data-s="${m.s}"`)}`;
  if (m.type === 'info') { const it = S.active.items[ui.cur], ex = exById(it.ex), rec = recordFor(ex.id);
    const pts = S.history.map(h => { const x = h.items.find(q => q.ex === ex.id); const b = x && bestOf(x.sets); return b ? b.score : null; }).filter(v => v != null);
    let ch = '<p class="muted">Haz este ejercicio 2 días y verás tu línea de fuerza.</p>';
    if (pts.length > 1) { const lo = Math.min(...pts), hi = Math.max(...pts), sp = hi - lo || 1; const xy = pts.map((v, i) => [8 + i * (304 / (pts.length - 1)), 92 - ((v - lo) / sp) * 80]);
      ch = `<svg class="spark big" viewBox="0 0 320 100"><polyline points="${xy.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ')}"/>${xy.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3"/>`).join('')}</svg>`; }
    return `<h2>${esc(ex.name)}</h2>${chips([ex.id])}<div class="card list"><div><span>Material</span><b>${ex.equip}</b></div><div><span>Objetivo</span><b>${it.lo}–${it.hi} reps, ${it.rir} RIR</b></div><div><span>Mejor serie</span><b>${rec ? `${rec.w ? kg(rec.w) + ' kg x ' : ''}${rec.r}` : 'Aún no hay'}</b></div></div>${ch}
      <label class="field">Descanso, en segundos<input inputmode="numeric" data-bind="itemRest" value="${it.rest}"></label><button class="btn primary" data-act="close">Hecho</button>`; }
  if (m.type === 'note') return `<h2>Nota</h2><label class="field"><textarea data-bind="note" rows="3" placeholder="Escribe aquí">${esc(S.active.items[ui.cur].note)}</textarea></label><button class="btn primary" data-act="close">Guardar nota</button>`;
  if (m.type === 'pick') return `<h2>${m.for === 'swap' ? 'Cambiar ejercicio' : 'Añadir ejercicios'}</h2>
    <input type="search" placeholder="Buscar un ejercicio" aria-label="Buscar ejercicio" data-bind="pickQ" value="${esc(m.q)}">
    <div class="pills" data-keep="pm">${['Todos', ...MUSCLES].map(x => `<button data-act="pickMuscle" data-m="${x}" aria-pressed="${(m.muscle || 'Todos') === x}">${x}</button>`).join('')}</div>
    <div id="pickList">${pickList()}</div><button class="btn" data-act="newExSheet">Crear ejercicio nuevo</button>`;
  if (m.type === 'newEx') return `<h2>Ejercicio nuevo</h2>
    <label class="field">Nombre<input id="nxName"></label>
    <label class="field">Músculo<select id="nxMuscle">${MUSCLES.map(x => `<option>${x}</option>`).join('')}</select></label>
    <label class="field">Material<select id="nxEquip">${Object.keys(EQUIP_GLYPH).map(x => `<option>${x}</option>`).join('')}</select></label>
    <label class="field">Salto de peso, en kg<input id="nxInc" inputmode="decimal" value="2,5"></label>
    <button class="btn primary" data-act="saveEx">Guardar ejercicio</button>`;
  if (m.type === 'itemEdit') { const it = S.program.days[ui.day].items[m.i];
    return `<h2>${esc(exById(it.ex).name)}</h2><div class="grid5">${[['sets', 'Series'], ['lo', 'Reps mín'], ['hi', 'Reps máx'], ['rir', 'RIR'], ['rest', 'Descanso s']].map(([f, l]) => `<label>${l}<input inputmode="numeric" data-bind="pitem" data-i="${m.i}" data-f="${f}" value="${it[f]}"></label>`).join('')}</div>
      <button class="btn primary" data-act="close">Hecho</button>`; }
  if (m.type === 'itemMenu') return `<h2>${esc(exById(S.program.days[ui.day].items[m.i].ex).name)}</h2>${opt('itemEdit', I.edit, 'Cambiar series y reps', `data-i="${m.i}"`)}${opt('moveItem', I.up, 'Subir', `data-i="${m.i}" data-dir="-1"`)}${opt('moveItem', I.down, 'Bajar', `data-i="${m.i}" data-dir="1"`)}${opt('delItem', I.trash, 'Quitar del entreno', `data-i="${m.i}"`)}`;
  if (m.type === 'progMenu') return `<h2>Programa</h2><label class="field">Nombre<input data-bind="progName" value="${esc(S.program.name)}"></label>${opt('addDay', I.plus, 'Añadir entreno')}${opt('delProgram', I.trash, 'Quitar este programa')}<button class="btn primary" data-act="close">Hecho</button>`;
  if (m.type === 'rename') return `<h2>Renombrar</h2><label class="field">Nombre del entreno<input data-bind="dayName" value="${esc(S.program.days[ui.day].name)}"></label><button class="btn primary" data-act="close">Hecho</button>`;
  return '';
}
function pickList() {
  const m = ui.sheet, q = (m.q || '').toLowerCase();
  const list = allEx().filter(e => (!m.muscle || m.muscle === 'Todos' || e.muscle === m.muscle) && e.name.toLowerCase().includes(q));
  return list.map(e => `<button class="pk" data-act="choose" data-ex="${esc(e.id)}">${thumb(e.id)}<div><b>${esc(e.name)}</b>${chips([e.id])}</div>${I.plus}</button>`).join('') || '<p class="muted">No hay ninguno con ese nombre. Puedes crearlo abajo.</p>';
}

// ---------- Acciones ----------
const close = () => { ui.sheet = null; };
const curItem = () => S.active.items[ui.cur];
const actions = {
  tab(d) { ui.tab = d.tab; ui.screen = null; close(); window.scrollTo(0, 0); },
  close,
  open(d) { ui.screen = d.screen; if (d.metric) ui.metric = d.metric; window.scrollTo(0, 0); },
  closeScreen() { ui.screen = null; ui.done = null; close(); window.scrollTo(0, 0); },
  dashMode(d) { ui.dashMode = d.m; },
  metric(d) { ui.metric = d.m; },
  range(d) { ui.range = d.r; },
  flip() { ui.back = !ui.back; },
  plusSheet() { ui.sheet = { type: 'plus' }; },
  toggleProg() { ui.progOpen = !ui.progOpen; },
  toggleLib(d) { ui.lib = ui.lib === +d.i ? null : +d.i; },
  daySheet(d) { ui.sheet = { type: 'day', i: +d.i }; },
  useTemplate(d) {
    if (S.program && !confirm('Esto cambia tu programa activo. Tu historial se queda. ¿Seguir?')) return;
    const t = clone(TEMPLATES[d.i]); S.program = { name: t.name, days: t.days.map(x => ({ id: uid(), ...x })) }; S.nextDay = 0; ui.lib = null; ui.progOpen = true; window.scrollTo(0, 0);
  },
  emptyProgram() {
    if (S.program && !confirm('Esto cambia tu programa activo. Tu historial se queda. ¿Seguir?')) return;
    S.program = { name: 'Mi programa', days: [{ id: uid(), name: 'Entreno A', items: [] }] }; S.nextDay = 0; ui.day = 0; ui.screen = 'program'; close();
  },
  editProgram(d) { if (d.i != null) ui.day = +d.i; ui.screen = 'program'; close(); window.scrollTo(0, 0); },
  progMenu() { ui.sheet = { type: 'progMenu' }; },
  delProgram() { if (confirm('¿Quitar el programa? Tu historial se queda.')) { S.program = null; ui.screen = null; close(); } },
  day(d) { ui.day = +d.i; },
  addDay() { S.program.days.push({ id: uid(), name: 'Entreno ' + 'ABCDEFGH'[S.program.days.length % 8], items: [] }); ui.day = S.program.days.length - 1; close(); },
  renameDay() { ui.sheet = { type: 'rename' }; },
  delDay() { if (S.program.days.length < 2) return toast('El programa necesita un entreno al menos.'); if (confirm('¿Borrar este entreno del programa?')) { S.program.days.splice(ui.day, 1); ui.day = 0; S.nextDay = 0; } },
  itemMenu(d) { ui.sheet = { type: 'itemMenu', i: +d.i }; },
  itemEdit(d) { ui.sheet = { type: 'itemEdit', i: +d.i }; },
  delItem(d) { S.program.days[ui.day].items.splice(+d.i, 1); close(); },
  moveItem(d) { const arr = S.program.days[ui.day].items, i = +d.i, j = i + +d.dir; if (j >= 0 && j < arr.length) [arr[i], arr[j]] = [arr[j], arr[i]]; close(); },
  start(d) { if (S.active) { ui.screen = 'active'; close(); return toast('Ya tienes un entreno en curso.'); } startWorkout(+d.i); },
  startFree() { startWorkout(null); },
  resume() { ui.screen = 'active'; close(); },
  minimize() { ui.screen = null; ui.focus = null; close(); },
  wmenu() { ui.sheet = { type: 'wmenu' }; },
  finish() { finishWorkout(); },
  discard() { if (confirm('¿Tirar este entreno? No se guarda nada.')) { S.active = null; stopRest(); ui.screen = null; ui.focus = null; close(); } },
  cur(d) { ui.cur = +d.i; ui.focus = null; },
  colMode() { ui.colMode = ui.colMode === 'prev' ? 'auto' : 'prev'; },
  focus(d) { unlockAudio(); ui.focus = { s: +d.s, f: d.f }; ui.fresh = true; },
  hideKeys() { ui.focus = null; },
  key(d) {
    const set = curItem().sets[ui.focus.s], f = ui.focus.f; let v = ui.fresh ? '' : String(set[f] || '');
    if (d.k === 'back') v = ui.fresh ? '' : v.slice(0, -1);
    else if (d.k === ',') { if (f !== 'w' || v.includes(',')) return; v = (v || '0') + ','; }
    else if (v.replace(',', '').length < 5) v += d.k;
    set[f] = v; ui.fresh = false;
  },
  rir(d) { const set = curItem().sets[ui.focus.s]; set.rir = String(set.rir) === d.v ? '' : d.v; },
  clearRir() { curItem().sets[ui.focus.s].rir = ''; toast('RIR son las reps que te quedan en reserva. Elige un número arriba.'); },
  rirHelp() { toast('RIR: cuántas reps más podrías hacer. 0 es al fallo.'); },
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
  autofill() { retarget(curItem(), true); toast('Relleno con el objetivo de hoy.'); },
  exInfo() { ui.sheet = { type: 'info' }; },
  noteSheet() { ui.sheet = { type: 'note' }; },
  warmup() {
    const it = curItem(), first = it.sets.find(isWork), top = first && num(first.w);
    if (!top) return toast('Primero escribe el peso de la primera serie.');
    const step = exById(it.ex).inc || 2.5;
    const warm = [[0.5, 8], [0.7, 5], [0.85, 2]].map(([f, r]) => ({ ...newSet('w'), w: kg(roundTo(top * f, step)), r: String(r) }));
    it.sets = warm.concat(it.sets.filter(isWork)); ui.focus = null;
  },
  delEx() { if (confirm('¿Quitar este ejercicio del entreno?')) { S.active.items.splice(ui.cur, 1); ui.cur = Math.max(0, ui.cur - 1); ui.focus = null; } },
  restSkip() { stopRest(); },
  pick(d) { ui.sheet = { type: 'pick', for: d.for, muscle: d.muscle || 'Todos', q: '' }; ui.focus = null; },
  pickMuscle(d) { ui.sheet.muscle = d.m; },
  newExSheet() { ui.sheet = { type: 'newEx', back: ui.sheet && ui.sheet.type === 'pick' ? ui.sheet : null }; },
  saveEx() {
    const name = document.getElementById('nxName').value.trim();
    if (!name) return toast('Escribe un nombre.');
    const equip = document.getElementById('nxEquip').value;
    const ex = { id: 'c-' + uid(), name, muscle: document.getElementById('nxMuscle').value, sec: [], equip, inc: equip === 'Peso corporal' ? 0 : (num(document.getElementById('nxInc').value) ?? 2.5) };
    S.custom.push(ex); const back = ui.sheet.back; ui.sheet = back;
    if (back) choose(ex.id); else toast('Ejercicio guardado.');
  },
  choose(d) { choose(d.ex); },
  openHist(d) { ui.openHist = ui.openHist === d.id ? null : d.id; },
  delHist(d) { if (confirm('¿Borrar este entreno? No se puede deshacer.')) S.history = S.history.filter(h => h.id !== d.id); },
  export() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }));
    a.download = `hierro-copia-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000); toast('Copia guardada.');
  },
  wipe() { if (confirm('¿Borrar TODO? Se pierden el programa y el historial.')) { S = freshState(); ui.tab = 'dash'; ui.screen = null; } },
};
function choose(exId) {
  const m = ui.sheet, base = { ex: exId, sets: 3, lo: 8, hi: 12, rir: 2, rest: S.settings.rest };
  if (m.for === 'day') { S.program.days[ui.day].items.push(base); toast('Añadido.'); return; }
  if (m.for === 'session') { S.active.items.push(newItem(base)); ui.cur = S.active.items.length - 1; }
  else if (m.for === 'swap') { const it = curItem(); it.ex = exId; retarget(it, true); }
  close();
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) { if (e.target.id === 'modal') { close(); render(); } return; }
  const fn = actions[el.dataset.act]; if (!fn) return;
  fn(el.dataset, el); save(); render();
});

// Campos de texto: guardan sin redibujar, para no perder el cursor.
const binds = {
  note(el) { curItem().note = el.value; },
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
      if (!data || !Array.isArray(data.history)) throw new Error('formato');
      if (!confirm('Esto cambia todos tus datos por los de la copia. ¿Seguir?')) return;
      S = Object.assign(freshState(), data); save(); render(); toast('Copia cargada.');
    }).catch(() => toast('Ese archivo no es una copia de Hierro.'));
  },
};
function onField(e) {
  const el = e.target.closest('[data-bind]'); if (!el) return;
  const b = el.dataset.bind, live = ['note', 'pickQ', 'progName', 'dayName'];
  if ((e.type === 'input') !== live.includes(b)) return;
  binds[b](el, el.dataset); save();
}
document.addEventListener('input', onField);
document.addEventListener('change', onField);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
const tabBtn = (id, label) => `<button data-act="tab" data-tab="${id}">${I[id]}<span>${label}</span></button>`;
document.getElementById('tabs').innerHTML = tabBtn('dash', 'Panel') + tabBtn('workout', 'Entreno')
  + `<button class="fabplus" data-act="plusSheet" aria-label="Añadir">${I.plus}</button>` + tabBtn('levels', 'Niveles') + tabBtn('more', 'Más');
render(); wake();
