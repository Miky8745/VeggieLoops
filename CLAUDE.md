# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Keep this file up to date.** Whenever you make a change worth noting — new commands, architecture decisions, IPC additions, navigation quirks, data conventions — add it here before finishing the task.

## Commands

```bash
# Start Tauri dev app (launches Vite dev server + Rust backend together)
npm run tauri dev

# Frontend only (no Rust, browser at http://localhost:1420)
npm run dev

# Type-check frontend (run after changes to .svelte or .ts files)
npm run check

# Build for production (runs `npm run build` then compiles Rust)
npm run tauri build

# Build frontend only
npm run build
```

Rust backend is built/run via `npm run tauri dev` — there is no separate `cargo run` entry point for the app. To check Rust code in isolation: `cd src-tauri && cargo check`.

## Code style

**Prefer many small files over few large ones.** If a component, helper, or type block is getting long, extract it into its own file without hesitation. Route pages should be thin coordinators — logic and UI belong in focused components under `src/lib/`.

## Architecture

This is a **Tauri v2 desktop app** with two distinct layers:

**Frontend** (`src/`): SvelteKit in **SPA mode** (SSR disabled, `adapter-static` with `fallback: "index.html"`). Svelte 5 runes syntax (`$state`, `$derived`, `$effect`, etc.) is used throughout. All routes live under `src/routes/`. There is no server-side code — SvelteKit is used purely as a client-side framework bundled by Vite.

**Backend** (`src-tauri/`): Rust crate (`veggieloops_lib`). The Tauri app is initialized in `src-tauri/src/lib.rs`; `main.rs` just calls `veggieloops_lib::run()`. Tauri commands are defined with `#[tauri::command]` — most in `lib.rs`, but project-file persistence commands live in `src-tauri/src/project.rs` (a separate module, kept apart from the file-tree/project-CRUD commands in `lib.rs`) — and all are registered via `invoke_handler!` in `lib.rs`. The frontend calls them with `invoke("command_name", { args })` from `@tauri-apps/api/core`.

**IPC boundary**: The only communication between frontend and backend is through Tauri's `invoke` mechanism. When adding new backend functionality, define the command in `lib.rs` and register it in `invoke_handler!`.

