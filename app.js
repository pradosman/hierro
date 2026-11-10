import { EXERCISES, MUSCLES, TEMPLATES } from './data.js';

// ---------- Guardado ----------
const KEY = 'hierro.v1';
const clone = o => JSON.parse(JSON.stringify(o));
const uid = () => Math.random().toString(36).slice(2, 10);

function freshState() {
  return {
    v: 1,
    settings: { bar: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25], rest: 120, sound: true },
    custom: [],
    program: null,
    nextDay: 0,
    active: null,
    restEnd: null,
    restTotal: 0,
    history: [],
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return Object.assign(freshState(), JSON.parse(raw));
  } catch (e) { console.error(e); }
  return freshState();
}

let S = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('No se pudo guardar. El móvil no tiene sitio.'); } };

const ui = { tab: 'hoy', modal: null, openHist: null, progEx: null };

// ---------- Ayudas ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => {
  if (v === '' || v == null) return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const kg = n => (n == null ? '' : String(Math.round(n * 100) / 100).replace('.', ','));
const allEx = () => EXERCISES.concat(S.custom);
const exById = id => allEx().find(e => e.id === id) || { id, name: 'Ejercicio borrado', muscle: 'Pecho', sec: [], equip: 'Máquina', inc: 2.5 };
const isWork = s => s.type !== 'w';
const e1rm = (w, r, rir) => w * (1 + (r + (rir || 0)) / 30);
const dayLabel = ts => new Date(ts).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
const mins = ms => Math.max(1, Math.round(ms / 60000));
const clock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const roundTo = (n, step) => (step > 0 ? Math.round(n / step) * step : Math.round(n));

let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 2600);
}

// ---------- Regla de progreso ----------
// Mira la última vez que hiciste el ejercicio y decide el objetivo de hoy.
function lastSets(exId) {
  for (let i = S.history.length - 1; i >= 0; i--) {
    const item = S.history[i].items.find(x => x.ex === exId);
    if (item) { const sets = item.sets.filter(isWork); if (sets.length) return sets; }
  }
  return null;
}

function suggest(item, workIdx) {
  const prev = lastSets(item.ex);
  if (!prev) return { tw: null, tr: null, why: 'Primera vez. Elige un peso que te deje reps en reserva.' };
  const p = prev[Math.min(workIdx, prev.length - 1)];
  const inc = exById(item.ex).inc;
  const rir = p.rir == null ? item.rir : p.rir;
  const eff = p.r + rir - item.rir; // reps que valdrían con la reserva pedida
  const was = `Última vez: ${p.w ? kg(p.w) + ' kg × ' : ''}${p.r}${p.rir == null ? '' : ', ' + p.rir + ' en reserva'}.`;
  if (!p.w || !inc) {
    return { tw: p.w || 0, tr: Math.max(item.lo, eff + 1), why: `${was} Hoy una repetición más.` };
  }
  if (eff >= item.hi) return { tw: p.w + inc, tr: item.lo, why: `${was} Llegaste arriba. Hoy sube el peso.` };
  if (eff <= item.lo - 2) return { tw: Math.max(0, p.w - inc), tr: item.lo, why: `${was} Se quedó corto. Hoy baja un poco.` };
  if (eff < item.lo) return { tw: p.w, tr: item.lo, why: `${was} Hoy mismo peso.` };
  return { tw: p.w, tr: Math.min(item.hi, eff + 1), why: `${was} Hoy una repetición más.` };
}

function retarget(item) {
  let wi = 0;
  item.sets.forEach(s => {
    if (!isWork(s)) return;
    const t = suggest(item, wi++);
    s.tw = t.tw; s.tr = t.tr;
  });
  item.why = suggest(item, 0).why;
}

const newSet = type => ({ type: type || 'n', w: '', r: '', rir: '', done: false, tw: null, tr: null });

function newItem(src) {
  const item = { ex: src.ex, lo: src.lo, hi: src.hi, rir: src.rir, rest: src.rest, note: '', why: '', sets: [] };
  for (let i = 0; i < src.sets; i++) item.sets.push(newSet());
  retarget(item);
  return item;
}

