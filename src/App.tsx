import { createSignal, onMount, Show } from 'solid-js';
import Toolbar from './components/Toolbar';
import PianoRollCanvas from './components/PianoRollCanvas';
import CopyPasteWizard from './components/CopyPasteWizard';
import ClearWizard from './components/ClearWizard';
import { projectState } from './state/project';
import { play, pause, stop } from './engine/transport';
import { saveProject, loadProject, exportMp3 } from './tauri/commands';
import { initAudio, getSynthMode } from './engine/audio';
import { renderNoteSample, SAMPLE_RATE } from './engine/sampleCache';
import { rowToNoteName } from './constants';
import './App.css';

function App() {
  const [canvasWidth, setCanvasWidth] = createSignal(800);
  const [showCopyWizard, setShowCopyWizard] = createSignal(false);
  const [showClearWizard, setShowClearWizard] = createSignal(false);
  const [exporting, setExporting] = createSignal(false);
  const [exportCountdown, setExportCountdown] = createSignal('');
  let containerRef: HTMLDivElement | undefined;

  onMount(() => {
    if (containerRef) {
      const rect = containerRef.getBoundingClientRect();
      setCanvasWidth(rect.width);

      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setCanvasWidth(entry.contentRect.width);
        }
      });
      observer.observe(containerRef);
    }

    // Pre-warm audio on first user interaction
    const warmUp = () => {
      initAudio();
      window.removeEventListener('click', warmUp);
      window.removeEventListener('keydown', warmUp);
    };
    window.addEventListener('click', warmUp);
    window.addEventListener('keydown', warmUp);

    // Keyboard shortcuts
    window.addEventListener('keydown', handleKeyDown);
  });

  function handleKeyDown(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement) return;

    if (e.code === 'Space') {
      e.preventDefault();
      if (projectState.playbackState() === 'playing') {
        pause();
      } else {
        play(canvasWidth());
      }
    }
  }

  async function handleSave() {
    stop();
    const data = projectState.serialize();
    const path = await saveProject(data);
    if (path) console.log('Saved to', path);
  }

  async function handleLoad() {
    stop();
    const data = await loadProject();
    if (data) {
      projectState.deserialize(data);
    }
  }

  async function handleExport() {
    if (exporting()) return;
    try {
    setExporting(true);
    stop();
    await initAudio();

    const bpmVal = projectState.bpm();
    const maxCol = projectState.getMaxCol();
    if (maxCol === 0) {
      alert('No notes to export');
      return;
    }

    const sixteenthDuration = 60 / bpmVal / 4;
    const sustain = projectState.sustainEnabled();
    const tailTime = sustain ? 6 : 3;
    const totalDuration = (maxCol + 1) * sixteenthDuration + tailTime;
    const sampleRate = SAMPLE_RATE;

    const noteSet = projectState.notes();
    const regions = sustain ? projectState.sustainRegions() : [];
    const synthMode = getSynthMode();

    // Collect unique notes to render
    const uniqueNotes = new Set<string>();
    for (const [key] of noteSet) {
      const [col, row] = key.split(':').map(Number);
      const noteName = rowToNoteName(row);
      const isSustained = sustain && regions.some(r => col >= r.startCol && col <= r.endCol);
      uniqueNotes.add(`${isSustained ? 's' : 'd'}:${noteName}`);
    }

    // Render unique note samples (with progress)
    const totalSteps = uniqueNotes.size + 1; // +1 for mixing/encoding
    let step = 0;
    const updateProgress = () => {
      const pct = Math.round((step / totalSteps) * 100);
      setExportCountdown(`${pct}%`);
    };
    updateProgress();

    // Render each unique note sample
    const sampleMap = new Map<string, Float32Array>();
    for (const noteKey of uniqueNotes) {
      const [susFlag, noteName] = noteKey.split(':');
      const isSustained = susFlag === 's';
      const sample = await renderNoteSample(synthMode, isSustained, noteName);
      sampleMap.set(noteKey, sample);
      step++;
      updateProgress();
    }

    // Mix all notes into output buffer
    const totalSamples = Math.ceil(totalDuration * sampleRate);
    const mixBuffer = new Float32Array(totalSamples);

    for (const [key, data] of noteSet) {
      const [col, row] = key.split(':').map(Number);
      const noteName = rowToNoteName(row);
      const isSustained = sustain && regions.some(r => col >= r.startCol && col <= r.endCol);
      const sampleKey = `${isSustained ? 's' : 'd'}:${noteName}`;
      const sample = sampleMap.get(sampleKey);
      if (!sample) continue;

      const startSample = Math.round(col * sixteenthDuration * sampleRate);
      // How many samples to use from the pre-rendered note
      const noteDurationSamples = Math.round(data.length * sixteenthDuration * sampleRate);
      // Use the full sample but fade out at the note's end
      const fadeStart = Math.min(noteDurationSamples, sample.length);
      const fadeDuration = Math.round(0.1 * sampleRate); // 100ms fade

      for (let i = 0; i < sample.length && startSample + i < totalSamples; i++) {
        let gain = 1.0;
        if (i >= fadeStart) {
          // Fade out after note duration
          const fadeProgress = (i - fadeStart) / fadeDuration;
          if (fadeProgress >= 1) break;
          gain = 1.0 - fadeProgress;
        }
        mixBuffer[startSample + i] += sample[i] * gain;
      }
    }

    // Clamp
    for (let i = 0; i < mixBuffer.length; i++) {
      mixBuffer[i] = Math.max(-1, Math.min(1, mixBuffer[i]));
    }

    step++;
    updateProgress();

    const path = await exportMp3(mixBuffer, sampleRate);
    if (path) console.log('Exported to', path);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed: ' + err);
    } finally {
      setExporting(false);
      setExportCountdown('');
    }
  }

  return (
    <div class="app-container" ref={containerRef}>
      <div class="menu-bar">
        <div class="menu-group">
          <button class="menu-btn" onClick={handleSave}>Save</button>
          <button class="menu-btn" onClick={handleLoad}>Open</button>
          <button class="menu-btn" onClick={handleExport} disabled={exporting()}>
            {exporting() ? `Exporting (${exportCountdown()})` : 'Export MP3'}
          </button>
        </div>
        <div class="menu-divider" />
        <div class="menu-group">
          <button class="menu-btn" onClick={() => setShowCopyWizard(true)}>Copy/Paste</button>
          <button class="menu-btn" onClick={() => setShowClearWizard(true)}>Clear</button>
        </div>
        <span class="app-title">PianoPainter</span>
      </div>
      <Toolbar canvasWidth={canvasWidth} />
      <PianoRollCanvas />
      <Show when={showCopyWizard()}>
        <CopyPasteWizard onClose={() => setShowCopyWizard(false)} />
      </Show>
      <Show when={showClearWizard()}>
        <ClearWizard onClose={() => setShowClearWizard(false)} />
      </Show>
    </div>
  );
}

export default App;
