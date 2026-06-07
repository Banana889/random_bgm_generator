import { describe, expect, it } from 'vitest';
import { PRESETS, getFrequency } from '../data/presets';
import { pickDrumFill, pickDrumPattern } from '../data/drums';
import { generateNewMotif, getNextChordKey, getNoteWeight, pickGoHomeNote } from './nextNote';

describe('music data', () => {
  it('resolves natural and accidental note frequencies', () => {
    expect(getFrequency('A4')).toBeCloseTo(440);
    expect(getFrequency('C#4')).toBeGreaterThan(getFrequency('C4'));
    expect(getFrequency('Bb3')).toBeLessThan(getFrequency('B3'));
  });

  it('keeps preset start chords valid', () => {
    for (const preset of Object.values(PRESETS)) {
      expect(preset.chords[preset.startChord]).toBeDefined();
      expect(preset.graph[preset.startChord]).toBeDefined();
    }
  });
});

describe('next note generation', () => {
  it('prefers chord tones and stepwise motion', () => {
    const chord = PRESETS.c_major.chords.I;
    expect(getNoteWeight('C4', 7, chord, 7)).toBeGreaterThan(getNoteWeight('D4', 8, chord, 7));
    expect(getNoteWeight('E4', 9, chord, 8)).toBeGreaterThan(getNoteWeight('A5', 14, chord, 1));
  });

  it('chooses valid go-home notes', () => {
    const preset = PRESETS.c_major;
    const selection = pickGoHomeNote(preset, preset.chords.I, 7, () => 0.9);
    expect(preset.scale).toContain(selection.note);
    expect(selection.index).toBeGreaterThanOrEqual(0);
  });

  it('walks chord graph with weighted random input', () => {
    expect(getNextChordKey('I', PRESETS.c_major.graph, () => 0)).toBe('IV');
    expect(Object.keys(PRESETS.c_major.graph.I)).toContain(getNextChordKey('I', PRESETS.c_major.graph, () => 0.99));
  });

  it('fills a rhythmic motif to one bar', () => {
    const motif = generateNewMotif(4, () => 0.99);
    expect(motif.reduce((sum, duration) => sum + duration, 0)).toBe(4);
  });
});

describe('drum patterns', () => {
  it('selects patterns for supported and fallback meters', () => {
    expect(Object.keys(pickDrumPattern(4, () => 0))).toContain('0');
    expect(Object.keys(pickDrumPattern(5, () => 0))).toContain('0');
    expect(Object.keys(pickDrumFill(6, () => 0))).toContain('0');
  });
});
