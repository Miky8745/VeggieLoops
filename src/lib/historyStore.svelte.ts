import { invoke } from '@tauri-apps/api/core';
import { serializeProject, applyProjectState, saveProject, type ProjectFileData } from './projectSerializer';

const MAX_ENTRIES = 250;
const IDLE_MS = 1000;

interface HistoryFile {
  past: ProjectFileData[];
  future: ProjectFileData[];
}

class HistoryStore {
  past = $state<ProjectFileData[]>([]);
  future = $state<ProjectFileData[]>([]);
  autosaveEnabled = $state(false);
  projectName = $state('');

  #lastSnap: ProjectFileData | null = null;
  #lastJson = '';
  #timer: ReturnType<typeof setTimeout> | null = null;
  #stopWatcher: (() => void) | null = null;

  async init(name: string) {
    this.projectName = name;
    this.past = [];
    this.future = [];

    const raw = await invoke<string | null>('load_history', { name });
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as HistoryFile;
        this.past = parsed.past ?? [];
        this.future = parsed.future ?? [];
      } catch {
        // Corrupt/unreadable history file — start fresh rather than crash.
        this.past = [];
        this.future = [];
      }
    }

    const snap = serializeProject();
    this.#lastSnap = snap;
    this.#lastJson = JSON.stringify(snap);
  }

  // Runs a standalone reactive root (this is a plain module singleton, not a
  // component, so a bare $effect has no parent effect context to attach to)
  // that serializes the whole project on every state change and, 1s after
  // things go quiet, commits one history entry (and autosaves, if enabled).
  startWatching() {
    if (this.#stopWatcher) return;
    this.#stopWatcher = $effect.root(() => {
      $effect(() => {
        const snap = serializeProject();
        const json = JSON.stringify(snap);
        if (json === this.#lastJson) return;
        if (this.#timer) clearTimeout(this.#timer);
        this.#timer = setTimeout(() => this.#commit(json, snap), IDLE_MS);
      });
    });
  }

  stopWatching() {
    this.#stopWatcher?.();
    this.#stopWatcher = null;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
  }

  #commit(json: string, snap: ProjectFileData) {
    this.#timer = null;
    if (this.#lastSnap) {
      this.past.push(this.#lastSnap);
      if (this.past.length > MAX_ENTRIES) this.past.shift();
    }
    this.future = [];
    this.#lastSnap = snap;
    this.#lastJson = json;
    this.#persistHistory();
    if (this.autosaveEnabled) saveProject(this.projectName);
  }

  // Forces any not-yet-committed change into a history entry right now, so
  // Ctrl+Z immediately after an edit has something to undo instead of
  // silently no-oping until the 1s idle timer would otherwise have fired.
  #flushPending() {
    if (!this.#timer) return;
    clearTimeout(this.#timer);
    this.#timer = null;
    const snap = serializeProject();
    const json = JSON.stringify(snap);
    if (json !== this.#lastJson) this.#commit(json, snap);
  }

  // Re-derives the baseline from a fresh live serialization (rather than
  // trusting the popped snapshot object byte-for-byte) so the watcher's next
  // comparison is guaranteed to match — otherwise any reconstruction drift
  // would look like a phantom user edit and could corrupt the other stack.
  #settleOn(snap: ProjectFileData) {
    applyProjectState(snap);
    const nowSnap = serializeProject();
    this.#lastSnap = nowSnap;
    this.#lastJson = JSON.stringify(nowSnap);
  }

  undo() {
    this.#flushPending();
    if (this.past.length === 0 || !this.#lastSnap) return;
    const prev = this.past.pop()!;
    this.future.push(this.#lastSnap);
    if (this.future.length > MAX_ENTRIES) this.future.shift();
    this.#settleOn(prev);
    this.#persistHistory();
  }

  redo() {
    this.#flushPending();
    if (this.future.length === 0 || !this.#lastSnap) return;
    const next = this.future.pop()!;
    this.past.push(this.#lastSnap);
    if (this.past.length > MAX_ENTRIES) this.past.shift();
    this.#settleOn(next);
    this.#persistHistory();
  }

  #persistHistory() {
    const contents = JSON.stringify({ past: this.past, future: this.future } satisfies HistoryFile);
    invoke('save_history', { name: this.projectName, contents });
  }
}

export const historyStore = new HistoryStore();
