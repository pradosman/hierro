// Fixed data: muscles, exercises and starter programs. Exercise ids stay stable so old history keeps working.

export const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Abs'];

// [id, name, main muscle, helper muscles, equipment, weight step in kg]
const RAW = [
  ['press-banca', 'Barbell Bench Press', 'Chest', ['Triceps', 'Shoulders'], 'Barbell', 2.5],
  ['press-inclinado', 'Incline Barbell Press', 'Chest', ['Shoulders', 'Triceps'], 'Barbell', 2.5],
  ['press-banca-manc', 'Dumbbell Bench Press', 'Chest', ['Triceps', 'Shoulders'], 'Dumbbell', 2],
  ['press-inclinado-manc', 'Incline Dumbbell Press', 'Chest', ['Shoulders', 'Triceps'], 'Dumbbell', 2],
  ['press-pecho-maq', 'Machine Chest Press', 'Chest', ['Triceps', 'Shoulders'], 'Machine', 5],
  ['aperturas-polea', 'Cable Fly', 'Chest', [], 'Cable', 2.5],
  ['pec-deck', 'Machine Fly', 'Chest', [], 'Machine', 5],
  ['fondos', 'Dip', 'Chest', ['Triceps', 'Shoulders'], 'Bodyweight', 2.5],
  ['flexiones', 'Push-Up', 'Chest', ['Triceps', 'Shoulders'], 'Bodyweight', 0],

  ['dominadas', 'Pull-Up', 'Back', ['Biceps'], 'Bodyweight', 2.5],
  ['jalon', 'Cable Lat Pulldown', 'Back', ['Biceps'], 'Cable', 5],
  ['jalon-neutro', 'Neutral Grip Lat Pulldown', 'Back', ['Biceps'], 'Cable', 5],
  ['remo-barra', 'Barbell Row', 'Back', ['Biceps', 'Hamstrings'], 'Barbell', 2.5],
  ['remo-manc', 'Dumbbell Row', 'Back', ['Biceps'], 'Dumbbell', 2],
  ['remo-polea', 'Seated Cable Row', 'Back', ['Biceps'], 'Cable', 5],
  ['remo-maq', 'Machine Row', 'Back', ['Biceps'], 'Machine', 5],
  ['remo-t', 'T-Bar Row', 'Back', ['Biceps'], 'Barbell', 2.5],
  ['pullover-polea', 'Cable Pullover', 'Back', [], 'Cable', 2.5],

  ['press-militar', 'Barbell Overhead Press', 'Shoulders', ['Triceps'], 'Barbell', 2.5],
  ['press-hombro-manc', 'Dumbbell Shoulder Press', 'Shoulders', ['Triceps'], 'Dumbbell', 2],
  ['press-hombro-maq', 'Machine Shoulder Press', 'Shoulders', ['Triceps'], 'Machine', 5],
  ['laterales', 'Dumbbell Lateral Raise', 'Shoulders', [], 'Dumbbell', 1],
  ['laterales-polea', 'Cable Lateral Raise', 'Shoulders', [], 'Cable', 2.5],
  ['pajaros', 'Dumbbell Reverse Fly', 'Shoulders', ['Back'], 'Dumbbell', 1],
  ['pajaros-maq', 'Machine Reverse Fly', 'Shoulders', ['Back'], 'Machine', 5],
  ['face-pull', 'Cable Face Pull', 'Shoulders', ['Back'], 'Cable', 2.5],

  ['curl-barra', 'Barbell Curl', 'Biceps', [], 'Barbell', 2.5],
  ['curl-manc', 'Dumbbell Curl', 'Biceps', [], 'Dumbbell', 1],
  ['curl-martillo', 'Hammer Curl', 'Biceps', [], 'Dumbbell', 1],
  ['curl-predicador', 'Preacher Curl', 'Biceps', [], 'Machine', 2.5],
  ['curl-polea', 'Cable Curl', 'Biceps', [], 'Cable', 2.5],
  ['curl-inclinado', 'Incline Dumbbell Curl', 'Biceps', [], 'Dumbbell', 1],

  ['triceps-polea', 'Cable Triceps Pushdown', 'Triceps', [], 'Cable', 2.5],
  ['triceps-cabeza', 'Overhead Cable Triceps Extension', 'Triceps', [], 'Cable', 2.5],
  ['press-frances', 'Skull Crusher', 'Triceps', [], 'Barbell', 2.5],
  ['press-cerrado', 'Close Grip Bench Press', 'Triceps', ['Chest', 'Shoulders'], 'Barbell', 2.5],
  ['fondos-banco', 'Bench Dip', 'Triceps', ['Chest'], 'Bodyweight', 0],

  ['sentadilla', 'Barbell Back Squat', 'Quads', ['Glutes'], 'Barbell', 2.5],
  ['sentadilla-frontal', 'Front Squat', 'Quads', ['Glutes'], 'Barbell', 2.5],
  ['prensa', 'Leg Press', 'Quads', ['Glutes'], 'Machine', 10],
  ['hack', 'Hack Squat', 'Quads', ['Glutes'], 'Machine', 5],
  ['extension-cuad', 'Leg Extension', 'Quads', [], 'Machine', 5],
  ['bulgara', 'Bulgarian Split Squat', 'Quads', ['Glutes'], 'Dumbbell', 2],
  ['zancadas', 'Dumbbell Lunge', 'Quads', ['Glutes'], 'Dumbbell', 2],

  ['peso-muerto', 'Conventional Deadlift', 'Hamstrings', ['Glutes', 'Back'], 'Barbell', 5],
  ['rumano', 'Barbell Romanian Deadlift', 'Hamstrings', ['Glutes'], 'Barbell', 2.5],
  ['femoral-tumbado', 'Lying Hamstring Curl', 'Hamstrings', [], 'Machine', 5],
  ['femoral-sentado', 'Seated Hamstring Curl', 'Hamstrings', [], 'Machine', 5],
  ['buenos-dias', 'Good Morning', 'Hamstrings', ['Glutes'], 'Barbell', 2.5],

  ['hip-thrust', 'Barbell Hip Thrust', 'Glutes', ['Hamstrings'], 'Barbell', 5],
  ['patada-polea', 'Cable Glute Kickback', 'Glutes', [], 'Cable', 2.5],
  ['abduccion', 'Machine Hip Abduction', 'Glutes', [], 'Machine', 5],

  ['gemelo-pie', 'Standing Calf Raise', 'Calves', [], 'Machine', 5],
  ['gemelo-sentado', 'Seated Calf Raise', 'Calves', [], 'Machine', 5],
  ['gemelo-prensa', 'Leg Press Calf Raise', 'Calves', [], 'Machine', 10],

  ['crunch-polea', 'Cable Crunch', 'Abs', [], 'Cable', 2.5],
  ['elevacion-piernas', 'Hanging Leg Raise', 'Abs', [], 'Bodyweight', 0],
  ['rueda', 'Ab Wheel Rollout', 'Abs', [], 'Bodyweight', 0],
  ['crunch-maq', 'Machine Crunch', 'Abs', [], 'Machine', 5],
];

