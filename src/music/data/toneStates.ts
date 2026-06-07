import toneStates from './toneStates.json';

export type ToneState = {
  name: string;
  bpm?: number;
  scale?: string;
  instrument?: string;
  timeSignature?: number;
  melodyVolume?: number;
  chordVolume?: number;
  drumsEnabled?: boolean;
  drumFillEnabled?: boolean;
  drumVolume?: number;
  rainEnabled?: boolean;
  thunderEnabled?: boolean;
  thunderVolume?: number;
  thunderDistance?: number;
  thunderCharacter?: number;
  activeTab?: 'melody' | 'rhythm' | 'ambience';
};

export type ResolvedToneState = ToneState & {
  bpm: number;
  timeSignature: number;
  melodyVolume: number;
  chordVolume: number;
  drumsEnabled: boolean;
  drumFillEnabled: boolean;
  drumVolume: number;
  rainEnabled: boolean;
  thunderEnabled: boolean;
  thunderVolume: number;
  thunderDistance: number;
  thunderCharacter: number;
};

const DEFAULT_TONE_STATE_VALUES = {
  bpm: 0,
  timeSignature: 0,
  melodyVolume: 0,
  chordVolume: 0,
  drumsEnabled: false,
  drumFillEnabled: false,
  drumVolume: 0,
  rainEnabled: false,
  thunderEnabled: false,
  thunderVolume: 0,
  thunderDistance: 0,
  thunderCharacter: 0
} satisfies Omit<ResolvedToneState, 'name' | 'scale' | 'instrument' | 'activeTab'>;

export const TONE_STATES = toneStates as Record<string, ToneState>;

export function resolveToneState(toneState: ToneState): ResolvedToneState {
  return { ...DEFAULT_TONE_STATE_VALUES, ...toneState };
}
