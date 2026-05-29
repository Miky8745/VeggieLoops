<script lang="ts">
  import { onMount } from 'svelte';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { LogicalSize } from '@tauri-apps/api/dpi';
  import { invoke } from '@tauri-apps/api/core';

  const projectName = new URLSearchParams(window.location.search).get('name') ?? 'Project';

  // ── File tree ──────────────────────────────────────────────────────────────

  interface FileNode {
    name: string;
    is_dir: boolean;
    children: FileNode[];
  }

  interface FlatNode {
    node: FileNode;
    depth: number;
    expanded: boolean;
    id: string;
  }

  let fileTree = $state<FileNode[]>([]);
  let expandedIds = $state(new Set<string>());
  let flatNodes = $derived(buildFlat(fileTree, 0, ''));

  function buildFlat(nodes: FileNode[], depth: number, parentId: string): FlatNode[] {
    const result: FlatNode[] = [];
    for (const node of nodes) {
      const id = `${parentId}/${node.name}`;
      const isExpanded = expandedIds.has(id);
      result.push({ node, depth, expanded: isExpanded, id });
      if (node.is_dir && isExpanded) {
        result.push(...buildFlat(node.children, depth + 1, id));
      }
    }
    return result;
  }

  function toggleDir(id: string) {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    expandedIds = next;
  }

  let explorerExpanded = $state(true);
  let showExplorer = $state(true);

  // ── Menu bar ───────────────────────────────────────────────────────────────

  async function exitProject() {
    const win = getCurrentWindow();
    await win.unmaximize();
    await win.setSize(new LogicalSize(800, 600));
    await win.center();
    window.location.href = '/';
  }

  type MenuItem = { label: string; action: () => void };

  const menus: { name: string; items: MenuItem[] }[] = [
    {
      name: 'File',
      items: [{ label: 'Exit project', action: exitProject }],
    },
    { name: 'Edit',    items: [] },
    { name: 'Tools',   items: [] },
    { name: 'Options', items: [] },
    { name: 'Help',    items: [] },
  ];

  let openMenu = $state<string | null>(null);

  $effect(() => {
    if (openMenu === null) return;
    const close = () => { openMenu = null; };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  });

  // ── Init ───────────────────────────────────────────────────────────────────

  onMount(async () => {
    const win = getCurrentWindow();
    await win.setTitle(projectName);
    await win.maximize();
    fileTree = await invoke<FileNode[]>('list_project_files', { name: projectName });
  });
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet" />
</svelte:head>

