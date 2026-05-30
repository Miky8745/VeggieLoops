<script lang="ts">
  import type { MenuItem } from '$lib/types';

  let {
    menus,
  }: {
    menus: { name: string; items: MenuItem[] }[];
  } = $props();

  let openMenu = $state<string | null>(null);

  $effect(() => {
    if (openMenu === null) return;
    const close = () => { openMenu = null; };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  });
</script>

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
        <div
          class="menu-dropdown"
          role="menu"
          tabindex="-1"
          onclick={(e) => e.stopPropagation()}
          onkeydown={(e) => e.stopPropagation()}
        >
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

<style>
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

  .menu-logo { margin-right: 6px; flex-shrink: 0; }

  .menu-entry { position: relative; }

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

  .menu-btn:hover, .menu-btn--open {
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
    color: var(--sidebar-text);
    font-family: inherit;
    font-size: 12.5px;
    cursor: pointer;
    transition: background 0.1s;
  }

  .menu-item:hover { background: rgba(255,255,255,0.06); color: #D0EAD0; }
</style>
