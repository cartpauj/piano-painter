import * as Tone from 'tone';
import { rowToNoteName, TOTAL_ROWS } from '../constants';
import { projectState } from '../state/project';
import { triggerNote } from './audio';
import type { SustainRegion } from '../types';

let part: Tone.Part | null = null;
let playheadInterval: number | null = null;
let onFinished: (() => void) | null = null;

export function setOnFinished(cb: () => void): void {
  onFinished = cb;
}

function isInSustainRegion(col: number, regions: SustainRegion[]): boolean {
  for (const r of regions) {
    if (col >= r.startCol && col <= r.endCol) return true;
  }
  return false;
}

export function startScheduler(fromCol: number = 0): void {
  stopScheduler();

  const maxCol = projectState.getMaxCol();
  const sustain = projectState.sustainEnabled();
  const regions = sustain ? projectState.sustainRegions() : [];

  // Pre-build note events starting from fromCol
  const events: Array<{ time: number; col: number; notes: Array<{ note: string; duration: number; sustained: boolean }> }> = [];

  for (let col = fromCol; col <= maxCol; col++) {
    const rows = projectState.getNotesInCol(col);
    if (rows.length === 0) continue;

    const sustained = sustain && isInSustainRegion(col, regions);

    const noteEvents = rows
      .filter(n => n.row >= 0 && n.row < TOTAL_ROWS)
      .map(n => {
        const noteName = rowToNoteName(n.row);
        const duration = Tone.Time('16n').toSeconds() * n.length;
        return { note: noteName, duration, sustained };
      });

    const time = (col - fromCol) * Tone.Time('16n').toSeconds();
    events.push({ time, col, notes: noteEvents });
  }

  part = new Tone.Part((time, value) => {
    projectState.setCurrentCol(value.col);
    projectState.markDirty();

    for (const n of value.notes) {
      triggerNote(n.note, n.duration, time, n.sustained);
    }
  }, events);

  part.start(0);

  // Update playhead position smoothly between note events
  playheadInterval = window.setInterval(() => {
    if (projectState.playbackState() !== 'playing') return;
    const transport = Tone.getTransport();
    const sixteenthSec = Tone.Time('16n').toSeconds();
    const col = fromCol + Math.floor(transport.seconds / sixteenthSec);
    projectState.setCurrentCol(col);
    projectState.markDirty();

    // Auto-stop after last note
    if (maxCol > 0 && col > maxCol) {
      if (onFinished) onFinished();
    }
  }, 30);
}

export function stopScheduler(): void {
  if (part) {
    part.dispose();
    part = null;
  }
  if (playheadInterval !== null) {
    clearInterval(playheadInterval);
    playheadInterval = null;
  }
}
