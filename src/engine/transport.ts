import * as Tone from 'tone';
import { projectState } from '../state/project';
import { initAudio, setVolume, silenceAll } from './audio';
import { startScheduler, stopScheduler, setOnFinished } from './scheduler';
import { CELL_WIDTH, PIANO_LABEL_WIDTH, COLS_PER_MEASURE } from '../constants';
import { colToX } from '../canvas/viewport';

let animFrameId: number | null = null;

function scrollToPlayhead(canvasWidth: number): void {
  const col = projectState.currentCol();
  const scrollX = projectState.scrollX();
  const x = colToX(col, scrollX);

  // If playhead is off-screen (left or right), center it
  if (x < PIANO_LABEL_WIDTH || x > canvasWidth - 50) {
    projectState.setScrollX(Math.max(0, col * CELL_WIDTH - (canvasWidth - PIANO_LABEL_WIDTH) / 3));
    projectState.markDirty();
  }
}

function autoScrollToPlayhead(canvasWidth: number): void {
  const col = projectState.currentCol();
  const scrollX = projectState.scrollX();
  const x = colToX(col, scrollX);
  const rightEdge = canvasWidth - 100;

  if (x > rightEdge) {
    projectState.setScrollX(col * CELL_WIDTH - (canvasWidth - PIANO_LABEL_WIDTH) / 2);
    projectState.markDirty();
  }
}

export async function play(canvasWidth: number): Promise<void> {
  await initAudio();
  setVolume(projectState.volume());

  const transport = Tone.getTransport();
  transport.bpm.value = projectState.bpm();

  if (projectState.playbackState() === 'paused') {
    // Scroll to show the paused playhead position
    scrollToPlayhead(canvasWidth);
    transport.start();
    projectState.setPlaybackState('playing');
  } else {
    transport.stop();
    const startCol = (projectState.startMeasure() - 1) * COLS_PER_MEASURE;
    transport.position = 0;
    projectState.setCurrentCol(startCol);
    // Scroll to the start position
    projectState.setScrollX(Math.max(0, startCol * CELL_WIDTH - 50));
    projectState.markDirty();
    setOnFinished(() => stop());
    startScheduler(startCol);
    transport.start('+0.1');
    projectState.setPlaybackState('playing');
  }

  // Start animation loop for auto-scroll
  function tick() {
    if (projectState.playbackState() === 'playing') {
      autoScrollToPlayhead(canvasWidth);
      animFrameId = requestAnimationFrame(tick);
    }
  }
  tick();
}

export function pause(): void {
  Tone.getTransport().pause();
  silenceAll();
  projectState.setPlaybackState('paused');
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}

export function stop(): void {
  const transport = Tone.getTransport();
  transport.stop();
  transport.position = 0;
  stopScheduler();
  silenceAll();
  const startCol = (projectState.startMeasure() - 1) * COLS_PER_MEASURE;
  projectState.setCurrentCol(startCol);
  projectState.setScrollX(startCol * CELL_WIDTH);
  projectState.setPlaybackState('stopped');
  projectState.markDirty();
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}

export function updateBpm(bpm: number): void {
  projectState.setBpm(bpm);
  Tone.getTransport().bpm.value = bpm;
}

export function updateVolume(vol: number): void {
  projectState.setVolume(vol);
  setVolume(vol);
}
