// Reads a program spreadsheet (.xlsx) on the phone, with no server and no library.
// An .xlsx file is a zip with XML inside. We open the zip, read the one sheet, and turn its rows into a program.

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Returns { 'path/in/zip': Uint8Array } for the files we ask for.
async function unzip(buf, wanted) {
  const b = new Uint8Array(buf);
  let end = -1;
  for (let i = b.length - 22; i >= 0 && i > b.length - 70000; i--) if (u32(b, i) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new Error('not-xlsx');
  const count = u16(b, end + 10); let p = u32(b, end + 16); const out = {};
  for (let n = 0; n < count; n++) {
    if (u32(b, p) !== 0x02014b50) break;
    const method = u16(b, p + 10), csize = u32(b, p + 20), nameLen = u16(b, p + 28), extraLen = u16(b, p + 30), commentLen = u16(b, p + 32), local = u32(b, p + 42);
    const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nameLen));
    if (wanted(name)) {
      const start = local + 30 + u16(b, local + 26) + u16(b, local + 28), data = b.subarray(start, start + csize);
      out[name] = method === 0 ? data : await inflate(data);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

// Rows of the first sheet, each one as { A: 'text', B: 'text', ... }.
export async function readXlsx(buf) {
  const files = await unzip(buf, n => n === 'xl/sharedStrings.xml' || /^xl\/worksheets\/[^/]+\.xml$/.test(n));
  const xml = bytes => new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'application/xml');
  const all = (node, tag) => [...node.getElementsByTagNameNS('*', tag)];
  const strings = files['xl/sharedStrings.xml'] ? all(xml(files['xl/sharedStrings.xml']), 'si').map(si => all(si, 't').map(t => t.textContent).join('')) : [];
  const sheetName = Object.keys(files).filter(n => n.startsWith('xl/worksheets/')).sort()[0];
  if (!sheetName) throw new Error('no-sheet');
  return all(xml(files[sheetName]), 'row').map(row => {
    const cells = {};
    all(row, 'c').forEach(c => {
      const col = (c.getAttribute('r') || '').replace(/\d+/g, ''), v = all(c, 'v')[0], inline = all(c, 't')[0];
      const val = v ? (c.getAttribute('t') === 's' ? strings[+v.textContent] : v.textContent) : (inline ? inline.textContent : null);
      if (col && val != null && String(val).trim() !== '') cells[col] = String(val).trim();
    });
    return cells;
  });
}

const COLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').concat('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c => 'A' + c));
const TYPES = [[/warm/i, 'w'], [/fail/i, 'f'], [/drop/i, 'd'], [/myo/i, 'm']];
export const TYPE_NAMES = { n: 'Standard Set', w: 'Warm Up', f: 'Failure Set', d: 'Drop Set', m: 'Myo Set' };

// Layout of the sheet: a "Program: name" row, then one row per exercise.
// Column A names the workout on its first exercise; a lone "Rest" in column A is a rest day.
// From column D on, every 4 columns are one set: type, rep range, RIR, rest in seconds.
export function parseProgram(rows) {
  let name = 'Imported Program'; const days = []; let cur = null;
  rows.forEach(r => {
    const a = r.A || '', b = r.B || '';
    if (/^program\s*:/i.test(a)) { name = a.replace(/^program\s*:\s*/i, '').trim() || name; return; }
    if (b.toLowerCase() === 'exercise') return;                       // header row
    if (a && !b) { if (/^rest\b/i.test(a)) { days.push({ name: 'Rest Day', rest: true, items: [] }); cur = null; } return; }   // "Block 1" and similar are skipped
    if (!b) return;
    if (a) { cur = { name: a.replace(/\s*@.*$/, '').trim(), items: [] }; days.push(cur); }
    if (!cur) { cur = { name: 'Workout ' + (days.length + 1), items: [] }; days.push(cur); }
    const sets = [];
    for (let k = 3; k + 3 < COLS.length; k += 4) {
      const type = r[COLS[k]], range = r[COLS[k + 1]], rir = r[COLS[k + 2]], rest = r[COLS[k + 3]];
      if (type == null && range == null && rir == null) { if (k > 3) break; continue; }
      const m = range ? String(range).match(/(\d+)\s*(?:-|–|to)?\s*(\d+)?/) : null;
      sets.push({ type: (TYPES.find(([re]) => re.test(type || '')) || [0, 'n'])[1], lo: m ? +m[1] : null, hi: m ? +(m[2] || m[1]) : null, rir: rir != null && rir !== '' && !isNaN(+rir) ? +rir : null, rest: rest != null && !isNaN(+rest) ? +rest : null });
    }
    if (sets.length) cur.items.push({ name: b, note: r.C || '', sets });
  });
  const work = days.filter(d => !d.rest);
  return { name, days, stats: { workouts: work.length, rests: days.length - work.length, sets: work.reduce((n, d) => n + d.items.reduce((x, it) => x + it.sets.length, 0), 0), exercises: new Set(work.flatMap(d => d.items.map(it => norm(it.name)))).size } };
}

