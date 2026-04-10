import { onMount, onCleanup, createEffect } from 'solid-js';
import { render } from '../canvas/renderer';
import { handleMouseDown, handleMouseUp, handleWheel, handleMouseMove, setCanvasHeight } from '../canvas/interaction';
import { CELL_WIDTH, CELL_HEIGHT, TOTAL_ROWS, HEADER_HEIGHT, SUSTAIN_ROW_HEIGHT } from '../constants';
import { getMaxScrollY } from '../canvas/viewport';
import { projectState } from '../state/project';


export default function PianoRollCanvas() {
  let canvas: HTMLCanvasElement | undefined;
  let scrollbarRef: HTMLInputElement | undefined;
  let resizeObserver: ResizeObserver | undefined;
  let blinkAnimId: number | null = null;

  function draw() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    render(ctx, canvas.width, canvas.height);
  }

  function resize() {
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = parent.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
    setCanvasHeight(rect.height);
    projectState.markDirty();
  }

  onMount(() => {
    if (!canvas) return;
    resize();

    // Scroll to show the lowest rows at the bottom of the screen
    const parent = canvas.parentElement;
    if (parent) {
      const canvasH = parent.getBoundingClientRect().height;
      const totalH = HEADER_HEIGHT + TOTAL_ROWS * CELL_HEIGHT + SUSTAIN_ROW_HEIGHT;
      projectState.setScrollY(Math.max(0, totalH - canvasH));
      projectState.markDirty();
    }

    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(canvas.parentElement!);

    canvas.addEventListener('mousedown', (e) => handleMouseDown(e, canvas!));
    canvas.addEventListener('mouseup', (e) => handleMouseUp(e, canvas!));
    canvas.addEventListener('mousemove', (e) => handleMouseMove(e, canvas!));
    canvas.addEventListener('wheel', handleWheel, { passive: false });
  });

  onCleanup(() => {
    resizeObserver?.disconnect();
    if (blinkAnimId) cancelAnimationFrame(blinkAnimId);
  });

  // Redraw when dirty flag changes and sync scrollbar
  createEffect(() => {
    projectState.dirty();
    requestAnimationFrame(() => {
      // Clamp scrollY to valid range
      const parent = canvas?.parentElement;
      if (parent) {
        const maxY = getMaxScrollY(parent.getBoundingClientRect().height);
        if (projectState.scrollY() > maxY) {
          projectState.setScrollY(maxY);
        }
      }
      draw();
      if (scrollbarRef) {
        scrollbarRef.max = String(getScrollMax());
        scrollbarRef.value = String(projectState.scrollX());
      }
    });
  });

  // Blink animation loop for paused/stopped playhead
  createEffect(() => {
    const state = projectState.playbackState();
    projectState.currentCol(); // track dependency

    if (blinkAnimId) {
      cancelAnimationFrame(blinkAnimId);
      blinkAnimId = null;
    }

    if (state !== 'playing') {
      function blinkLoop() {
        draw();
        blinkAnimId = requestAnimationFrame(blinkLoop);
      }
      blinkLoop();
    }
  });

  function handleScrollbar(e: Event) {
    const target = e.target as HTMLInputElement;
    projectState.setScrollX(parseInt(target.value));
    projectState.markDirty();
  }

  function getScrollMax() {
    const maxCol = projectState.getMaxCol();
    // 1 measure buffer beyond the last note, minimum 2 measures total
    const minCols = Math.max(2 * 16, maxCol + 16);
    return minCols * CELL_WIDTH;
  }

  return (
    <div style={{
      flex: '1',
      overflow: 'hidden',
      position: 'relative',
      display: 'flex',
      'flex-direction': 'column',
    }}>
      <div style={{ flex: '1', overflow: 'hidden', position: 'relative' }}>
        <canvas
          ref={canvas}
          style={{
            display: 'block',
            cursor: 'pointer',
          }}
        />
      </div>
      <input
        ref={scrollbarRef}
        type="range"
        min="0"
        max={getScrollMax()}
        value={projectState.scrollX()}
        onInput={handleScrollbar}
        style={{
          width: '100%',
          height: '16px',
          margin: '0',
          padding: '0',
          cursor: 'pointer',
          'flex-shrink': '0',
        }}
      />
    </div>
  );
}
