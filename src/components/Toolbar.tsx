import { createSignal, For } from 'solid-js';
import { projectState } from '../state/project';
import { play, pause, stop, updateBpm, updateVolume } from '../engine/transport';
import { setSynthMode, getSynthMode, type SynthMode } from '../engine/audio';
import { NOTE_COLORS } from '../constants';

export default function Toolbar(props: { canvasWidth: () => number }) {
  const [loading, setLoading] = createSignal(false);
  const [synthMode, setSynthModeLocal] = createSignal<SynthMode>(getSynthMode());

  function handleSynthChange(e: Event) {
    const mode = (e.target as HTMLSelectElement).value as SynthMode;
    setSynthModeLocal(mode);
    setSynthMode(mode);
  }

  async function handlePlay() {
    if (projectState.playbackState() === 'playing') {
      stop();
    }
    setLoading(true);
    await play(props.canvasWidth());
    setLoading(false);
  }

  function handleBpmChange(e: Event) {
    const val = parseInt((e.target as HTMLInputElement).value);
    if (!isNaN(val) && val > 0 && val <= 300) {
      updateBpm(val);
    }
  }

  function handleVolumeChange(e: Event) {
    const val = parseFloat((e.target as HTMLInputElement).value);
    updateVolume(val);
  }

  return (
    <div style={{
      display: 'flex',
      'align-items': 'center',
      gap: '12px',
      padding: '8px 16px',
      background: '#F5F3F0',
      'border-bottom': '1px solid #CCC',
      'min-height': '32px',
      'flex-shrink': '0',
    }}>
      {/* Transport Controls */}
      <div style={{ display: 'flex', gap: '4px' }}>
        <button
          onClick={handlePlay}
          disabled={loading()}
          style={buttonStyle()}
          title="Play"
        >
          {loading() ? '...' : '▶'}
        </button>
        <button
          onClick={() => pause()}
          disabled={projectState.playbackState() !== 'playing'}
          style={buttonStyle()}
          title="Pause"
        >
          ⏸
        </button>
        <button
          onClick={() => stop()}
          disabled={projectState.playbackState() === 'stopped'}
          style={buttonStyle()}
          title="Stop"
        >
          ⏹
        </button>
        <button
          onClick={async () => {
            const wasPlaying = projectState.playbackState() === 'playing';
            projectState.setStartMeasure(1);
            stop();
            if (wasPlaying) {
              await play(props.canvasWidth());
            }
          }}
          style={buttonStyle()}
          title="Return to start"
        >
          ⏮
        </button>
      </div>

      <div class="toolbar-divider" />

      {/* BPM */}
      <div style={{ display: 'flex', 'align-items': 'center', gap: '4px' }}>
        <label style={{ 'font-size': '12px', color: '#666' }}>BPM</label>
        <input
          type="number"
          min="20"
          max="300"
          value={projectState.bpm()}
          onInput={handleBpmChange}
          class="toolbar-input"
          style={{ width: '60px' }}
        />
      </div>

      {/* Volume */}
      <div style={{ display: 'flex', 'align-items': 'center', gap: '4px' }}>
        <label style={{ 'font-size': '12px', color: '#666' }}>Vol</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={projectState.volume()}
          onInput={handleVolumeChange}
          style={{ width: '80px' }}
        />
      </div>

      <div class="toolbar-divider" />

      {/* Sound */}
      <div style={{ display: 'flex', 'align-items': 'center', gap: '4px' }}>
        <label style={{ 'font-size': '12px', color: '#666' }}>Sound</label>
        <select
          value={synthMode()}
          onChange={handleSynthChange}
          class="toolbar-select"
        >
          <option value="basic">Basic</option>
          <option value="fm">FM Piano</option>
          <option value="multi">Rich Piano</option>
        </select>
      </div>

      {/* Sustain */}
      <div style={{ display: 'flex', 'align-items': 'center', gap: '4px' }}>
        <input
          type="checkbox"
          id="sustain-toggle"
          checked={projectState.sustainEnabled()}
          onChange={(e) => projectState.toggleSustain(e.currentTarget.checked)}
        />
        <label for="sustain-toggle" style={{ 'font-size': '12px', color: '#666', cursor: 'pointer' }}>Sustain</label>
      </div>

      <div class="toolbar-divider" />

      {/* Color */}
      <div style={{ display: 'flex', 'align-items': 'center', gap: '4px' }}>
        <div style={{
          width: '14px',
          height: '14px',
          'border-radius': '2px',
          background: projectState.activeColor(),
          border: '1px solid #999',
        }} />
        <select
          value={projectState.activeColor()}
          onChange={(e) => projectState.setActiveColor(e.currentTarget.value)}
          class="toolbar-select"
        >
          <For each={NOTE_COLORS}>{(c) =>
            <option value={c.value}>{c.label}</option>
          }</For>
        </select>
      </div>

      {/* Spacer */}
      <div style={{ flex: '1' }} />

      {/* Status */}
      <span style={{ 'font-size': '11px', color: '#999' }}>
        {projectState.playbackState() === 'playing' ? 'Playing' :
         projectState.playbackState() === 'paused' ? 'Paused' : 'Ready'}
      </span>
    </div>
  );
}

function buttonStyle() {
  return {
    padding: '4px 10px',
    border: '1px solid #CCC',
    'border-radius': '3px',
    background: '#FFF',
    cursor: 'pointer',
    'font-size': '14px',
    'min-width': '32px',
  };
}
