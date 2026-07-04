import type { Placement } from './types';

let nextId = 1;

class PlacementStore {
  placements = $state<Placement[]>([]);

  add(patternId: number, trackId: number, startBeat: number): Placement {
    const placement: Placement = { id: nextId++, patternId, trackId, startBeat };
    this.placements.push(placement);
    return placement;
  }

  update(id: number, changes: Partial<Pick<Placement, 'trackId' | 'startBeat'>>) {
    this.placements = this.placements.map(p => (p.id === id ? { ...p, ...changes } : p));
  }

  remove(id: number) {
    this.placements = this.placements.filter(p => p.id !== id);
  }

  exportState(): Placement[] {
    return this.placements.map(p => ({ ...p }));
  }

  importState(data: Placement[]) {
    this.placements = data.map(p => ({ ...p }));
    nextId = this.placements.reduce((m, p) => Math.max(m, p.id), 0) + 1;
  }

  resetToDefault() {
    this.placements = [];
    nextId = 1;
  }
}

export const placementStore = new PlacementStore();
