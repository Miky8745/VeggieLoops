<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { onMount } from 'svelte';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { LogicalSize } from '@tauri-apps/api/dpi';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import ProjectsPanel from '$lib/components/ProjectsPanel.svelte';
  import NewProjectModal from '$lib/components/NewProjectModal.svelte';
  import Toolbar from '$lib/components/Toolbar.svelte';
  import FileExplorer from '$lib/components/FileExplorer.svelte';
  import Playlist from '$lib/components/Playlist.svelte';
  import ChannelRack from '$lib/components/ChannelRack.svelte';
  import PianoRoll from '$lib/components/PianoRoll.svelte';
  import ProjectShortcuts from '$lib/components/ProjectShortcuts.svelte';
  import { channelStore } from '$lib/channelStore.svelte';
  import { historyStore } from '$lib/historyStore.svelte';
  import { playback } from '$lib/playbackStore.svelte';
  import { saveProject, loadProject, resetAllStores } from '$lib/projectSerializer';
  import type { FileNode } from '$lib/types';

  type View = 'home' | 'project';
  type NavKey = 'projects' | 'customize' | 'plugins' | 'learn';

  let view = $state<View>('home');
  let activeNav = $state<NavKey>('projects');
  let projects = $state<string[]>([]);
  let showModal = $state(false);
  let projectName = $state('');
  let fileTree = $state<FileNode[]>([]);
  let showExplorer    = $state(true);
  let showPlaylist    = $state(true);
  let showChannelRack = $state(false);
  let showPianoRoll   = $state(false);
  let showMixer       = $state(false);
  let showPianoRollOverview = $state(false);

  // The zone to the right of the file explorer and below the toolbar — this
  // is what "maximize" fills for the Playlist/ChannelRack/PianoRoll floating
  // windows. Measured off the empty `.workspace-zone` placeholder div so it
  // stays correct as the explorer is toggled or the window is resized.
  let workspaceEl = $state<HTMLDivElement | undefined>(undefined);
  let workspaceBounds = $state({ x: 0, y: 0, width: 0, height: 0 });

  function measureWorkspace() {
    if (!workspaceEl) return;
    const r = workspaceEl.getBoundingClientRect();
    workspaceBounds = { x: r.left, y: r.top, width: r.width, height: r.height };
  }

  $effect(() => {
    if (view !== 'project' || !workspaceEl) return;
    measureWorkspace();
    const ro = new ResizeObserver(measureWorkspace);
    ro.observe(workspaceEl);
    window.addEventListener('resize', measureWorkspace);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measureWorkspace);
    };
  });

  async function openProject(name: string) {
    const win = getCurrentWindow();
    try {
      await win.setTitle(name);
      await win.maximize();
    } catch (_) {}
    fileTree = await invoke<FileNode[]>('list_data_files');
    projectName = name;

    const loaded = await loadProject(name);
    if (!loaded) resetAllStores();
    await historyStore.init(name);
    historyStore.startWatching();
    playback.startWatching();

    view = 'project';
  }

  async function exitProject() {
    historyStore.stopWatching();
    playback.stopWatching();
    const win = getCurrentWindow();
    try {
      await win.unmaximize();
      await win.setSize(new LogicalSize(800, 600));
      await win.center();
      await win.setTitle('VeggieLoops');
    } catch (_) {}
    view = 'home';
  }

  let menus = $derived([
    { name: 'File', items: [
      { label: 'Save', action: () => saveProject(projectName) },
      { label: historyStore.autosaveEnabled ? 'Autosave: On' : 'Autosave: Off',
        action: () => { historyStore.autosaveEnabled = !historyStore.autosaveEnabled; } },
      { label: 'Exit project', action: exitProject },
    ] },
    { name: 'Edit',     items: [] },
    { name: 'Add',      items: [] },
    { name: 'Patterns', items: [] },
    { name: 'View',     items: [] },
    { name: 'Options',  items: [] },
    { name: 'Tools',    items: [] },
    { name: 'Help',     items: [] },
  ]);

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
  <ProjectShortcuts />
  <div class="workspace">
    <Toolbar
      {menus}
      bind:showExplorer
      bind:showChannelRack
      bind:showPianoRoll
      bind:showPlaylist
      bind:showMixer
    />

    <!-- Body: left panel + workspace -->
    <div class="body">
      <FileExplorer {fileTree} bind:show={showExplorer} />
      <div class="workspace-zone" bind:this={workspaceEl}></div>
    </div>

    <Playlist bind:show={showPlaylist} {workspaceBounds} />
    <ChannelRack
      bind:show={showChannelRack}
      {workspaceBounds}
      bind:showPianoRollOverview
      onOpenPianoRoll={(channelId) => {
        channelStore.selectedChannelId = channelId;
        showPianoRoll = true;
      }}
    />
    <PianoRoll bind:show={showPianoRoll} {workspaceBounds} bind:showPianoRollOverview />
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

  /* Body: file explorer + workspace side by side */
  .body { display: flex; flex: 1; min-height: 0; overflow: hidden; }

  /* Empty placeholder whose rect defines where the Playlist/ChannelRack/
     PianoRoll floating windows land when maximized — those windows render
     as fixed-position siblings of `.body`, not inside this div. */
  .workspace-zone {
    flex: 1;
    background: var(--main-bg);
    overflow: hidden;
    min-width: 0;
  }

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
