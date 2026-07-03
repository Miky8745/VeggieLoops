import type { ChannelData } from './types';

let nextId = 1;

function makeChannel(id: number): ChannelData {
  return {
    id,
    samplePath: null,
    muted: false,
    pan: 0.5,
    volume: 0.8,
    mixerTrack: 0,
    steps: Array(16).fill(false) as boolean[],
    notes: [],
  };
}

class ChannelStore {
  channels = $state<ChannelData[]>([makeChannel(0)]);
  selectedChannelId = $state<number | null>(null);

  #beatsPerBar = $state(4);
  #patternLength = $state(16);

  // One bar is always 4 steps per beat (16th notes), so a bar in 4/4 is 16
  // steps, 3/4 is 12, 2/4 is 8, etc. patternLength is kept snapped to a whole
  // multiple of this so the pattern never ends mid-bar.
  get barLength(): number {
    return this.#beatsPerBar * 4;
  }

  get beatsPerBar(): number {
    return this.#beatsPerBar;
  }

  set beatsPerBar(value: number) {
    const bars = Math.max(1, Math.round(this.#patternLength / this.barLength));
    this.#beatsPerBar = Math.max(1, Math.min(16, Math.round(value)));
    this.#patternLength = bars * this.barLength;
  }

  get patternLength(): number {
    return this.#patternLength;
  }

  set patternLength(value: number) {
    const bars = Math.max(1, Math.round(value / this.barLength));
    this.#patternLength = bars * this.barLength;
  }

  addChannel() {
    this.channels.push(makeChannel(nextId++));
  }

  get selectedChannel(): ChannelData | null {
    return this.channels.find(c => c.id === this.selectedChannelId) ?? null;
  }
}

export const channelStore = new ChannelStore();