Vite is fixed to port **1420** (required by Tauri's `devUrl` config) — the port must be available when running dev.

## Frontend structure

```
src/
  app.html                   — HTML template; holds global CSS reset + design tokens (loads before any JS)
  app.css                    — reference copy of design tokens (not imported anywhere)
  routes/
    +layout.svelte           — pass-through layout (no styles; fonts + reset are in app.html)
    +page.svelte             — single page managing both home and project views (~180 lines)
  lib/
    types.ts                 — shared TS interfaces: FileNode, FlatNode, MenuItem, ChannelData, Note, PatternData, Placement, FileDropDetail
    channelStore.svelte.ts   — Svelte 5 class-based shared state: channels, patternLength, selectedChannelId (singleton, same pattern as playbackStore.svelte.ts). Also exposes exportState()/importState()/resetToDefault() for save/undo (see "Undo/redo & saving").
    patternStore.svelte.ts   — Svelte 5 class-based shared state: patterns (`PatternData[]`, each with id/name/color/lengthBeats), selectedPatternId (+ `selectedPattern` getter), addPattern(). Singleton shared by Toolbar's pattern dropdown and Playlist's patterns panel so both reflect the same pattern list/selection. Also exposes exportState()/importState()/resetToDefault().
    placementStore.svelte.ts — Svelte 5 class-based shared state: `placements` (`Placement[]`, each with id/patternId/trackId/startBeat) placed on the Playlist timeline. add()/update()/remove()/exportState()/importState()/resetToDefault(). Singleton shared by `Playlist.svelte`.
    projectSerializer.ts     — `ProjectFileData` (mirrors the Rust `ProjectFile` struct field-for-field). `serializeProject()`/`applyProjectState()` gather/apply the four stores above plus `playback.tempo`; `resetAllStores()`; `saveProject(name)`/`loadProject(name)` (invoke `save_project`/`load_project`).
    historyStore.svelte.ts   — Svelte 5 class-based singleton: undo/redo stacks (250-entry cap each), autosave toggle, debounced watcher that drives both. See "Undo/redo & saving".
    sampleName.ts             — formatSampleName(path)/formatChannelLabel(channel): shared "Drop sample" / prettified-filename label used by ChannelRow and PianoRoll
    multisample.ts            — buildMultisample()/pickFromFolder(): turns a dropped folder's file list into a note→sample map and resolves nearest-pitch playback (see "Multisample instrument folders")
    pianoroll/
      pitch.ts                — pure pitch/geometry helpers shared by the piano roll components: pitch↔y, step↔x, key/black-key/C-note tests, pixel constants (STEP_W, KEY_H, KEY_COL_W, RULER_H, LANE_H), parseNoteName(filename) for multisample folders
    components/
      Sidebar.svelte         — home sidebar: logo, nav, settings footer
      ProjectsPanel.svelte   — projects list, search, empty state, action buttons
      NewProjectModal.svelte — new-project form modal (owns its own state + invoke)
      MenuBar.svelte         — project page menu fragment (no wrapper element): logo SVG + File/Edit/… dropdowns. Embedded inside Toolbar.svelte.
      Toolbar.svelte         — two-row FL Studio-style toolbar (CSS grid 2col × 2row). Row 1: menu section (grey-green) + transport + BPM/POS displays + feature toggles + monitor placeholder + peak meter. Row 2: info box + panel toggle buttons + snap/pattern dropdowns + Shift/Alt/Ctrl indicators. Accepts bindable props: showExplorer, showChannelRack, showPianoRoll, showPlaylist, showMixer.
      FileExplorer.svelte    — activity bar + explorer panel + file tree. Accepts `show` bindable prop; root wrapper uses display:contents / display:none to hide without unmounting.
      ProjectShortcuts.svelte — no markup, just `<svelte:window onkeydown>` for the global Ctrl/Cmd+Z (undo), Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z (redo), and Ctrl/Cmd+S (save) shortcuts; ignores keydowns targeting an `input`/`textarea`/contenteditable. Mounted once in the project view of `+page.svelte`.
      Playlist.svelte        — FL Studio-style playlist grid (tracks × bars, 4/4 shading, sticky headers) plus a patterns panel docked on the left (see "Playlist patterns panel" below)
      ChannelRack.svelte     — draggable floating window for the channel rack (step sequencer), toggled from toolbar. Sources `channels`/`patternLength` from `channelStore` (not local state) so the Piano Roll can share the same data.
      PianoRoll.svelte       — draggable floating window (same chrome pattern as ChannelRack), toggled from toolbar via `showPianoRoll` and also opened by double-clicking a channel's sample name in the rack. Coordinates the sub-components below and owns tool/selection/scroll-sync state.
      pianoroll/
        PianoRollHeader.svelte — draggable title bar + Draw/Select tool toggle + close button
        PianoKeys.svelte       — sticky-look vertical piano key column (128 keys, black/white, C-note labels), Y-scroll driven by a `scrollTop` prop via CSS transform (not native scroll)
        PianoRollRuler.svelte  — sticky-look step ruler (4-step grey/orange grouping, playhead cell), X-scroll driven by a `scrollLeft` prop via CSS transform
        NoteGrid.svelte        — the actual native-scrolling grid (only real scrollbars live here); owns all draw/select/marquee/move/resize/copy-paste/delete pointer + keyboard interaction; emits scroll position up via `onScroll`
        VelocityLane.svelte    — per-note velocity bars below the grid, drag-to-set (mirrors ChannelRow's paint gesture), X-scroll driven the same way as the ruler
```

CSS custom properties (design tokens) live in `app.html`'s `<style>` tag so they are available synchronously before any JS runs. New components should use `var(--token)` rather than hardcoding colors.

The global reset in `app.html` (mirrored in `app.css`) sets `user-select: none` on `html, body` so dragging around the UI never drag-selects text (matches a native desktop app feel); `input`/`textarea` are explicitly reset back to `user-select: text` so form fields stay usable.

## Playlist patterns panel

`Playlist.svelte` docks a fixed-width patterns panel on the **left** of the timeline (inside `.playlist-body`, a sibling of the scrollable `.playlist` grid — not part of the FL Studio toolbar/left/workspace zone rule, since this is internal to the Playlist floating window).

- **Data** — `patternStore.svelte.ts` (singleton) holds the list of `PatternData` (`id`, `name`, `color`, `lengthBeats`) and `selectedPatternId`. The panel and the Toolbar's pattern dropdown both read/write this same store, so selecting a pattern in either place stays in sync. `+` at the bottom of the panel calls `patternStore.addPattern()`.
- **Pattern length** — edited inline per pattern card via a `ScrollField` (`decimals={2}`, `step={0.25}`), so lengths like `4.5` beats are representable (needed for unquantized audio clips such as vocal takes).
- **Placing patterns on the timeline** — dragging a pattern card follows the same manual pointer-drag convention as `FileExplorer`'s sample drag (pointerdown → 4px-threshold promotion to a `dragging` state → a cursor-following ghost → drop resolved via `document.elementsFromPoint` looking for a `data-track-id` attribute), rather than native HTML5 drag-and-drop. Dropping over a track row creates a `Placement` (`{ id, patternId, trackId, startBeat }`, defined in `types.ts`, held in the `placementStore.svelte.ts` singleton — not local component state, so placements participate in save/undo) snapped to the nearest whole beat. `pixelsPerBeat = barWidth / channelStore.beatsPerBar`, so placement geometry stays correct if the time signature changes.
- **Moving/deleting placements** — dragging an existing placed block re-runs the same drop resolution to relocate it; right-click deletes it (mirrors the Piano Roll's right-click-delete convention). A placement always renders at `pattern.lengthBeats` looked up live (not copied at drop time), so resizing a pattern's length in the panel resizes every placed instance of it.

## Navigation

**There is no cross-page navigation.** Both the home view and the project workspace live in `src/routes/+page.svelte` and are toggled via a `view` state variable (`'home' | 'project'`). This avoids Vite dev-mode CSS race conditions caused by full page reloads.

**Do not add `window.location.href` navigation or `goto()` calls** to switch between home and project — mutate `view` instead and call the Tauri window APIs (maximize/restore/setTitle) directly in the transition functions `openProject` / `exitProject`.

## Data storage

All app data lives under `data/` in the project root (`VeggieLoops/data/`). The Rust backend resolves this via `app_root()` in `lib.rs`, which calls `std::env::current_dir()` and steps up one level if the cwd is `src-tauri/` (which it is during `tauri dev`). `projects_root()` calls `app_root()` and appends `data/projects/`.

- **Projects**: `data/projects/<project-name>/` — one folder per project, containing:
  - `<project-name>.vlp` — the saved project (XML). Written by `save_project`, read by `load_project`. Absent until the first save.
  - `history` — the undo/redo stacks (plain JSON, not XML — Rust treats its contents as an opaque string). Written/read by `save_history`/`load_history`.
- **Samples**: `data/samples/` — 1,004 audio files from LMMS (basses, bassloops, beats, drums, drumsynth, effects, instruments, latin, misc, shapes, stringsnpads, waveforms). Re-download via `bash data/samples/download.sh` (run from `data/samples/`).

## Tauri commands

Most commands are defined in `src-tauri/src/lib.rs`; project-file persistence commands live in `src-tauri/src/project.rs`. All are registered in one `invoke_handler!` call in `lib.rs`.

| Command | Args | Returns | Description |
|---|---|---|---|
| `list_projects` | — | `Vec<String>` | Sorted list of project folder names |
| `create_project` | `name: String` | `()` | Creates `data/projects/<name>/` |
| `list_project_files` | `name: String` | `Vec<FileNode>` | Recursive file tree for a project (dirs first, max depth 10) |
| `list_data_files` | — | `Vec<FileNode>` | Recursive file tree for the entire `data/` directory |
| `get_data_root` | — | `String` | Absolute path to the `data/` directory |
| `read_audio_bytes` | `relative_path: String` | `Vec<u8>` | Reads `data/<relative_path>` and returns raw bytes (path traversal blocked). Some FL Studio factory samples are a RIFF/WAVE shell around a proprietary format tag (`0x674F`) whose "data" chunk is actually a raw Ogg Vorbis stream no decoder recognizes wrapped as-is; this command unwraps that shell down to the plain Ogg payload before returning (`unwrap_fl_ogg_wav` in `lib.rs`) — a no-op for ordinary PCM WAVs |
| `list_dir_files` | `relative_path: String` | `Vec<String>` | Non-recursive list of audio-file names (`wav`/`ogg`/`mp3`/`flac`) directly inside a data-relative folder, sorted. Used to build a multisample instrument when a folder is dropped onto a channel (see "Multisample instrument folders" below) |
| `save_project` | `name: String, project: ProjectFile` | `()` | Serializes `project` to XML and writes `data/projects/<name>/<name>.vlp` |
| `load_project` | `name: String` | `Option<ProjectFile>` | Reads/parses `<name>.vlp`; `None` if it doesn't exist yet |
| `save_history` | `name: String, contents: String` | `()` | Writes the opaque JSON `contents` string to `data/projects/<name>/history` |
| `load_history` | `name: String` | `Option<String>` | Reads `history` as a raw string; `None` if it doesn't exist yet |

`FileNode` is `{ name: String, is_dir: bool, children: Vec<FileNode> }`. `ProjectFile` and its nested structs are defined in `project.rs` — see "Undo/redo & saving" below.

## Audio / playback

The sequencer uses the Web Audio API look-ahead scheduler pattern for accurate timing:

- **`src/lib/playbackStore.svelte.ts`** — Svelte 5 class-based shared state and the app's single unified playback clock: `isPlaying`, `tempo` (BPM), `currentStep` (floored, -1 when stopped), `currentStepFraction` (continuous, non-floored — drives the Piano Roll's smooth playhead line), `soloChannelId` (`number | null` — when set, only that channel plays; set only by the Piano Roll's own play button), `transportMode` (`'pattern' | 'song'` — `'song'` mode has no engine-side behavior yet, it's purely the Toolbar's PAT/SNG display state today). `startWatching()`/`stopWatching()` (called from `+page.svelte`'s `openProject`/`exitProject`, alongside `historyStore`) open a standalone `$effect.root()` (same reasoning as `historyStore.svelte.ts` — a plain module singleton has no parent effect context) that owns *all* `audioEngine.start()/stop()` orchestration and the `requestAnimationFrame` loop advancing `currentStep`/`currentStepFraction` — this used to live inside `ChannelRack.svelte`, which meant playback silently stopped advancing its visual position if that window was ever closed while playing; now it runs regardless of which windows are open. `restartFromZero()` is called by `patternStore`'s `selectedPatternId` setter on every pattern switch — if playing, it actually restarts the audio loop at step 0 of the new pattern; if stopped, it just resets the idle marker. `Toolbar`, `ChannelRack`, and `PianoRoll` all read/write the singleton `playback` object, so their play buttons stay in sync automatically (shared reactive state, no cross-component events).
- **`src/lib/channelStore.svelte.ts`** — Svelte 5 class-based shared state: `channels` (`ChannelData[]`), `patternLength`, `selectedChannelId` (+ `selectedChannel` getter), `addChannel()`. `ChannelRack` and `PianoRoll` both read/write this singleton so they operate on the same channel data.
  - **Time signature / pattern length** — `beatsPerBar` (numerator, denominator fixed at quarter notes, default 4) and `patternLength` are both getter/setter pairs. `patternLength`'s setter always snaps to the nearest whole multiple of `barLength` (`= beatsPerBar * 4` sixteenth-note steps), so the pattern can never end mid-bar — 4/4 → multiples of 16, 3/4 → multiples of 12, 2/4 → multiples of 8, etc. Setting `beatsPerBar` re-snaps `patternLength` to the same bar *count* under the new bar length. `ChannelRack`'s "TIME SIG"/"LEN" `ScrollField`s bind directly to these accessors.
- **`src/lib/audioEngine.ts`** — singleton `audioEngine`. `start(getBpm, getChannels, patternLength)` takes *getters* (closures), not direct values, so that live BPM and channel changes are picked up on each scheduler tick without restarting the engine. Uses `AudioContext.currentTime` for sample-accurate scheduling (`source.start(time)`). 100ms lookahead, 25ms tick interval.
- **Visual sync** — the `requestAnimationFrame` loop owned by `playbackStore` (see above) reads `audioEngine.currentTime - audioEngine.startAudioTime` and divides by `audioEngine.stepDuration` to determine the display step, both floored (`currentStep`) and continuous (`currentStepFraction`). This matches what's audibly playing, not what's been pre-scheduled.
- **Solo playback** — when `playback.soloChannelId` is set, the `getChannels` closure passed to `audioEngine.start()` filters to just that one channel instead of returning `channelStore.channels`. There is still only ever one `playback.isPlaying`/one running `audioEngine` instance — solo is just a filter, not a second engine. `ChannelRack`'s and `Toolbar`'s play/stop always clear `soloChannelId` (full-pattern playback); only the Piano Roll's own play button sets it (see "Piano Roll" below).
- **Sample loading** — `audioEngine.loadSample(relativePath)` calls `invoke('read_audio_bytes', { relativePath })` and decodes with `decodeAudioData`. Results are cached in a `Map` keyed by relative path.
- **Step convention** — 16 steps = 1 bar of 4/4; each step = 1 sixteenth note. Step duration = `60 / BPM / 4` seconds. Color groups in ChannelRow (4 steps per group) correspond to one beat each.
- **Sample paths** — `FileExplorer` dispatches a `FileDropDetail` (`types.ts`) in the `filedrop` event: `{ kind: 'file', path }` for a leaf, or `{ kind: 'folder', path, files }` (immediate child file paths, non-recursive) for a directory. `ChannelRack`'s drop handler sets `channel.samplePath`/`channel.sampleFolder` (mutually exclusive — setting one clears the other) accordingly.
- **Notes vs. steps (dual scheduling path)** — each `ChannelData` has both a flat `steps: boolean[]` (step sequencer) and a `notes: Note[]` (piano roll). In `audioEngine.tick()`, a channel with any `notes` plays *only* from that note data (pitched via `playbackRate`, scaled by `note.velocity`); a channel with an empty `notes` array falls back to the original boolean-step behavior unchanged (played at pitch 60, i.e. unshifted for a single-sample channel). This means drawing in the Piano Roll fully supersedes that channel's step-sequencer row — the two are not merged/overlaid. Both paths funnel through `audioEngine`'s private `triggerPitched(ch, targetPitch, ...)`, which is what actually branches on `samplePath` vs `sampleFolder`.
- **Pitch → playback rate** — `2 ** ((note.pitch - 60) / 12)`, i.e. MIDI-style semitone pitch with `60` as the unshifted (rate = 1) reference, following FL Studio's own octave-numbering convention where `60 = C5` (see `pianoroll/pitch.ts`'s `pitchName`). There is no MIDI file import/export, so this convention only needs to be internally self-consistent. For a multisample channel (`sampleFolder` set) the reference pitch is whichever recorded sample is closest to the note being played, not always 60 — see below.

