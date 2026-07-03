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

**Backend** (`src-tauri/`): Rust crate (`veggieloops_lib`). The Tauri app is initialized in `src-tauri/src/lib.rs`; `main.rs` just calls `veggieloops_lib::run()`. Tauri commands are defined with `#[tauri::command]` in `lib.rs` and registered via `invoke_handler`. The frontend calls them with `invoke("command_name", { args })` from `@tauri-apps/api/core`.

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
    types.ts                 — shared TS interfaces: FileNode, FlatNode, MenuItem, ChannelData, Note
    channelStore.svelte.ts   — Svelte 5 class-based shared state: channels, patternLength, selectedChannelId (singleton, same pattern as playbackStore.svelte.ts)
    sampleName.ts             — formatSampleName(path): shared "Drop sample" / prettified-filename label used by ChannelRow and PianoRoll
    pianoroll/
      pitch.ts                — pure pitch/geometry helpers shared by the piano roll components: pitch↔y, step↔x, key/black-key/C-note tests, pixel constants (STEP_W, KEY_H, KEY_COL_W, RULER_H, LANE_H)
    components/
      Sidebar.svelte         — home sidebar: logo, nav, settings footer
      ProjectsPanel.svelte   — projects list, search, empty state, action buttons
      NewProjectModal.svelte — new-project form modal (owns its own state + invoke)
      MenuBar.svelte         — project page menu fragment (no wrapper element): logo SVG + File/Edit/… dropdowns. Embedded inside Toolbar.svelte.
      Toolbar.svelte         — two-row FL Studio-style toolbar (CSS grid 2col × 2row). Row 1: menu section (grey-green) + transport + BPM/POS displays + feature toggles + monitor placeholder + peak meter. Row 2: info box + panel toggle buttons + snap/pattern dropdowns + Shift/Alt/Ctrl indicators. Accepts bindable props: showExplorer, showChannelRack, showPianoRoll, showPlaylist, showMixer.
      FileExplorer.svelte    — activity bar + explorer panel + file tree. Accepts `show` bindable prop; root wrapper uses display:contents / display:none to hide without unmounting.
      Playlist.svelte        — FL Studio-style playlist grid (tracks × bars, 4/4 shading, sticky headers)
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

## Navigation

**There is no cross-page navigation.** Both the home view and the project workspace live in `src/routes/+page.svelte` and are toggled via a `view` state variable (`'home' | 'project'`). This avoids Vite dev-mode CSS race conditions caused by full page reloads.

**Do not add `window.location.href` navigation or `goto()` calls** to switch between home and project — mutate `view` instead and call the Tauri window APIs (maximize/restore/setTitle) directly in the transition functions `openProject` / `exitProject`.

## Data storage

All app data lives under `data/` in the project root (`VeggieLoops/data/`). The Rust backend resolves this via `app_root()` in `lib.rs`, which calls `std::env::current_dir()` and steps up one level if the cwd is `src-tauri/` (which it is during `tauri dev`). `projects_root()` calls `app_root()` and appends `data/projects/`.

- **Projects**: `data/projects/<project-name>/` — one folder per project.
- **Samples**: `data/samples/` — 1,004 audio files from LMMS (basses, bassloops, beats, drums, drumsynth, effects, instruments, latin, misc, shapes, stringsnpads, waveforms). Re-download via `bash data/samples/download.sh` (run from `data/samples/`).

## Tauri commands

All commands are defined in `src-tauri/src/lib.rs` and registered in `invoke_handler!`.

| Command | Args | Returns | Description |
|---|---|---|---|
| `list_projects` | — | `Vec<String>` | Sorted list of project folder names |
| `create_project` | `name: String` | `()` | Creates `data/projects/<name>/` |
| `list_project_files` | `name: String` | `Vec<FileNode>` | Recursive file tree for a project (dirs first, max depth 10) |
| `list_data_files` | — | `Vec<FileNode>` | Recursive file tree for the entire `data/` directory |
| `get_data_root` | — | `String` | Absolute path to the `data/` directory |
| `read_audio_bytes` | `relative_path: String` | `Vec<u8>` | Reads `data/<relative_path>` and returns raw bytes (path traversal blocked) |

`FileNode` is `{ name: String, is_dir: bool, children: Vec<FileNode> }`.

## Audio / playback

The sequencer uses the Web Audio API look-ahead scheduler pattern for accurate timing:

