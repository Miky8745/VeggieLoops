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

## Architecture

This is a **Tauri v2 desktop app** with two distinct layers:

**Frontend** (`src/`): SvelteKit in **SPA mode** (SSR disabled, `adapter-static` with `fallback: "index.html"`). Svelte 5 runes syntax (`$state`, `$derived`, `$effect`, etc.) is used throughout. All routes live under `src/routes/`. There is no server-side code — SvelteKit is used purely as a client-side framework bundled by Vite.

**Backend** (`src-tauri/`): Rust crate (`veggieloops_lib`). The Tauri app is initialized in `src-tauri/src/lib.rs`; `main.rs` just calls `veggieloops_lib::run()`. Tauri commands are defined with `#[tauri::command]` in `lib.rs` and registered via `invoke_handler`. The frontend calls them with `invoke("command_name", { args })` from `@tauri-apps/api/core`.

**IPC boundary**: The only communication between frontend and backend is through Tauri's `invoke` mechanism. When adding new backend functionality, define the command in `lib.rs` and register it in `invoke_handler!`.

Vite is fixed to port **1420** (required by Tauri's `devUrl` config) — the port must be available when running dev.

## Navigation

**Do not use `goto` from `$app/navigation` for cross-page navigation.** In Tauri's WebView with `adapter-static`, `goto` can silently fail when the target route isn't hydrated in the current router instance.

Use `window.location.href` instead:
```ts
window.location.href = `/project?name=${encodeURIComponent(name)}`;
window.location.href = '/';
```

Read URL params with `new URLSearchParams(window.location.search).get('name')` rather than `$page.url.searchParams`.

## Data storage

All app data lives under `data/` in the project root (`VeggieLoops/data/`). The Rust backend resolves this via `app_root()` in `lib.rs`, which calls `std::env::current_dir()` and steps up one level if the cwd is `src-tauri/` (which it is during `tauri dev`). `projects_root()` calls `app_root()` and appends `data/projects/`.

- **Projects**: `data/projects/<project-name>/` — one folder per project.

## Tauri commands

All commands are defined in `src-tauri/src/lib.rs` and registered in `invoke_handler!`.

| Command | Args | Returns | Description |
|---|---|---|---|
| `list_projects` | — | `Vec<String>` | Sorted list of project folder names |
| `create_project` | `name: String` | `()` | Creates `data/projects/<name>/` |
| `list_project_files` | `name: String` | `Vec<FileNode>` | Recursive file tree for a project (dirs first, max depth 10) |
| `list_data_files` | — | `Vec<FileNode>` | Recursive file tree for the entire `data/` directory |

`FileNode` is `{ name: String, is_dir: bool, children: Vec<FileNode> }`.

## Routes

### `/` — Home screen (`src/routes/+page.svelte`)
- Sidebar with Projects / Customize / Plugins / Learn navigation.
- Projects panel: search bar, scrollable project list (loads via `list_projects` on mount), empty state when no projects exist.
- **New Project** button opens an in-page modal (not a new Tauri window) where the user names the project. On confirm, `create_project` is invoked and the app navigates to the project page.
- Window size: default 800×600 (set in `tauri.conf.json`).

### `/project` — Project workspace (`src/routes/project/+page.svelte`)
- URL param: `?name=<project-name>` (read via `new URLSearchParams(window.location.search)`).
- On mount: sets the OS window title to the project name and maximizes the window.
- **Menu bar** (top, full width): leaf logo + File / Edit / Tools / Options / Help. File → "Exit project" unmaximizes, restores to 800×600, centers, then navigates home. Other menus are currently empty.
- **Activity bar** (44px, left): Explorer toggle button — clicking it shows/hides the file explorer panel.
- **File explorer** (220px): VSCode-style tree showing the entire `data/` directory (via `list_data_files`). Folders are expandable/collapsible. Section header labelled "DATA" collapses the whole tree.
- **Main area**: placeholder workspace content.
- On exit: window is restored to 800×600 and centered before navigating home.
