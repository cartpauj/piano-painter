import {
  CELL_WIDTH, CELL_HEIGHT, TOTAL_ROWS, PIANO_LABEL_WIDTH,
  SUSTAIN_ROW_HEIGHT, HEADER_HEIGHT, COLS_PER_BEAT, COLS_PER_MEASURE,
  COLORS, NOTE_NAMES, isBlackKey, LOWEST_OCTAVE,
} from '../constants';
import { getViewport, colToX, rowToY, type ViewportInfo } from './viewport';
import { projectState } from '../state/project';

export function render(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
  const scrollX = projectState.scrollX();
  const scrollY = projectState.scrollY();
  const vp = getViewport(scrollX, scrollY, canvasWidth, canvasHeight);

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Clip the grid area below the header
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, HEADER_HEIGHT, canvasWidth, canvasHeight - HEADER_HEIGHT);
  ctx.clip();

  drawBackground(ctx, vp, scrollY);
  drawGridLines(ctx, vp, scrollX, scrollY);
  drawNotes(ctx, vp, scrollX, scrollY);
  drawSustainRow(ctx, vp, scrollX, scrollY);
  drawPianoLabels(ctx, canvasHeight, scrollY);
  drawPlayhead(ctx, vp, scrollX, scrollY, canvasHeight);

  ctx.restore();

  // Header drawn on top (not clipped)
  drawHeader(ctx, vp, scrollX);
}

function drawBackground(ctx: CanvasRenderingContext2D, vp: ViewportInfo, scrollY: number): void {
  for (let row = 0; row < TOTAL_ROWS; row++) {
    const y = rowToY(row, scrollY);
    if (y + CELL_HEIGHT < HEADER_HEIGHT || y > vp.canvasHeight) continue;
    ctx.fillStyle = isBlackKey(row) ? COLORS.cellBlackKey : COLORS.cellWhiteKey;
    ctx.fillRect(PIANO_LABEL_WIDTH, y, vp.canvasWidth - PIANO_LABEL_WIDTH, CELL_HEIGHT);
  }
}

function drawGridLines(ctx: CanvasRenderingContext2D, vp: ViewportInfo, scrollX: number, scrollY: number): void {
  const gridBottom = HEADER_HEIGHT + TOTAL_ROWS * CELL_HEIGHT - scrollY;
  const sustainVisible = projectState.sustainEnabled();
  const visibleBottom = sustainVisible
    ? Math.min(gridBottom + SUSTAIN_ROW_HEIGHT, vp.canvasHeight)
    : Math.min(gridBottom, vp.canvasHeight);

  // Vertical lines
  for (let col = vp.startCol; col <= vp.endCol; col++) {
    const x = colToX(col, scrollX);
    if (x < PIANO_LABEL_WIDTH || x > vp.canvasWidth) continue;

    if (col % COLS_PER_MEASURE === 0) {
      ctx.strokeStyle = COLORS.measureLine;
      ctx.lineWidth = 1.5;
    } else if (col % COLS_PER_BEAT === 0) {
      ctx.strokeStyle = COLORS.beatLine;
      ctx.lineWidth = 1;
    } else {
      ctx.strokeStyle = COLORS.gridLine;
      ctx.lineWidth = 0.5;
    }

    ctx.beginPath();
    ctx.moveTo(x, HEADER_HEIGHT);
    ctx.lineTo(x, visibleBottom);
    ctx.stroke();
  }

  // Horizontal lines
  for (let row = 0; row <= TOTAL_ROWS; row++) {
    const y = HEADER_HEIGHT + row * CELL_HEIGHT - scrollY;
    if (y < HEADER_HEIGHT || y > vp.canvasHeight) continue;

    const noteRow = TOTAL_ROWS - row;
    if (noteRow >= 0 && noteRow % 12 === 0) {
      ctx.strokeStyle = COLORS.beatLine;
      ctx.lineWidth = 1;
    } else {
      ctx.strokeStyle = COLORS.gridLine;
      ctx.lineWidth = 0.5;
    }

    ctx.beginPath();
    ctx.moveTo(PIANO_LABEL_WIDTH, y);
    ctx.lineTo(vp.canvasWidth, y);
    ctx.stroke();
  }

  // Line between grid and sustain row
  if (sustainVisible && gridBottom >= HEADER_HEIGHT && gridBottom <= vp.canvasHeight) {
    ctx.strokeStyle = COLORS.measureLine;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(PIANO_LABEL_WIDTH, gridBottom);
    ctx.lineTo(vp.canvasWidth, gridBottom);
    ctx.stroke();
  }
}

function drawNotes(ctx: CanvasRenderingContext2D, vp: ViewportInfo, scrollX: number, scrollY: number): void {
  const noteMap = projectState.notes();
  const padding = 1;
  const radius = 3;
  const currentCol = projectState.currentCol();
  const isPlaying = projectState.playbackState() === 'playing';

  for (const [key, data] of noteMap) {
    const [col, row] = key.split(':').map(Number);
    const endCol = col + data.length - 1;
    // Skip if entirely off-screen
    if (endCol < vp.startCol - 1 || col > vp.endCol) continue;

    const x = colToX(col, scrollX);
    const y = rowToY(row, scrollY);
    const w = CELL_WIDTH * data.length;

    if (x + w < PIANO_LABEL_WIDTH || x > vp.canvasWidth) continue;
    if (y + CELL_HEIGHT < HEADER_HEIGHT || y > vp.canvasHeight) continue;

    // Dim notes that are currently being played
    const isBeingPlayed = isPlaying && currentCol >= col && currentCol <= endCol;
    ctx.globalAlpha = isBeingPlayed ? 0.4 : 1.0;
    ctx.fillStyle = data.color;
    if (data.length > 1) {
      // Rounded rectangle for held notes
      const rx = x + padding;
      const ry = y + padding;
      const rw = w - padding * 2;
      const rh = CELL_HEIGHT - padding * 2;
      ctx.beginPath();
      ctx.roundRect(rx, ry, rw, rh, radius);
      ctx.fill();
    } else {
      ctx.fillRect(
        x + padding,
        y + padding,
        CELL_WIDTH - padding * 2,
        CELL_HEIGHT - padding * 2
      );
    }
  }
  ctx.globalAlpha = 1.0;
}

