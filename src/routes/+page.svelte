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
  import type { FileNode } from '$lib/types';

  type View = 'home' | 'project';
  type NavKey = 'projects' | 'customize' | 'plugins' | 'learn';

  let view = $state<View>('home');
  let activeNav = $state<NavKey>('projects');
  let projects = $state<string[]>([]);
  let showModal = $state(false);
  let projectName = $state('');
  let fileTree = $state<FileNode[]>([]);

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
    <MenuBar {menus} />
    <div class="body">
      <FileExplorer {fileTree} />
      <main class="main">
        <div class="main-header">
          <h1 class="main-title">{projectName}</h1>
        </div>
        <Playlist />
      </main>
    </div>
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

  .body { display: flex; flex: 1; min-height: 0; overflow: hidden; }

  .main-header {
    padding: 12px 20px;
    border-bottom: 1px solid var(--main-border);
    flex-shrink: 0;
  }

  .main-title {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 17px;
    font-weight: 600;
    color: var(--main-text);
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