<div class="workspace">

  <!-- ── Menu bar ── -->
  <header class="menu-bar">
    <svg class="menu-logo" width="16" height="16" viewBox="0 0 30 30" fill="none" aria-hidden="true">
      <path d="M15 3C15 3 5 9.5 5 19C5 24.523 9.2 26.5 15 26.5C20.8 26.5 25 24.523 25 19C25 9.5 15 3 15 3Z" fill="#5BAD5B"/>
      <line x1="15" y1="26.5" x2="15" y2="13" stroke="#2E7D32" stroke-width="1.6" stroke-linecap="round"/>
      <line x1="15" y1="20" x2="19.5" y2="15.5" stroke="#2E7D32" stroke-width="1.6" stroke-linecap="round"/>
      <line x1="15" y1="16.5" x2="10.5" y2="13" stroke="#2E7D32" stroke-width="1.6" stroke-linecap="round"/>
    </svg>

    {#each menus as menu}
      <div class="menu-entry">
        <button
          class="menu-btn"
          class:menu-btn--open={openMenu === menu.name}
          onclick={(e) => { e.stopPropagation(); openMenu = openMenu === menu.name ? null : menu.name; }}
        >{menu.name}</button>

        {#if openMenu === menu.name && menu.items.length > 0}
          <div class="menu-dropdown" role="menu" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
            {#each menu.items as item}
              <button class="menu-item" onclick={() => { openMenu = null; item.action(); }}>
                {item.label}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </header>

  <!-- ── Body ── -->
  <div class="body">

    <!-- Activity bar -->
    <aside class="activity-bar">
      <div class="activity-top">
        <!-- Explorer icon -->
        <button
          class="activity-btn"
          class:activity-btn--active={showExplorer}
          title="Explorer"
          aria-label="Toggle explorer"
          onclick={() => showExplorer = !showExplorer}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 5h7l2 2h7v11H3V5z"/>
          </svg>
        </button>
      </div>
    </aside>

    <!-- File explorer panel -->
    {#if showExplorer}
    <div class="explorer">
      <div class="explorer-head">Explorer</div>

      <div class="explorer-section">
        <button
          class="section-title"
          onclick={() => explorerExpanded = !explorerExpanded}
          aria-expanded={explorerExpanded}
        >
          <svg
            class="section-chevron"
            class:section-chevron--open={explorerExpanded}
            width="10" height="10" viewBox="0 0 10 10" fill="none"
            stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M2.5 3.5l2.5 3 2.5-3"/>
          </svg>
          <span>{projectName.toUpperCase()}</span>
        </button>

        {#if explorerExpanded}
          <div class="file-tree" role="tree">
            {#if flatNodes.length === 0}
              <p class="tree-empty">No files yet</p>
            {:else}
              {#each flatNodes as flat (flat.id)}
                {#if flat.node.is_dir}
                  <button
                    class="tree-item"
                    style="padding-left: {10 + flat.depth * 16}px"
                    onclick={() => toggleDir(flat.id)}
                    role="treeitem"
                    aria-selected={false}
                    aria-expanded={flat.expanded}
                  >
                    <!-- chevron -->
                    <svg
                      class="item-chevron"
                      class:item-chevron--open={flat.expanded}
                      width="9" height="9" viewBox="0 0 9 9" fill="none"
                      stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M2 3l2.5 2.5L7 3"/>
                    </svg>
                    <!-- folder icon -->
                    <svg class="item-icon item-icon--dir" width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      {#if flat.expanded}
                        <path d="M1 4.5h6l1.5 1.5H14v6H1V4.5z"/>
                        <path d="M1 7.5h13"/>
                      {:else}
                        <path d="M1 4.5h5l1.5 1.5H14v7H1V4.5z"/>
                      {/if}
                    </svg>
                    <span class="item-name">{flat.node.name}</span>
                  </button>
                {:else}
                  <div
                    class="tree-item tree-item--file"
                    style="padding-left: {10 + flat.depth * 16 + 13}px"
                    role="treeitem"
                    aria-selected={false}
                  >
                    <!-- file icon -->
                    <svg class="item-icon item-icon--file" width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M2 1.5h6l3 3v7.5H2V1.5z"/>
                      <path d="M8 1.5V4.5H11"/>
                    </svg>
                    <span class="item-name">{flat.node.name}</span>
                  </div>
                {/if}
              {/each}
            {/if}
          </div>
        {/if}
      </div>
    </div>
    {/if}

    <!-- Main content -->
    <main class="main">
      <div class="main-header">
        <h1 class="main-title">{projectName}</h1>
      </div>
      <div class="placeholder">
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.2" aria-hidden="true">
          <rect x="4" y="4" width="48" height="48" rx="12"/>
          <path d="M20 28h16M28 20v16"/>
        </svg>
        <p class="placeholder-label">Workspace ready</p>
        <p class="placeholder-sub">Start building your veggie loop.</p>
      </div>
    </main>

  </div>
</div>

<style>
  :global(*, *::before, *::after) { box-sizing: border-box; margin: 0; padding: 0; }
  :global(html, body) { height: 100%; overflow: hidden; }
  :global(#svelte) { height: 100%; }

  .workspace {
    display: flex;
    flex-direction: column;
    height: 100vh;
    font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
    font-size: 13px;
    -webkit-font-smoothing: antialiased;

    --sidebar-bg:    #1B2E1B;
    --sidebar-border:#233323;
    --explorer-bg:   #1E321E;
    --explorer-border:#2A3E2A;
    --main-bg:       #F5F8F5;
    --main-text:     #182E18;
    --main-muted:    #6A8A6A;
    --main-border:   #D6E8D6;
    --accent:        #3C8B3C;
    --sidebar-text:  #8DB08D;
    --btn-hover:     #EDF5ED;
  }

  @media (prefers-color-scheme: dark) {
    .workspace {
      --sidebar-bg:    #152415;
      --sidebar-border:#1C301C;
      --explorer-bg:   #182E18;
      --explorer-border:#243824;
      --main-bg:       #182818;
      --main-text:     #C4DCC4;
      --main-muted:    #5A7A5A;
      --main-border:   #274027;
      --accent:        #4DA84D;
      --sidebar-text:  #708E70;
      --btn-hover:     #1E301E;
    }
  }

  /* ── Menu bar ── */

  .menu-bar {
    display: flex;
    align-items: center;
    gap: 2px;
    height: 30px;
    padding: 0 8px;
    background: var(--sidebar-bg);
    border-bottom: 1px solid var(--sidebar-border);
    flex-shrink: 0;
    user-select: none;
  }

  .menu-logo {
    margin-right: 6px;
    flex-shrink: 0;
  }

  .menu-entry {
    position: relative;
  }

  .menu-btn {
    background: transparent;
    border: none;
    color: var(--sidebar-text);
    font-family: inherit;
    font-size: 12.5px;
    padding: 3px 8px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
    line-height: 1;
  }

  .menu-btn:hover,
  .menu-btn--open {
    background: rgba(255,255,255,0.08);
    color: #D0EAD0;
  }

  .menu-dropdown {
    position: absolute;
    top: calc(100% + 2px);
    left: 0;
    min-width: 160px;
    background: var(--explorer-bg);
    border: 1px solid var(--explorer-border);
    border-radius: 6px;
    box-shadow: 0 6px 20px rgba(0,0,0,0.25);
    z-index: 200;
    padding: 3px;
  }

  .menu-item {
    display: block;
    width: 100%;
    padding: 6px 10px;
    text-align: left;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--main-text);
    font-family: inherit;
    font-size: 12.5px;
    cursor: pointer;
    transition: background 0.1s;
  }

  .menu-item:hover {
    background: rgba(255,255,255,0.06);
  }

  /* ── Body ── */

  .body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  /* ── Activity bar ── */

  .activity-bar {
    width: 44px;
    flex-shrink: 0;
    background: var(--sidebar-bg);
    border-right: 1px solid var(--sidebar-border);
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .activity-top {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 8px;
    gap: 4px;
  }

  .activity-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(--sidebar-text);
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
    opacity: 0.6;
  }

  .activity-btn--active {
    opacity: 1;
    color: #D0EAD0;
  }

  .activity-btn:hover {
    background: rgba(255,255,255,0.06);
    opacity: 1;
  }

  /* ── Explorer ── */

  .explorer {
    width: 220px;
    flex-shrink: 0;
    background: var(--explorer-bg);
    border-right: 1px solid var(--explorer-border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .explorer-head {
    padding: 8px 12px 4px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--main-muted);
    flex-shrink: 0;
  }

  .explorer-section {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 5px;
    width: 100%;
    padding: 5px 8px;
    background: transparent;
    border: none;
    font-family: inherit;
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.07em;
    color: var(--sidebar-text);
    cursor: pointer;
    text-align: left;
    flex-shrink: 0;
    transition: color 0.1s;
  }

  .section-title:hover { color: #D0EAD0; }

  .section-chevron {
    flex-shrink: 0;
    transition: transform 0.15s;
    transform: rotate(-90deg);
  }

  .section-chevron--open {
    transform: rotate(0deg);
  }

  .file-tree {
    flex: 1;
    overflow-y: auto;
    padding-bottom: 8px;
  }

  .file-tree::-webkit-scrollbar { width: 5px; }
  .file-tree::-webkit-scrollbar-thumb {
    background: var(--explorer-border);
    border-radius: 3px;
  }

  .tree-empty {
    padding: 6px 16px;
    font-size: 12px;
    color: var(--main-muted);
    font-style: italic;
  }

  .tree-item {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    height: 22px;
    padding-right: 8px;
    border: none;
    background: transparent;
    font-family: inherit;
    font-size: 13px;
    color: var(--sidebar-text);
    cursor: pointer;
    text-align: left;
    transition: background 0.08s, color 0.08s;
    white-space: nowrap;
    overflow: hidden;
  }

  .tree-item:hover {
    background: rgba(255,255,255,0.05);
    color: #D0EAD0;
  }

  .tree-item--file {
    cursor: default;
  }

  .item-chevron {
    flex-shrink: 0;
    transition: transform 0.15s;
    transform: rotate(-90deg);
    color: var(--main-muted);
  }

  .item-chevron--open {
    transform: rotate(0deg);
  }

  .item-icon {
    flex-shrink: 0;
  }

  .item-icon--dir {
    color: var(--accent);
    opacity: 0.85;
  }

  .item-icon--file {
    color: var(--sidebar-text);
    opacity: 0.7;
  }

  .item-name {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Main content ── */

  .main {
    flex: 1;
    background: var(--main-bg);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }

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

  .placeholder {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: var(--main-muted);
    text-align: center;
  }

  .placeholder-label {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 15px;
    font-weight: 600;
    color: var(--main-text);
    opacity: 0.4;
  }

  .placeholder-sub {
    font-size: 13px;
    color: var(--main-muted);
  }
</style>
