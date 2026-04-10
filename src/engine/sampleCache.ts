// import * as Tone from 'tone'; // disabled with auto-generation fallback
import { invoke } from '@tauri-apps/api/core';
// import { buildVoices } from './audio';
import type { SynthMode } from './audio';

const SAMPLE_DURATION = 5; // seconds
const SAMPLE_RATE = 44100;

// In-memory cache: "mode:sustained:noteName" -> Float32Array
const cache = new Map<string, Float32Array>();
let diskKeysLoaded = false;
let diskKeys = new Set<string>();

function cacheKey(mode: SynthMode, sustained: boolean, note: string): string {
  return `${mode}:${sustained ? 's' : 'd'}:${note}`;
}

// Disabled with auto-generation fallback
// function float32ToBase64(f32: Float32Array): string {
//   const i16 = new Int16Array(f32.length);
//   for (let i = 0; i < f32.length; i++) {
//     i16[i] = Math.max(-32768, Math.min(32767, Math.round(f32[i] * 32767)));
//   }
//   const bytes = new Uint8Array(i16.buffer);
//   let binary = '';
//   for (let i = 0; i < bytes.length; i += 8192) {
//     binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
//   }
//   return btoa(binary);
// }

function base64ToFloat32(b64: string): Float32Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const i16 = new Int16Array(bytes.buffer);
  const f32 = new Float32Array(i16.length);
  for (let i = 0; i < i16.length; i++) {
    f32[i] = i16[i] / 32767;
  }
  return f32;
}

async function loadDiskKeys(): Promise<void> {
  if (diskKeysLoaded) return;
  try {
    const keys = await invoke<string[]>('list_cached_samples');
    diskKeys = new Set(keys);
  } catch {
    diskKeys = new Set();
  }
  diskKeysLoaded = true;
}

async function loadFromDisk(key: string): Promise<Float32Array | null> {
  try {
    const b64 = await invoke<string | null>('load_sample', { key });
    if (!b64) return null;
    return base64ToFloat32(b64);
  } catch {
    return null;
  }
}

// Disabled with auto-generation fallback
// async function saveToDisk(key: string, pcm: Float32Array): Promise<void> {
//   try {
//     const b64 = float32ToBase64(pcm);
//     await invoke('save_sample', { key, pcmBase64: b64 });
//     diskKeys.add(key);
//   } catch (err) {
//     console.error('Failed to cache sample to disk:', err);
//   }
// }

export async function renderNoteSample(
  mode: SynthMode,
  sustained: boolean,
  noteName: string,
): Promise<Float32Array> {
  const key = cacheKey(mode, sustained, noteName);

  // Check memory cache
  const memCached = cache.get(key);
  if (memCached) return memCached;

  // Check disk cache
  await loadDiskKeys();
  if (diskKeys.has(key)) {
    const diskData = await loadFromDisk(key);
    if (diskData) {
      cache.set(key, diskData);
      return diskData;
    }
  }

  // Sample not found in bundled resources or cache — throw so we can diagnose
  throw new Error(`Pre-compiled sample not found for ${key}. Expected to find it in the bundled resources. Resource loading may have failed.`);

  // Auto-generation fallback disabled for debugging
  // const buffer = await Tone.Offline(({ transport }) => {
  //   const compressor = new Tone.Compressor({
  //     threshold: -18,
  //     ratio: 3,
  //     attack: 0.003,
  //     release: 0.25,
  //   }).toDestination();
  //   const vol = new Tone.Volume(0).connect(compressor);
  //
  //   const voices = buildVoices(mode, sustained, vol);
  //   const voice = voices[0];
  //
  //   transport.schedule((t: number) => {
  //     voice.trigger(noteName, SAMPLE_DURATION - 0.5, t);
  //   }, 0);
  //
  //   transport.start();
  // }, SAMPLE_DURATION, 1, SAMPLE_RATE);
  //
  // const pcm = buffer.getChannelData(0);
  // cache.set(key, pcm);
  // saveToDisk(key, pcm);
  //
  // return pcm;
}

export function clearCache(): void {
  cache.clear();
}

export { SAMPLE_DURATION, SAMPLE_RATE };
