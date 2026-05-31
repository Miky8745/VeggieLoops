# 🥦 Veggie Loops

A FL Studio-inspired digital audio workstation (DAW) built with [Tauri v2](https://tauri.app/) and [Svelte 5](https://svelte.dev/).

## About

Veggie Loops is a desktop DAW with a pattern-based music production workflow. It features an FL Studio-style toolbar and transport controls, a playlist grid, channel rack, piano roll, file explorer, and a built-in sample library. The frontend is a SvelteKit SPA; the native shell and file-system access are handled by a Rust/Tauri backend.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Rust](https://www.rust-lang.org/tools/install) (required by Tauri)
- Tauri system dependencies for your OS — see the [Tauri prerequisites guide](https://tauri.app/start/prerequisites/)

## Getting Started

Install dependencies:

```bash
npm install
```

Start the app:

```bash
npm run tauri dev
```

This launches the Vite dev server and the Rust backend together, opening the native desktop window with hot-reload.

## All Commands

```bash
# Start Tauri dev app (Vite + Rust backend)
npm run tauri dev

# Frontend only — no Rust, browser at http://localhost:1420
npm run dev

# Type-check frontend (.svelte / .ts files)
npm run check

# Production build (frontend + Rust compilation)
npm run tauri build

# Frontend build only
npm run build

# Check Rust code in isolation
cd src-tauri && cargo check
```

## Tech Stack

| Layer    | Technology                        |
|----------|-----------------------------------|
| Frontend | SvelteKit (SPA mode) + Svelte 5   |
| Bundler  | Vite (port 1420)                  |
| Backend  | Rust (`veggieloops_lib`)          |
| Desktop  | Tauri v2                          |

## Project Structure

```
veggie-loops/
├── src/
│   ├── app.html              — HTML template; global CSS reset + design tokens
│   ├── routes/
│   │   ├── +layout.svelte
│   │   └── +page.svelte      — single page: home view + project workspace
│   └── lib/
│       ├── types.ts           — shared TS interfaces (FileNode, FlatNode, MenuItem)
│       └── components/
│           ├── Sidebar.svelte
│           ├── ProjectsPanel.svelte
│           ├── NewProjectModal.svelte
│           ├── MenuBar.svelte
│           ├── Toolbar.svelte
│           ├── FileExplorer.svelte
│           ├── Playlist.svelte
│           ├── ChannelRack.svelte
│           └── ...
├── src-tauri/
│   └── src/
│       ├── lib.rs             — Tauri commands + app init
│       └── main.rs
└── data/
    ├── projects/              — one folder per project
    └── samples/               — 1,004 LMMS audio samples
```

## Samples

The sample library (~1,004 files from LMMS) lives in `data/samples/`. To download:

```bash
cd data/samples
bash download.sh
```

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.

## License

[MIT](LICENSE)