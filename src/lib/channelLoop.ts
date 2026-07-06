import type { ChannelData } from './types';

// How many steps of a channel's own content repeat before it restarts,
// independent of the overall loop bound. Finds the last bar containing any
// content for this channel, then loops at that bar's end — which is exactly
// the point where "there are no notes in the next bar" holds for every step
// from then to the end of loopLength. A channel with content reaching all
// the way to loopLength's end has no such trailing gap, so it just plays
// through once.
export function channelLoopLength(ch: ChannelData, loopLength: number, barLength: number): number {
  const bars = Math.ceil(loopLength / barLength);
  let lastOccupiedBar = -1;
  for (let bar = 0; bar < bars; bar++) {
    const from = bar * barLength;
    const to   = Math.min(from + barLength, loopLength);
    const occupied = ch.notes.length > 0
      ? ch.notes.some(n => n.start < to && n.start + n.length > from)
      : ch.steps.slice(from, to).some(Boolean);
    if (occupied) lastOccupiedBar = bar;
  }
  if (lastOccupiedBar === -1) return loopLength; // no content — loop length is moot
  return Math.min((lastOccupiedBar + 1) * barLength, loopLength);
}
