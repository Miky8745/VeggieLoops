import type { PatternData } from './types';
import { channelStore } from './channelStore.svelte';

const PATTERN_COLORS = [
  '#90C396', '#E0A458', '#5B8DB8', '#C97064',
  '#9B7EDE', '#4FB0A5', '#D6C34B', '#C15C86',
];

let nextId = 2;

function makePattern(id: number): PatternData {
  return {
    id,
    name: `Pattern ${id}`,
    color: PATTERN_COLORS[(id - 1) % PATTERN_COLORS.length],
    lengthBeats: 4,
  };
}

class PatternStore {
  patterns = $state<PatternData[]>([makePattern(1)]);
  #selectedPatternId = $state(1);

  get selectedPatternId(): number {
    return this.#selectedPatternId;
  }

  // Switching the selected pattern hands off to channelStore so channels
  // (and their sample/mute/pan/volume settings) stay put while their
  // step/note content swaps to whatever was last drawn in that pattern.
  set selectedPatternId(id: number) {
    if (id === this.#selectedPatternId) return;
    channelStore.switchPattern(this.#selectedPatternId, id);
    this.#selectedPatternId = id;
  }

  get selectedPattern(): PatternData | null {
    return this.patterns.find(p => p.id === this.#selectedPatternId) ?? null;
  }

  addPattern() {
    const pattern = makePattern(nextId++);
    this.patterns.push(pattern);
    this.selectedPatternId = pattern.id;
    return pattern;
  }
}

export const patternStore = new PatternStore();
