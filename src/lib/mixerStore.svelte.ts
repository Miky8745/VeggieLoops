// Ephemeral, session-only mixer state — not yet wired into projectSerializer.ts
// or historyStore's undo/redo (same treatment as windowFocusStore.svelte.ts).
// Persisting mixer routing/volumes is future work once the audio-engine side
// of mixer routing exists.

// 0 loosely aligns with ChannelData.mixerTrack's existing default of 0
// (see ChannelRow.svelte's "MIXER TRACK" ScrollField, min=0) — nothing reads
// or writes mixerTrack from here yet, this is just a convention worth
// carrying forward for whoever wires real channel-to-mixer-track routing.
export const MASTER_TRACK_ID = 0;

export interface MixerChannelData {
  id: number;
  volume: number;       // 0..2, unity ~0.8 — matches ChannelData.volume's convention
  filterEnabled: boolean;
}

export interface MixerConnection {
  id: number;
  fromTrackId: number;  // side-chain OUT port owner — never MASTER_TRACK_ID (master has no OUT port)
  toTrackId: number;    // side-chain IN port owner
}

export interface FilterSlotData {
  id: number;
  enabled: boolean;
}

const INITIAL_CHANNEL_COUNT = 10;
const FILTER_SLOT_COUNT = 10;

function makeChannel(id: number): MixerChannelData {
  return { id, volume: 0.8, filterEnabled: false };
}

let nextChannelId = 1;
let nextConnectionId = 1;
let nextFilterSlotId = 1;

class MixerStore {
  master = $state<MixerChannelData>({ id: MASTER_TRACK_ID, volume: 0.8, filterEnabled: false });

  channels = $state<MixerChannelData[]>(
    Array.from({ length: INITIAL_CHANNEL_COUNT }, () => makeChannel(nextChannelId++)),
  );

  connections = $state<MixerConnection[]>([]);

  filterSlots = $state<FilterSlotData[]>(
    Array.from({ length: FILTER_SLOT_COUNT }, () => ({ id: nextFilterSlotId++, enabled: false })),
  );

  addChannel(): MixerChannelData {
    const ch = makeChannel(nextChannelId++);
    this.channels.push(ch);
    return ch;
  }

  // A jack port carries a single cable, mirroring a physical TS jack — a new
  // connection touching either port first drops whatever that port was
  // already carrying. Self-connections and connections originating from the
  // master (which has no OUT port) are rejected outright.
  connect(fromTrackId: number, toTrackId: number) {
    if (fromTrackId === toTrackId || fromTrackId === MASTER_TRACK_ID) return;
    this.connections = [
      ...this.connections.filter(c => c.fromTrackId !== fromTrackId && c.toTrackId !== toTrackId),
      { id: nextConnectionId++, fromTrackId, toTrackId },
    ];
    this.#maybeGrow(fromTrackId, toTrackId);
  }

  disconnect(connectionId: number) {
    this.connections = this.connections.filter(c => c.id !== connectionId);
  }

  connectionForPort(trackId: number, kind: 'in' | 'out'): MixerConnection | undefined {
    return kind === 'out'
      ? this.connections.find(c => c.fromTrackId === trackId)
      : this.connections.find(c => c.toTrackId === trackId);
  }

  // Keeps a free channel always available at the tail so the user can keep
  // chaining side-chain cables indefinitely without an explicit "add"
  // click — triggers only when the connection touches the CURRENT last
  // channel's id (either port). Channels never shrink back down.
  #maybeGrow(a: number, b: number) {
    const lastId = this.channels[this.channels.length - 1]?.id;
    if (lastId !== undefined && (a === lastId || b === lastId)) {
      this.addChannel();
    }
  }
}

export const mixerStore = new MixerStore();
