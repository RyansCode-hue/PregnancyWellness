import { LaborItem } from '../types';

// Use the in-app Edit form on each item to attach your own image.
// `stages` is which phases of labor each item is most useful in.
// Empty/undefined means "show in every stage."
export const LABOR_SEED: LaborItem[] = [
  // ─── Positions ───
  {
    id: 'seed-position-lunges-with-ball',
    category: 'position',
    name: 'Lunges with ball',
    caption: 'Asymmetric lunge using a birth ball for support — opens the pelvis and helps baby rotate.',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'seed-position-childs-pose',
    category: 'position',
    name: "Child's pose",
    caption: 'Kneeling forward fold with arms extended. Restful, takes pressure off the lower back.',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'seed-position-forward-leans-inversions',
    category: 'position',
    name: 'Forward leans / inversions',
    caption: 'Lean forward over a ball, couch, or counter. Helpful for fetal positioning early in labor.',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'seed-position-hands-and-knees',
    category: 'position',
    name: 'Hands and knees',
    caption: 'All-fours position. Eases back labor and gives gravity-neutral relief between contractions.',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'seed-position-squats',
    category: 'position',
    name: 'Squats',
    caption: 'Deep supported squat. Opens the pelvic outlet — useful in late first stage and pushing.',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'seed-position-toilet',
    category: 'position',
    name: 'Sitting on / straddling the toilet',
    caption: 'Sitting (or facing backward) on the toilet relaxes the pelvic floor — sometimes called the "dilation station."',
    createdAt: '2026-01-01T00:00:00.000Z',
  },

  // ─── Comfort Methods ───
  {
    id: 'seed-comfort-birth-comb',
    category: 'comfort',
    name: 'Birth comb',
    caption: 'Hold a hair comb in the palm during contractions — pressure on the hand activates a counter-pain pathway.',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'seed-comfort-essential-oils',
    category: 'comfort',
    name: 'Essential oils',
    caption: 'Lavender, peppermint, or clary sage on a cloth or diffuser — calming and grounding.',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'seed-comfort-counter-pressure',
    category: 'comfort',
    name: 'Counter pressure',
    caption: 'Firm pressure on the lower back or hips during contractions — especially helpful for back labor.',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'seed-comfort-sock-massager',
    category: 'comfort',
    name: 'Sock massager',
    caption: 'Tennis balls in a sock — roll along the lower back for self-applied pressure relief.',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'seed-comfort-homeopathy',
    category: 'comfort',
    name: 'Homeopathy',
    caption: 'Remedies like Caulophyllum or Arnica — discuss with your provider beforehand.',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'seed-comfort-heat',
    category: 'comfort',
    name: 'Heat',
    caption: 'Warm rice sock, heating pad, or warm shower/bath — eases muscle tension.',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'seed-comfort-tens',
    category: 'comfort',
    name: 'TENS',
    caption: 'Transcutaneous electrical nerve stimulation — small pads on the lower back deliver mild electrical pulses for pain relief.',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];