// ---------- Entreno ----------
function startWorkout(dayIdx) {
  const d = dayIdx == null ? null : S.program.days[dayIdx];
  S.active = { dayIdx, dayName: d ? d.name : 'Entreno libre', start: Date.now(), items: d ? d.items.map(newItem) : [] };
  save(); render(); wake();
}

function completeSet(i, s) {
  const item = S.active.items[i], set = item.sets[s];
  if (set.done) { set.done = false; save(); render(); return; }
  const body = !exById(item.ex).inc;
  const w = num(set.w) ?? set.tw ?? (body ? 0 : null);
  const r = num(set.r) ?? set.tr;
  if (w == null) return toast('Escribe el peso.');
  if (!r || r < 1) return toast('Escribe las repeticiones.');
  set.w = kg(w); set.r = String(Math.round(r));
  if (set.rir === '' && isWork(set)) set.rir = String(item.rir);
  set.done = true;
  if (isWork(set)) startRest(item.rest);
  save(); render();
}

function finishWorkout() {
  const a = S.active;
  const items = a.items.map(it => ({
    ex: it.ex, note: it.note,
    sets: it.sets.filter(s => s.done).map(s => ({ type: s.type, w: num(s.w) || 0, r: num(s.r), rir: num(s.rir) })),
  })).filter(it => it.sets.length);
  if (!items.length) {
    if (!confirm('No has marcado ninguna serie. ¿Tirar este entreno?')) return;
    S.active = null; stopRest(); save(); render(); return;
  }
  const records = [];
  items.forEach(it => {
    const best = bestOf(it.sets);
    const old = recordFor(it.ex);
    if (best && (!old || best.score > old.score + 0.01)) records.push({ ex: it.ex, ...best });
  });
  const entry = { id: uid(), start: a.start, end: Date.now(), dayName: a.dayName, items };
  S.history.push(entry);
  if (a.dayIdx != null && S.program) S.nextDay = (a.dayIdx + 1) % S.program.days.length;
  S.active = null; stopRest(); save();
  ui.modal = { type: 'summary', entry, records };
  render();
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

// ---------- Descanso ----------
let audio;
function unlockAudio() {
  try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch (e) { /* sin sonido */ }
}
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
function tickRest() {
  const bar = document.getElementById('rest');
  if (!S.restEnd || !S.active) { bar.hidden = true; return; }
  const left = (S.restEnd - Date.now()) / 1000;
  if (left <= 0) {
    if (left > -3) beep();
    stopRest(); save(); bar.hidden = true; toast('Descanso terminado. A por la siguiente serie.');
    return;
  }
  bar.hidden = false;
  bar.querySelector('.rest-time').textContent = clock(Math.ceil(left));
  bar.querySelector('.rest-fill').style.transform = `scaleX(${Math.min(1, left / (S.restTotal || left))})`;
}
setInterval(tickRest, 250);

let lock;
async function wake() { try { if (S.active && navigator.wakeLock) lock = await navigator.wakeLock.request('screen'); } catch (e) { /* no pasa nada */ } }
document.addEventListener('visibilitychange', () => { if (!document.hidden) { wake(); tickRest(); } });

// ---------- Pantallas ----------
function render() {
  const view = { hoy: viewHoy, programa: viewPrograma, historial: viewHistorial, progreso: viewProgreso, ajustes: viewAjustes }[ui.tab];
  document.getElementById('view').innerHTML = view();
  document.querySelectorAll('#tabs button').forEach(b => b.setAttribute('aria-current', b.dataset.tab === ui.tab ? 'page' : 'false'));
  const m = document.getElementById('modal');
  m.innerHTML = ui.modal ? `<div class="sheet" role="dialog" aria-modal="true">${viewModal()}</div>` : '';
  m.hidden = !ui.modal;
  tickRest();
}

function viewHoy() {
  if (S.active) return viewActive();
  if (!S.program) {
    return `<h1>Elige un programa</h1>
      <p class="lead">Un programa es tu plan de la semana. Luego puedes cambiar todo.</p>
      ${TEMPLATES.map((t, i) => `<button class="card pick" data-act="useTemplate" data-i="${i}">
        <strong>${esc(t.name)}</strong><span>${esc(t.about)}</span></button>`).join('')}
      <button class="card pick" data-act="emptyProgram"><strong>Empezar de cero</strong><span>Creas tú los días y los ejercicios.</span></button>`;
  }
  const days = S.program.days;
  if (!days.length) return `<h1>Tu programa está vacío</h1><p class="lead">Añade un día en la pestaña Programa.</p>
    <button class="btn main" data-act="tab" data-tab="programa">Ir a Programa</button>`;
  const idx = Math.min(S.nextDay, days.length - 1), d = days[idx];
  const last = S.history[S.history.length - 1];
  return `<p class="over">${last ? 'Último entreno: ' + esc(dayLabel(last.start)) : 'Aún no has entrenado'}</p>
    <h1>Hoy toca ${esc(d.name)}</h1>
    <ol class="plan">${d.items.map(it => {
      const t = suggest(it, 0);
      return `<li><span>${esc(exById(it.ex).name)}</span>
        <em>${it.sets} × ${t.tw ? kg(t.tw) + ' kg × ' + t.tr : it.lo + '–' + it.hi}</em></li>`;
    }).join('') || '<li><span>Este día no tiene ejercicios.</span></li>'}</ol>
    <button class="btn main big" data-act="start" data-i="${idx}">Empezar entreno</button>
    <div class="row">
      ${days.length > 1 ? `<button class="btn" data-act="skipDay">Hacer otro día</button>` : ''}
      <button class="btn" data-act="startFree">Entreno libre</button>
    </div>`;
}

const TYPE = { n: null, w: 'C', d: 'D', f: 'F' };
const TYPE_NAME = { n: 'Serie normal', w: 'Calentamiento', d: 'Serie descendente', f: 'Al fallo' };

function viewActive() {
  const a = S.active;
  let done = 0, total = 0;
  a.items.forEach(it => it.sets.forEach(s => { total++; if (s.done) done++; }));
  return `<header class="live">
      <div><p class="over">${done} de ${total} series</p><h1>${esc(a.dayName)}</h1></div>
      <button class="btn main" data-act="finish">Terminar</button>
    </header>
    ${a.items.map((it, i) => {
      const ex = exById(it.ex);
      let n = 0;
      return `<section class="card ex">
        <div class="ex-head">
          <div><h2>${esc(ex.name)}</h2>
          <p class="meta">${it.lo}–${it.hi} reps, deja ${it.rir} en reserva</p></div>
          <button class="icon" data-act="exMenu" data-i="${i}" aria-label="Opciones de ${esc(ex.name)}">⋯</button>
        </div>
        <p class="why">${esc(it.why)}</p>
        ${it.note ? `<p class="note">${esc(it.note)}</p>` : ''}
        <div class="sets">
          <div class="set head"><span></span><span>kg</span><span>reps</span><span>reserva</span><span></span></div>
          ${it.sets.map((s, j) => {
            const label = TYPE[s.type] || ++n;
            return `<div class="set ${s.done ? 'done' : ''} t-${s.type}">
              <button class="tag" data-act="setType" data-i="${i}" data-s="${j}" aria-label="${TYPE_NAME[s.type]}. Toca para cambiar.">${label}</button>
              <input inputmode="decimal" aria-label="Peso" data-bind="set" data-f="w" data-i="${i}" data-s="${j}" value="${esc(s.w)}" placeholder="${s.tw != null ? kg(s.tw) : '–'}">
              <input inputmode="numeric" aria-label="Repeticiones" data-bind="set" data-f="r" data-i="${i}" data-s="${j}" value="${esc(s.r)}" placeholder="${s.tr ?? '–'}">
              <input inputmode="numeric" aria-label="Reps en reserva" data-bind="set" data-f="rir" data-i="${i}" data-s="${j}" value="${esc(s.rir)}" placeholder="${isWork(s) ? it.rir : '–'}">
              <button class="check" data-act="check" data-i="${i}" data-s="${j}" aria-pressed="${s.done}" aria-label="${s.done ? 'Desmarcar serie' : 'Marcar serie hecha'}">✓</button>
            </div>`;
          }).join('')}
        </div>
        <div class="row">
          <button class="btn small" data-act="addSet" data-i="${i}">Añadir serie</button>
          ${it.sets.length ? `<button class="btn small" data-act="delSet" data-i="${i}">Quitar serie</button>` : ''}
        </div>
      </section>`;
    }).join('')}
    <button class="btn" data-act="pick" data-for="session">Añadir ejercicio</button>
    <button class="btn danger" data-act="discard">Tirar este entreno</button>`;
}

function viewPrograma() {
  if (!S.program) return `<h1>Programa</h1><p class="lead">Aún no tienes programa. Elige uno en la pestaña Hoy.</p>
    <button class="btn main" data-act="tab" data-tab="hoy">Ir a Hoy</button>`;
  const p = S.program;
  return `<h1>Programa</h1>
    <label class="field">Nombre<input data-bind="progName" value="${esc(p.name)}"></label>
    ${p.days.map((d, di) => `<section class="card">
      <div class="ex-head">
        <input class="title" aria-label="Nombre del día" data-bind="dayName" data-d="${di}" value="${esc(d.name)}">
        <button class="icon" data-act="delDay" data-d="${di}" aria-label="Borrar ${esc(d.name)}">✕</button>
      </div>
      ${d.items.map((it, ii) => `<div class="pitem">
        <div class="ex-head"><strong>${esc(exById(it.ex).name)}</strong>
          <span class="mini">
            <button class="icon" data-act="moveItem" data-d="${di}" data-i="${ii}" data-dir="-1" aria-label="Subir">↑</button>
            <button class="icon" data-act="moveItem" data-d="${di}" data-i="${ii}" data-dir="1" aria-label="Bajar">↓</button>
            <button class="icon" data-act="delItem" data-d="${di}" data-i="${ii}" aria-label="Quitar">✕</button>
          </span></div>
        <div class="grid5">
          ${[['sets', 'Series'], ['lo', 'Reps mín'], ['hi', 'Reps máx'], ['rir', 'Reserva'], ['rest', 'Descanso s']].map(([f, l]) =>
            `<label>${l}<input inputmode="numeric" data-bind="pitem" data-d="${di}" data-i="${ii}" data-f="${f}" value="${it[f]}"></label>`).join('')}
        </div></div>`).join('')}
      <button class="btn small" data-act="pick" data-for="day" data-d="${di}">Añadir ejercicio</button>
    </section>`).join('')}
    <button class="btn" data-act="addDay">Añadir día</button>
    <button class="btn danger" data-act="changeProgram">Cambiar de programa</button>`;
}

function viewHistorial() {
  if (!S.history.length) return `<h1>Historial</h1><p class="lead">Aquí salen tus entrenos cuando termines el primero.</p>`;
  return `<h1>Historial</h1>${S.history.slice().reverse().map(h => {
    const st = sessionStats(h), open = ui.openHist === h.id;
    return `<section class="card">
      <button class="hist" data-act="openHist" data-id="${h.id}" aria-expanded="${open}">
        <strong>${esc(h.dayName)}</strong>
        <span>${esc(dayLabel(h.start))}</span>
        <span>${mins(h.end - h.start)} min, ${st.sets} series, ${st.vol.toLocaleString('es-ES')} kg movidos</span>
      </button>
      ${open ? h.items.map(it => `<div class="hitem"><strong>${esc(exById(it.ex).name)}</strong>
        <p>${it.sets.map(s => `${TYPE[s.type] ? TYPE[s.type] + ' ' : ''}${s.w ? kg(s.w) + ' × ' : ''}${s.r}${s.rir != null ? ' (' + s.rir + ')' : ''}`).join(' · ')}</p>
        ${it.note ? `<p class="note">${esc(it.note)}</p>` : ''}</div>`).join('') +
        `<button class="btn small danger" data-act="delHist" data-id="${h.id}">Borrar este entreno</button>` : ''}
    </section>`;
  }).join('')}`;
}

function weekStart(ts) { const d = new Date(ts); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); }
function weekVolume(from) {
  const out = Object.fromEntries(MUSCLES.map(m => [m, 0]));
  S.history.filter(h => h.start >= from && h.start < from + 7 * 864e5).forEach(h => h.items.forEach(it => {
    const ex = exById(it.ex), n = it.sets.filter(isWork).length;
    if (ex.muscle in out) out[ex.muscle] += n;
    (ex.sec || []).forEach(m => { if (m in out) out[m] += n / 2; });
  }));
  return out;
}

