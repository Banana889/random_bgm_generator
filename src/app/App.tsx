import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { RainVisualizer } from '../ambience/RainVisualizer';
import type { NoiseGenerator } from '../ambience/NoiseGenerator';
import type { PadStyle, ToneAudioBackend } from '../audio/ToneAudioBackend';
import { AUTO_DRUM_FILL_INTERVAL_BARS, PRESETS } from '../music/data/presets';
import { INSTRUMENT_PRESETS } from '../music/data/instruments';
import { type DrumType, pickDrumFill, pickDrumPattern } from '../music/data/drums';
import { resolveToneState, TONE_STATES } from '../music/data/toneStates';
import { generateNewMotif, getNextChordKey, pickGoHomeNote } from '../music/composition/nextNote';
import { createTimerWorker } from '../platform/createTimerWorker';
import type { AppState, DrumTrailEvent, MelodyTrailEvent, TabKey } from './types';

const SCHEDULE_LOOKAHEAD = 0.25;
const MAX_MELODY_TRAIL = 64;
const MAX_DRUM_TRAIL = 160;
const VISUAL_FLOW_SECONDS = 7.2;

const initialState: AppState = {
  bpm: 65,
  beatsPerBar: 4,
  currentPresetKey: 'c_major',
  currentInstrumentKey: 'origin',
  currentChordKey: null,
  playingChord: null,
  lastPlayedNoteIndex: 7,
  isPlaying: false,
  isDrumsEnabled: false,
  currentBeat: 0,
  melodyTrail: [],
  drumTrail: [],
  drumPattern: {},
  drumPatternBarsRemaining: 0,
  isDrumFillEnabled: false,
  drumFillQueued: false,
  drumFillActive: false,
  drumFillPattern: {},
  drumFillBarsUntilAuto: AUTO_DRUM_FILL_INTERVAL_BARS,
  phraseState: 'PLAYING',
  phraseBeatsRemaining: 16,
  currentMotif: [],
  motifIndex: 0,
  rainEnabled: false,
  thunderEnabled: false,
  thunderVolume: 0.18,
  thunderDistance: 0.9,
  thunderCharacter: 0,
  drumVolume: 0.5,
  melodyVolume: 1,
  chordVolume: 1,
  logEvents: [],
  chordDisplay: '--',
  chordDetail: 'Waiting...',
  noteDisplay: '--',
  activeTab: 'melody',
  toneStateKey: ''
};

const toneStates = TONE_STATES;
const assetBaseUrl = import.meta.env.BASE_URL;
const diceFaces = [1, 2, 3, 4, 5, 6];

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function beatDurationSeconds(bpm: number, beatsPerBar: number): number {
  return beatsPerBar === 6 ? 60 / bpm / 3 : 60 / bpm;
}

function formatVolume(value: number): number {
  return Math.round(clamp01(value) * 100);
}

function isValidTimeSignature(value: number): boolean {
  return value === 3 || value === 4 || value === 6;
}