- **`src/lib/playbackStore.svelte.ts`** — Svelte 5 class-based shared state: `isPlaying`, `tempo` (BPM), `currentStep` (0-15 when playing, -1 when stopped). Both `Toolbar` and `ChannelRack` import the singleton `playback` object.
- **`src/lib/channelStore.svelte.ts`** — Svelte 5 class-based shared state: `channels` (`ChannelData[]`), `patternLength`, `selectedChannelId` (+ `selectedChannel` getter), `addChannel()`. `ChannelRack` and `PianoRoll` both read/write this singleton so they operate on the same channel data.
- **`src/lib/audioEngine.ts`** — singleton `audioEngine`. `start(getBpm, getChannels, patternLength)` takes *getters* (closures), not direct values, so that live BPM and channel changes are picked up on each scheduler tick without restarting the engine. Uses `AudioContext.currentTime` for sample-accurate scheduling (`source.start(time)`). 100ms lookahead, 25ms tick interval.
- **Visual sync** — a `requestAnimationFrame` loop in `ChannelRack` reads `audioEngine.currentTime - audioEngine.startAudioTime` and divides by `audioEngine.stepDuration` to determine the display step. This matches what's audibly playing, not what's been pre-scheduled.
- **Sample loading** — `audioEngine.loadSample(relativePath)` calls `invoke('read_audio_bytes', { relativePath })` and decodes with `decodeAudioData`. Results are cached in a `Map` keyed by relative path.
- **Step convention** — 16 steps = 1 bar of 4/4; each step = 1 sixteenth note. Step duration = `60 / BPM / 4` seconds. Color groups in ChannelRow (4 steps per group) correspond to one beat each.
- **Sample paths** — `FileExplorer` dispatches the path relative to `data/` (e.g. `samples/drums/clap02.ogg`) in the `filedrop` event. This is stored in `channel.samplePath` and passed directly to `read_audio_bytes`.
- **Notes vs. steps (dual scheduling path)** — each `ChannelData` has both a flat `steps: boolean[]` (step sequencer) and a `notes: Note[]` (piano roll). In `audioEngine.tick()`, a channel with any `notes` plays *only* from that note data (pitched via `playbackRate`, scaled by `note.velocity`); a channel with an empty `notes` array falls back to the original boolean-step behavior unchanged. This means drawing in the Piano Roll fully supersedes that channel's step-sequencer row — the two are not merged/overlaid.
- **Pitch → playback rate** — `2 ** ((note.pitch - 60) / 12)`, i.e. MIDI-style semitone pitch with `60` as the unshifted (rate = 1) reference, following FL Studio's own octave-numbering convention where `60 = C5` (see `pianoroll/pitch.ts`'s `pitchName`). There is no MIDI file import/export, so this convention only needs to be internally self-consistent.

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

Entered via `openProject(name)`: sets window title, maximizes, loads file tree, sets `view = 'project'`. File → "Exit project" calls `exitProject()`: unmaximizes, restores 800×600, centers, resets title, sets `view = 'home'`.

## Piano Roll

`PianoRoll.svelte` is a draggable floating window (`position: fixed`, same header-drag chrome as `ChannelRack.svelte`) that sits outside the toolbar/left/workspace grid, like `ChannelRack` — it is not subject to the "never place controls in left/workspace" rule since it's an overlay window, not part of either fixed zone.

- **Opening it** — double-click a channel's sample-name box in `ChannelRack`/`ChannelRow` (works even on an empty "Drop sample" channel — notes are channel-scoped, not sample-scoped). This sets `channelStore.selectedChannelId` and flips `showPianoRoll` (owned by `+page.svelte`, same as `showChannelRack`). The window always shows/edits `channelStore.selectedChannel`; switching the selected channel while it's open re-targets it live.
- **Coordinate system** — `pianoroll/pitch.ts` is the single source of truth for pixel math: `stepToX`/`xToStep` (16th-note steps, `STEP_W` px each) and `pitchToY`/`yToPitch` (semitones, `KEY_H` px each, high pitches at the top). All drag/resize/marquee logic in `NoteGrid.svelte` snaps through these — there is no sub-step or microtonal dragging in v1.
- **Scroll sync without extra scrollbars** — `NoteGrid.svelte`'s viewport is the *only* element with native `overflow: auto`; it reports `scrollLeft`/`scrollTop` up via `onScroll`. `PianoKeys` (Y) and `PianoRollRuler`/`VelocityLane` (X) are `overflow: hidden` and just apply `transform: translate(-scroll…px)` to their content — no bound scroll containers or `$effect`-driven `scrollTop` assignments needed.
- **Tools** (`PianoRollHeader.svelte`, `tool: 'draw' | 'select'`, bindable):
  - **Draw**: click-drag on empty space creates a note and live-resizes its length while dragging within the same pitch row; dragging into a different row switches to painting new 1-step notes into each newly-entered cell (2D extension of `ChannelRow`'s `stepMousedown`/`stepPointerenter` paint idiom). Dragging an existing note's body moves it; dragging its last ~6px moves only its right edge (resize). Right-click deletes (works in both tools).
  - **Select**: click-drag on empty space draws a marquee (ctrl/cmd = toggle, shift = add, plain = replace — same modifier semantics as `ChannelRack.handleSelect`); dragging a selected note moves the whole selection together. Delete/Backspace removes selected notes; Ctrl/Cmd+C/V copies and pastes appended right after the copied block's end.
- **Velocity lane** — one bar per note (`VelocityLane.svelte`), height ∝ `note.velocity` (0–1). Drag vertically to set; dragging across several bars in one gesture sets each as the pointer passes over it (same mousedown-then-pointerenter-while-buttons-held pattern as the step paint gesture).
