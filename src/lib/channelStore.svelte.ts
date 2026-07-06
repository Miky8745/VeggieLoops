import type { ChannelData, Note } from './types';

let nextId = 1;

function makeChannel(id: number): ChannelData {
  return {
    id,
    samplePath: null,
    sampleFolder: null,
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

export interface ChannelSettingsExport {
  id: number;
  samplePath: string | null;
  sampleFolder: string | null;
  muted: boolean;
  pan: number;
  volume: number;
  mixerTrack: number;
}

export interface PatternContentEntry {
  patternId: number;
  channelId: number;
  steps: boolean[];
  notes: Note[];
}

export interface ChannelStoreExport {
  channels: ChannelSettingsExport[];
  content: PatternContentEntry[];
  beatsPerBar: number;
  patternLength: number;
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

  // Flattens channel settings + every pattern's step/note content (including
  // the currently active pattern, which lives on the live channel objects
  // rather than in #patternContent) into plain, JSON/XML-serializable data.
  exportState(currentPatternId: number): ChannelStoreExport {
    const content: PatternContentEntry[] = [];
    for (const [patternId, chMap] of this.#patternContent) {
      for (const [channelId, c] of chMap) {
        content.push({ patternId, channelId, steps: [...c.steps], notes: c.notes.map(n => ({ ...n })) });
      }
    }
    for (const ch of this.channels) {
      content.push({ patternId: currentPatternId, channelId: ch.id, steps: [...ch.steps], notes: ch.notes.map(n => ({ ...n })) });
    }
    return {
      channels: this.channels.map(c => ({
        id: c.id, samplePath: c.samplePath, sampleFolder: c.sampleFolder, muted: c.muted,
        pan: c.pan, volume: c.volume, mixerTrack: c.mixerTrack,
      })),
      content,
      beatsPerBar: this.#beatsPerBar,
      patternLength: this.#patternLength,
    };
  }

  importState(data: ChannelStoreExport, currentPatternId: number) {
    this.#beatsPerBar = data.beatsPerBar;
    this.#patternLength = data.patternLength;

    this.#patternContent = new Map();
    const liveByChannel = new Map<number, PatternContent>();
    for (const e of data.content) {
      if (e.patternId === currentPatternId) {
        liveByChannel.set(e.channelId, { steps: e.steps, notes: e.notes });
        continue;
      }
      let chMap = this.#patternContent.get(e.patternId);
      if (!chMap) { chMap = new Map(); this.#patternContent.set(e.patternId, chMap); }
      chMap.set(e.channelId, { steps: e.steps, notes: e.notes });
    }

    this.channels = data.channels.map(c => {
      const live = liveByChannel.get(c.id);
      return {
        id: c.id, samplePath: c.samplePath, sampleFolder: c.sampleFolder ?? null, muted: c.muted,
        pan: c.pan, volume: c.volume, mixerTrack: c.mixerTrack,
        steps: live ? live.steps : (Array(16).fill(false) as boolean[]),
        notes: live ? live.notes : [],
      };
    });

    nextId = this.channels.reduce((m, c) => Math.max(m, c.id), 0) + 1;
    // selectedChannelId (which channel the Piano Roll targets) is UI-only —
    // intentionally left untouched.
  }

  resetToDefault() {
    this.channels = [makeChannel(0)];
    this.selectedChannelId = null;
    this.#beatsPerBar = 4;
    this.#patternLength = 16;
    this.#patternContent = new Map();
    nextId = 1;
  }
}

export const channelStore = new ChannelStore();
