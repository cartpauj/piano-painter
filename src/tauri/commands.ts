import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import type { ProjectData } from '../types';

export async function saveProject(data: ProjectData): Promise<string | null> {
  const filePath = await save({
    filters: [{ name: 'PianoPainter Project', extensions: ['pp'] }],
    defaultPath: 'untitled.pp',
  });

  if (!filePath) return null;

  await invoke('save_project', {
    path: filePath,
    data: JSON.stringify(data),
  });

  return filePath;
}

export async function loadProject(): Promise<ProjectData | null> {
  const filePath = await open({
    filters: [{ name: 'PianoPainter Project', extensions: ['pp'] }],
    multiple: false,
  });

  if (!filePath) return null;

  const json = await invoke<string>('load_project', { path: filePath });
  return JSON.parse(json) as ProjectData;
}

export async function exportMp3(samples: Float32Array, sampleRate: number): Promise<string | null> {
  const filePath = await save({
    filters: [{ name: 'MP3 Audio', extensions: ['mp3'] }],
    defaultPath: 'export.mp3',
  });

  if (!filePath) return null;

  // Convert f32 to i16 and encode as base64 for fast IPC
  const i16 = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    i16[i] = Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767)));
  }
  const bytes = new Uint8Array(i16.buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  const pcmBase64 = btoa(binary);

  await invoke('export_mp3', {
    path: filePath,
    pcmBase64,
    sampleRate,
  });

  return filePath;
}
