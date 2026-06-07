export type Chord = {
  name: string;
  root: string;
  tones: string[];
};

export type MusicPreset = {
  name: string;
  scale: string[];
  stableNotes: string[];
  specialNotes?: string[];
  startChord: string;
  chords: Record<string, Chord>;
  graph: Record<string, Record<string, number>>;
};

export const FREQ: Record<string, number> = {
  G2: 98.0,
  A2: 110.0,
  B2: 123.47,
  C3: 130.81,
  D3: 146.83,
  E3: 164.81,
  F3: 174.61,
  G3: 196.0,
  A3: 220.0,
  B3: 246.94,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  B4: 493.88,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  F5: 698.46,
  G5: 783.99,
  A5: 880.0
};

export function getFrequency(note: string): number {
  if (note in FREQ) return FREQ[note];
  if (note.length === 3 && note[1] === '#') {
    const baseNote = note[0] + note[2];
    if (baseNote in FREQ) return FREQ[baseNote] * Math.pow(2, 1 / 12);
  }
  if (note.length === 3 && note[1] === 'b') {
    const baseNote = note[0] + note[2];
    if (baseNote in FREQ) return FREQ[baseNote] / Math.pow(2, 1 / 12);
  }
  return 440.0;
}

export const PRESETS: Record<string, MusicPreset> = {
  c_major: {
    name: 'C Major (Dynamic Pop)',
    scale: ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'],
    stableNotes: ['C', 'G'],
    startChord: 'I',
    chords: {
      I: { name: 'Cmaj7', root: 'C4', tones: ['C', 'E', 'G', 'B'] },
      ii: { name: 'Dm7', root: 'D4', tones: ['D', 'F', 'A', 'C'] },
      iii: { name: 'Em7', root: 'E3', tones: ['E', 'G', 'B', 'D'] },
      IV: { name: 'Fmaj7', root: 'F3', tones: ['F', 'A', 'C', 'E'] },
      V: { name: 'G7', root: 'G3', tones: ['G', 'B', 'D', 'F'] },
      vi: { name: 'Am7', root: 'A3', tones: ['A', 'C', 'E', 'G'] }
    },
    graph: {
      I: { IV: 3, V: 2, vi: 2, ii: 1 },
      ii: { V: 4, vi: 1 },
      iii: { vi: 3, IV: 1 },
      IV: { V: 3, I: 2, ii: 1 },
      V: { I: 4, vi: 2, iii: 1 },
      vi: { ii: 2, IV: 2, iii: 1, V: 1 }
    }
  },
  a_minor: {
    name: 'A Minor (Emotional)',
    scale: ['A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4'],
    stableNotes: ['A', 'E'],
    startChord: 'i',
    chords: {
      i: { name: 'Am9', root: 'A2', tones: ['A', 'C', 'E', 'G', 'B'] },
      III: { name: 'Cmaj7', root: 'C3', tones: ['C', 'E', 'G', 'B'] },
      iv: { name: 'Dm7', root: 'D3', tones: ['D', 'F', 'A', 'C'] },
      v: { name: 'Em7', root: 'E3', tones: ['E', 'G', 'B', 'D'] },
      VI: { name: 'Fmaj7', root: 'F3', tones: ['F', 'A', 'C', 'E'] },
      VII: { name: 'G7', root: 'G2', tones: ['G', 'B', 'D', 'F'] }
    },
    graph: {
      i: { VI: 3, iv: 2, VII: 1, III: 1 },
      III: { VI: 2, VII: 2 },
      iv: { v: 3, VII: 1, i: 1 },
      v: { i: 4, VI: 1 },
      VI: { VII: 2, iv: 2, i: 1 },
      VII: { III: 3, i: 2 }
    }
  },
  '5_scale': {
    name: 'Pentatonic Scale (Versatile)',
    scale: ['C3', 'D3', 'E3', 'G3', 'A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5'],
    stableNotes: ['C', 'G'],
    startChord: 'I',
    chords: {
      I: { name: 'Cmaj7', root: 'C4', tones: ['C', 'E', 'G', 'B'] },
      ii: { name: 'Dm7', root: 'D3', tones: ['D', 'F', 'A', 'C'] },
      iii: { name: 'Em7', root: 'E3', tones: ['E', 'G', 'B', 'D'] },
      IV: { name: 'Fmaj7', root: 'F3', tones: ['F', 'A', 'C', 'E'] },
      V: { name: 'G7', root: 'G3', tones: ['G', 'B', 'D', 'F'] },
      vi: { name: 'Am7', root: 'A3', tones: ['A', 'C', 'E', 'G'] }
    },
    graph: {
      I: { IV: 3, V: 2, vi: 2, ii: 1 },
      ii: { V: 4, vi: 1 },
      iii: { vi: 3, IV: 1 },
      IV: { V: 3, I: 2, ii: 1 },
      V: { I: 4, vi: 2, iii: 1 },
      vi: { ii: 2, IV: 2, iii: 1, V: 1 }
    }
  },
  c_major_high: {
    name: 'C Major High (Bright)',
    scale: ['B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5'],
    stableNotes: ['C', 'G'],
    startChord: 'I',
    chords: {
      I: { name: 'Cmaj7', root: 'C4', tones: ['C', 'E', 'G', 'B'] },
      ii: { name: 'Dm7', root: 'D4', tones: ['D', 'F', 'A', 'C'] },
      iii: { name: 'Em7', root: 'E4', tones: ['E', 'G', 'B', 'D'] },
      IV: { name: 'Fmaj7', root: 'F4', tones: ['F', 'A', 'C', 'E'] },
      V: { name: 'G7', root: 'G4', tones: ['G', 'B', 'D', 'F'] },
      vi: { name: 'Am7', root: 'A4', tones: ['A', 'C', 'E', 'G'] }
    },
    graph: {
      I: { IV: 3, V: 2, vi: 2, ii: 1 },
      ii: { V: 4, vi: 1 },
      iii: { vi: 3, IV: 1 },
      IV: { V: 3, I: 2, ii: 1 },
      V: { I: 4, vi: 2, iii: 1 },
      vi: { ii: 2, IV: 2, iii: 1, V: 1 }
    }
  },
  a_minor_blues: {
    name: 'Minor Blues (Soulful)',
    scale: ['A2', 'C3', 'D3', 'D#3', 'E3', 'G3', 'A3', 'C4', 'D4', 'D#4', 'E4', 'G4', 'A4'],
    stableNotes: ['A', 'E'],
    specialNotes: ['D#'],
    startChord: 'i',
    chords: {
      i: { name: 'Am7', root: 'A2', tones: ['A', 'C', 'E', 'G'] },
      IV: { name: 'D7', root: 'D3', tones: ['D', 'F#', 'A', 'C'] },
      V: { name: 'E7', root: 'E3', tones: ['E', 'G#', 'B', 'D'] }
    },
    graph: {
      i: { IV: 4, V: 2 },
      IV: { i: 4, V: 2 },
      V: { i: 5, IV: 1 }
    }
  },
  c_dorian: {
    name: 'C Dorian (Moody)',
    scale: ['C3', 'D3', 'Eb3', 'F3', 'G3', 'A3', 'Bb3', 'C4', 'D4', 'Eb4', 'F4', 'G4', 'A4'],
    stableNotes: ['C', 'G'],
    specialNotes: ['Eb', 'Bb'],
    startChord: 'i',
    chords: {
      i: { name: 'Cm7', root: 'C3', tones: ['C', 'Eb', 'G', 'Bb'] },
      ii: { name: 'Dm7', root: 'D3', tones: ['D', 'F', 'A', 'C'] },
      III: { name: 'Ebmaj7', root: 'Eb3', tones: ['Eb', 'G', 'Bb', 'D'] },
      IV: { name: 'F7', root: 'F3', tones: ['F', 'A', 'C', 'Eb'] },
      v: { name: 'Gm7', root: 'G3', tones: ['G', 'Bb', 'D', 'F'] },
      vi: { name: 'Am7b5', root: 'A3', tones: ['A', 'C', 'Eb', 'G'] },
      VII: { name: 'Bbmaj7', root: 'Bb3', tones: ['Bb', 'D', 'F', 'A'] }
    },
    graph: {
      i: { IV: 3, v: 2, ii: 1 },
      ii: { v: 4, vi: 1 },
      III: { vi: 2, VII: 2 },
      IV: { v: 3, i: 2, ii: 1 },
      v: { i: 4, vi: 1 },
      vi: { VII: 2, IV: 2, i: 1 },
      VII: { III: 3, i: 2 }
    }
  }
};

export const AUTO_DRUM_FILL_INTERVAL_BARS = 8;