export const EXERCISES = RAW.map(([id, name, muscle, sec, equip, inc]) => ({ id, name, muscle, sec, equip, inc }));

// Shortcut: [exercise, sets, min reps, max reps, reps in reserve, rest in s]
const it = (ex, sets, lo, hi, rir, rest) => ({ ex, sets, lo, hi, rir, rest });

export const TEMPLATES = [
  {
    name: 'Full Body 3x',
    days: [
      { name: 'Full Body A', items: [it('sentadilla', 3, 6, 10, 2, 180), it('press-banca', 3, 6, 10, 2, 180), it('remo-polea', 3, 8, 12, 2, 120), it('laterales', 3, 12, 20, 1, 75), it('femoral-sentado', 2, 10, 15, 1, 90), it('triceps-polea', 2, 10, 15, 1, 75)] },
      { name: 'Full Body B', items: [it('rumano', 3, 8, 12, 2, 180), it('press-hombro-manc', 3, 8, 12, 2, 120), it('jalon', 3, 8, 12, 2, 120), it('prensa', 3, 10, 15, 2, 150), it('curl-manc', 2, 10, 15, 1, 75), it('gemelo-pie', 3, 10, 15, 1, 75)] },
      { name: 'Full Body C', items: [it('hack', 3, 8, 12, 2, 150), it('press-inclinado-manc', 3, 8, 12, 2, 120), it('remo-manc', 3, 8, 12, 2, 120), it('hip-thrust', 3, 8, 12, 2, 150), it('pajaros', 2, 12, 20, 1, 75), it('crunch-polea', 3, 10, 15, 1, 75)] },
    ],
  },
  {
    name: 'Upper Lower 4x',
    days: [
      { name: 'Upper 1', items: [it('press-banca', 3, 6, 10, 2, 180), it('remo-barra', 3, 6, 10, 2, 150), it('press-hombro-manc', 3, 8, 12, 2, 120), it('jalon', 3, 8, 12, 2, 120), it('triceps-polea', 3, 10, 15, 1, 75), it('curl-manc', 3, 10, 15, 1, 75)] },
      { name: 'Lower 1', items: [it('sentadilla', 3, 6, 10, 2, 180), it('rumano', 3, 8, 12, 2, 150), it('extension-cuad', 3, 10, 15, 1, 90), it('femoral-sentado', 3, 10, 15, 1, 90), it('gemelo-pie', 3, 10, 15, 1, 75), it('crunch-polea', 3, 10, 15, 1, 75)] },
      { name: 'Upper 2', items: [it('press-inclinado-manc', 3, 8, 12, 2, 150), it('remo-polea', 3, 8, 12, 2, 120), it('pec-deck', 3, 10, 15, 1, 90), it('laterales', 4, 12, 20, 1, 75), it('triceps-cabeza', 3, 10, 15, 1, 75), it('curl-martillo', 3, 10, 15, 1, 75)] },
      { name: 'Lower 2', items: [it('prensa', 3, 10, 15, 2, 150), it('hip-thrust', 3, 8, 12, 2, 150), it('bulgara', 2, 8, 12, 2, 120), it('femoral-tumbado', 3, 10, 15, 1, 90), it('gemelo-sentado', 3, 10, 15, 1, 75), it('elevacion-piernas', 3, 8, 15, 1, 75)] },
    ],
  },
  {
    name: 'Push Pull Legs',
    days: [
      { name: 'Push', items: [it('press-banca', 3, 6, 10, 2, 180), it('press-hombro-manc', 3, 8, 12, 2, 120), it('press-inclinado-manc', 3, 8, 12, 2, 120), it('laterales', 4, 12, 20, 1, 75), it('triceps-polea', 3, 10, 15, 1, 75), it('triceps-cabeza', 2, 10, 15, 1, 75)] },
      { name: 'Pull', items: [it('dominadas', 3, 5, 10, 2, 150), it('remo-barra', 3, 6, 10, 2, 150), it('remo-polea', 3, 8, 12, 2, 120), it('face-pull', 3, 12, 20, 1, 75), it('curl-barra', 3, 8, 12, 1, 90), it('curl-martillo', 2, 10, 15, 1, 75)] },
      { name: 'Legs', items: [it('sentadilla', 3, 6, 10, 2, 180), it('rumano', 3, 8, 12, 2, 150), it('prensa', 3, 10, 15, 2, 150), it('femoral-sentado', 3, 10, 15, 1, 90), it('gemelo-pie', 4, 10, 15, 1, 75), it('crunch-polea', 3, 10, 15, 1, 75)] },
    ],
  },
];