export const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const titleCase = s => String(s).replace(/(^|[\s\-/(])([a-z])/g, (m, p, c) => p + c.toUpperCase());

// First rule that matches wins, so the specific ones go first.
const MUSCLE_RULES = [
  [/calf|calves/, 'Calves'], [/tibial/, 'Tibs'],
  [/hamstring|leg curl|romanian|\brdl\b|good morning|stiff.leg|ham raise|nordic/, 'Hamstrings'],
  [/adduct/, 'Adductors'], [/abduct/, 'Abductors'],
  [/hip thrust|glute|kickback/, 'Glutes'],
  [/squat|leg press|leg extension|lunge|step.up/, 'Quads'],
  [/deadlift/, 'Hamstrings'],
  [/crunch|leg raise|ab wheel|dragon flag|plank|sit.up/, 'Abs'], [/oblique|woodchop|side bend/, 'Obliques'],
  [/lateral raise|y.raise|upright row/, 'Side Delts'], [/reverse fly|rear delt|face pull|reverse pec/, 'Rear Delts'],
  [/overhead press|shoulder press|military|front raise/, 'Front Delts'], [/shrug/, 'Upper Traps'],
  [/tricep|pushdown|skull|\bdips?\b|close.grip bench/, 'Triceps'],
  [/wrist|forearm/, 'Forearms'], [/curl/, 'Biceps'],
  [/pull.?up|chin.?up|pulldown|pullover/, 'Lats'], [/\brow\b/, 'Upper Back'], [/back extension|hyperextension/, 'Lower Back'],
  [/press|fly|push.?up|chest|pec/, 'Chest'], [/neck/, 'Neck'],
];
const SECONDARY = { Chest: ['Triceps', 'Front Delts'], Lats: ['Biceps', 'Upper Back'], 'Upper Back': ['Lats', 'Biceps'], 'Front Delts': ['Triceps', 'Side Delts'], Quads: ['Glutes'], Hamstrings: ['Glutes'], Glutes: ['Hamstrings'] };
const ISOLATION = /fly|curl|extension|raise|pushdown|kickback|crunch|shrug|pullover|adduct|abduct/;
const EQUIP_RULES = [[/barbell|t.bar|ez.bar|trap bar/, 'Barbell'], [/dumbbell|kettlebell/, 'Dumbbell'], [/cable|pulley|pulldown|pushdown/, 'Cable'], [/machine|pin.loaded|plate.loaded|smith|leg press|hack|pec deck/, 'Machine'], [/pull.?up|chin.?up|\bdips?\b|push.?up|dragon flag|plank|ab wheel|bodyweight|hanging/, 'Bodyweight']];
const STEP = { Barbell: 2.5, Dumbbell: 2, Machine: 5, Cable: 2.5, Bodyweight: 0 };

// Best guess of muscle and equipment for an exercise we do not know, from its name (and the note, when the name says little).
export function guessExercise(name, note = '') {
  const n = norm(name), both = n + ' ' + norm(note);
  const muscle = (MUSCLE_RULES.find(([re]) => re.test(n)) || MUSCLE_RULES.find(([re]) => re.test(both)) || [0, 'Chest'])[1];
  const equip = (EQUIP_RULES.find(([re]) => re.test(n)) || EQUIP_RULES.find(([re]) => re.test(both)) || [0, 'Machine'])[1];
  return { muscle, sec: ISOLATION.test(n) ? [] : (SECONDARY[muscle] || []), equip, inc: STEP[equip] };
}

// ---------- Exercise database (the user's own sheet) ----------
// Columns: name, video link, (count), category, phase, -, -, equipment, then up to four pairs of muscle + percent.
const MUSCLE_ES = { pectoral: 'Chest', 'dorsal ancho': 'Lats', 'espalda alta': 'Upper Back', 'espalda baja': 'Lower Back', trapecio: 'Upper Traps', 'deltoides anterior': 'Front Delts', 'deltoides lateral': 'Side Delts', 'deltoides posterior': 'Rear Delts', biceps: 'Biceps', triceps: 'Triceps', abdomen: 'Abs', oblicuos: 'Obliques', cuadriceps: 'Quads', isquiosurales: 'Hamstrings', gluteo: 'Glutes', aductores: 'Adductors', abductores: 'Abductors', gemelo: 'Calves', antebrazo: 'Forearms', cardio: 'Cardio' };
const plain = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const EQUIP_ES = [[/^(barra|bara|con barra|landmine|sa[tf]e[ft]y bar)/, 'Barbell'], [/mancuerna|kettlebell|garrafa|disco|balon|saco/, 'Dumbbell'], [/maquina|multipower|ghd|trineo|airbike|bicicleta|eliptica|cinta/, 'Machine'], [/polea/, 'Cable']];

// rows: arrays of cell text (pasted table) or { A, B, ... } objects (from an .xlsx file).
export function parseExerciseTable(rows) {
  const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const arr = rows.map(r => (Array.isArray(r) ? r : L.split('').map(c => r[c] || '')));
  const out = [], seen = new Set(); let skipped = 0;
  arr.forEach(r => {
    const name = String(r[0] || '').trim();
    if (!name || /^nombre a buscar$/i.test(name)) return;
    const key = norm(plain(name)); if (!key || seen.has(key)) { skipped++; return; }
    const w = {}; const order = [];
    for (let k = 8; k <= 14; k += 2) {
      const m = MUSCLE_ES[plain(r[k])]; if (!m) continue;
      const pct = parseFloat(String(r[k + 1] || '').replace(',', '.')) || 0;
      if (!(m in w)) { w[m] = pct / 100; order.push(m); }
    }
    const main = order.find(m => m !== 'Cardio') || order[0] || 'Other';
    const mat = String(r[7] || '').trim(), pm = plain(mat);
    const equip = (EQUIP_ES.find(([re]) => re.test(pm)) || [0, 'Bodyweight'])[1];
    const url = String(r[1] || '').trim();
    seen.add(key);
    out.push({ id: 'u-' + key.replace(/ /g, '-').slice(0, 70), name, muscle: main, sec: order.filter(m => m !== main && m !== 'Cardio'), w, equip, mat, inc: STEP[equip], url: /^https?:\/\//.test(url) ? url : '', cat: String(r[3] || '').trim() });
  });
  return { list: out, skipped };
}
export const parseTsv = text => String(text).split(/\r?\n/).map(l => l.split('\t'));