function viewProgreso() {
  if (!S.history.length) return `<h1>Progreso</h1><p class="lead">Aquí verás tus series por músculo y tus marcas.</p>`;
  const vol = weekVolume(weekStart(Date.now()));
  const max = Math.max(10, ...Object.values(vol));
  const done = [...new Set(S.history.flatMap(h => h.items.map(i => i.ex)))].map(exById).sort((a, b) => a.name.localeCompare(b.name));
  const cur = done.find(e => e.id === ui.progEx) || done[0];
  const pts = S.history.map(h => { const it = h.items.find(x => x.ex === cur.id); const b = it && bestOf(it.sets); return b ? { t: h.start, ...b } : null; }).filter(Boolean);
  const rec = recordFor(cur.id);
  return `<h1>Progreso</h1>
    <section class="card"><h2>Series esta semana</h2>
      <p class="meta">El músculo principal cuenta 1. El que ayuda cuenta medio.</p>
      ${MUSCLES.map(m => `<div class="bar"><span>${m}</span><i><b style="width:${(vol[m] / max) * 100}%"></b></i><em>${kg(vol[m])}</em></div>`).join('')}
    </section>
    <section class="card"><h2>Fuerza por ejercicio</h2>
      <select data-bind="progEx" aria-label="Ejercicio">${done.map(e => `<option value="${e.id}" ${e.id === cur.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select>
      ${chart(pts)}
      ${rec ? `<p class="meta">Mejor serie: ${rec.w ? kg(rec.w) + ' kg × ' : ''}${rec.r} reps, ${esc(dayLabel(rec.date))}.</p>` : ''}
      <p class="meta">La línea es tu fuerza calculada para 1 repetición.</p>
    </section>`;
}

function chart(pts) {
  if (pts.length < 2) return `<p class="lead">Haz este ejercicio 2 días y verás la línea.</p>`;
  const W = 320, H = 130, pad = 8;
  const ys = pts.map(p => p.score), lo = Math.min(...ys), hi = Math.max(...ys), span = hi - lo || 1;
  const xy = pts.map((p, i) => [pad + (i / (pts.length - 1)) * (W - pad * 2), H - pad - ((p.score - lo) / span) * (H - pad * 2)]);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="De ${kg(Math.round(ys[0]))} a ${kg(Math.round(ys[ys.length - 1]))}">
    <polyline points="${xy.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ')}"/>
    ${xy.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3"/>`).join('')}
  </svg><p class="meta">De ${kg(Math.round(ys[0]))} a ${kg(Math.round(ys[ys.length - 1]))} en ${pts.length} entrenos.</p>`;
}

function viewAjustes() {
  const s = S.settings;
  return `<h1>Ajustes</h1>
    <section class="card">
      <label class="field">Peso de la barra, en kg<input inputmode="decimal" data-bind="setting" data-f="bar" value="${kg(s.bar)}"></label>
      <label class="field">Discos que tienes, en kg<input data-bind="setting" data-f="plates" value="${s.plates.map(kg).join(' ')}"></label>
      <label class="field">Descanso para ejercicios nuevos, en segundos<input inputmode="numeric" data-bind="setting" data-f="rest" value="${s.rest}"></label>
      <label class="check-row"><input type="checkbox" data-bind="setting" data-f="sound" ${s.sound ? 'checked' : ''}> Pitido al acabar el descanso</label>
    </section>
    <section class="card"><h2>Tus datos</h2>
      <p class="meta">Los datos viven solo en este móvil. Guarda una copia de vez en cuando.</p>
      <button class="btn" data-act="export">Guardar copia</button>
      <label class="btn">Cargar copia<input type="file" accept="application/json,.json" data-bind="import" hidden></label>
      <button class="btn danger" data-act="wipe">Borrar todo</button>
    </section>`;
}

// ---------- Ventanas ----------
function viewModal() {
  const m = ui.modal;
  if (m.type === 'summary') {
    const st = sessionStats(m.entry);
    return `<h2>Entreno guardado</h2>
      <p class="lead">${mins(m.entry.end - m.entry.start)} min, ${st.sets} series, ${st.vol.toLocaleString('es-ES')} kg movidos.</p>
      ${m.records.length ? `<h3>Marcas nuevas</h3><ul class="list">${m.records.map(r => `<li>${esc(exById(r.ex).name)}: ${r.w ? kg(r.w) + ' kg × ' : ''}${r.r}</li>`).join('')}</ul>` : ''}
      <button class="btn main" data-act="close">Cerrar</button>`;
  }
  if (m.type === 'exMenu') {
    const it = S.active.items[m.i], ex = exById(it.ex);
    return `<h2>${esc(ex.name)}</h2>
      <button class="btn" data-act="warmup" data-i="${m.i}">Añadir calentamiento</button>
      ${ex.equip === 'Barra' ? `<button class="btn" data-act="plates" data-i="${m.i}">Qué discos pongo</button>` : ''}
      <button class="btn" data-act="pick" data-for="swap" data-i="${m.i}" data-muscle="${esc(ex.muscle)}">Cambiar por otro ejercicio</button>
      <label class="field">Nota<textarea data-bind="note" data-i="${m.i}" rows="2">${esc(it.note)}</textarea></label>
      <label class="field">Descanso, en segundos<input inputmode="numeric" data-bind="itemRest" data-i="${m.i}" value="${it.rest}"></label>
      <button class="btn danger" data-act="delEx" data-i="${m.i}">Quitar del entreno</button>
      <button class="btn main" data-act="close">Hecho</button>`;
  }
  if (m.type === 'plates') {
    return `<h2>Qué discos pongo</h2>
      <label class="field">Peso total, en kg<input inputmode="decimal" data-bind="plateW" value="${esc(m.w)}"></label>
      <div id="plateOut">${plateOut(m.w)}</div>
      <button class="btn main" data-act="close">Cerrar</button>`;
  }
  if (m.type === 'pick') {
    return `<h2>${m.for === 'swap' ? 'Cambiar ejercicio' : 'Añadir ejercicio'}</h2>
      <input type="search" placeholder="Buscar" aria-label="Buscar ejercicio" data-bind="pickQ" value="${esc(m.q)}">
      <div class="chips">${['Todos', ...MUSCLES].map(x => `<button data-act="pickMuscle" data-m="${x}" aria-pressed="${(m.muscle || 'Todos') === x}">${x}</button>`).join('')}</div>
      <div id="pickList">${pickList()}</div>
      <button class="btn" data-act="newEx">Crear ejercicio nuevo</button>
      <button class="btn" data-act="close">Cancelar</button>`;
  }
  if (m.type === 'newEx') {
    return `<h2>Ejercicio nuevo</h2>
      <label class="field">Nombre<input id="nxName"></label>
      <label class="field">Músculo<select id="nxMuscle">${MUSCLES.map(x => `<option>${x}</option>`).join('')}</select></label>
      <label class="field">Material<select id="nxEquip">${['Barra', 'Mancuernas', 'Máquina', 'Polea', 'Peso corporal'].map(x => `<option>${x}</option>`).join('')}</select></label>
      <label class="field">Salto de peso, en kg<input id="nxInc" inputmode="decimal" value="2,5"></label>
      <button class="btn main" data-act="saveEx">Guardar ejercicio</button>
      <button class="btn" data-act="close">Cancelar</button>`;
  }
  if (m.type === 'templates') {
    return `<h2>Cambiar de programa</h2><p class="lead">Tu historial se queda. Solo cambia el plan.</p>
      ${TEMPLATES.map((t, i) => `<button class="card pick" data-act="useTemplate" data-i="${i}"><strong>${esc(t.name)}</strong><span>${esc(t.about)}</span></button>`).join('')}
      <button class="card pick" data-act="emptyProgram"><strong>Empezar de cero</strong><span>Creas tú los días y los ejercicios.</span></button>
      <button class="btn" data-act="close">Cancelar</button>`;
  }
  if (m.type === 'days') {
    return `<h2>¿Qué día haces hoy?</h2>
      ${S.program.days.map((d, i) => `<button class="card pick" data-act="start" data-i="${i}"><strong>${esc(d.name)}</strong><span>${d.items.length} ejercicios</span></button>`).join('')}
      <button class="btn" data-act="close">Cancelar</button>`;
  }
  return '';
}

function pickList() {
  const m = ui.modal, q = (m.q || '').toLowerCase();
  const list = allEx().filter(e => (!m.muscle || m.muscle === 'Todos' || e.muscle === m.muscle) && e.name.toLowerCase().includes(q));
  return list.map(e => `<button class="opt" data-act="choose" data-ex="${esc(e.id)}"><strong>${esc(e.name)}</strong><span>${e.muscle}, ${e.equip}</span></button>`).join('')
    || '<p class="lead">No hay ninguno con ese nombre. Puedes crearlo abajo.</p>';
}

function plateOut(raw) {
  const w = num(raw), bar = S.settings.bar;
  if (w == null) return '<p class="lead">Escribe el peso total.</p>';
  if (w < bar) return `<p class="lead">Es menos que la barra sola (${kg(bar)} kg).</p>`;
  let side = (w - bar) / 2; const out = [];
  S.settings.plates.slice().sort((a, b) => b - a).forEach(p => { while (side >= p - 1e-9) { out.push(p); side -= p; } });
  return `<p class="meta">En cada lado de la barra:</p>
    <div class="plates">${out.map(p => `<span class="plate p${String(p).replace('.', '_')}">${kg(p)}</span>`).join('') || '<span class="meta">Nada. Solo la barra.</span>'}</div>
    ${side > 0.01 ? `<p class="lead">No sale exacto. Sobran ${kg(side * 2)} kg.</p>` : ''}`;
}

// ---------- Acciones ----------
const closeModal = () => { ui.modal = null; };
const actions = {
  tab(d) { ui.tab = d.tab; closeModal(); window.scrollTo(0, 0); },
  close: closeModal,
  useTemplate(d) {
    const t = clone(TEMPLATES[d.i]);
    S.program = { name: t.name, days: t.days.map(x => ({ id: uid(), ...x })) }; S.nextDay = 0; closeModal(); ui.tab = 'hoy';
  },
  emptyProgram() { S.program = { name: 'Mi programa', days: [{ id: uid(), name: 'Día 1', items: [] }] }; S.nextDay = 0; closeModal(); ui.tab = 'programa'; },
  changeProgram() { ui.modal = { type: 'templates' }; },
  start(d) { closeModal(); unlockAudio(); startWorkout(+d.i); },
  startFree() { unlockAudio(); startWorkout(null); },
  skipDay() { ui.modal = { type: 'days' }; },
  finish() { finishWorkout(); },
  discard() { if (confirm('¿Tirar este entreno? No se guarda nada.')) { S.active = null; stopRest(); } },
  check(d) { unlockAudio(); completeSet(+d.i, +d.s); },
  setType(d) {
    const set = S.active.items[d.i].sets[d.s], order = ['n', 'w', 'd', 'f'];
    set.type = order[(order.indexOf(set.type) + 1) % order.length];
    retarget(S.active.items[d.i]); toast(TYPE_NAME[set.type]);
  },
  addSet(d) { const it = S.active.items[d.i]; it.sets.push(newSet()); retarget(it); },
  delSet(d) { S.active.items[d.i].sets.pop(); },
  exMenu(d) { ui.modal = { type: 'exMenu', i: +d.i }; },
  delEx(d) { S.active.items.splice(+d.i, 1); closeModal(); },
  warmup(d) {
    const it = S.active.items[d.i], first = it.sets.find(isWork);
    const top = first && (num(first.w) ?? first.tw);
    if (!top) { closeModal(); return toast('Primero escribe el peso de la primera serie.'); }
    const step = exById(it.ex).inc || 2.5;
    const warm = [[0.5, 8], [0.7, 5], [0.85, 2]].map(([f, r]) => ({ ...newSet('w'), tw: roundTo(top * f, step), tr: r }));
    it.sets = warm.concat(it.sets.filter(isWork)); closeModal();
  },
  plates(d) { const it = S.active.items[d.i], f = it.sets.find(isWork); ui.modal = { type: 'plates', w: f ? (f.w || kg(f.tw)) : '' }; },
  pick(d) { ui.modal = { type: 'pick', for: d.for, d: d.d, i: d.i, muscle: d.muscle || 'Todos', q: '' }; },
  pickMuscle(d) { ui.modal.muscle = d.m; },
  newEx() { ui.modal = { type: 'newEx', back: ui.modal }; },
  saveEx() {
    const name = document.getElementById('nxName').value.trim();
    if (!name) return toast('Escribe un nombre.');
    const equip = document.getElementById('nxEquip').value;
    const ex = { id: 'c-' + uid(), name, muscle: document.getElementById('nxMuscle').value, sec: [], equip, inc: equip === 'Peso corporal' ? 0 : (num(document.getElementById('nxInc').value) ?? 2.5) };
    S.custom.push(ex); const back = ui.modal.back; ui.modal = back; choose(ex.id);
  },
  choose(d) { choose(d.ex); },
  addDay() { S.program.days.push({ id: uid(), name: 'Día ' + (S.program.days.length + 1), items: [] }); },
  delDay(d) { if (confirm('¿Borrar este día del programa?')) { S.program.days.splice(+d.d, 1); S.nextDay = 0; } },
  delItem(d) { S.program.days[d.d].items.splice(+d.i, 1); },
  moveItem(d) {
    const arr = S.program.days[d.d].items, i = +d.i, j = i + +d.dir;
    if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]];
  },
  openHist(d) { ui.openHist = ui.openHist === d.id ? null : d.id; },
  delHist(d) { if (confirm('¿Borrar este entreno? No se puede deshacer.')) S.history = S.history.filter(h => h.id !== d.id); },
  export() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }));
    a.download = `hierro-copia-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000); toast('Copia guardada.');
  },
  wipe() { if (confirm('¿Borrar TODO? Se pierden el programa y el historial.')) { S = freshState(); ui.tab = 'hoy'; } },
};

