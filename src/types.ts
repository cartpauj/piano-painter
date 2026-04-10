export interface SustainRegion {
  startCol: number;
  endCol: number;
}

export interface ProjectData {
  version: number;
  bpm: number;
  volume: number;
  sustainEnabled?: boolean;
  synthMode?: string;
  notes: Array<{ col: number; row: number; color?: string; length?: number }>;
  sustain: SustainRegion[];
}

export type PlaybackState = 'stopped' | 'playing' | 'paused';
