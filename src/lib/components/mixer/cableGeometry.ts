// Pure geometry helper shared by MixerCables.svelte for both committed
// connections and the live in-progress drag cable, so the two never drift
// out of visual sync with each other.

// Horizontal control-point offset, clamped so a near-vertical or very short
// cable doesn't produce an exaggerated S-curve.
function controlOffset(x1: number, x2: number): number {
  return Math.min(80, Math.max(24, Math.abs(x2 - x1) * 0.5));
}

export function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const o = controlOffset(x1, x2);
  return `M ${x1} ${y1} C ${x1 + o} ${y1}, ${x2 - o} ${y2}, ${x2} ${y2}`;
}
