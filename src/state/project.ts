import { createSignal, batch } from 'solid-js';
import { DEFAULT_BPM, DEFAULT_VOLUME, DEFAULT_NOTE_COLOR } from '../constants';
import { getSynthMode, setSynthMode, type SynthMode } from '../engine/audio';
import type { SustainRegion, ProjectData, PlaybackState } from '../types';

export interface NoteData {
  color: string;
  length: number; // in cells (1 = single tap)
}

// Notes stored as Map of "col:row" -> NoteData
const [notes, setNotes] = createSignal<Map<string, NoteData>>(new Map());
const [sustainRegions, setSustainRegions] = createSignal<SustainRegion[]>([]);
const [bpm, setBpm] = createSignal(DEFAULT_BPM);
const [volume, setVolume] = createSignal(DEFAULT_VOLUME);
const [playbackState, setPlaybackState] = createSignal<PlaybackState>('stopped');
const [currentCol, setCurrentCol] = createSignal(0);
const [scrollX, setScrollX] = createSignal(0);
const [scrollY, setScrollY] = createSignal(0);
const [sustainEnabled, setSustainEnabled] = createSignal(false);
const [startMeasure, setStartMeasure] = createSignal(1);
const [activeColor, setActiveColor] = createSignal(DEFAULT_NOTE_COLOR);
const [dirty, setDirty] = createSignal(0);

function toggleSustain(on: boolean) {
  setSustainEnabled(on);
  if (on && sustainRegions().length === 0) {
    // Default: pedal down for the whole song
    setSustainRegions([{ startCol: 0, endCol: 9999 }]);
  }
  markDirty();
}

function markDirty() {
  setDirty(d => d + 1);
}

function noteKey(col: number, row: number): string {
  return `${col}:${row}`;
}

function toggleNote(col: number, row: number): void {
  const key = noteKey(col, row);
  setNotes(prev => {
    const next = new Map(prev);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.set(key, { color: activeColor(), length: 1 });
    }
    return next;
  });
  markDirty();
}

function placeNote(col: number, row: number, length: number): void {
  const key = noteKey(col, row);
  setNotes(prev => {
    const next = new Map(prev);
    // Remove any notes that overlap with this range on the same row
    for (let c = col; c < col + length; c++) {
      const k = noteKey(c, row);
      if (k !== key && next.has(k)) {
        next.delete(k);
      }
    }
    next.set(key, { color: activeColor(), length });
    return next;
  });
  markDirty();
}

function hasNote(col: number, row: number): boolean {
  return notes().has(noteKey(col, row));
}

function getNoteData(col: number, row: number): NoteData | undefined {
  return notes().get(noteKey(col, row));
}

// Check if a cell is covered by any note (including multi-cell notes starting earlier)
function isCellOccupied(col: number, row: number): boolean {
  const n = notes();
  // Check if there's a note starting at this exact cell
  if (n.has(noteKey(col, row))) return true;
  // Check if a note starting in a previous column covers this cell
  for (let c = col - 1; c >= Math.max(0, col - 64); c--) {
    const data = n.get(noteKey(c, row));
    if (data && c + data.length > col) return true;
    if (data) break; // found a note that doesn't reach, stop looking
  }
  return false;
}

// Find the starting column of a held note that covers this cell (returns null if none)
function findNoteStart(col: number, row: number): number | null {
  const n = notes();
  for (let c = col - 1; c >= Math.max(0, col - 64); c--) {
    const data = n.get(noteKey(c, row));
    if (data && c + data.length > col) return c;
    if (data) break;
  }
  return null;
}

function getNotesInCol(col: number): Array<{ row: number; length: number }> {
  const result: Array<{ row: number; length: number }> = [];
  const n = notes();
  for (const [key, data] of n) {
    const [c, r] = key.split(':').map(Number);
    if (c === col) result.push({ row: r, length: data.length });
  }
  return result;
}

function clearAll(): void {
  batch(() => {
    setNotes(new Map<string, NoteData>());
    setSustainRegions([]);
    setCurrentCol(0);
    setPlaybackState('stopped');
    markDirty();
  });
}

function serialize(): ProjectData {
  const noteArray: Array<{ col: number; row: number; color?: string; length?: number }> = [];
  for (const [key, data] of notes()) {
    const [col, row] = key.split(':').map(Number);
    const entry: { col: number; row: number; color: string; length?: number } = { col, row, color: data.color };
    if (data.length > 1) entry.length = data.length;
    noteArray.push(entry);
  }
  return {
    version: 1,
    bpm: bpm(),
    volume: volume(),
    sustainEnabled: sustainEnabled(),
    synthMode: getSynthMode(),
    notes: noteArray,
    sustain: sustainRegions(),
  };
}

function deserialize(data: ProjectData): void {
  batch(() => {
    const noteMap = new Map<string, NoteData>();
    for (const n of data.notes) {
      noteMap.set(noteKey(n.col, n.row), {
        color: n.color || DEFAULT_NOTE_COLOR,
        length: n.length || 1,
      });
    }
    setNotes(() => noteMap);
    setSustainRegions(data.sustain || []);
    setBpm(data.bpm || DEFAULT_BPM);
    setVolume(data.volume ?? DEFAULT_VOLUME);
    setSustainEnabled(data.sustainEnabled ?? false);
    if (data.synthMode) setSynthMode(data.synthMode as SynthMode);
    setCurrentCol(0);
    setPlaybackState('stopped');
    setScrollX(0);
    setScrollY(99999); // will be clamped to max by canvas
    markDirty();
  });
}

function getMaxCol(): number {
  let max = 0;
  for (const [key, data] of notes()) {
    const col = parseInt(key.split(':')[0]);
    const end = col + data.length - 1;
    if (end > max) max = end;
  }
  return max;
}

export const projectState = {
  notes,
  setNotes,
  sustainRegions,
  setSustainRegions,
  bpm,
  setBpm,
  volume,
  setVolume,
  playbackState,
  setPlaybackState,
  currentCol,
  setCurrentCol,
  scrollX,
  setScrollX,
  scrollY,
  setScrollY,
  sustainEnabled,
  setSustainEnabled,
  toggleSustain,
  startMeasure,
  setStartMeasure,
  activeColor,
  setActiveColor,
  dirty,
  markDirty,
  toggleNote,
  placeNote,
  hasNote,
  getNoteData,
  isCellOccupied,
  findNoteStart,
  getNotesInCol,
  clearAll,
  serialize,
  deserialize,
  getMaxCol,
};
