import { TOTAL_ROWS, PIANO_LABEL_WIDTH, HEADER_HEIGHT, CELL_HEIGHT, SUSTAIN_ROW_HEIGHT, COLS_PER_MEASURE, rowToNoteName } from '../constants';
import { xToCol, yToRow, getMaxScrollY } from './viewport';
import { projectState } from '../state/project';
import { initAudio, triggerNote } from '../engine/audio';
import * as Tone from 'tone';

let isDraggingSustain = false;
let sustainDragStartCol = -1;
let canvasHeight = 0;

// Note drag state
let isDraggingNote = false;
let noteDragStartCol = -1;
let noteDragRow = -1;
let noteDragCurrentCol = -1;
let noteDragMaxCol = -1;
export function setCanvasHeight(h: number): void {
  canvasHeight = h;
}

export function handleMouseDown(e: MouseEvent, canvas: HTMLCanvasElement): void {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (x < PIANO_LABEL_WIDTH) return;

  const scrollX = projectState.scrollX();
  const scrollY = projectState.scrollY();
  const col = xToCol(x, scrollX);
  if (col < 0) return;

  const gridBottom = HEADER_HEIGHT + TOTAL_ROWS * CELL_HEIGHT - scrollY;

  // Check if clicking in sustain row (only when sustain is enabled)
  if (projectState.sustainEnabled() && y >= gridBottom && y <= gridBottom + SUSTAIN_ROW_HEIGHT) {
    isDraggingSustain = true;
    sustainDragStartCol = col;
    return;
  }

  // Check if clicking in header — select start measure
  if (y < HEADER_HEIGHT) {
    const measure = Math.floor(col / COLS_PER_MEASURE) + 1;
    projectState.setStartMeasure(measure);
    projectState.markDirty();
    return;
  }

  const row = yToRow(y, scrollY);
  if (row < 0 || row >= TOTAL_ROWS) return;

  // If there's a note starting at this cell, remove it
  if (projectState.hasNote(col, row)) {
    projectState.toggleNote(col, row);
    isDraggingNote = false;
    return;
  }

  // If cell is covered by a held note from an earlier column, find and remove it
  const parentCol = projectState.findNoteStart(col, row);
  if (parentCol !== null) {
    projectState.toggleNote(parentCol, row);
    isDraggingNote = false;
    return;
  }

  // Start a note drag
  isDraggingNote = true;
  noteDragStartCol = col;
  noteDragRow = row;
  noteDragCurrentCol = col;

  // Pre-compute max draggable column (stop before any existing note on this row)
  noteDragMaxCol = col + 1024;
  const noteMap = projectState.notes();
  for (const [key] of noteMap) {
    const [c, r] = key.split(':').map(Number);
    if (r !== row) continue;
    if (c > col && c < noteDragMaxCol) {
      noteDragMaxCol = c - 1;
    }
  }

  // Place a single cell note immediately (will be resized on drag)
  projectState.placeNote(col, row, 1);

  // Play the note preview
  initAudio().then(() => {
    triggerNote(rowToNoteName(row), 0.3, Tone.now());
  });
}

export function handleMouseMove(e: MouseEvent, canvas: HTMLCanvasElement): void {
  if (!isDraggingNote) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const scrollX = projectState.scrollX();
  let col = xToCol(x, scrollX);
  if (col < noteDragStartCol) col = noteDragStartCol;
  if (col > noteDragMaxCol) col = noteDragMaxCol;

  if (col !== noteDragCurrentCol) {
    noteDragCurrentCol = col;
    const length = col - noteDragStartCol + 1;
    projectState.placeNote(noteDragStartCol, noteDragRow, length);
  }
}

export function handleMouseUp(e: MouseEvent, canvas: HTMLCanvasElement): void {
  if (isDraggingNote) {
    isDraggingNote = false;
    noteDragStartCol = -1;
    noteDragRow = -1;
    noteDragCurrentCol = -1;
    return;
  }

  if (isDraggingSustain) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const scrollX = projectState.scrollX();
    const endCol = Math.max(0, xToCol(x, scrollX));

    const startCol = Math.min(sustainDragStartCol, endCol);
    const finalEndCol = Math.max(sustainDragStartCol, endCol);

    const existing = projectState.sustainRegions();
    const overlapping = existing.filter(r =>
      !(r.endCol < startCol || r.startCol > finalEndCol)
    );

    if (overlapping.length > 0 && startCol === finalEndCol) {
      projectState.setSustainRegions(
        existing.filter(r => !overlapping.includes(r))
      );
    } else {
      let mergedStart = startCol;
      let mergedEnd = finalEndCol;
      for (const r of overlapping) {
        mergedStart = Math.min(mergedStart, r.startCol);
        mergedEnd = Math.max(mergedEnd, r.endCol);
      }
      const remaining = existing.filter(r => !overlapping.includes(r));
      remaining.push({ startCol: mergedStart, endCol: mergedEnd });
      projectState.setSustainRegions(remaining);
    }

    isDraggingSustain = false;
    sustainDragStartCol = -1;
    projectState.markDirty();
  }

}

export function handleWheel(e: WheelEvent): void {
  e.preventDefault();

  if (e.shiftKey) {
    const delta = e.deltaY;
    projectState.setScrollX(prev => Math.max(0, prev + delta));
  } else {
    const maxY = getMaxScrollY(canvasHeight);
    projectState.setScrollY(prev => Math.max(0, Math.min(maxY, prev + e.deltaY)));
  }

  if (e.deltaX !== 0) {
    projectState.setScrollX(prev => Math.max(0, prev + e.deltaX));
  }

  projectState.markDirty();
}
