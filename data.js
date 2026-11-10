// Datos fijos: músculos, ejercicios y programas de ejemplo.

export const MUSCLES = [
  'Pecho', 'Espalda', 'Hombro', 'Bíceps', 'Tríceps',
  'Cuádriceps', 'Isquios', 'Glúteo', 'Gemelo', 'Abdomen',
];

// [id, nombre, músculo principal, músculos secundarios, material, salto de peso en kg]
const RAW = [
  ['press-banca', 'Press de banca', 'Pecho', ['Tríceps', 'Hombro'], 'Barra', 2.5],
  ['press-inclinado', 'Press inclinado con barra', 'Pecho', ['Hombro', 'Tríceps'], 'Barra', 2.5],
  ['press-banca-manc', 'Press de banca con mancuernas', 'Pecho', ['Tríceps', 'Hombro'], 'Mancuernas', 2],
  ['press-inclinado-manc', 'Press inclinado con mancuernas', 'Pecho', ['Hombro', 'Tríceps'], 'Mancuernas', 2],
  ['press-pecho-maq', 'Press de pecho en máquina', 'Pecho', ['Tríceps', 'Hombro'], 'Máquina', 5],
  ['aperturas-polea', 'Aperturas en polea', 'Pecho', [], 'Polea', 2.5],
  ['pec-deck', 'Aperturas en máquina', 'Pecho', [], 'Máquina', 5],
  ['fondos', 'Fondos en paralelas', 'Pecho', ['Tríceps', 'Hombro'], 'Peso corporal', 2.5],
  ['flexiones', 'Flexiones', 'Pecho', ['Tríceps', 'Hombro'], 'Peso corporal', 0],

  ['dominadas', 'Dominadas', 'Espalda', ['Bíceps'], 'Peso corporal', 2.5],
  ['jalon', 'Jalón al pecho', 'Espalda', ['Bíceps'], 'Polea', 5],
  ['jalon-neutro', 'Jalón con agarre neutro', 'Espalda', ['Bíceps'], 'Polea', 5],
  ['remo-barra', 'Remo con barra', 'Espalda', ['Bíceps', 'Isquios'], 'Barra', 2.5],
  ['remo-manc', 'Remo con mancuerna', 'Espalda', ['Bíceps'], 'Mancuernas', 2],
  ['remo-polea', 'Remo sentado en polea', 'Espalda', ['Bíceps'], 'Polea', 5],
  ['remo-maq', 'Remo en máquina', 'Espalda', ['Bíceps'], 'Máquina', 5],
  ['remo-t', 'Remo en T', 'Espalda', ['Bíceps'], 'Barra', 2.5],
  ['pullover-polea', 'Pullover en polea', 'Espalda', [], 'Polea', 2.5],

  ['press-militar', 'Press militar', 'Hombro', ['Tríceps'], 'Barra', 2.5],
  ['press-hombro-manc', 'Press de hombro con mancuernas', 'Hombro', ['Tríceps'], 'Mancuernas', 2],
  ['press-hombro-maq', 'Press de hombro en máquina', 'Hombro', ['Tríceps'], 'Máquina', 5],
  ['laterales', 'Elevaciones laterales', 'Hombro', [], 'Mancuernas', 1],
  ['laterales-polea', 'Elevaciones laterales en polea', 'Hombro', [], 'Polea', 2.5],
  ['pajaros', 'Pájaros', 'Hombro', ['Espalda'], 'Mancuernas', 1],
  ['pajaros-maq', 'Deltoide posterior en máquina', 'Hombro', ['Espalda'], 'Máquina', 5],
  ['face-pull', 'Face pull', 'Hombro', ['Espalda'], 'Polea', 2.5],

  ['curl-barra', 'Curl con barra', 'Bíceps', [], 'Barra', 2.5],
  ['curl-manc', 'Curl con mancuernas', 'Bíceps', [], 'Mancuernas', 1],
  ['curl-martillo', 'Curl martillo', 'Bíceps', [], 'Mancuernas', 1],
  ['curl-predicador', 'Curl predicador', 'Bíceps', [], 'Máquina', 2.5],
  ['curl-polea', 'Curl en polea', 'Bíceps', [], 'Polea', 2.5],
  ['curl-inclinado', 'Curl inclinado con mancuernas', 'Bíceps', [], 'Mancuernas', 1],

  ['triceps-polea', 'Extensión de tríceps en polea', 'Tríceps', [], 'Polea', 2.5],
  ['triceps-cabeza', 'Extensión sobre la cabeza en polea', 'Tríceps', [], 'Polea', 2.5],
  ['press-frances', 'Press francés', 'Tríceps', [], 'Barra', 2.5],
  ['press-cerrado', 'Press de banca agarre cerrado', 'Tríceps', ['Pecho', 'Hombro'], 'Barra', 2.5],
  ['fondos-banco', 'Fondos en banco', 'Tríceps', ['Pecho'], 'Peso corporal', 0],

  ['sentadilla', 'Sentadilla', 'Cuádriceps', ['Glúteo'], 'Barra', 2.5],
  ['sentadilla-frontal', 'Sentadilla frontal', 'Cuádriceps', ['Glúteo'], 'Barra', 2.5],
  ['prensa', 'Prensa de piernas', 'Cuádriceps', ['Glúteo'], 'Máquina', 10],
  ['hack', 'Sentadilla hack', 'Cuádriceps', ['Glúteo'], 'Máquina', 5],
  ['extension-cuad', 'Extensión de cuádriceps', 'Cuádriceps', [], 'Máquina', 5],
  ['bulgara', 'Sentadilla búlgara', 'Cuádriceps', ['Glúteo'], 'Mancuernas', 2],
  ['zancadas', 'Zancadas', 'Cuádriceps', ['Glúteo'], 'Mancuernas', 2],

  ['peso-muerto', 'Peso muerto', 'Isquios', ['Glúteo', 'Espalda'], 'Barra', 5],
  ['rumano', 'Peso muerto rumano', 'Isquios', ['Glúteo'], 'Barra', 2.5],
  ['femoral-tumbado', 'Curl femoral tumbado', 'Isquios', [], 'Máquina', 5],
  ['femoral-sentado', 'Curl femoral sentado', 'Isquios', [], 'Máquina', 5],
  ['buenos-dias', 'Buenos días', 'Isquios', ['Glúteo'], 'Barra', 2.5],

  ['hip-thrust', 'Hip thrust', 'Glúteo', ['Isquios'], 'Barra', 5],
  ['patada-polea', 'Patada de glúteo en polea', 'Glúteo', [], 'Polea', 2.5],
  ['abduccion', 'Abducción en máquina', 'Glúteo', [], 'Máquina', 5],

  ['gemelo-pie', 'Elevación de gemelo de pie', 'Gemelo', [], 'Máquina', 5],
  ['gemelo-sentado', 'Elevación de gemelo sentado', 'Gemelo', [], 'Máquina', 5],
  ['gemelo-prensa', 'Gemelo en prensa', 'Gemelo', [], 'Máquina', 10],

  ['crunch-polea', 'Crunch en polea', 'Abdomen', [], 'Polea', 2.5],
  ['elevacion-piernas', 'Elevación de piernas colgado', 'Abdomen', [], 'Peso corporal', 0],
  ['rueda', 'Rueda abdominal', 'Abdomen', [], 'Peso corporal', 0],
  ['crunch-maq', 'Crunch en máquina', 'Abdomen', [], 'Máquina', 5],
];

