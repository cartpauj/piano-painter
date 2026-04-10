import { createSignal, For } from 'solid-js';
import { projectState } from '../state/project';
import { NOTE_COLORS, COLS_PER_MEASURE } from '../constants';

interface Props {
  onClose: () => void;
}

export default function CopyPasteWizard(props: Props) {
  const [srcMeasure, setSrcMeasure] = createSignal(1);
  const [measureCount, setMeasureCount] = createSignal(4);
  const [destMeasure, setDestMeasure] = createSignal(5);
  const [selectedColors, setSelectedColors] = createSignal<Set<string>>(new Set(['all']));
  const [repeatCount, setRepeatCount] = createSignal(1);
  const [pasteMode, setPasteMode] = createSignal<'replace' | 'add'>('replace');

  function toggleColor(value: string) {
    setSelectedColors(prev => {
      const next = new Set(prev);
      if (value === 'all') {
        return new Set(['all']);
      }
      next.delete('all');
      if (next.has(value)) {
        next.delete(value);
        if (next.size === 0) return new Set(['all']);
      } else {
        next.add(value);
      }
      return next;
    });
  }

  function isColorSelected(value: string): boolean {
    return selectedColors().has(value);
  }

  function handleApply() {
    const srcStartCol = (srcMeasure() - 1) * COLS_PER_MEASURE;
    const srcEndCol = srcStartCol + measureCount() * COLS_PER_MEASURE - 1;
    const destStartCol = (destMeasure() - 1) * COLS_PER_MEASURE;
    const measCols = measureCount() * COLS_PER_MEASURE;
    const allColors = selectedColors().has('all');
    const filterColors = selectedColors();
    const repeats = repeatCount();

    const noteMap = projectState.notes();
    const newMap = new Map(noteMap);

    // Collect source notes that match the color filter
    const srcNotes: Array<{ colOffset: number; row: number; color: string; length: number }> = [];
    for (const [key, data] of noteMap) {
      const [col, row] = key.split(':').map(Number);
      if (col >= srcStartCol && col <= srcEndCol) {
        if (allColors || filterColors.has(data.color)) {
          srcNotes.push({ colOffset: col - srcStartCol, row, color: data.color, length: data.length });
        }
      }
    }

    // Paste for each repeat
    for (let r = 0; r < repeats; r++) {
      const pasteStartCol = destStartCol + r * measCols;
      const pasteEndCol = pasteStartCol + measCols - 1;

      // If replace mode, clear destination range
      if (pasteMode() === 'replace') {
        for (const key of [...newMap.keys()]) {
          const col = parseInt(key.split(':')[0]);
          if (col >= pasteStartCol && col <= pasteEndCol) {
            newMap.delete(key);
          }
        }
      }

      // Paste source notes
      for (const note of srcNotes) {
        const newKey = `${pasteStartCol + note.colOffset}:${note.row}`;
        newMap.set(newKey, { color: note.color, length: note.length });
      }
    }

    projectState.setNotes(newMap);
    projectState.markDirty();
    props.onClose();
  }

  return (
    <div class="wizard-overlay" onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
      <div class="wizard-panel">
        <div class="wizard-header">
          <span class="wizard-title">Copy & Paste Wizard</span>
          <button class="wizard-close" onClick={props.onClose}>X</button>
        </div>

        <div class="wizard-body">
          {/* Source */}
          <div class="wizard-section">
            <label class="wizard-label">Copy from</label>
            <div class="wizard-row">
              <span class="wizard-field-label">Start measure</span>
              <input
                type="number"
                min="1"
                value={srcMeasure()}
                onInput={(e) => setSrcMeasure(Math.max(1, parseInt(e.currentTarget.value) || 1))}
                class="wizard-input"
              />
            </div>
            <div class="wizard-row">
              <span class="wizard-field-label">Measure count</span>
              <input
                type="number"
                min="1"
                value={measureCount()}
                onInput={(e) => setMeasureCount(Math.max(1, parseInt(e.currentTarget.value) || 1))}
                class="wizard-input"
              />
            </div>
          </div>

          {/* Destination */}
          <div class="wizard-section">
            <label class="wizard-label">Paste into</label>
            <div class="wizard-row">
              <span class="wizard-field-label">Start measure</span>
              <input
                type="number"
                min="1"
                value={destMeasure()}
                onInput={(e) => setDestMeasure(Math.max(1, parseInt(e.currentTarget.value) || 1))}
                class="wizard-input"
              />
            </div>
            <div class="wizard-row">
              <span class="wizard-field-label">Repeat</span>
              <input
                type="number"
                min="1"
                value={repeatCount()}
                onInput={(e) => setRepeatCount(Math.max(1, parseInt(e.currentTarget.value) || 1))}
                class="wizard-input"
              />
            </div>
          </div>

          {/* Color filter */}
          <div class="wizard-section">
            <label class="wizard-label">Colors to copy</label>
            <div class="wizard-color-list">
              <label class="wizard-color-option">
                <input
                  type="checkbox"
                  checked={isColorSelected('all')}
                  onChange={() => toggleColor('all')}
                />
                <span>All colors</span>
              </label>
              <For each={NOTE_COLORS}>{(c) =>
                <label class="wizard-color-option">
                  <input
                    type="checkbox"
                    checked={isColorSelected(c.value)}
                    onChange={() => toggleColor(c.value)}
                  />
                  <div class="wizard-color-swatch" style={{ background: c.value }} />
                  <span>{c.label}</span>
                </label>
              }</For>
            </div>
          </div>

          {/* Paste mode */}
          <div class="wizard-section">
            <label class="wizard-label">Paste mode</label>
            <div class="wizard-row">
              <label class="wizard-radio">
                <input
                  type="radio"
                  name="pasteMode"
                  checked={pasteMode() === 'replace'}
                  onChange={() => setPasteMode('replace')}
                />
                <span>Replace (clear destination first)</span>
              </label>
            </div>
            <div class="wizard-row">
              <label class="wizard-radio">
                <input
                  type="radio"
                  name="pasteMode"
                  checked={pasteMode() === 'add'}
                  onChange={() => setPasteMode('add')}
                />
                <span>Add (keep existing notes)</span>
              </label>
            </div>
          </div>
        </div>

        <div class="wizard-footer">
          <button class="wizard-btn wizard-btn-cancel" onClick={props.onClose}>Cancel</button>
          <button class="wizard-btn wizard-btn-apply" onClick={handleApply}>Apply</button>
        </div>
      </div>
    </div>
  );
}
