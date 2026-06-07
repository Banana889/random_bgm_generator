import type { Chord } from '../music/data/presets';
import type { DrumPattern, DrumType } from '../music/data/drums';

export type TabKey = 'melody' | 'rhythm' | 'ambience';
export type PhraseState = 'PLAYING' | 'RESTING';

export type MelodyTrailEvent = {
  id: number;
  note: string;
  pitchY: number;
  size: number;
  flowDuration: number;
  flowDelay: number;
};

export type DrumTrailEvent = {
  id: number;
  type: DrumType;
  x: number;
  y: number;
  size: number;
  isFill: boolean;
  flowDuration: number;
  flowDelay: number;
};

export type LogEvent = {
  note: string;
  durationInBeats: number;
  chordName: string;
};

export type AppState = {
  bpm: number;
  beatsPerBar: number;
  currentPresetKey: string;
  currentInstrumentKey: string;
  currentChordKey: string | null;
  playingChord: Chord | null;
  lastPlayedNoteIndex: number;
  isPlaying: boolean;
  isDrumsEnabled: boolean;
  currentBeat: number;
  melodyTrail: MelodyTrailEvent[];
  drumTrail: DrumTrailEvent[];
  drumPattern: DrumPattern;
  drumPatternBarsRemaining: number;
  isDrumFillEnabled: boolean;
  drumFillQueued: boolean;
  drumFillActive: boolean;
  drumFillPattern: DrumPattern;
  drumFillBarsUntilAuto: number;
  phraseState: PhraseState;
  phraseBeatsRemaining: number;
  currentMotif: number[];
  motifIndex: number;
  rainEnabled: boolean;
  thunderEnabled: boolean;
  thunderVolume: number;
  thunderDistance: number;
  thunderCharacter: number;
  drumVolume: number;
  melodyVolume: number;
  chordVolume: number;
  logEvents: LogEvent[];
  chordDisplay: string;
  chordDetail: string;
  noteDisplay: string;
  activeTab: TabKey;
  toneStateKey: string;
};
