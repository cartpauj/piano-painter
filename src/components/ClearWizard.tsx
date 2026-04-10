import { createSignal } from 'solid-js';
import { projectState } from '../state/project';
import { stop } from '../engine/transport';
import { COLS_PER_MEASURE } from '../constants';

interface Props {
  onClose: () => void;
}

export default function ClearWizard(props: Props) {
  const [mode, setMode] = createSignal<'all' | 'range'>('all');
  const [startMeasure, setStartMeasure] = createSignal(1);
  const [measureCount, setMeasureCount] = createSignal(4);

  function handleApply() {
    stop();

    if (mode() === 'all') {
      projectState.clearAll();
    } else {
      const startCol = (startMeasure() - 1) * COLS_PER_MEASURE;
      const endCol = startCol + measureCount() * COLS_PER_MEASURE - 1;
      const noteMap = projectState.notes();
      const newMap = new Map(noteMap);

      for (const key of noteMap.keys()) {
        const col = parseInt(key.split(':')[0]);
        if (col >= startCol && col <= endCol) {
          newMap.delete(key);
        }
      }

      projectState.setNotes(newMap);
      projectState.markDirty();
    }

    props.onClose();
  }

  return (
    <div class="wizard-overlay" onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
      <div class="wizard-panel">
        <div class="wizard-header">
          <span class="wizard-title">Clear Notes</span>
          <button class="wizard-close" onClick={props.onClose}>X</button>
        </div>

        <div class="wizard-body">
          <div class="wizard-section">
            <div class="wizard-row">
              <label class="wizard-radio">
                <input
                  type="radio"
                  name="clearMode"
                  checked={mode() === 'all'}
                  onChange={() => setMode('all')}
                />
                <span>Clear all notes</span>
              </label>
            </div>
            <div class="wizard-row">
              <label class="wizard-radio">
                <input
                  type="radio"
                  name="clearMode"
                  checked={mode() === 'range'}
                  onChange={() => setMode('range')}
                />
                <span>Clear a range of measures</span>
              </label>
            </div>
          </div>

          {mode() === 'range' && (
            <div class="wizard-section">
              <div class="wizard-row">
                <span class="wizard-field-label">Start measure</span>
                <input
                  type="number"
                  min="1"
                  value={startMeasure()}
                  onInput={(e) => setStartMeasure(Math.max(1, parseInt(e.currentTarget.value) || 1))}
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
          )}
        </div>

        <div class="wizard-footer">
          <button class="wizard-btn wizard-btn-cancel" onClick={props.onClose}>Cancel</button>
          <button class="wizard-btn wizard-btn-apply" onClick={handleApply}>Clear</button>
        </div>
      </div>
    </div>
  );
}