function choose(exId) {
  const m = ui.modal;
  const base = { ex: exId, sets: 3, lo: 8, hi: 12, rir: 2, rest: S.settings.rest };
  if (m.for === 'day') S.program.days[m.d].items.push(base);
  else if (m.for === 'session') S.active.items.push(newItem(base));
  else if (m.for === 'swap') { const it = S.active.items[m.i]; it.ex = exId; it.sets.forEach(s => { if (!s.done) { s.w = ''; s.r = ''; } }); retarget(it); }
  closeModal();
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) { if (e.target.id === 'modal') { closeModal(); render(); } return; }
  const fn = actions[el.dataset.act];
  if (!fn) return;
  fn(el.dataset, el); save(); render();
});

document.getElementById('restAdd').addEventListener('click', () => { if (S.restEnd) { S.restEnd += 30000; S.restTotal += 30; save(); tickRest(); } });
document.getElementById('restSkip').addEventListener('click', () => { stopRest(); save(); tickRest(); });

// Campos de texto: guardan sin redibujar, para no perder el cursor.
const binds = {
  set(el, d) { S.active.items[d.i].sets[d.s][d.f] = el.value; },
  note(el, d) { S.active.items[d.i].note = el.value; },
  itemRest(el, d) { const n = num(el.value); if (n != null) S.active.items[d.i].rest = Math.max(0, Math.round(n)); },
  progName(el) { S.program.name = el.value; },
  dayName(el, d) { S.program.days[d.d].name = el.value; },
  pitem(el, d) {
    const n = num(el.value); if (n == null || n < 0) return;
    const it = S.program.days[d.d].items[d.i]; it[d.f] = Math.round(n);
    if (d.f === 'sets') it.sets = Math.min(12, Math.max(1, it.sets));
    if (it.hi < it.lo) it.hi = it.lo;
  },
  setting(el, d) {
    const s = S.settings;
    if (d.f === 'sound') s.sound = el.checked;
    else if (d.f === 'plates') { const p = el.value.split(/[\s;]+/).map(num).filter(n => n > 0); if (p.length) s.plates = p; }
    else { const n = num(el.value); if (n != null && n >= 0) s[d.f] = n; }
  },
  plateW(el) { ui.modal.w = el.value; document.getElementById('plateOut').innerHTML = plateOut(el.value); },
  pickQ(el) { ui.modal.q = el.value; document.getElementById('pickList').innerHTML = pickList(); },
  progEx(el) { ui.progEx = el.value; render(); },
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
  const b = el.dataset.bind;
  const live = ['set', 'note', 'plateW', 'pickQ', 'progName', 'dayName'];
  if ((e.type === 'input') !== live.includes(b)) return;
  binds[b](el, el.dataset); save();
}
document.addEventListener('input', onField);
document.addEventListener('change', onField);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
render(); wake();
