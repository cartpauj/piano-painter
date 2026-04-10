import * as Tone from 'tone';

const VOICE_COUNT = 16;

export type SynthMode = 'basic' | 'fm' | 'multi';

interface Voice {
  trigger(note: string, duration: number, time: number): void;
  dispose(): void;
}

let dryVoices: Voice[] = [];
let sustainVoices: Voice[] = [];
let volumeNode: Tone.Volume | null = null;
let reverb: Tone.Reverb | null = null;
let compressor: Tone.Compressor | null = null;
let isLoaded = false;
let nextDryVoice = 0;
let nextSusVoice = 0;
let currentMode: SynthMode = 'multi';

// --- Basic voice ---
function createBasicVoice(dest: Tone.ToneAudioNode, sustain: boolean): Voice {
  const synth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: {
      attack: 0.005,
      decay: sustain ? 2.0 : 0.3,
      sustain: sustain ? 0.35 : 0.4,
      release: sustain ? 4.0 : 1.2,
    },
  }).connect(dest);

  return {
    trigger(note, duration, time) {
      synth.triggerAttackRelease(note, duration, time);
    },
    dispose() { synth.dispose(); },
  };
}

// --- FM voice ---
function createFMVoice(dest: Tone.ToneAudioNode, sustain: boolean): Voice {
  const synth = new Tone.FMSynth({
    harmonicity: 3,
    modulationIndex: 14,
    oscillator: { type: 'sine' },
    envelope: {
      attack: 0.001,
      decay: sustain ? 4.0 : 1.4,
      sustain: sustain ? 0.2 : 0.08,
      release: sustain ? 3.5 : 1.2,
    },
    modulation: { type: 'square' },
    modulationEnvelope: {
      attack: 0.002,
      decay: sustain ? 3.0 : 0.8,
      sustain: sustain ? 0.2 : 0.1,
      release: sustain ? 2.0 : 0.5,
    },
  }).connect(dest);

  return {
    trigger(note, duration, time) {
      synth.triggerAttackRelease(note, duration, time);
    },
    dispose() { synth.dispose(); },
  };
}

// --- Multi-oscillator voice ---
function createMultiVoice(dest: Tone.ToneAudioNode, sustain: boolean): Voice {
  const body = new Tone.Synth({
    oscillator: {
      type: 'custom' as const,
      partials: [1, 0.7, 0.4, 0.2, 0.12, 0.06, 0.03, 0.015],
    },
    envelope: {
      attack: 0.003,
      decay: sustain ? 5.0 : 1.8,
      sustain: sustain ? 0.2 : 0.05,
      release: sustain ? 4.0 : 1.5,
    },
    volume: -3,
  }).connect(dest);

  const hammer = new Tone.Synth({
    oscillator: {
      type: 'custom' as const,
      partials: [0.2, 0.4, 0.6, 0.8, 1, 0.9, 0.7, 0.5, 0.3, 0.15],
    },
    envelope: {
      attack: 0.001,
      decay: 0.08,
      sustain: 0.0,
      release: 0.05,
    },
    volume: -12,
  }).connect(dest);

  const sympathetic = new Tone.Synth({
    oscillator: {
      type: 'custom' as const,
      partials: [1, 0.5, 0.25, 0.12],
    },
    envelope: {
      attack: 0.01,
      decay: sustain ? 6.0 : 2.0,
      sustain: sustain ? 0.12 : 0.03,
      release: sustain ? 5.0 : 2.0,
    },
    volume: -18,
  }).connect(dest);

  sympathetic.detune.value = 3;

  return {
    trigger(note, duration, time) {
      body.triggerAttackRelease(note, duration, time);
      hammer.triggerAttackRelease(note, duration, time);
      sympathetic.triggerAttackRelease(note, duration, time);
    },
    dispose() {
      body.dispose();
      hammer.dispose();
      sympathetic.dispose();
    },
  };
}

export function buildVoices(mode: SynthMode, sustain: boolean, dest: Tone.ToneAudioNode): Voice[] {
  const pool: Voice[] = [];
  const factory = mode === 'basic' ? createBasicVoice
    : mode === 'fm' ? createFMVoice
    : createMultiVoice;

  for (let i = 0; i < VOICE_COUNT; i++) {
    pool.push(factory(dest, sustain));
  }
  return pool;
}

function rebuildAllVoices(): void {
  for (const v of dryVoices) v.dispose();
  for (const v of sustainVoices) v.dispose();
  dryVoices = [];
  sustainVoices = [];
  nextDryVoice = 0;
  nextSusVoice = 0;

  if (volumeNode) {
    dryVoices = buildVoices(currentMode, false, volumeNode);
    sustainVoices = buildVoices(currentMode, true, volumeNode);
  }
}

export async function initAudio(): Promise<void> {
  if (isLoaded) return;

  Tone.setContext(new Tone.Context({ latencyHint: 'playback' }));
  await Tone.start();

  reverb = new Tone.Reverb({ decay: 1.8, wet: 0.18 }).toDestination();
  await reverb.ready;
  compressor = new Tone.Compressor({
    threshold: -18,
    ratio: 3,
    attack: 0.003,
    release: 0.25,
  }).connect(reverb);
  volumeNode = new Tone.Volume(0).connect(compressor);

  rebuildAllVoices();
  isLoaded = true;
}

export function setSynthMode(mode: SynthMode): void {
  if (mode === currentMode && dryVoices.length > 0) return;
  currentMode = mode;
  rebuildAllVoices();
}

export function getSynthMode(): SynthMode {
  return currentMode;
}

export function setSustainMode(_on: boolean): void {
  // No-op now — both pools are always built
}

export function triggerNote(note: string, duration: number, time: number, sustained: boolean = false): void {
  if (sustained && sustainVoices.length > 0) {
    const voice = sustainVoices[nextSusVoice % VOICE_COUNT];
    nextSusVoice++;
    voice.trigger(note, duration, time);
  } else if (dryVoices.length > 0) {
    const voice = dryVoices[nextDryVoice % VOICE_COUNT];
    nextDryVoice++;
    voice.trigger(note, duration, time);
  }
}

export function silenceAll(): void {
  // Dispose voices and the old volume node (cuts off everything including reverb tail)
  for (const v of dryVoices) v.dispose();
  for (const v of sustainVoices) v.dispose();
  dryVoices = [];
  sustainVoices = [];
  nextDryVoice = 0;
  nextSusVoice = 0;

  // Replace volume node to sever connection to old reverb tail
  if (volumeNode && compressor) {
    volumeNode.dispose();
    volumeNode = new Tone.Volume(0).connect(compressor);
    dryVoices = buildVoices(currentMode, false, volumeNode);
    sustainVoices = buildVoices(currentMode, true, volumeNode);
  }
}

export function setVolume(value: number): void {
  if (volumeNode) {
    const db = value <= 0 ? -Infinity : 20 * Math.log10(value);
    volumeNode.volume.value = db;
  }
}
