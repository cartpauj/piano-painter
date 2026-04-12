import { XMLParser } from 'fast-xml-parser';
import { readFileSync, writeFileSync } from 'fs';

const [,, input, output] = process.argv;
if (!input) { console.error('usage: node xml2pp.mjs <in.xml> [out.pp]'); process.exit(1); }
const out = output || input.replace(/\.(xml|musicxml)$/i, '.pp');

const xml = readFileSync(input, 'utf8');
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', isArray: (name) => ['part','measure','note'].includes(name) });
const doc = parser.parse(xml);

const STEP = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
const pitchToMidi = (step, octave, alter = 0) => (octave + 1) * 12 + STEP[step] + Number(alter || 0);

const RED = '#E74C3C', BLUE = '#4A90D9';
const COLS_PER_QUARTER = 4; // .pp uses 16th grid

let bpm = 100;
const soundTempo = xml.match(/tempo="([0-9.]+)"/);
if (soundTempo) bpm = Math.round(Number(soundTempo[1]));
const perMin = xml.match(/<per-minute>([0-9.]+)<\/per-minute>/);
if (perMin) bpm = Math.round(Number(perMin[1]));

const notes = [];
const parts = doc['score-partwise']?.part || [];

for (const part of parts) {
  let divisions = 256;
  let cursor = 0; // in quarter-note * 1 units? we'll track in divisions
  const voiceCursors = new Map(); // per-voice if needed
  let measureStart = 0;
  const measures = part.measure || [];

  for (const m of measures) {
    const children = [];
    // fast-xml-parser preserves order poorly by default; collect ordered list
    // Re-parse this measure preserving order:
    // Instead, handle in the order fast-xml-parser gives (it should preserve).
    // We'll iterate known element arrays/objects.
    // Rebuild ordered stream using #text? Simpler: use preserveOrder mode per-measure.
    children.push(m);
  }

  // Switch to preserveOrder for accurate sequencing
  const op = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', preserveOrder: true });
  // We need the raw XML for just this part; easier: reparse whole doc in preserveOrder and walk.
  // Do that once outside this loop — see below.
  break;
}

// --- Re-do with preserveOrder ---
notes.length = 0;
const op = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', preserveOrder: true });
const ordered = op.parse(xml);

// helper: get children array from preserveOrder node
const kids = (n, key) => (n[key] || []);
const textOf = (arr) => {
  if (!arr) return '';
  for (const item of arr) {
    if (item['#text'] !== undefined) return String(item['#text']);
  }
  return '';
};
const getChild = (arr, key) => arr?.find(x => x[key] !== undefined);
const getChildren = (arr, key) => (arr || []).filter(x => x[key] !== undefined);

// Walk to score-partwise
const root = ordered.find(x => x['score-partwise'])?.['score-partwise'] || [];

for (const partNode of getChildren(root, 'part')) {
  const partChildren = partNode.part;
  let divisions = 256;
  let cursor = 0; // in divisions
  let lastNoteCursor = 0;

  for (const mNode of getChildren(partChildren, 'measure')) {
    const mChildren = mNode.measure;
    for (const item of mChildren) {
      const key = Object.keys(item).find(k => k !== ':@');
      const v = item[key];

      if (key === 'attributes') {
        const divNode = getChild(v, 'divisions');
        if (divNode) divisions = Number(textOf(divNode.divisions));
      } else if (key === 'backup') {
        const d = Number(textOf(getChild(v, 'duration').duration));
        cursor -= d;
      } else if (key === 'forward') {
        const d = Number(textOf(getChild(v, 'duration').duration));
        cursor += d;
      } else if (key === 'direction') {
        // tempo in sound element
        const sound = getChild(v, 'sound');
        if (sound && item[':@']) {}
        // check :@ on sound
        for (const c of v) {
          if (c.sound && c[':@']?.tempo) bpm = Math.round(Number(c[':@'].tempo));
        }
      } else if (key === 'note') {
        const isChord = !!getChild(v, 'chord');
        const isRest = !!getChild(v, 'rest');
        const isGrace = !!getChild(v, 'grace');
        const durNode = getChild(v, 'duration');
        const duration = durNode ? Number(textOf(durNode.duration)) : 0;

        if (isGrace) {
          // skip grace notes for now
          continue;
        }

        const startCursor = isChord ? lastNoteCursor : cursor;

        if (!isRest) {
          const pitchNode = getChild(v, 'pitch');
          if (pitchNode) {
            const pitch = pitchNode.pitch;
            const step = textOf(getChild(pitch, 'step').step);
            const octave = Number(textOf(getChild(pitch, 'octave').octave));
            const alterNode = getChild(pitch, 'alter');
            const alter = alterNode ? Number(textOf(alterNode.alter)) : 0;
            const midi = pitchToMidi(step, octave, alter);
            const row = midi - 36; // C2 = 0
            const staffNode = getChild(v, 'staff');
            const staff = staffNode ? Number(textOf(staffNode.staff)) : (midi < 60 ? 2 : 1);
            const color = staff === 1 ? RED : BLUE;
            // convert divisions → 16th-note cols: 1 quarter = divisions; 1 sixteenth = divisions/4
            const col = Math.round(startCursor * COLS_PER_QUARTER / divisions);
            let length = Math.max(1, Math.round(duration * COLS_PER_QUARTER / divisions));
            if (row >= 0 && row <= 60) {
              notes.push({ col, row, color, length });
            }
          }
        }

        if (!isChord) {
          lastNoteCursor = cursor;
          cursor += duration;
        }
      }
    }
  }
}

if (notes.length === 0) { console.error('no notes parsed'); process.exit(1); }
const minCol = Math.min(...notes.map(n => n.col));
notes.forEach(n => { n.col -= minCol; });

const pp = { version: 1, bpm, volume: 0.8, sustainEnabled: true, synthMode: 'multi', notes, sustain: [{ startCol: 0, endCol: 9999 }] };
writeFileSync(out, JSON.stringify(pp));
console.log(`wrote ${out}: ${notes.length} notes, bpm=${bpm}`);
