import pkg from '@tonejs/midi';
const { Midi } = pkg;
import { readFileSync, writeFileSync } from 'fs';

const [,, input, output] = process.argv;
if (!input) { console.error('usage: node mid2pp.mjs <in.mid> [out.pp]'); process.exit(1); }
const out = output || input.replace(/\.midi?$/i, '.pp');

const midi = new Midi(readFileSync(input));
const bpm = Math.round(midi.header.tempos[0]?.bpm ?? 120);

// .pp grid: 16th notes, COLS_PER_BEAT = 4. So col = ticks * 4 / PPQ.
// Row: C2 (MIDI 36) = row 0, C7 (MIDI 96) = row 60. row = midi - 36.
const ppq = midi.header.ppq;
const ticksToCol = t => Math.round(t * 4 / ppq);

const RED = '#E74C3C';   // treble / RH
const BLUE = '#4A90D9';  // bass / LH

const notes = [];
midi.tracks.forEach((track, ti) => {
  // Heuristic: split hands by average pitch if multi-track; otherwise by midi < 60
  track.notes.forEach(n => {
    const row = n.midi - 36;
    if (row < 0 || row > 60) return; // out of range, clip
    const col = ticksToCol(n.ticks);
    let length = ticksToCol(n.durationTicks);
    if (length < 1) length = 1;
    const color = n.midi < 60 ? BLUE : RED;
    notes.push({ col, row, color, length });
  });
});

// Normalize: shift so first col = 0
const minCol = Math.min(...notes.map(n => n.col));
notes.forEach(n => { n.col -= minCol; });

const pp = {
  version: 1,
  bpm,
  volume: 0.8,
  sustainEnabled: true,
  synthMode: 'multi',
  notes,
  sustain: [{ startCol: 0, endCol: 9999 }],
};

writeFileSync(out, JSON.stringify(pp));
const clipped = midi.tracks.flatMap(t => t.notes).filter(n => n.midi - 36 < 0 || n.midi - 36 > 60).length;
console.log(`wrote ${out}: ${notes.length} notes, bpm=${bpm}, ppq=${ppq}${clipped ? `, ${clipped} notes out of C2-C7 range clipped` : ''}`);
