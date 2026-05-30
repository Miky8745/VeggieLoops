<script lang="ts">
  import type { FileNode, FlatNode } from '$lib/types';

  let { fileTree }: { fileTree: FileNode[] } = $props();

  let expandedIds = $state(new Set<string>());
  let explorerExpanded = $state(true);
  let showExplorer = $state(true);

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
</script>

<!-- Activity bar -->
<aside class="activity-bar">
  <div class="activity-top">
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

<!-- Explorer panel -->
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
      <span>DATA</span>
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
                <svg
                  class="item-chevron"
                  class:item-chevron--open={flat.expanded}
                  width="9" height="9" viewBox="0 0 9 9" fill="none"
                  stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M2 3l2.5 2.5L7 3"/>
                </svg>
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

<style>
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

  .activity-btn--active { opacity: 1; color: #D0EAD0; }
  .activity-btn:hover { background: rgba(255,255,255,0.06); opacity: 1; }

  .explorer {
    width: 220px;
    flex-shrink: 0;
    background: var(--explorer-bg);
    border-right: 1px solid var(--explorer-border);
    display: flex;
    flex-direction: column;
    min-height: 0;
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

  .explorer-section { display: flex; flex-direction: column; flex: 1; overflow: hidden; }

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

  .section-chevron { flex-shrink: 0; transition: transform 0.15s; transform: rotate(-90deg); }
  .section-chevron--open { transform: rotate(0deg); }

  .file-tree { flex: 1; overflow-y: auto; padding-bottom: 8px; }
  .file-tree::-webkit-scrollbar { width: 5px; }
  .file-tree::-webkit-scrollbar-thumb { background: var(--explorer-border); border-radius: 3px; }

  .tree-empty { padding: 6px 16px; font-size: 12px; color: var(--main-muted); font-style: italic; }

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

  .tree-item:hover { background: rgba(255,255,255,0.05); color: #D0EAD0; }
  .tree-item--file { cursor: default; }

  .item-chevron { flex-shrink: 0; transition: transform 0.15s; transform: rotate(-90deg); color: var(--main-muted); }
  .item-chevron--open { transform: rotate(0deg); }

  .item-icon { flex-shrink: 0; }
  .item-icon--dir { color: var(--accent); opacity: 0.85; }
  .item-icon--file { color: var(--sidebar-text); opacity: 0.7; }

  .item-name { overflow: hidden; text-overflow: ellipsis; }
</style>
