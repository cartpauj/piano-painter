import { renderNoteSample } from './sampleCache';
import { rowToNoteName, TOTAL_ROWS } from '../constants';
import type { SynthMode } from './audio';

export async function generateAllSamples(
  onProgress: (done: number, total: number) => void
): Promise<void> {
  const modes: SynthMode[] = ['basic', 'fm', 'multi'];
  const sustainStates = [false, true];
  const total = TOTAL_ROWS * modes.length * sustainStates.length;
  let done = 0;

  for (const mode of modes) {
    for (const sustained of sustainStates) {
      for (let row = 0; row < TOTAL_ROWS; row++) {
        const noteName = rowToNoteName(row);
        await renderNoteSample(mode, sustained, noteName);
        done++;
        onProgress(done, total);
      }
    }
  }
}
