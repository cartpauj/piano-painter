import { CELL_WIDTH, CELL_HEIGHT, TOTAL_ROWS, PIANO_LABEL_WIDTH, SUSTAIN_ROW_HEIGHT, HEADER_HEIGHT } from '../constants';

export interface ViewportInfo {
  startCol: number;
  endCol: number;
  visibleCols: number;
  canvasWidth: number;
  canvasHeight: number;
  gridWidth: number;
  gridHeight: number;
  scrollY: number;
}

export function getViewport(scrollX: number, scrollY: number, canvasWidth: number, canvasHeight: number): ViewportInfo {
  const gridWidth = canvasWidth - PIANO_LABEL_WIDTH;
  const gridHeight = TOTAL_ROWS * CELL_HEIGHT + SUSTAIN_ROW_HEIGHT + HEADER_HEIGHT;
  const visibleCols = Math.ceil(gridWidth / CELL_WIDTH) + 1;
  const startCol = Math.max(0, Math.floor(scrollX / CELL_WIDTH));
  const endCol = startCol + visibleCols;

  return {
    startCol,
    endCol,
    visibleCols,
    canvasWidth,
    canvasHeight,
    gridWidth,
    gridHeight,
    scrollY,
  };
}

export function colToX(col: number, scrollX: number): number {
  return PIANO_LABEL_WIDTH + col * CELL_WIDTH - scrollX;
}

export function xToCol(x: number, scrollX: number): number {
  return Math.floor((x - PIANO_LABEL_WIDTH + scrollX) / CELL_WIDTH);
}

export function rowToY(row: number, scrollY: number): number {
  const visualRow = TOTAL_ROWS - 1 - row;
  return HEADER_HEIGHT + visualRow * CELL_HEIGHT - scrollY;
}

export function yToRow(y: number, scrollY: number): number {
  const adjustedY = y - HEADER_HEIGHT + scrollY;
  if (adjustedY < 0) return -1;
  const visualRow = Math.floor(adjustedY / CELL_HEIGHT);
  if (visualRow >= TOTAL_ROWS) return -2; // sustain area
  return TOTAL_ROWS - 1 - visualRow;
}

export function getTotalGridHeight(): number {
  return HEADER_HEIGHT + TOTAL_ROWS * CELL_HEIGHT + SUSTAIN_ROW_HEIGHT;
}

export function getMaxScrollY(canvasHeight: number): number {
  return Math.max(0, getTotalGridHeight() - canvasHeight);
}