export const EXERCISES = RAW.map(([id, name, muscle, sec, equip, inc]) => ({ id, name, muscle, sec, equip, inc }));

// Atajo para escribir los programas: [ejercicio, series, reps mín, reps máx, reps en reserva, descanso en s]
const it = (ex, sets, lo, hi, rir, rest) => ({ ex, sets, lo, hi, rir, rest });

export const TEMPLATES = [
  {
    name: 'Cuerpo entero',
    about: '3 días. Todo el cuerpo cada día.',
    days: [
      { name: 'Día A', items: [it('sentadilla', 3, 6, 10, 2, 180), it('press-banca', 3, 6, 10, 2, 180), it('remo-polea', 3, 8, 12, 2, 120), it('laterales', 3, 12, 20, 1, 75), it('femoral-sentado', 2, 10, 15, 1, 90), it('triceps-polea', 2, 10, 15, 1, 75)] },
      { name: 'Día B', items: [it('rumano', 3, 8, 12, 2, 180), it('press-hombro-manc', 3, 8, 12, 2, 120), it('jalon', 3, 8, 12, 2, 120), it('prensa', 3, 10, 15, 2, 150), it('curl-manc', 2, 10, 15, 1, 75), it('gemelo-pie', 3, 10, 15, 1, 75)] },
      { name: 'Día C', items: [it('hack', 3, 8, 12, 2, 150), it('press-inclinado-manc', 3, 8, 12, 2, 120), it('remo-manc', 3, 8, 12, 2, 120), it('hip-thrust', 3, 8, 12, 2, 150), it('pajaros', 2, 12, 20, 1, 75), it('crunch-polea', 3, 10, 15, 1, 75)] },
    ],
  },
  {
    name: 'Torso y pierna',
    about: '4 días. Dos de torso y dos de pierna.',
    days: [
      { name: 'Torso 1', items: [it('press-banca', 3, 6, 10, 2, 180), it('remo-barra', 3, 6, 10, 2, 150), it('press-hombro-manc', 3, 8, 12, 2, 120), it('jalon', 3, 8, 12, 2, 120), it('triceps-polea', 3, 10, 15, 1, 75), it('curl-manc', 3, 10, 15, 1, 75)] },
      { name: 'Pierna 1', items: [it('sentadilla', 3, 6, 10, 2, 180), it('rumano', 3, 8, 12, 2, 150), it('extension-cuad', 3, 10, 15, 1, 90), it('femoral-sentado', 3, 10, 15, 1, 90), it('gemelo-pie', 3, 10, 15, 1, 75), it('crunch-polea', 3, 10, 15, 1, 75)] },
      { name: 'Torso 2', items: [it('press-inclinado-manc', 3, 8, 12, 2, 150), it('remo-polea', 3, 8, 12, 2, 120), it('pec-deck', 3, 10, 15, 1, 90), it('laterales', 4, 12, 20, 1, 75), it('triceps-cabeza', 3, 10, 15, 1, 75), it('curl-martillo', 3, 10, 15, 1, 75)] },
      { name: 'Pierna 2', items: [it('prensa', 3, 10, 15, 2, 150), it('hip-thrust', 3, 8, 12, 2, 150), it('bulgara', 2, 8, 12, 2, 120), it('femoral-tumbado', 3, 10, 15, 1, 90), it('gemelo-sentado', 3, 10, 15, 1, 75), it('elevacion-piernas', 3, 8, 15, 1, 75)] },
    ],
  },
  {
    name: 'Empuje, tirón y pierna',
    about: '3 días que se repiten. Sirve para 3 o 6 días por semana.',
    days: [
      { name: 'Empuje', items: [it('press-banca', 3, 6, 10, 2, 180), it('press-hombro-manc', 3, 8, 12, 2, 120), it('press-inclinado-manc', 3, 8, 12, 2, 120), it('laterales', 4, 12, 20, 1, 75), it('triceps-polea', 3, 10, 15, 1, 75), it('triceps-cabeza', 2, 10, 15, 1, 75)] },
      { name: 'Tirón', items: [it('dominadas', 3, 5, 10, 2, 150), it('remo-barra', 3, 6, 10, 2, 150), it('remo-polea', 3, 8, 12, 2, 120), it('face-pull', 3, 12, 20, 1, 75), it('curl-barra', 3, 8, 12, 1, 90), it('curl-martillo', 2, 10, 15, 1, 75)] },
      { name: 'Pierna', items: [it('sentadilla', 3, 6, 10, 2, 180), it('rumano', 3, 8, 12, 2, 150), it('prensa', 3, 10, 15, 2, 150), it('femoral-sentado', 3, 10, 15, 1, 90), it('gemelo-pie', 4, 10, 15, 1, 75), it('crunch-polea', 3, 10, 15, 1, 75)] },
    ],
  },
];
