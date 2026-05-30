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
      MenuBar.svelte         — project page menu bar with dropdowns
      FileExplorer.svelte    — activity bar + explorer panel + file tree
      Playlist.svelte        — FL Studio-style playlist grid (tracks × bars, 4/4 shading, sticky headers)
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

`FileNode` is `{ name: String, is_dir: bool, children: Vec<FileNode> }`.

## Views (both in `src/routes/+page.svelte`)

### Home view (`view === 'home'`)
- Sidebar with Projects / Customize / Plugins / Learn navigation.
- Projects panel: search bar, scrollable project list (loads via `list_projects` on mount), empty state when no projects exist.
- **New Project** button opens an in-page modal. On confirm, `create_project` is invoked then `openProject()` is called to switch to the project view.
- Window size: 800×600 (set in `tauri.conf.json`).

### Project view (`view === 'project'`)
- Entered via `openProject(name)`: sets window title, maximizes, loads file tree, sets `view = 'project'`.
- **Menu bar** (top, full width): leaf logo + File / Edit / Tools / Options / Help. File → "Exit project" calls `exitProject()`: unmaximizes, restores 800×600, centers, resets title, sets `view = 'home'`.
- **Activity bar** (44px, left): Explorer toggle button.
- **File explorer** (220px): VSCode-style tree for the entire `data/` directory (via `list_data_files`). Folders are expandable/collapsible; section header "DATA" collapses the tree.
- **Main area**: `Playlist` component — scrollable grid with 8 tracks × 64 bars. Track names are sticky-left; bar ruler is sticky-top. Groups of 4 bars alternate shade (`#1C1C1C` / `#222222`). `trackHeight`, `barWidth`, `barCount` are `$state` for future resize support.
