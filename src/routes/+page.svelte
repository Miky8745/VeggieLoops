<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { onMount } from 'svelte';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { LogicalSize } from '@tauri-apps/api/dpi';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import ProjectsPanel from '$lib/components/ProjectsPanel.svelte';
  import NewProjectModal from '$lib/components/NewProjectModal.svelte';
  import MenuBar from '$lib/components/MenuBar.svelte';
  import FileExplorer from '$lib/components/FileExplorer.svelte';
  import Playlist from '$lib/components/Playlist.svelte';
  import ChannelRack from '$lib/components/ChannelRack.svelte';
  import type { FileNode } from '$lib/types';

  type View = 'home' | 'project';
  type NavKey = 'projects' | 'customize' | 'plugins' | 'learn';

  let view = $state<View>('home');
  let activeNav = $state<NavKey>('projects');
  let projects = $state<string[]>([]);
  let showModal = $state(false);
  let projectName = $state('');
  let fileTree = $state<FileNode[]>([]);
  let showPlaylist = $state(true);
  let showChannelRack = $state(false);

  async function openProject(name: string) {
    const win = getCurrentWindow();
    try {
      await win.setTitle(name);
      await win.maximize();
    } catch (_) {}
    fileTree = await invoke<FileNode[]>('list_data_files');
    projectName = name;
    view = 'project';
  }

  async function exitProject() {
    const win = getCurrentWindow();
    try {
      await win.unmaximize();
      await win.setSize(new LogicalSize(800, 600));
      await win.center();
      await win.setTitle('VeggieLoops');
    } catch (_) {}
    view = 'home';
  }

  const menus = [
    { name: 'File',    items: [{ label: 'Exit project', action: exitProject }] },
    { name: 'Edit',    items: [] },
    { name: 'Tools',   items: [] },
    { name: 'Options', items: [] },
    { name: 'Help',    items: [] },
  ];

  onMount(async () => {
    projects = await invoke<string[]>('list_projects');
  });
</script>

{#if view === 'home'}
  <div class="app">
    <Sidebar bind:activeNav />
    <main class="main">
      {#if activeNav === 'projects'}
        <ProjectsPanel {projects} onNewProject={() => showModal = true} onOpenProject={openProject} />
      {:else}
        <div class="placeholder-panel">
          <div class="placeholder-content">
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.2" aria-hidden="true">
              <rect x="4" y="4" width="44" height="44" rx="10"/>
              <path d="M18 26h16M26 18v16"/>
            </svg>
            <p class="coming-soon-label">Coming Soon</p>
          </div>
        </div>
      {/if}
    </main>
    <NewProjectModal bind:show={showModal} onCreated={openProject} />
  </div>
{:else}
  <div class="workspace">
    <!-- Top: all controls live here — menus, toolbar buttons, info display -->
    <div class="top-bar">
      <div class="control-strip">
        <div class="control-row">
          <MenuBar {menus} />
          <div class="tb-sep" role="separator" aria-orientation="vertical"></div>
          <button
            class="tb-btn"
            class:tb-btn--active={showPlaylist}
            onclick={() => { showPlaylist = !showPlaylist; }}
          >Playlist</button>
          <button
            class="tb-btn"
            class:tb-btn--active={showChannelRack}
            onclick={() => { showChannelRack = true; }}
          >Channel Rack</button>
          <button class="tb-btn" disabled>Placeholder A</button>
          <button class="tb-btn" disabled>Placeholder B</button>
        </div>
        <div class="info-box">
          <span class="info-line">test</span>
          <span class="info-line">test</span>
        </div>
      </div>
    </div>

    <!-- Body: left panel + workspace -->
    <div class="body">
      <FileExplorer {fileTree} />
      <main class="main">
        {#if showPlaylist}
          <Playlist />
        {/if}
      </main>
    </div>

    <ChannelRack bind:show={showChannelRack} />
  </div>
{/if}

<style>
  /* ── Home view ─────────────────────────────── */
  .app {
    display: flex;
    height: 100vh;
    font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
    font-size: 14px;
    -webkit-font-smoothing: antialiased;
  }

  .placeholder-panel {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--main-text-muted);
  }

  .placeholder-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  .coming-soon-label {
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--main-text-muted);
  }

  /* ── Project view ──────────────────────────── */
  .workspace {
    display: flex;
    flex-direction: column;
    height: 100vh;
    font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
    font-size: 13px;
    -webkit-font-smoothing: antialiased;
  }

  /* Top bar: full-width container, background + bottom border */
  .top-bar {
    background: var(--sidebar-bg);
    border-bottom: 1px solid var(--sidebar-border);
    flex-shrink: 0;
    user-select: none;
  }

  /* control-strip: only as wide as its content */
  .control-strip {
    display: flex;
    flex-direction: column;
    width: max-content;
  }

  /* Row 1: logo + menus + separator + toolbar buttons */
  .control-row {
    display: flex;
    align-items: center;
    gap: 2px;
    height: 30px;
    padding: 0 8px;
  }

  .tb-sep {
    width: 1px;
    height: 14px;
    background: var(--sidebar-border);
    margin: 0 6px;
    flex-shrink: 0;
  }

  .tb-btn {
    background: var(--btn-bg);
    border: 1px solid var(--btn-border);
    color: var(--btn-text);
    font-family: inherit;
    font-size: 12px;
    padding: 3px 10px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.1s, color 0.1s, border-color 0.1s;
    line-height: 1;
  }

  .tb-btn:hover:not(:disabled) {
    background: var(--btn-hover);
    color: var(--main-text);
  }

  .tb-btn--active {
    border-color: var(--accent);
    color: var(--accent);
  }

  .tb-btn--active:hover {
    background: rgba(224, 120, 0, 0.08);
  }

  .tb-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }

  /* Row 2: 2-line info box — same section as the control row */
  .info-box {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 1px;
    padding: 3px 8px 4px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .info-line {
    font-size: 10.5px;
    font-family: 'DM Mono', 'Cascadia Code', 'Consolas', monospace;
    color: var(--main-text-muted);
    line-height: 1.3;
  }

  /* Body: file explorer + workspace side by side */
  .body { display: flex; flex: 1; min-height: 0; overflow: hidden; }

  /* ── Shared ────────────────────────────────── */
  .main {
    flex: 1;
    background: var(--main-bg);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }
</style>
