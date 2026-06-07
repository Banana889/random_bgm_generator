import type { Chord, MusicPreset } from '../data/presets';

export type NoteSelection = {
  note: string;
  index: number;
  weight: number;
};

export function getNoteWeight(noteName: string, noteIndex: number, chord: Chord | null, lastPlayedIndex: number): number {
  let weight = 10;
  const pitchClass = noteName.slice(0, -1);

  if (chord?.tones.includes(pitchClass)) weight += 50;

  const distance = Math.abs(noteIndex - lastPlayedIndex);
  if (distance === 0) weight += 10;
  if (distance === 1) weight += 40;
  if (distance === 2) weight += 20;
  if (distance > 4) weight -= 20;
  if (distance > 7) weight -= 50;
  if (noteIndex < 3 || noteIndex > 12) weight -= 10;

  return Math.max(0, weight);
}

export function pickRandomNote(
  preset: MusicPreset,
  currentChord: Chord | null,
  lastPlayedIndex: number,
  random = Math.random
): NoteSelection {
  let weightSum = 0;
  const candidates = preset.scale.map((note, index) => {
    const weight = getNoteWeight(note, index, currentChord, lastPlayedIndex);
    weightSum += weight;
    return { note, index, weight };
  });

  let r = random() * weightSum;
  for (const item of candidates) {
    r -= item.weight;
    if (r <= 0) return item;
  }

  return candidates[Math.floor(candidates.length / 2)];
}

export function pickGoHomeNote(
  preset: MusicPreset,
  currentChord: Chord | null,
  lastPlayedIndex: number,
  random = Math.random
): NoteSelection {
  if (random() < 0.3) return pickRandomNote(preset, currentChord, lastPlayedIndex, random);

  const stableIndices: number[] = [];
  preset.scale.forEach((note, index) => {
    const pitchClass = note.slice(0, -1);
    const degree = index % 7;
    if (degree === 0 || degree === 4 || preset.stableNotes.includes(pitchClass)) stableIndices.push(index);
  });

  if (currentChord) {
    const rootPitchClass = currentChord.root.slice(0, -1);
    preset.scale.forEach((note, index) => {
      if (note.startsWith(rootPitchClass) && !stableIndices.includes(index)) stableIndices.push(index);
    });
  }

  preset.specialNotes?.forEach((special) => {
    preset.scale.forEach((note, index) => {
      if (note.startsWith(special) && !stableIndices.includes(index)) stableIndices.push(index);
    });
  });

  let bestCandidate: number | null = null;
  let minDistance = Infinity;
  stableIndices.sort(() => random() - 0.5);

  for (const index of stableIndices) {
    const dist = Math.abs(index - lastPlayedIndex);
    if (dist < minDistance) {
      if (dist === 0 && minDistance !== Infinity) continue;
      minDistance = dist;
      bestCandidate = index;
    }
  }

  if (bestCandidate === null) return pickRandomNote(preset, currentChord, lastPlayedIndex, random);

  return { note: preset.scale[bestCandidate], index: bestCandidate, weight: 100 };
}

export function getNextChordKey(currentKey: string, graph: Record<string, Record<string, number>>, random = Math.random): string {
  const transitions = graph[currentKey];
  if (!transitions) return currentKey;

  const keys = Object.keys(transitions);
  const sum = keys.reduce((total, key) => total + transitions[key], 0);
  let r = random() * sum;
  for (const key of keys) {
    r -= transitions[key];
    if (r <= 0) return key;
  }
  return keys[0];
}

export function generateNewMotif(beatsPerBar: number, random = Math.random): number[] {
  const pattern: number[] = [];
  let remaining = beatsPerBar;
  const possibleDurations = [0.5, 0.5, 1.0, 1.0, 2.0];

  while (remaining > 0) {
    let duration = possibleDurations[Math.floor(random() * possibleDurations.length)];
    if (duration > remaining) duration = remaining;
    pattern.push(duration);
    remaining -= duration;
  }

  return pattern;
}
