export type InstrumentPreset = {
  name: string;
  pad: Record<string, unknown> & { volume: number };
  lead: (Record<string, unknown> & { volume: number; type?: string; harmonics?: { ratio: number; amp: number }[]; tremolo?: { depth: number; bpmRatio: number } });
};

export const INSTRUMENT_PRESETS: Record<string, InstrumentPreset> = {
  origin: {
    name: 'Origin Instrument (Default)',
    pad: {
      oscillator: { type: 'sine', count: 3, spread: 30 },
      envelope: { attack: 0.5, decay: 0.5, sustain: 0.8, release: 2 },
      volume: -10
    },
    lead: {
      oscillator: { type: 'sine', modulationType: 'square' },
      envelope: { attack: 0.01, decay: 0.01, sustain: 1, release: 0.5 },
      modulation: { type: 'square' },
      modulationEnvelope: { attack: 0.1, decay: 0, sustain: 1, release: 0.5 },
      volume: -5,
      tremolo: { depth: 0.5, bpmRatio: 0.5 }
    }
  },
  soft_dream: {
    name: 'Soft Dream (C Major High, and higher BPM recommended)',
    pad: {
      oscillator: { type: 'sine', count: 10, spread: 30 },
      envelope: { attack: 1.0, decay: 3.0, sustain: 0.5, release: 2.0 },
      volume: -10
    },
    lead: {
      oscillator: { type: 'fmsine', modulationType: 'sine', modulationIndex: 2, harmonicity: 3.0 },
      envelope: { attack: 0.05, decay: 0.4, sustain: 0.5, release: 3.0 },
      modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.2 },
      volume: -12
    }
  },
  flute: {
    name: 'Flute',
    pad: {
      oscillator: { type: 'fattriangle', count: 3, spread: 20 },
      envelope: { attack: 2.0, decay: 3.0, sustain: 0.5, release: 2.0 },
      volume: -10
    },
    lead: {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.05, decay: 0.2, sustain: 0.2, release: 1.5 },
      volume: -5
    }
  },
  cinematic: {
    name: 'Cinematic Strings',
    pad: {
      oscillator: { type: 'fatsawtooth', count: 3, spread: 40 },
      envelope: { attack: 1.5, decay: 4.0, sustain: 0.7, release: 3.0 },
      volume: -6
    },
    lead: {
      oscillator: { type: 'fmsine', modulationType: 'sine', modulationIndex: 3, harmonicity: 3 },
      envelope: { attack: 0.01, decay: 0.5, sustain: 0.1, release: 2.0 },
      volume: -8
    }
  },
  electric_piano: {
    name: 'Electric Piano',
    pad: {
      oscillator: { type: 'fmsine', modulationIndex: 10, harmonicity: 1 },
      envelope: { attack: 0.1, decay: 1.5, sustain: 0.2, release: 1.0 },
      volume: -10
    },
    lead: {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.5 },
      volume: -2
    }
  },
  wind_bell: {
    name: 'Wind Bell',
    pad: {
      oscillator: { type: 'fmsine', modulationIndex: 10, harmonicity: 1 },
      envelope: { attack: 1, decay: 1.5, sustain: 0.2, release: 1.0 },
      volume: -5
    },
    lead: {
      type: 'customAdditive',
      harmonics: [
        { ratio: 1.0, amp: 1.0 },
        { ratio: 10.2, amp: 0.1 },
        { ratio: 13.14, amp: 0.03 }
      ],
      volume: -10,
      envelope: { attack: 0.01, decay: 0.5, sustain: 0.5, release: 0.5 }
    }
  }
};
