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
    types.ts                 — shared TS interfaces: FileNode, FlatNode, MenuItem
    components/
      Sidebar.svelte         — home sidebar: logo, nav, settings footer
      ProjectsPanel.svelte   — projects list, search, empty state, action buttons
      NewProjectModal.svelte — new-project form modal (owns its own state + invoke)
      MenuBar.svelte         — project page menu fragment (no wrapper element): logo SVG + File/Edit/… dropdowns. Embedded inside Toolbar.svelte.
      Toolbar.svelte         — two-row FL Studio-style toolbar (CSS grid 2col × 2row). Row 1: menu section (grey-green) + transport + BPM/POS displays + feature toggles + monitor placeholder + peak meter. Row 2: info box + panel toggle buttons + snap/pattern dropdowns + Shift/Alt/Ctrl indicators. Accepts bindable props: showExplorer, showChannelRack, showPianoRoll, showPlaylist, showMixer.
      FileExplorer.svelte    — activity bar + explorer panel + file tree. Accepts `show` bindable prop; root wrapper uses display:contents / display:none to hide without unmounting.
      Playlist.svelte        — FL Studio-style playlist grid (tracks × bars, 4/4 shading, sticky headers)
      ChannelRack.svelte     — in-app modal for the channel rack (blank placeholder, toggled from toolbar)
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
- **`src/lib/audioEngine.ts`** — singleton `audioEngine`. `start(getBpm, getChannels, patternLength)` takes *getters* (closures), not direct values, so that live BPM and channel changes are picked up on each scheduler tick without restarting the engine. Uses `AudioContext.currentTime` for sample-accurate scheduling (`source.start(time)`). 100ms lookahead, 25ms tick interval.
- **Visual sync** — a `requestAnimationFrame` loop in `ChannelRack` reads `audioEngine.currentTime - audioEngine.startAudioTime` and divides by `audioEngine.stepDuration` to determine the display step. This matches what's audibly playing, not what's been pre-scheduled.
- **Sample loading** — `audioEngine.loadSample(relativePath)` calls `invoke('read_audio_bytes', { relativePath })` and decodes with `decodeAudioData`. Results are cached in a `Map` keyed by relative path.
- **Step convention** — 16 steps = 4 bars of 4/4; each step = 1 quarter note. Step duration = `60 / BPM` seconds. Color groups in ChannelRow (4 steps per group) correspond to one bar each.
- **Sample paths** — `FileExplorer` dispatches the path relative to `data/` (e.g. `samples/drums/clap02.ogg`) in the `filedrop` event. This is stored in `channel.samplePath` and passed directly to `read_audio_bytes`.

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