function drawSustainRow(ctx: CanvasRenderingContext2D, vp: ViewportInfo, scrollX: number, scrollY: number): void {
  if (!projectState.sustainEnabled()) return;

  const gridBottom = HEADER_HEIGHT + TOTAL_ROWS * CELL_HEIGHT - scrollY;

  if (gridBottom + SUSTAIN_ROW_HEIGHT < HEADER_HEIGHT || gridBottom > vp.canvasHeight) return;

  // Background
  ctx.fillStyle = COLORS.sustainRow;
  ctx.fillRect(PIANO_LABEL_WIDTH, gridBottom, vp.canvasWidth - PIANO_LABEL_WIDTH, SUSTAIN_ROW_HEIGHT);

  // Sustain label
  ctx.fillStyle = COLORS.headerText;
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillRect(0, gridBottom, PIANO_LABEL_WIDTH, SUSTAIN_ROW_HEIGHT);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('SUS', PIANO_LABEL_WIDTH / 2, gridBottom + SUSTAIN_ROW_HEIGHT / 2);

  // Draw sustain regions
  const regions = projectState.sustainRegions();
  for (const region of regions) {
    const startX = colToX(region.startCol, scrollX);
    const endX = colToX(region.endCol + 1, scrollX);
    if (endX < PIANO_LABEL_WIDTH || startX > vp.canvasWidth) continue;

    const clampedStartX = Math.max(startX, PIANO_LABEL_WIDTH);
    ctx.fillStyle = COLORS.sustainActive;
    ctx.fillRect(clampedStartX, gridBottom + 2, endX - clampedStartX, SUSTAIN_ROW_HEIGHT - 4);
  }
}

function drawPianoLabels(ctx: CanvasRenderingContext2D, canvasHeight: number, scrollY: number): void {
  // Background for piano label column
  ctx.fillStyle = '#F5F3F0';
  ctx.fillRect(0, HEADER_HEIGHT, PIANO_LABEL_WIDTH, canvasHeight - HEADER_HEIGHT);

  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let row = 0; row < TOTAL_ROWS; row++) {
    const y = rowToY(row, scrollY);
    if (y + CELL_HEIGHT < HEADER_HEIGHT || y > canvasHeight) continue;

    const noteIndex = row % 12;
    const octave = LOWEST_OCTAVE + Math.floor(row / 12);
    const name = `${NOTE_NAMES[noteIndex]}${octave}`;
    const black = isBlackKey(row);

    ctx.fillStyle = black ? COLORS.pianoBlackKey : COLORS.pianoWhiteKey;
    ctx.fillRect(0, y, PIANO_LABEL_WIDTH - 1, CELL_HEIGHT);

    ctx.fillStyle = black ? COLORS.pianoLabelTextBlack : COLORS.pianoLabelText;
    ctx.fillText(name, PIANO_LABEL_WIDTH / 2, y + CELL_HEIGHT / 2);
  }

  // Border between labels and grid
  ctx.strokeStyle = COLORS.measureLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PIANO_LABEL_WIDTH, 0);
  ctx.lineTo(PIANO_LABEL_WIDTH, canvasHeight);
  ctx.stroke();
}

function drawHeader(ctx: CanvasRenderingContext2D, vp: ViewportInfo, scrollX: number): void {
  ctx.fillStyle = COLORS.headerBg;
  ctx.fillRect(0, 0, vp.canvasWidth, HEADER_HEIGHT);

  const selectedMeasure = projectState.startMeasure();

  ctx.font = '10px monospace';
  ctx.textBaseline = 'middle';

  for (let col = vp.startCol; col <= vp.endCol; col++) {
    if (col % COLS_PER_MEASURE === 0) {
      const x = colToX(col, scrollX);
      if (x < PIANO_LABEL_WIDTH) continue;
      const measure = Math.floor(col / COLS_PER_MEASURE) + 1;
      const isSelected = measure === selectedMeasure;

      if (isSelected) {
        ctx.fillStyle = '#4A90D9';
        ctx.fillRect(x, 0, COLS_PER_MEASURE * CELL_WIDTH, HEADER_HEIGHT);
        ctx.fillStyle = '#FFFFFF';
      } else {
        ctx.fillStyle = COLORS.headerText;
      }

      ctx.textAlign = 'left';
      ctx.fillText(`${measure}`, x + 3, HEADER_HEIGHT / 2);
    }
  }

  ctx.strokeStyle = COLORS.measureLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, HEADER_HEIGHT);
  ctx.lineTo(vp.canvasWidth, HEADER_HEIGHT);
  ctx.stroke();
}

function drawPlayhead(
  ctx: CanvasRenderingContext2D, vp: ViewportInfo, scrollX: number, _scrollY: number, canvasHeight: number
): void {
  const state = projectState.playbackState();
  const col = projectState.currentCol();
  const x = colToX(col, scrollX);
  if (x < PIANO_LABEL_WIDTH - 1 || x > vp.canvasWidth) return;

  let alpha = 1;
  if (state !== 'playing') {
    alpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(Date.now() / 300));
  }

  ctx.strokeStyle = `rgba(255, 60, 60, ${alpha})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, HEADER_HEIGHT);
  ctx.lineTo(x, canvasHeight);
  ctx.stroke();
}
