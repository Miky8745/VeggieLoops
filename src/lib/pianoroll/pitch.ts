export const MIN_PITCH = 0;
export const MAX_PITCH = 127;
export const KEY_H = 14;    // px per semitone row
export const STEP_W = 24;   // px per 16th-note step (matches ChannelRow's .step width)
export const KEY_COL_W = 56;
export const RULER_H = 20;
export const LANE_H = 70;
export const DEFAULT_CENTER_PITCH = 60; // FL convention: 60 = C5

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK_OFFSETS = new Set([1, 3, 6, 8, 10]);

export function pitchName(pitch: number): string {
  const name = NOTE_NAMES[pitch % 12];
  const octave = Math.floor(pitch / 12);
  return `${name}${octave}`;
}

export function isBlackKey(pitch: number): boolean {
  return BLACK_OFFSETS.has(pitch % 12);
}

export function isCNote(pitch: number): boolean {
  return pitch % 12 === 0;
}

// y=0 is the top of the grid == MAX_PITCH; pitch decreases downward (high notes on top).
export function pitchToY(pitch: number): number {
  return (MAX_PITCH - pitch) * KEY_H;
}

export function yToPitch(y: number): number {
  const p = MAX_PITCH - Math.floor(y / KEY_H);
  return Math.max(MIN_PITCH, Math.min(MAX_PITCH, p));
}

export function stepToX(step: number): number {
  return step * STEP_W;
}

export function xToStep(x: number): number {
  return Math.max(0, Math.floor(x / STEP_W));
}

export const GRID_TOTAL_H = (MAX_PITCH - MIN_PITCH + 1) * KEY_H;

export function patternWidth(patternLength: number): number {
  return patternLength * STEP_W;
}

export function clampPitch(pitch: number): number {
  return Math.max(MIN_PITCH, Math.min(MAX_PITCH, pitch));
}
