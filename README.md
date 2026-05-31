# 🥦 Veggie Loops

A FL Studio-inspired digital audio workstation (DAW) built with [Tauri](https://tauri.app/) and [Svelte](https://svelte.dev/).

## About

Veggie Loops is a desktop DAW application that brings a familiar, pattern-based music production workflow to a modern, lightweight stack. Powered by Tauri for the native shell and Svelte for a reactive, snappy UI.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)
- [Rust](https://www.rust-lang.org/tools/install) (required by Tauri)
- Tauri system dependencies for your OS — see the [Tauri prerequisites guide](https://tauri.app/start/prerequisites/)

## Getting Started

Install dependencies:

```bash
npm install
```

Start the development build:

```bash
npm run tauri dev
```

This launches the native desktop window with hot-reload enabled for the Svelte frontend.

## Tech Stack

| Layer    | Technology |
|----------|------------|
| Frontend | Svelte     |
| Backend  | Rust (Tauri) |
| Desktop  | Tauri      |

## Project Structure

```
veggie-loops/
├── src/          # Svelte frontend
├── src-tauri/    # Rust backend & Tauri config
└── public/       # Static assets
```

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.

## License

[MIT](LICENSE)

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Svelte](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer).