export default function App() {
  const [state, setState] = useState<AppState>(() => {
    const keys = Object.keys(toneStates);
    return { ...initialState, toneStateKey: keys[Math.floor(Math.random() * keys.length)] || '' };
  });
  const [diceRollId, setDiceRollId] = useState(0);
  const [isMobileConfigOpen, setIsMobileConfigOpen] = useState(false);
  const stateRef = useRef(state);
  const engineRef = useRef<ToneAudioBackend | null>(null);
  const noiseRef = useRef<NoiseGenerator | null>(null);
  const visualizerRef = useRef<RainVisualizer | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const nextBeatTimeRef = useRef(0);
  const melodyBusyUntilRef = useRef(0);
  const stepIndexRef = useRef(0);
  const melodyVisualIdRef = useRef(0);
  const melodyVisualTimeoutsRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const drumVisualIdRef = useRef(0);
  const drumVisualTimeoutsRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const isMountedRef = useRef(false);

  stateRef.current = state;

  const beatUnit = state.beatsPerBar === 6 ? '♩.' : '♩';
  const beatUnitTitle = state.beatsPerBar === 6 ? 'One beat equals a dotted quarter note' : 'One beat equals a quarter note';
  const toneStateKeys = useMemo(() => Object.keys(toneStates), []);
  const diceStateFace = Math.max(1, (toneStateKeys.indexOf(state.toneStateKey) % diceFaces.length) + 1);

  useEffect(() => {
    isMountedRef.current = true;
    const canvas = document.getElementById('rain-canvas');
    if (canvas instanceof HTMLCanvasElement) visualizerRef.current = new RainVisualizer(canvas);
    return () => {
      isMountedRef.current = false;
      workerRef.current?.postMessage('stop');
      workerRef.current?.terminate();
      clearMelodyVisualTimers();
      clearDrumVisualTimers();
      visualizerRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (!state.toneStateKey) return;
    applyToneState(state.toneStateKey);
  }, []);

  useEffect(() => {
    engineRef.current?.setDrumVolume(state.drumVolume);
  }, [state.drumVolume]);

  useEffect(() => {
    engineRef.current?.setLeadVolume(state.melodyVolume);
  }, [state.melodyVolume]);

  useEffect(() => {
    engineRef.current?.setPadVolume(state.chordVolume);
  }, [state.chordVolume]);

  useEffect(() => {
    engineRef.current?.updateLeadTremolo(state.bpm);
  }, [state.bpm]);

  useEffect(() => {
    engineRef.current?.toggleRain(state.isPlaying && state.rainEnabled);
  }, [state.isPlaying, state.rainEnabled]);

  useEffect(() => {
    syncThunderNoiseControls();
  }, [state.isPlaying, state.rainEnabled, state.thunderEnabled, state.thunderVolume, state.thunderDistance, state.thunderCharacter]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && stateRef.current.isPlaying) resetSchedulerTiming(0.08);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  function patchState(patch: Partial<AppState>): void {
    setState((current) => ({ ...current, ...patch }));
  }

  function updateState(updater: (current: AppState) => AppState): void {
    const next = updater(stateRef.current);
    stateRef.current = next;
    if (isMountedRef.current) setState(next);
  }

  function randomizeToneState(): void {
    const keys = toneStateKeys.filter((key) => key !== stateRef.current.toneStateKey);
    const choices = keys.length ? keys : toneStateKeys;
    setDiceRollId((current) => current + 1);
    applyToneState(choices[Math.floor(Math.random() * choices.length)]);
  }

  function resetSchedulerTiming(offset = 0.12): void {
    const engine = engineRef.current;
    if (!engine) return;
    const nextBeatTime = engine.getCurrentTime() + offset;
    nextBeatTimeRef.current = nextBeatTime;
    melodyBusyUntilRef.current = nextBeatTime;
  }

  function clearDrumFill(current: AppState): AppState {
    return { ...current, drumFillQueued: false, drumFillActive: false, drumFillPattern: {} };
  }

  function clearVisualHistory(current: AppState): AppState {
    clearMelodyVisualTimers();
    clearDrumVisualTimers();
    return { ...current, melodyTrail: [], drumTrail: [] };
  }

  function clearMelodyVisualTimers(): void {
    melodyVisualTimeoutsRef.current.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    melodyVisualTimeoutsRef.current.clear();
  }

  function clearDrumVisualHistory(current: AppState): AppState {
    clearDrumVisualTimers();
    return { ...current, drumTrail: [] };
  }

  function clearDrumVisualTimers(): void {
    drumVisualTimeoutsRef.current.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    drumVisualTimeoutsRef.current.clear();
  }

  function getVisualFlowTiming(audioTime: number): { flowDuration: number; flowDelay: number; removeAfterMs: number } {
    const engine = engineRef.current;
    const leadSeconds = engine ? Math.max(0, audioTime - engine.getCurrentTime()) : 0;
    return {
      flowDuration: VISUAL_FLOW_SECONDS,
      flowDelay: leadSeconds,
      removeAfterMs: (leadSeconds + VISUAL_FLOW_SECONDS) * 1000
    };
  }

  function scheduleDrumVisualRemoval(id: number, removeAfterMs: number): void {
    const timeoutId = setTimeout(() => {
      drumVisualTimeoutsRef.current.delete(id);
      updateState((current) => ({ ...current, drumTrail: current.drumTrail.filter((event) => event.id !== id) }));
    }, removeAfterMs);
    drumVisualTimeoutsRef.current.set(id, timeoutId);
  }

  function scheduleMelodyVisualRemoval(id: number, removeAfterMs: number): void {
    const timeoutId = setTimeout(() => {
      melodyVisualTimeoutsRef.current.delete(id);
      updateState((current) => ({ ...current, melodyTrail: current.melodyTrail.filter((event) => event.id !== id) }));
    }, removeAfterMs);
    melodyVisualTimeoutsRef.current.set(id, timeoutId);
  }

  function syncThunderNoiseControls(): void {
    const current = stateRef.current;
    const freq = 3000 - current.thunderDistance * 2900;
    const character = current.thunderCharacter;

    if (noiseRef.current) {
      noiseRef.current.setFilterFreq(freq);
      noiseRef.current.setFilterQ(character);
      noiseRef.current.setType(character > 5 ? 'bandpass' : 'lowpass');
      noiseRef.current.setVolume(current.isPlaying && current.thunderEnabled ? current.thunderVolume : 0);
    }

    if (visualizerRef.current) {
      const isRaining = current.isPlaying && current.rainEnabled;
      visualizerRef.current.setIntensity(isRaining ? 0.45 : 0);
      visualizerRef.current.setTone(400);
      visualizerRef.current.setWind(character * 2);
      visualizerRef.current.toggle(isRaining);
      visualizerRef.current.setThunder(current.isPlaying && current.thunderEnabled, current.thunderVolume, current.thunderDistance);
    }
  }

  function stopSession(): void {
    workerRef.current?.postMessage('stop');
    engineRef.current?.stopAll();
    engineRef.current?.toggleRain(false);
    updateState((current) =>
      clearVisualHistory({
        ...clearDrumFill(current),
        isPlaying: false,
        isDrumFillEnabled: false,
        drumFillBarsUntilAuto: AUTO_DRUM_FILL_INTERVAL_BARS,
        rainEnabled: false,
        thunderEnabled: false,
        noteDisplay: '--',
        chordDisplay: '--',
        chordDetail: 'Waiting...',
        logEvents: []
      })
    );
  }

  async function startSession(): Promise<void> {
    if (stateRef.current.isPlaying) {
      stopSession();
      return;
    }

    if (!engineRef.current) {
      const { ToneAudioBackend } = await import('../audio/ToneAudioBackend');
      engineRef.current = new ToneAudioBackend(stateRef.current.currentInstrumentKey);
    }
    await engineRef.current.resume();
    engineRef.current.updateLeadTremolo(stateRef.current.bpm);
    engineRef.current.setDrumVolume(stateRef.current.drumVolume);
    engineRef.current.setLeadVolume(stateRef.current.melodyVolume);
    engineRef.current.setPadVolume(stateRef.current.chordVolume);
    if (!noiseRef.current) {
      const { NoiseGenerator } = await import('../ambience/NoiseGenerator');
      noiseRef.current = new NoiseGenerator();
    }

    resetSchedulerTiming(0.1);
    stepIndexRef.current = 0;
    updateState((current) =>
      clearVisualHistory({
        ...current,
        isPlaying: true,
        currentBeat: 0,
        currentChordKey: null,
        drumFillBarsUntilAuto: AUTO_DRUM_FILL_INTERVAL_BARS
      })
    );

    if (!workerRef.current) {
      workerRef.current = createTimerWorker();
      workerRef.current.onmessage = (event: MessageEvent<string>) => {
        if (event.data === 'tick') tick();
      };
    }
    workerRef.current.postMessage('start');
  }

  function tick(): void {
    const engine = engineRef.current;
    const current = stateRef.current;
    if (!engine || !current.isPlaying) return;

    const now = engine.getCurrentTime();
    const beatDuration = beatDurationSeconds(current.bpm, current.beatsPerBar);
    const stepDuration = beatDuration / 2;
    if (nextBeatTimeRef.current < now - stepDuration) {
      nextBeatTimeRef.current = now + 0.02;
      melodyBusyUntilRef.current = Math.max(melodyBusyUntilRef.current, nextBeatTimeRef.current);
    }

    let nextState = stateRef.current;
    while (nextBeatTimeRef.current < now + SCHEDULE_LOOKAHEAD) {
      const isOnBeat = stepIndexRef.current % 2 === 0;
      const currentHalfBeatInBar = stepIndexRef.current % (nextState.beatsPerBar * 2);
      const currentBeatInBar = Math.floor(stepIndexRef.current / 2) % nextState.beatsPerBar;

      if (nextState.isDrumsEnabled) nextState = playDrumPatternStep(nextState, currentHalfBeatInBar, nextBeatTimeRef.current, stepDuration);

      if (currentBeatInBar === 0 && isOnBeat) {
        const preset = PRESETS[nextState.currentPresetKey];
        const currentChordKey = nextState.currentChordKey || preset.startChord;
        const chord = preset.chords[currentChordKey];
        const styles: PadStyle[] = ['block', 'block', 'block', 'strum', 'arpeggio'];
        engine.playPad(chord, nextBeatTimeRef.current, styles[Math.floor(Math.random() * styles.length)], beatDuration);
        nextState = {
          ...nextState,
          currentChordKey: getNextChordKey(currentChordKey, preset.graph),
          playingChord: chord,
          chordDisplay: chord.name,
          chordDetail: `Notes: ${chord.tones.join('-')}`
        };
      }

      if (nextBeatTimeRef.current >= melodyBusyUntilRef.current - 0.001) {
        nextState = playMelodyStep(nextState, beatDuration, stepDuration, nextBeatTimeRef.current);
      }

      nextBeatTimeRef.current += stepDuration;
      stepIndexRef.current++;
      nextState = { ...nextState, currentBeat: Math.floor(stepIndexRef.current / 2) % nextState.beatsPerBar };
    }

    stateRef.current = nextState;
    if (isMountedRef.current) setState(nextState);
  }

  function playDrumPatternStep(current: AppState, currentHalfBeatInBar: number, time: number, stepDuration: number): AppState {
    let next = current;
    if (currentHalfBeatInBar === 0) {
      if (next.drumFillActive) {
        next = addDrumVisual(next, 'crash', time, 0, true);
        next = playDrum(next, 'crash', time);
        next = { ...next, drumFillActive: false, drumFillPattern: {} };
      }
      if (next.isDrumFillEnabled && !next.drumFillQueued) next = { ...next, drumFillBarsUntilAuto: next.drumFillBarsUntilAuto - 1 };
      if (next.isDrumFillEnabled && (next.drumFillQueued || next.drumFillBarsUntilAuto <= 0)) {
        next = {
          ...next,
          drumFillQueued: false,
          drumFillActive: true,
          drumFillPattern: pickDrumFill(next.beatsPerBar),
          drumFillBarsUntilAuto: AUTO_DRUM_FILL_INTERVAL_BARS
        };
      } else if (next.drumPatternBarsRemaining <= 0) {
        next = { ...next, drumPattern: pickDrumPattern(next.beatsPerBar), drumPatternBarsRemaining: 2 + Math.floor(Math.random() * 3) };
      } else {
        next = { ...next, drumPatternBarsRemaining: next.drumPatternBarsRemaining - 1 };
      }

      const pattern = next.drumFillActive ? next.drumFillPattern : next.drumPattern;
      next = addDrumPatternVisuals(next, pattern, time, stepDuration, next.drumFillActive);
    }

    const pattern = next.drumFillActive ? next.drumFillPattern : next.drumPattern;
    for (const type of pattern[currentHalfBeatInBar] || []) {
      next = playDrum(next, type, time);
    }
    return next;
  }

  function playDrum(current: AppState, type: DrumType, time: number): AppState {
    const engine = engineRef.current;
    if (!engine) return current;
    if (type === 'kick') engine.playKick(time);
    else if (type === 'snare') engine.playSnare(time);
    else if (type === 'tom-low') engine.playTomLow(time);
    else if (type === 'tom-mid') engine.playTomMid(time);
    else if (type === 'tom-high') engine.playTomHigh(time);
    else if (type === 'crash') engine.playCrash(time);
    else if (type === 'hihat-heavy') engine.playHiHatHeavy(time);
    else if (type === 'hihat') engine.playHiHat(time);
    return current;
  }

  function addDrumPatternVisuals(current: AppState, pattern: AppState['drumPattern'], barStartTime: number, stepDuration: number, isFill = false): AppState {
    let next = current;
    for (const [halfBeat, types] of Object.entries(pattern)) {
      const currentHalfBeatInBar = Number(halfBeat);
      const beatPosition = currentHalfBeatInBar / 2;
      const time = barStartTime + currentHalfBeatInBar * stepDuration;
      for (const type of types) next = addDrumVisual(next, type, time, beatPosition, isFill);
    }
    return next;
  }

  function addDrumVisual(current: AppState, type: DrumType, time: number, beatPosition: number, isFill = false): AppState {
    const displayType = type === 'hihat-heavy' ? 'hihat' : type;
    const props = {
      kick: { y: 0.82, size: 1 },
      snare: { y: 0.5, size: 0.82 },
      hihat: { y: 0.2, size: 0.48 },
      'tom-low': { y: 0.68, size: 0.86 },
      'tom-mid': { y: 0.42, size: 0.8 },
      'tom-high': { y: 0.28, size: 0.74 },
      crash: { y: 0.12, size: 1.08 }
    }[displayType];
    if (!props) return current;
    const id = ++drumVisualIdRef.current;
    const flow = getVisualFlowTiming(time);
    scheduleDrumVisualRemoval(id, flow.removeAfterMs);
    const drumTrail: DrumTrailEvent[] = [
      ...current.drumTrail,
      { id, type: displayType, x: clamp01(beatPosition / Math.max(current.beatsPerBar, 1)), y: props.y, size: props.size, isFill, flowDuration: flow.flowDuration, flowDelay: flow.flowDelay }
    ].slice(-MAX_DRUM_TRAIL);
    return { ...current, drumTrail };
  }

  function playMelodyStep(current: AppState, beatDuration: number, stepDuration: number, time: number): AppState {
    let next = current;
    if (next.phraseState === 'RESTING') {
      melodyBusyUntilRef.current = time + stepDuration;
      next = updatePhraseState({ ...next, phraseBeatsRemaining: next.phraseBeatsRemaining - 0.5 });
      return next;
    }

    if (next.currentMotif.length === 0) next = { ...next, currentMotif: generateNewMotif(next.beatsPerBar), motifIndex: 0 };
    const durationInBeats = next.currentMotif[next.motifIndex];
    const durationSeconds = beatDuration * durationInBeats;
    const preset = PRESETS[next.currentPresetKey];
    const selection = pickGoHomeNote(preset, next.playingChord, next.lastPlayedNoteIndex);
    engineRef.current?.playMelodyNote(selection.note, durationSeconds, time);
    melodyBusyUntilRef.current = time + durationSeconds;

    const id = ++melodyVisualIdRef.current;
    const flow = getVisualFlowTiming(time);
    scheduleMelodyVisualRemoval(id, flow.removeAfterMs);
    const melodyTrail: MelodyTrailEvent[] = [
      ...next.melodyTrail,
      { id, note: selection.note, pitchY: clamp01(selection.index / Math.max(preset.scale.length - 1, 1)), size: Math.min(durationInBeats / 2, 1), flowDuration: flow.flowDuration, flowDelay: flow.flowDelay }
    ].slice(-MAX_MELODY_TRAIL);

    next = {
      ...next,
      lastPlayedNoteIndex: selection.index,
      melodyTrail,
      noteDisplay: selection.note,
      logEvents: [{ note: selection.note, durationInBeats, chordName: next.playingChord?.name || '--' }, ...next.logEvents].slice(0, 20),
      motifIndex: (next.motifIndex + 1) % next.currentMotif.length,
      phraseBeatsRemaining: next.phraseBeatsRemaining - durationInBeats
    };
    return updatePhraseState(next);
  }

  function updatePhraseState(current: AppState): AppState {
    if (current.phraseBeatsRemaining > 1) return current;
    if (current.phraseState === 'PLAYING') {
      const preset = PRESETS[current.currentPresetKey];
      const lastNote = preset.scale[current.lastPlayedNoteIndex] || 'C4';
      const pitchClass = lastNote.slice(0, -1);
      if (preset.stableNotes.includes(pitchClass)) {
        return { ...current, phraseState: 'RESTING', phraseBeatsRemaining: [2, 4][Math.floor(Math.random() * 2)], noteDisplay: '(Rest)' };
      }
      return { ...current, phraseBeatsRemaining: current.phraseBeatsRemaining + 2 };
    }
    return {
      ...current,
      phraseState: 'PLAYING',
      phraseBeatsRemaining: [8, 12, 16][Math.floor(Math.random() * 3)],
      currentMotif: generateNewMotif(current.beatsPerBar),
      motifIndex: 0
    };
  }

  function applyToneState(key: string): void {
    const toneState = toneStates[key];
    if (!toneState) return;
    const preset = resolveToneState(toneState);
    setState((current) => {
      const next = clearDrumFill({
        ...current,
        toneStateKey: key,
        bpm: preset.bpm > 0 ? preset.bpm : current.bpm,
        currentPresetKey: preset.scale && PRESETS[preset.scale] ? preset.scale : current.currentPresetKey,
        currentInstrumentKey: preset.instrument && INSTRUMENT_PRESETS[preset.instrument] ? preset.instrument : current.currentInstrumentKey,
        beatsPerBar: isValidTimeSignature(preset.timeSignature) ? preset.timeSignature : current.beatsPerBar,
        melodyVolume: clamp01(preset.melodyVolume),
        chordVolume: clamp01(preset.chordVolume),
        isDrumsEnabled: preset.drumsEnabled,
        drumVolume: clamp01(preset.drumVolume),
        rainEnabled: preset.rainEnabled,
        thunderEnabled: preset.thunderEnabled,
        thunderVolume: clamp01(preset.thunderVolume),
        thunderDistance: clamp01(preset.thunderDistance),
        thunderCharacter: Math.max(0, preset.thunderCharacter),
        activeTab: preset.activeTab ?? current.activeTab,
        currentChordKey: null,
        drumPattern: {},
        drumPatternBarsRemaining: 0,
        isDrumFillEnabled: preset.drumFillEnabled,
        drumFillBarsUntilAuto: AUTO_DRUM_FILL_INTERVAL_BARS
      });
      engineRef.current?.setInstrument(next.currentInstrumentKey);
      engineRef.current?.updateLeadTremolo(next.bpm);
      engineRef.current?.setLeadVolume(next.melodyVolume);
      engineRef.current?.setPadVolume(next.chordVolume);
      engineRef.current?.setDrumVolume(next.drumVolume);
      stateRef.current = next;
      return next;
    });
  }

  function setInstrument(key: string): void {
    engineRef.current?.setInstrument(key);
    engineRef.current?.updateLeadTremolo(stateRef.current.bpm);
    patchState({ currentInstrumentKey: key });
  }

  function setBeatsPerBar(value: number): void {
    updateState((current) =>
      clearDrumFill({
        ...current,
        beatsPerBar: value,
        drumPattern: {},
        drumPatternBarsRemaining: 0,
        isDrumFillEnabled: false,
        drumFillBarsUntilAuto: AUTO_DRUM_FILL_INTERVAL_BARS
      })
    );
  }

  function toggleDrums(enabled: boolean): void {
    updateState((current) =>
      enabled
        ? { ...current, isDrumsEnabled: true }
        : clearDrumVisualHistory(
            clearDrumFill({
              ...current,
              isDrumsEnabled: false,
              isDrumFillEnabled: false,
              drumFillBarsUntilAuto: AUTO_DRUM_FILL_INTERVAL_BARS
            })
          )
    );
  }

  return (
    <main className="app-shell">
      <section className="output-panel" aria-label="Session output">
        <div className="panel-header">
          <div className="brand-lockup">
            <img src={`${assetBaseUrl}static/driftone-icon-1024.svg`} alt="Driftone logo" className="brand-logo" />
            <h1>Driftone</h1>
          </div>
          <p>Generative ambient music and white noise, anchored in a tranquil harbor.</p>
        </div>

        <div className="display-area" id="main-ui" style={{ opacity: state.isPlaying ? 1 : 0.34 }}>
          <div className="chord-box"><h3>CURRENT CHORD</h3><h1 id="chord-display">{state.chordDisplay}</h1><div id="chord-detail">{state.chordDetail}</div></div>
          <div className="chord-box"><h3>MELODY NOTE</h3><h1 id="note-display">{state.noteDisplay}</h1></div>
        </div>

        <div className="melody-trail">
          <div className="trail-stage" id="melody-trail">
            {state.drumTrail.map((event) => <span key={`d-${event.id}`} className={`drum-mark drum-${event.type}${event.isFill ? ' drum-fill' : ''}`} style={{ '--drum-x': event.x, '--drum-y': event.y, '--drum-size': event.size, '--flow-duration': `${event.flowDuration}s`, '--flow-delay': `${event.flowDelay}s` } as React.CSSProperties} title={event.type} />)}
            {state.melodyTrail.map((event) => <span key={`m-${event.id}`} className="trail-note" style={{ '--pitch-y': event.pitchY, '--note-size': event.size, '--flow-duration': `${event.flowDuration}s`, '--flow-delay': `${event.flowDelay}s` } as React.CSSProperties} title={event.note}><span className="note-head" /><span className="note-tail" /></span>)}
          </div>
        </div>

        <div id="log">
          {state.logEvents.map((event, index) => <div className="note-event" key={`${event.note}-${index}`}><span className="event-note">{event.note}</span><span className="event-duration" title={`${event.durationInBeats} beats`}><span style={{ '--duration-size': Math.min(event.durationInBeats / 2, 1) } as React.CSSProperties} /></span><span className="event-beats">{event.durationInBeats}</span><span className="event-chord">{event.chordName}</span></div>)}
        </div>
      </section>

      <div className="right-stack">
        <div className="preset-card">
          <div className="section-heading">
            <span className="section-label">TONE STATE</span>
            <p>Load a full sound state.</p>
          </div>
          <div className="control-group preset-row"><label htmlFor="tone-state">STATE</label><select id="tone-state" value={state.toneStateKey} onChange={(event) => applyToneState(event.target.value)}>{toneStateKeys.map((key) => <option key={key} value={key}>{toneStates[key].name}</option>)}</select><button type="button" className={`dice-btn${diceRollId ? ' is-rolling' : ''}`} aria-label="Random tone state" onClick={randomizeToneState}><span className="dice-scene" aria-hidden="true"><span key={diceRollId} className={`dice-cube dice-current-${diceStateFace}`}>{diceFaces.map((face) => <span key={face} className={`dice-face dice-face-${face}`} style={{ backgroundImage: `url(${assetBaseUrl}static/dice-face-${face}.svg)` }} />)}</span></span></button></div>
        </div>

        <button type="button" className="mobile-config-toggle" aria-label="Configure sound" aria-expanded={isMobileConfigOpen} aria-controls="control-panel" onClick={() => setIsMobileConfigOpen((open) => !open)}><span aria-hidden="true" /></button>

        <section id="control-panel" className={`control-panel${isMobileConfigOpen ? ' is-open' : ''}`} aria-label="Session controls">
          <div className="mobile-panel-header">
            <span>Sound Settings</span>
            <button type="button" aria-label="Close sound settings" onClick={() => setIsMobileConfigOpen(false)}>×</button>
          </div>
          <div className="tab-list" role="tablist" aria-label="Control sections">
            {(['melody', 'rhythm', 'ambience'] as TabKey[]).map((tab) => <button key={tab} className={`tab-button ${state.activeTab === tab ? 'active' : ''}`} type="button" role="tab" aria-selected={state.activeTab === tab} onClick={() => patchState({ activeTab: tab })}>{tab[0].toUpperCase() + tab.slice(1)}</button>)}
          </div>
          <div className="tab-panels">
            <div className="tab-panel active" role="tabpanel" data-panel="melody" hidden={state.activeTab !== 'melody'}>
              <ControlSection label="HARMONY" text="Choose the tonal world and chord graph."><ControlSelect label="MODE / SCALE" value={state.currentPresetKey} onChange={(value) => patchState({ currentPresetKey: value, currentChordKey: null })} options={Object.entries(PRESETS).map(([key, preset]) => [key, preset.name])} /></ControlSection>
              <ControlSection label="TIMBRE" text="Shape the lead and pad instrument color."><ControlSelect label="SOUND / TIMBRE" value={state.currentInstrumentKey} onChange={setInstrument} options={Object.entries(INSTRUMENT_PRESETS).map(([key, preset]) => [key, preset.name])} /></ControlSection>
              <div className="control-section"><Range label={`MELODY VOL: ${formatVolume(state.melodyVolume)}`} value={state.melodyVolume} min={0} max={1} step={0.01} onChange={(melodyVolume) => patchState({ melodyVolume })} /><Range label={`CHORD VOL: ${formatVolume(state.chordVolume)}`} value={state.chordVolume} min={0} max={1} step={0.01} onChange={(chordVolume) => patchState({ chordVolume })} /></div>
            </div>
            <div className="tab-panel" role="tabpanel" data-panel="rhythm" hidden={state.activeTab !== 'rhythm'}>
              <ControlSection label="METER" text="Set the grid that drives phrases and chords."><ControlSelect label="TIME SIG" value={String(state.beatsPerBar)} onChange={(value) => setBeatsPerBar(Number(value))} options={[["4", "4/4"], ["3", "3/4"], ["6", "6/8"]]} /><Range label={`BPM ${beatUnit}: ${state.bpm}`} title={beatUnitTitle} value={state.bpm} min={40} max={160} step={1} onChange={(bpm) => patchState({ bpm })} /></ControlSection>
              <ControlSection label="PULSE" text="Control the tempo and percussion layer."><Switch label="DRUMS" checked={state.isDrumsEnabled} onChange={toggleDrums} /><Range label={`DRUM VOL: ${formatVolume(state.drumVolume)}`} value={state.drumVolume} min={0} max={1} step={0.01} onChange={(drumVolume) => patchState({ drumVolume })} /><Switch label="FILL" checked={state.isDrumFillEnabled} onChange={(isDrumFillEnabled) => patchState({ isDrumFillEnabled: state.isPlaying && state.isDrumsEnabled ? isDrumFillEnabled : false, drumFillBarsUntilAuto: AUTO_DRUM_FILL_INTERVAL_BARS })} className={`control-group inline-control fill-control${state.drumFillActive ? ' is-active' : state.drumFillQueued ? ' is-queued' : ''}`} /></ControlSection>
            </div>
            <div className="tab-panel" role="tabpanel" data-panel="ambience" hidden={state.activeTab !== 'ambience'}>
              <ControlSection label="RAIN" text="Enable the ambient rain layer."><Switch label="Rain Ambience" checked={state.rainEnabled} onChange={(rainEnabled) => patchState({ rainEnabled })} /></ControlSection>
              <ControlSection label="STORM" text="Shape thunder intensity, distance, and thunder-to-wind character."><Switch label="Storm AMBIENCE" checked={state.thunderEnabled} onChange={(thunderEnabled) => patchState({ thunderEnabled })} /><div className="ambience-stack"><RangeRow label="Intensity" value={state.thunderVolume} min={0} max={1} step={0.01} onChange={(thunderVolume) => patchState({ thunderVolume })} /><RangeRow label="Distance" value={state.thunderDistance} min={0} max={1} step={0.01} onChange={(thunderDistance) => patchState({ thunderDistance })} /><RangeRow label="Character" value={state.thunderCharacter} min={0} max={20} step={0.1} onChange={(thunderCharacter) => patchState({ thunderCharacter })} left="⚡" right="༄" /></div></ControlSection>
            </div>
          </div>
        </section>

        <div className="session-actions"><button id="start-btn" type="button" className={state.isPlaying ? 'is-ending' : ''} onClick={() => void startSession()}>{state.isPlaying ? 'End Session' : 'Start Session'}</button></div>
      </div>
    </main>
  );
}

function ControlSection({ label, text, children }: { label: string; text: string; children: React.ReactNode }) {
  return <div className="control-section"><div className="section-heading"><span className="section-label">{label}</span><p>{text}</p></div>{children}</div>;
}

function ControlSelect({ label, value, options, onChange }: { label: string; value: string; options: string[][]; onChange: (value: string) => void }) {
  const id = useId();
  return <div className="control-group"><label htmlFor={id}>{label}</label><select id={id} value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></div>;
}

function Range({ label, title, value, min, max, step, onChange }: { label: string; title?: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  const id = useId();
  return <div className="control-group"><label htmlFor={id} title={title}>{label}</label><input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></div>;
}

function RangeRow({ label, value, min, max, step, onChange, left = '', right = '' }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void; left?: string; right?: string }) {
  const id = useId();
  return <div className="range-row"><label htmlFor={id}>{label}</label><div className="range-control"><span aria-hidden="true">{left}</span><input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /><span aria-hidden="true">{right}</span></div></div>;
}

function Switch({ label, checked, onChange, className = 'control-group inline-control' }: { label: string; checked: boolean; onChange: (checked: boolean) => void; className?: string }) {
  const id = useId();
  return <div className={className}><label htmlFor={id}>{label}</label><span className="switch"><input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span className="slider round" /></span></div>;
}
