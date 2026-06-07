import * as Tone from 'tone';
import { INSTRUMENT_PRESETS } from '../music/data/instruments';
import type { InstrumentPreset } from '../music/data/instruments';
import type { Chord } from '../music/data/presets';

export type PadStyle = 'block' | 'strum' | 'arpeggio';

type RatioSynth = Tone.PolySynth<Tone.Synth> & { _ratio?: number };

export class ToneAudioBackend {
  private reverb: Tone.Reverb;
  private padFilter: Tone.AutoFilter;
  private padTremolo: Tone.Tremolo;
  private padVolumeNode: Tone.Volume;
  private padSynth: Tone.PolySynth<Tone.AMSynth>;
  private leadSynth: Tone.PolySynth<Tone.FMSynth>;
  private leadVolumeNode: Tone.Volume;
  private leadTremolo: Tone.Tremolo | null = null;
  private leadTremoloBpmRatio: number | null = null;
  private additiveSynths: RatioSynth[] = [];
  private currentLeadType = 'standard';
  private drumVolume: Tone.Volume;
  private kick: Tone.MembraneSynth;
  private snareFilter: Tone.Filter;
  private snare: Tone.NoiseSynth;
  private snareBody: Tone.MembraneSynth;
  private hihatFilter: Tone.Filter;
  private hihat: Tone.NoiseSynth;
  private drumPlayers: Tone.Players;
  private rainNoise: Tone.Noise;
  private rainFilter: Tone.AutoFilter;
  private rainVolume: Tone.Volume;
  private rainPlayer: Tone.Player;
  private isRainPlayerStarted = false;
  private isStarted = false;

