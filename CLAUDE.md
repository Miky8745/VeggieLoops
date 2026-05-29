# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

**Frontend** (`src/`): SvelteKit in **SPA mode** (SSR disabled, `adapter-static` with `fallback: "index.html"`). Svelte 5 runes syntax (`$state`, etc.) is used. All routes live under `src/routes/`. There is no server-side code — SvelteKit is used purely as a client-side framework bundled by Vite.

**Backend** (`src-tauri/`): Rust crate (`veggieloops_lib`). The Tauri app is initialized in `src-tauri/src/lib.rs`; `main.rs` just calls `veggieloops_lib::run()`. Tauri commands are defined with `#[tauri::command]` in `lib.rs` and registered via `invoke_handler`. The frontend calls them with `invoke("command_name", { args })` from `@tauri-apps/api/core`.

**IPC boundary**: The only communication between frontend and backend is through Tauri's `invoke` mechanism. When adding new backend functionality, define the command in `lib.rs` and register it in `invoke_handler!`.

Vite is fixed to port **1420** (required by Tauri's `devUrl` config) — the port must be available when running dev.

## Data storage

All app data lives under `data/` in the project root (i.e. `VeggieLoops/data/`). The Rust backend resolves this as `std::env::current_dir()/data/` — in dev mode (`npm run tauri dev`) the cwd is the project root.

- **Projects**: `data/projects/<project-name>/` — one folder per project, created by the `create_project` Tauri command.

## Project creation flow

1. User clicks **New Project** on the home screen.
2. An in-page modal (Svelte component, no new Tauri window) prompts for a project name.
3. On confirm, `invoke('create_project', { name })` creates `data/projects/<name>/`.
4. The app navigates to `/project?name=<name>` via `goto`.
5. The project page reads the name from URL params and sets the OS window title via `getCurrentWindow().setTitle(name)` (`@tauri-apps/api/window`).