### Multisample instrument folders

Dragging a **folder** (rather than a single file) from `FileExplorer` onto a channel's sample drop zone builds a simple multisample instrument instead of a one-shot: `channel.sampleFolder` is set (and `samplePath` cleared) instead of the other way around. This exists because FL Studio's factory `Packs/Instruments` content (and `Packs/Legacy/Instruments`) ships each instrument as a folder of raw audio files — many of them with the recorded note baked into the filename (e.g. `OSTR C1.wav`, `01_TSAX_LONG G#1ogg.wav`) — alongside a proprietary `.fst`/`.dwp` preset (DirectWave/FL patch state, undocumented binary format) that isn't parsed at all; only the raw audio files are used.

- **`src/lib/pianoroll/pitch.ts`'s `parseNoteName(filename)`** — regex-parses a trailing note token (e.g. `C1`, `G#3`, `A_2` — some packs use `_` in place of `#` to keep filenames filesystem-safe) into a MIDI pitch using the same `60 = C5` convention as the rest of the app. Also strips a trailing `ogg` (case-insensitive, no separating dot) that shows up on many Legacy-pack filenames — an artifact of the original `.ogg` extension being kept when the file was re-saved as `.wav`. Returns `null` when no note token is found (e.g. round-robin folders like `Ibanez Pick (1).wav` or fully keymap-numbered ones like `FL Piano (1).wav` whose true per-key mapping lives only in the unparsed `.fst`).
- **`src/lib/multisample.ts`** — `buildMultisample(fileNames, folderPath)` parses every file in a dropped folder into a `MultisampleFolder`: `pitched` (files with a recognized note, sorted ascending) and `allPaths` (every file, for the fallback below). `pickFromFolder(folder, targetPitch)` resolves what to actually play: if `pitched` is non-empty, the nearest recorded pitch plus the `playbackRate` needed to reach `targetPitch` from it (this is the "if that note doesn't exist, create it from the nearest one" behavior); if `pitched` is empty, a random file from `allPaths` played at the same middle-C-relative rate a single-sample channel would use (i.e. round-robin/one-shot folders behave like today's single-sample channels, just with a random take per hit).
- **`audioEngine.ts`'s `resolveFolder(folderPath)`** — lazily lists a folder's contents via `invoke('list_dir_files', ...)` and runs `buildMultisample`, caching the result (same dedup-cache shape as `loadSample`'s `bufferCache`/`loadingPromises`) so the folder is only listed once regardless of how many notes/hits reference it.
- **Pattern-scoped step/note content** — channels (sample, mute, pan, volume, mixer track) are shared across all patterns, but each channel's `steps`/`notes` content is scoped per pattern. `channelStore.switchPattern(fromId, toId)` stashes the current `channels[i].steps`/`.notes` into a private `Map<patternId, Map<channelId, content>>`, then restores (or, the first time a pattern is visited, creates blank) content into the same channel objects — channel identity/order/settings never change. `patternStore`'s `selectedPatternId` is a getter/setter pair whose setter calls `channelStore.switchPattern` before updating, so switching patterns via the Toolbar dropdown, the Playlist patterns panel, or `addPattern()` all trigger the swap automatically; nothing else needs to call `switchPattern` directly.

## Views (both in `src/routes/+page.svelte`)

### Home view (`view === 'home'`)
- Sidebar with Projects / Customize / Plugins / Learn navigation.
- Projects panel: search bar, scrollable project list (loads via `list_projects` on mount), empty state when no projects exist.
- **New Project** button opens an in-page modal. On confirm, `create_project` is invoked then `openProject()` is called to switch to the project view.
- Window size: 800×600 (set in `tauri.conf.json`).

### Project view (`view === 'project'`)

The workspace is divided into three fixed zones. **This hierarchy must be respected for all future additions.**

```
┌──────────────────────────────────────────────────────────────┐
│  TOOLBAR ROW 1 (~50px, CSS grid col1+col2)                   │
│  col1 [grey-green]: logo File Edit Add Patterns View … Help  │
│  col2: [PAT|SNG] [▶][■][⏸][●] [BPM] [POS] [⌨→🎹][321][↺][🎵]│
│        [monitor rect] [peak meter]                           │
├──────────────────────────────────────────────────────────────┤
│  TOOLBAR ROW 2 (~26px)                                       │
│  col1 [info]: two-line status text (same width as col1 above)│
│  col2: [📁][≡CR][🎹PR][▦PL][🎛MX][↩AS][🎤] [Snap▾][Pat▾]   │
│        [SHF][ALT][CTL]                                       │
├──────────┬───────────────────────────────────────────────────┤
│  LEFT    │  WORKSPACE                                        │
│  File    │  (everything the user edits/plays with)           │
│  explorer│                                                   │
└──────────┴───────────────────────────────────────────────────┘
```

- **Toolbar** (`Toolbar.svelte`) — a CSS grid (`grid-template-columns: max-content 1fr; grid-template-rows: 50px 26px`). Col 1 is the menu section (grey-green bg, `--toolbar-green-bg`); it auto-sizes, and the info box in row 2 col 1 stretches to the same width automatically. All transport/toggle/panel buttons live in col 2. New toolbar buttons go in `Toolbar.svelte`.
- **Left** — file explorer and any future list-type structures.
- **Workspace** — everything the user edits: playlist, piano roll, mixer, etc.

**Never place controlling buttons or displays in the left or workspace zones.** New toolbar controls belong in `Toolbar.svelte`; new left-panel structures belong inside/beside `FileExplorer.svelte`.

Entered via `openProject(name)`: sets window title, maximizes, loads file tree, loads the project's saved `.vlp` (or resets all stores to blank if none exists yet), initializes and starts the undo/redo history watcher and the `playbackStore` clock watcher, sets `view = 'project'`. File → "Exit project" calls `exitProject()`: stops the history watcher and the clock watcher, unmaximizes, restores 800×600, centers, resets title, sets `view = 'home'`.

## Undo/redo & saving

- **One debounced watcher drives both undo/redo history and autosave**, rather than instrumenting every mutation call site (which are scattered across `NoteGrid.svelte`, `ChannelRow.svelte`, `ChannelRack.svelte`, `Playlist.svelte`, and the stores themselves). `historyStore.svelte.ts`'s `startWatching()` opens a standalone reactive root via `$effect.root()` (required since this is a plain module singleton, not a component — a bare `$effect` has no parent effect context to attach to) containing an `$effect` that re-serializes the whole project on every reactive flush and, whenever the serialized JSON differs from the last-committed one, (re)arms a 1000ms `setTimeout`. When 1 second passes with no further changes, it commits: pushes the pre-change snapshot onto the undo stack (`past`, capped at 250, oldest dropped first), clears the redo stack (`future`), persists both to the project's `history` file, and — if `historyStore.autosaveEnabled` (on by default, toggled via File → "Autosave: On/Off") — also calls `saveProject()`.
- **`undo()`/`redo()`** (`historyStore.svelte.ts`) are standard past/future stack swaps built on `applyProjectState()`.
- **What counts as project state** (saved to `.vlp` *and* snapshotted for undo) — `src/lib/projectSerializer.ts`'s `ProjectFileData`: `channelStore` (channel settings + every pattern's steps/notes, beatsPerBar, patternLength), `patternStore` (patterns + selectedPatternId), `placementStore` (playlist placements), and `playback.tempo`. Explicitly excluded: `isPlaying`/`currentStep`/`currentStepFraction`/`soloChannelId`/`transportMode` (playback-only) and any UI selection state (e.g. `channelStore.selectedChannelId`) — these are ephemeral and reset per session.
- **Why every store needs `exportState()`/`importState()`** — `channelStore`'s per-pattern step/note content lives in a private `Map` (not JSON/XML-serializable), and it's the only place that knows how to flatten it (merging the currently-active pattern's *live* content, which isn't in the map, with every other pattern's *stashed* content, which is). `patternStore.importState()` sets `#selectedPatternId` directly rather than through its public setter, which would otherwise call `channelStore.switchPattern` and corrupt the import (that swap logic is exactly what full-state import needs to bypass — it already restores every pattern's content wholesale). All four stores recompute their module-scope `nextId` counter after import (`max(existing ids) + 1`) so newly created objects post-undo/load never collide with restored ids.
- **XML on the Rust side** (`src-tauri/src/project.rs`, using `quick-xml`'s serde support) — every struct is `#[serde(rename_all = "camelCase")]` so field names match the plain JSON object the frontend passes to `invoke('save_project', { name, project })` (Tauri IPC args are always JSON, regardless of what Rust does with them afterward — this attribute is what makes e.g. `sample_path`/`samplePath` line up). quick-xml repeats a bare `Vec<T>` field's own tag name per element rather than giving each item its own tag, so the four top-level lists (`channels`, `content`, `patterns`, `placements`) are each wrapped in a small struct with a renamed inner field (e.g. `ChannelsXml { #[serde(rename = "channel")] items: Vec<ChannelSettings> }`) to get clean per-item XML tags. `projectSerializer.ts`'s `ProjectFileData` mirrors this wrapper shape exactly (e.g. `channels: { channel: [...] }`) so it deserializes cleanly on the Rust side.
- **The `history` file is deliberately untyped on the Rust side** — `save_history`/`load_history` just read/write a plain JSON string; only `.vlp` needs to be real XML, so there's no reason for Rust to understand the history file's internal shape (avoids a second parallel struct family).
- **Known tradeoff, not yet a problem** — the watcher's `$effect` re-serializes and diffs the *entire* project on every reactive flush, not just once per second; the 1000ms timer only gates the final commit (stack push + disk write), not the stringify-and-diff work itself. During a fast gesture (dragging a note's length, painting steps) this could re-run many times per second. Left as-is for now since the ask was for something simple; if it ever causes jank, the fix is splitting the watcher into a cheap "dirty" flag effect plus a `setInterval`-driven poll that only stringifies while dirty.

## Piano Roll

`PianoRoll.svelte` is a draggable floating window (`position: fixed`, same header-drag chrome as `ChannelRack.svelte`) that sits outside the toolbar/left/workspace grid, like `ChannelRack` — it is not subject to the "never place controls in left/workspace" rule since it's an overlay window, not part of either fixed zone.

- **Opening it** — double-click a channel's sample-name box in `ChannelRack`/`ChannelRow` (works even on an empty "Drop sample" channel — notes are channel-scoped, not sample-scoped). This sets `channelStore.selectedChannelId` and flips `showPianoRoll` (owned by `+page.svelte`, same as `showChannelRack`). The window always shows/edits `channelStore.selectedChannel`; switching the selected channel while it's open re-targets it live.
- **Coordinate system** — `pianoroll/pitch.ts` is the single source of truth for pixel math: `stepToX`/`xToStep` (16th-note steps, `STEP_W` px each) and `pitchToY`/`yToPitch` (semitones, `KEY_H` px each, high pitches at the top). All drag/resize/marquee logic in `NoteGrid.svelte` snaps through these — there is no sub-step or microtonal dragging in v1.
- **Scroll sync without extra scrollbars** — `NoteGrid.svelte`'s viewport is the *only* element with native `overflow: auto`; it reports `scrollLeft`/`scrollTop` up via `onScroll`. `PianoKeys` (Y) and `PianoRollRuler`/`VelocityLane` (X) are `overflow: hidden` and just apply `transform: translate(-scroll…px)` to their content — no bound scroll containers or `$effect`-driven `scrollTop` assignments needed. All three viewport elements (`.grid-viewport`, `.keys-viewport`, `.ruler-viewport`) need an explicit `height: 100%` — without it a block element's `height: auto` sizes to its (huge, 128-pitch) content instead of the CSS-grid-stretched parent, so `overflow: auto`/`hidden` never actually clips anything and there's nothing to scroll.
- **Auto-extend** — `PianoRoll.svelte` runs an `$effect` that checks every channel's notes on each change; if any note reaches into the pattern's current last bar, `channelStore.patternLength` grows by one more bar (`barLength`). This is what lets users keep drawing notes indefinitely instead of hitting the end of the pattern — there's no manual "extend" action.
- **Piano key look** (`PianoKeys.svelte`) — rows are semitone-height (`KEY_H`) white bands (needed so they line up 1:1 with `NoteGrid` rows); a black key is rendered as a shorter/narrower absolutely-positioned `.black-key` overlay (`width: 62%`, `top/bottom: 2px` inset) rather than a full-row black background, so it visually reads as a real black key sitting on top of/between white keys instead of a same-size alternating stripe.
- **Tools** (`PianoRollHeader.svelte`, `tool: 'draw' | 'select'`, bindable):
  - **Draw**: click-drag on empty space creates a note and live-resizes its length while dragging within the same pitch row; dragging into a different row switches to painting new 1-step notes into each newly-entered cell (2D extension of `ChannelRow`'s `stepMousedown`/`stepPointerenter` paint idiom). Dragging an existing note's body moves it; dragging its last ~6px moves only its right edge (resize).
  - **Select**: click-drag on empty space draws a marquee (ctrl/cmd = toggle, shift = add, plain = replace — same modifier semantics as `ChannelRack.handleSelect`); dragging a selected note moves the whole selection together. Delete/Backspace removes selected notes; Ctrl/Cmd+C/V copies and pastes appended right after the copied block's end.
  - **Delete (both tools)** — right-click deletes the note under the cursor; holding the right button and dragging deletes every note the cursor subsequently passes over (mirrors the paint-drag idiom: state set in `mousedown`, continued via `pointermove` while `e.buttons & 2`, cleared on `pointerup`).
- **Velocity lane** — one bar per note (`VelocityLane.svelte`), height ∝ `note.velocity` (0–1). Drag vertically to set; dragging across several bars in one gesture sets each as the pointer passes over it (same mousedown-then-pointerenter-while-buttons-held pattern as the step paint gesture).
- **`MiniNoteRoll.svelte` (`pianoroll/`)** — the shared note-thumbnail renderer used both by the Channel Rack's mini piano-roll preview and the Piano Roll's overview panel (below). Props: `notes`, `patternLength`, `activeStep`, `rowHeight`, `fit: 'steps' | 'stretch'`. Vertical axis is always squashed to `rowHeight` by auto-fitting to *this channel's own* min/max note pitch (not the full 0–127 keyboard — 128 semitones in a ~28px row would make notes sub-pixel), with a minimum bar height and a `span` clamped to 1 so a single shared pitch centers rather than divides by zero. `fit="steps"` (the Channel Rack's mode) lays out in real pixels via `STEP_W`/`stepToX`/`patternWidth` from `pianoroll/pitch.ts`, so it's pixel-accurate against the real grid and lines up with neighboring step rows. `fit="stretch"` (the overview panel's mode) instead expresses note/playhead position as percentages of `patternLength`, so the *whole* pattern condenses to fit whatever width the panel has, regardless of pixels-per-step.
- **Mini piano-roll preview in the Channel Rack** — `ChannelRow.svelte`'s `.steps` area shows the step-sequencer buttons only when `channel.notes` is empty; otherwise it renders `<MiniNoteRoll fit="steps">` instead, since a note-based channel's step buttons don't reflect what's actually scheduled (`audioEngine` plays *only* from `notes` when any exist). Editing still only happens via the floating Piano Roll window (double-click the sample name) — the mini-roll has no pointer handlers.
- **Overview/minimap panel** (`PianoRollOverview.svelte`) — a full-width strip above the Piano Roll's main grid, toggled by the "Piano roll overview" button in the Channel Rack header (`showPianoRollOverview`, lifted into `+page.svelte` and passed to both `ChannelRack` and `PianoRoll` the same way `showPianoRoll`/`showChannelRack` are). Renders `<MiniNoteRoll fit="stretch">` for the whole pattern, with a lighter-gray overlay rectangle showing the fraction of the pattern currently visible in `NoteGrid`'s viewport — computed purely from ratios against `patternWidth(patternLength)` (`scrollLeft`/`viewportWidth`), no DOM measurement of the mini-roll itself needed. Click or click-drag anywhere in the strip seeks: `NoteGrid.svelte` exposes an `export function scrollTo(x, y)` (set via `bind:this`) that a parent can call to scroll it from outside — setting `scrollLeft`/`scrollTop` directly fires the existing native `onscroll` handler, so the overlay's position self-corrects from the real post-clamp value with no extra plumbing. `NoteGrid`'s viewport width is tracked reactively (a `ResizeObserver` on the viewport element, reported via an `onViewportResize` callback prop) since it's otherwise only read once, non-reactively, at mount.
- **Piano Roll's own play button** (`PianoRollHeader.svelte`) — plays *only* the currently-open channel by setting `playback.soloChannelId` before starting (see "Audio / playback" above); pressing it again just stops. Reuses the exact `hdr-btn hdr-tgl` chrome/SVGs as `ChannelRack`'s play button.
- **Continuous playhead line** (`NoteGrid.svelte`) — a separate, thin 1px line (distinct from the existing discrete `.playhead` step-highlight band, which stays for cell-alignment purposes) driven by `playback.currentStepFraction` rather than the floored `currentStep`/`activeStep`, so it moves smoothly instead of snapping per 16th-note. Only rendered while `playback.isPlaying` (`PianoRoll.svelte` passes `-1` otherwise, the same sentinel convention as `activeStep`).