  constructor(initialInstrumentKey: string) {
    this.reverb = new Tone.Reverb({ decay: 4, preDelay: 0.2, wet: 0.4 }).toDestination();
    void this.reverb.generate();
    this.padFilter = new Tone.AutoFilter({ frequency: 0.2, baseFrequency: 200, octaves: 3, depth: 0.7, type: 'sine' });
    this.padTremolo = new Tone.Tremolo({ frequency: 3, depth: 0.2, spread: 180 });
    this.padVolumeNode = new Tone.Volume(0).connect(this.reverb);
    this.padSynth = new Tone.PolySynth(Tone.AMSynth).chain(this.padTremolo, this.padFilter, this.padVolumeNode);
    this.leadSynth = new Tone.PolySynth(Tone.FMSynth);
    this.leadVolumeNode = new Tone.Volume(0).connect(this.reverb);

    this.drumVolume = new Tone.Volume(0).toDestination();
    this.kick = new Tone.MembraneSynth({ pitchDecay: 0.045, octaves: 3.5, oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.14, sustain: 0, release: 0.18 } }).connect(this.drumVolume);
    this.kick.volume.value = -7;
    this.snareFilter = new Tone.Filter({ type: 'bandpass', frequency: 2200, Q: 1 }).connect(this.drumVolume);
    this.snare = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.08 } }).connect(this.snareFilter);
    this.snare.volume.value = -11;
    this.snareBody = new Tone.MembraneSynth({ pitchDecay: 0.01, octaves: 0.8, oscillator: { type: 'triangle' }, envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.06 } }).connect(this.drumVolume);
    this.snareBody.volume.value = -7;
    this.hihatFilter = new Tone.Filter({ type: 'highpass', frequency: 6500, Q: 0.8 }).connect(this.drumVolume);
    this.hihat = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.035, sustain: 0, release: 0.02 } }).connect(this.hihatFilter);
    this.hihat.volume.value = -21;
    this.drumPlayers = new Tone.Players({
      kick: '/res/drums/kick.mp3',
      snare: '/res/drums/snare.mp3',
      hihat: '/res/drums/hihat.mp3',
      hihatHeavy: '/res/drums/hihat-heavy.mp3',
      tomLow: '/res/drums/tom-low.mp3',
      tomMid: '/res/drums/tom-mid.mp3',
      tomHigh: '/res/drums/tom-high.mp3',
      crash: '/res/drums/crash.mp3'
    }).connect(this.drumVolume);
    this.drumPlayers.player('kick').volume.value = -8;
    this.drumPlayers.player('snare').volume.value = -10;
    this.drumPlayers.player('hihat').volume.value = -18;
    this.drumPlayers.player('hihatHeavy').volume.value = -22;
    this.drumPlayers.player('tomLow').volume.value = -10;
    this.drumPlayers.player('tomMid').volume.value = -11;
    this.drumPlayers.player('tomHigh').volume.value = -12;
    this.drumPlayers.player('crash').volume.value = -23;
    this.setDrumVolume(0.5);

    this.rainNoise = new Tone.Noise('pink');
    this.rainFilter = new Tone.AutoFilter({ frequency: 0.1, depth: 0.5, baseFrequency: 600 });
    this.rainVolume = new Tone.Volume(-Infinity);
    this.rainNoise.chain(this.rainFilter, this.rainVolume, this.reverb);
    this.rainPlayer = new Tone.Player({ url: '/res/rain.mp3', loop: true, autostart: false, fadeIn: 2, fadeOut: 2 }).toDestination();
    this.rainPlayer.volume.value = -10;
    this.setInstrument(initialInstrumentKey);
  }

  async resume(): Promise<void> {
    await Tone.start();
    this.startSources();
    await Tone.loaded();
  }

  getCurrentTime(): number {
    return Tone.now();
  }

  setDrumVolume(value: number): void {
    const normalized = Math.max(0, Math.min(1, value));
    this.drumVolume.volume.rampTo(normalized === 0 ? -Infinity : 20 * Math.log10(normalized * 2), 0.05);
  }

  setLeadVolume(value: number): void {
    const normalized = Math.max(0, Math.min(1, value));
    this.leadVolumeNode.volume.rampTo(normalized === 0 ? -Infinity : 20 * Math.log10(normalized), 0.05);
  }

  setPadVolume(value: number): void {
    const normalized = Math.max(0, Math.min(1, value));
    this.padVolumeNode.volume.rampTo(normalized === 0 ? -Infinity : 20 * Math.log10(normalized), 0.05);
  }

  setInstrument(presetKey: string): void {
    const preset = INSTRUMENT_PRESETS[presetKey];
    if (!preset) return;
    this.currentLeadType = preset.lead.type || 'standard';
    this.applyPadPreset(preset);
    this.applyLeadPreset(preset);
  }

  updateLeadTremolo(bpm: number): void {
    if (this.leadTremolo && this.leadTremoloBpmRatio) {
      this.leadTremolo.frequency.rampTo((bpm * this.leadTremoloBpmRatio) / 60, 0.1);
    }
  }

  toggleRain(isEnabled: boolean): void {
    if (isEnabled) {
      this.rainVolume.volume.rampTo(-15, 2);
      if (this.rainPlayer.loaded) this.startRainAtRandomPosition();
      else void Tone.loaded().then(() => this.startRainAtRandomPosition());
    } else {
      this.rainVolume.volume.rampTo(-Infinity, 2);
      if (this.isRainPlayerStarted) this.rainPlayer.stop();
      this.isRainPlayerStarted = false;
    }
  }

  playPad(chord: Chord, time: number, style: PadStyle = 'block', beatDuration: number): void {
    this.padSynth.releaseAll(time);
    const notes = this.getChordNotes(chord);
    if (style === 'strum') {
      notes.forEach((note, index) => {
        this.padSynth.triggerAttack(note, time + (index * beatDuration) / 4);
      });
      return;
    }
    if (style === 'arpeggio') {
      notes.sort(() => Math.random() - 0.5).forEach((note, index) => {
        this.padSynth.triggerAttackRelease(note, '1n', time + index * beatDuration);
      });
      return;
    }
    this.padSynth.triggerAttack(notes, time);
  }

  playMelodyNote(note: string, duration: number, time: number): void {
    const velocity = 0.6 + Math.random() * 0.3;
    if (this.currentLeadType === 'customAdditive') {
      const baseFreq = Tone.Frequency(note).toFrequency();
      this.additiveSynths.forEach((synth) => {
        synth.triggerAttackRelease(baseFreq * (synth._ratio || 1), duration, time, velocity);
      });
      return;
    }
    this.leadSynth.triggerAttackRelease(note, duration, time, velocity);
  }

  stopAll(time = Tone.now()): void {
    this.padSynth.releaseAll(time);
    this.leadSynth.releaseAll(time);
    this.additiveSynths.forEach((synth) => {
      synth.releaseAll(time);
    });
  }

  playKick(time: number): void {
    if (this.playDrumSample('kick', time)) return;
    this.kick.triggerAttackRelease(55, '8n', time, 0.62);
  }

  playSnare(time: number): void {
    if (this.playDrumSample('snare', time)) return;
    this.snareBody.triggerAttackRelease(200, '16n', time, 0.5);
    this.snare.triggerAttackRelease('16n', time, 0.58);
  }

  playHiHatHeavy(time: number): void {
    if (this.playDrumSample('hihatHeavy', time) || this.playDrumSample('hihat', time)) return;
    this.hihat.triggerAttackRelease('32n', time, 0.3);
  }

  playHiHat(time: number): void {
    if (this.playDrumSample('hihat', time)) return;
    this.hihat.triggerAttackRelease('32n', time, 0.2);
  }

  playTomLow(time: number): void {
    if (this.playDrumSample('tomLow', time)) return;
    this.kick.triggerAttackRelease(82, '16n', time, 0.42);
  }

  playTomMid(time: number): void {
    if (this.playDrumSample('tomMid', time)) return;
    this.kick.triggerAttackRelease(124, '16n', time, 0.38);
  }

  playTomHigh(time: number): void {
    if (this.playDrumSample('tomHigh', time)) return;
    this.kick.triggerAttackRelease(165, '16n', time, 0.34);
  }

  playCrash(time: number): void {
    if (this.playDrumSample('crash', time)) return;
    this.hihat.triggerAttackRelease('8n', time, 0.34);
  }

  private applyPadPreset(preset: InstrumentPreset): void {
    const { volume, ...padParams } = preset.pad;
    this.padSynth.set(padParams as never);
    this.padSynth.volume.rampTo(volume, 0.1);
  }

  private applyLeadPreset(preset: InstrumentPreset): void {
    if (preset.lead.type === 'customAdditive') {
      this.disposeAdditiveSynths();
      preset.lead.harmonics?.forEach((harmonic) => {
        const synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'sine' },
          envelope: preset.lead.envelope as never,
          volume: preset.lead.volume + Math.log10(harmonic.amp) * 20
        }).connect(this.reverb) as RatioSynth;
        synth._ratio = harmonic.ratio;
        this.additiveSynths.push(synth);
      });
      this.leadSynth.volume.rampTo(-Infinity, 0.1);
      return;
    }

    this.disposeAdditiveSynths();
    const { volume, tremolo, ...leadParams } = preset.lead;
    this.leadSynth.releaseAll(Tone.now());
    this.leadSynth.set(leadParams as never);
    this.leadSynth.volume.rampTo(volume, 0.1);
    this.leadSynth.disconnect();
    this.leadTremolo?.dispose();
    this.leadTremolo = null;
    this.leadTremoloBpmRatio = null;
    if (tremolo) {
      this.leadTremoloBpmRatio = tremolo.bpmRatio || 4;
      this.leadTremolo = new Tone.Tremolo({ frequency: 1, depth: tremolo.depth });
      if (this.isStarted) this.leadTremolo.start();
      this.leadSynth.chain(this.leadTremolo, this.leadVolumeNode);
    } else {
      this.leadSynth.connect(this.leadVolumeNode);
    }
  }

  private startSources(): void {
    if (this.isStarted) return;
    this.padFilter.start();
    this.padTremolo.start();
    this.rainFilter.start();
    this.rainNoise.start();
    this.leadTremolo?.start();
    this.isStarted = true;
  }

  private disposeAdditiveSynths(): void {
    this.additiveSynths.forEach((synth) => {
      synth.dispose();
    });
    this.additiveSynths = [];
  }

  private startRainAtRandomPosition(): void {
    if (this.isRainPlayerStarted) return;
    const duration = this.rainPlayer.buffer.duration;
    this.rainPlayer.start(undefined, Math.random() * duration);
    this.isRainPlayerStarted = true;
  }

  private getChordNotes(chord: Chord) {
    const octave = chord.root.slice(-1);
    return chord.tones.map((tone) => `${tone}${octave}`);
  }

  private playDrumSample(name: string, time: number): boolean {
    const player = this.drumPlayers.player(name);
    if (!player?.loaded) return false;
    player.start(time);
    return true;
  }
}
