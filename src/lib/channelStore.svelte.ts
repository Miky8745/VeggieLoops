import type { ChannelData, Note } from './types';

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

interface PatternContent {
  steps: boolean[];
  notes: Note[];
}

class ChannelStore {
  channels = $state<ChannelData[]>([makeChannel(0)]);
  selectedChannelId = $state<number | null>(null);

  #beatsPerBar = $state(4);
  #patternLength = $state(16);

  // Step/note content is scoped per pattern (keyed by pattern id, then channel
  // id); channel identity and settings (sample, mute, pan, volume, mixer
  // track) are shared across all patterns. patternStore calls switchPattern()
  // whenever the selected pattern changes.
  #patternContent = new Map<number, Map<number, PatternContent>>();

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

  // Stashes the current step/note content of every channel under
  // fromPatternId, then restores (or, for a pattern never visited before,
  // creates fresh blank) content for toPatternId. Channels themselves are
  // never added/removed/reordered by this.
  switchPattern(fromPatternId: number, toPatternId: number) {
    const fromContent = new Map<number, PatternContent>();
    for (const ch of this.channels) {
      fromContent.set(ch.id, { steps: ch.steps, notes: ch.notes });
    }
    this.#patternContent.set(fromPatternId, fromContent);

    const toContent = this.#patternContent.get(toPatternId);
    for (const ch of this.channels) {
      const saved = toContent?.get(ch.id);
      ch.steps = saved ? saved.steps : (Array(16).fill(false) as boolean[]);
      ch.notes = saved ? saved.notes : [];
    }
  }
}

export const channelStore = new ChannelStore();
