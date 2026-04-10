// Grid dimensions
export const CELL_WIDTH = 16;
export const CELL_HEIGHT = 14;
export const PIANO_LABEL_WIDTH = 52;
export const TOOLBAR_HEIGHT = 48;
export const SUSTAIN_ROW_HEIGHT = 20;
export const HEADER_HEIGHT = 22;

// Note range: C2 (row 0) to C7 (row 60) = 61 keys
export const TOTAL_ROWS = 61;
export const LOWEST_OCTAVE = 2;
export const HIGHEST_NOTE_ROW = 60; // C7

// Musical divisions
export const COLS_PER_BEAT = 4; // 16th notes per beat
export const BEATS_PER_MEASURE = 4;
export const COLS_PER_MEASURE = COLS_PER_BEAT * BEATS_PER_MEASURE; // 16

// Default settings
export const DEFAULT_BPM = 120;
export const DEFAULT_VOLUME = 0.8;

// Note names within an octave (bottom to top in piano roll = low to high)
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Which notes are "black keys" (sharps/flats)
export const BLACK_KEY_INDICES = new Set([1, 3, 6, 8, 10]); // C#, D#, F#, G#, A#

// Colors
export const COLORS = {
  background: '#FAF8F5',       // cream/off-white
  cellWhiteKey: '#FAF8F5',     // cream for white key rows
  cellBlackKey: '#EDEBE8',     // slightly darker for black key rows
  cellEnabled: '#4A90D9',      // blue for active notes
  cellEnabledHover: '#3A7BC8',
  gridLine: '#CCCCCC',         // thin grid lines
  beatLine: '#999999',         // beat boundary lines
  measureLine: '#666666',      // measure boundary lines
  playhead: 'rgba(255, 60, 60, 0.8)', // red playhead
  sustainRow: '#E8E4DF',       // sustain row background
  sustainActive: '#8BC34A',    // green for sustain regions
  headerBg: '#F0EDE8',
  headerText: '#666666',
  pianoWhiteKey: '#FFFFFF',
  pianoBlackKey: '#333333',
  pianoLabelText: '#333333',
  pianoLabelTextBlack: '#FFFFFF',
};

export const DEFAULT_NOTE_COLOR = '#4A90D9';

export const NOTE_COLORS: Array<{ value: string; label: string }> = [
  { value: '#4A90D9', label: 'Blue' },
  { value: '#E74C3C', label: 'Red' },
  { value: '#2ECC71', label: 'Green' },
  { value: '#F39C12', label: 'Orange' },
  { value: '#9B59B6', label: 'Purple' },
];

// Generate full note name for a row index
// Row 0 = C2 (lowest), Row 60 = C7 (highest)
export function rowToNoteName(row: number): string {
  const noteIndex = row % 12;
  const octave = LOWEST_OCTAVE + Math.floor(row / 12);
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

// Check if a row is a black key
export function isBlackKey(row: number): boolean {
  return BLACK_KEY_INDICES.has(row % 12);
}
