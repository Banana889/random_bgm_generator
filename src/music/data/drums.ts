export type DrumType = 'kick' | 'snare' | 'hihat' | 'hihat-heavy' | 'tom-low' | 'tom-mid' | 'tom-high' | 'crash';
export type DrumPattern = Record<number, DrumType[]>;

export const DRUM_PATTERN_POOL: Record<string, DrumPattern[]> = {
  '3': [
    { 0: ['kick', 'hihat'], 2: ['snare', 'hihat'], 4: ['snare', 'hihat'] },
    { 0: ['kick', 'hihat'], 1: ['hihat'], 2: ['snare'], 3: ['hihat'], 4: ['snare'], 5: ['hihat'] },
    { 0: ['kick'], 1: ['hihat'], 2: ['snare', 'hihat'], 4: ['kick', 'snare'], 5: ['hihat'] }
  ],
  '6': [
    { 0: ['kick', 'hihat'], 2: ['hihat'], 4: ['hihat'], 6: ['snare', 'hihat'], 8: ['hihat'], 10: ['hihat'] },
    { 0: ['kick', 'hihat'], 2: ['hihat'], 4: ['kick', 'hihat'], 6: ['snare', 'hihat'], 8: ['hihat'], 10: ['hihat'] },
    { 0: ['kick'], 2: ['hihat'], 4: ['kick', 'hihat'], 6: ['snare', 'hihat'], 8: ['hihat'], 10: ['snare', 'hihat'] }
  ],
  default: [
    { 0: ['kick', 'hihat'], 1: ['hihat'], 2: ['snare', 'hihat'], 3: ['hihat'], 4: ['kick', 'hihat'], 5: ['hihat'], 6: ['snare', 'hihat'], 7: ['hihat'] },
    { 0: ['kick', 'hihat'], 1: ['hihat'], 2: ['kick', 'snare', 'hihat'], 3: ['hihat'], 4: ['kick', 'hihat'], 5: ['hihat'], 6: ['kick', 'snare', 'hihat'], 7: ['hihat'] },
    { 0: ['kick', 'hihat'], 1: ['hihat'], 2: ['snare', 'hihat'], 3: ['kick', 'hihat'], 4: ['hihat'], 5: ['snare', 'hihat'], 6: ['snare'], 7: ['kick', 'hihat'] },
    { 0: ['kick', 'hihat'], 1: ['hihat'], 2: ['hihat'], 3: ['kick', 'hihat'], 4: ['snare', 'hihat'], 5: ['hihat'], 6: ['kick', 'hihat'], 7: ['hihat'] }
  ]
};

export const DRUM_FILL_POOL: Record<string, DrumPattern[]> = {
  '3': [
    { 0: ['snare'], 2: ['snare'], 3: ['tom-high'], 4: ['tom-mid'], 5: ['tom-low'] },
    { 0: ['snare'], 1: ['snare'], 2: ['tom-high'], 3: ['tom-mid'], 4: ['tom-low'], 5: ['tom-low'] },
    { 0: ['tom-high'], 2: ['snare'], 3: ['tom-high'], 4: ['snare'], 5: ['tom-low'] }
  ],
  '6': [
    { 0: ['snare'], 2: ['snare'], 4: ['tom-high'], 6: ['tom-mid'], 8: ['tom-low'], 10: ['snare'] },
    { 0: ['tom-high'], 2: ['snare'], 4: ['tom-mid'], 6: ['tom-high'], 8: ['tom-mid'], 10: ['tom-low'] },
    { 0: ['snare'], 2: ['tom-high'], 4: ['kick'], 6: ['snare'], 8: ['tom-mid'], 10: ['kick', 'tom-low'] }
  ],
  default: [
    { 0: ['snare'], 1: ['snare'], 2: ['snare'], 3: ['snare'], 4: ['tom-high'], 5: ['tom-high'], 6: ['tom-low'], 7: ['tom-low'] },
    { 0: ['kick', 'snare', 'tom-low'], 1: ['snare', 'tom-low'], 2: ['kick', 'snare', 'tom-low'], 3: ['snare', 'tom-low'], 4: ['kick', 'snare', 'tom-low'], 5: ['snare', 'tom-low'], 6: ['kick', 'snare', 'tom-low'], 7: ['snare', 'tom-low'] },
    { 0: ['snare'], 1: ['tom-high'], 2: ['tom-low'], 3: ['kick'], 4: ['snare'], 5: ['tom-high'], 6: ['tom-low'], 7: ['kick'] },
    { 0: ['tom-high'], 1: ['snare'], 2: ['tom-low'], 3: ['snare'], 4: ['tom-high'], 5: ['snare'], 6: ['tom-low'], 7: ['snare'] }
  ]
};

export function pickDrumPattern(beatsPerBar: number, random = Math.random): DrumPattern {
  const patterns = DRUM_PATTERN_POOL[String(beatsPerBar)] || DRUM_PATTERN_POOL.default;
  return patterns[Math.floor(random() * patterns.length)];
}

export function pickDrumFill(beatsPerBar: number, random = Math.random): DrumPattern {
  const fills = DRUM_FILL_POOL[String(beatsPerBar)] || DRUM_FILL_POOL.default;
  return fills[Math.floor(random() * fills.length)];
}
