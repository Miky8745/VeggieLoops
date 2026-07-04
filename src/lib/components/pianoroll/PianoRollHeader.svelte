<script lang="ts">
  let {
    title,
    tool = $bindable(),
    maximized,
    onClose,
    onDragStart,
    onToggleMaximize,
  }: {
    title: string;
    tool: 'draw' | 'select';
    maximized: boolean;
    onClose: () => void;
    onDragStart: (e: MouseEvent) => void;
    onToggleMaximize: () => void;
  } = $props();
</script>

<div class="pr-header" onmousedown={onDragStart} role="toolbar" aria-label="Piano Roll controls" tabindex="-1">
  <div class="hdr-left">
    <button
      class="hdr-btn hdr-tgl"
      class:hdr-tgl--on={tool === 'draw'}
      onclick={(e) => { e.stopPropagation(); tool = 'draw'; }}
      aria-label="Draw tool"
      title="Draw (pencil)"
    >
      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 12l1-3 7-7 2 2-7 7-3 1z"/>
      </svg>
    </button>
    <button
      class="hdr-btn hdr-tgl"
      class:hdr-tgl--on={tool === 'select'}
      onclick={(e) => { e.stopPropagation(); tool = 'select'; }}
      aria-label="Select tool"
      title="Select (arrow)"
    >
      <svg viewBox="0 0 14 14" fill="currentColor">
        <path d="M2 1l9 5.5-3.6 1L9.5 12l-1.7.8-2-4.5L3 10.7z"/>
      </svg>
    </button>
  </div>

  <span class="pr-title">{title}</span>

  <div class="hdr-right">
    <button
      class="hdr-btn"
      onclick={(e) => { e.stopPropagation(); onToggleMaximize(); }}
      aria-label={maximized ? 'Restore' : 'Maximize'}
      title={maximized ? 'Restore' : 'Maximize'}
    >
      {#if maximized}
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
          <rect x="4" y="4" width="8" height="8" rx="1"/>
          <path d="M2 8V3a1 1 0 0 1 1-1h5"/>
        </svg>
      {:else}
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="2" width="10" height="10" rx="1"/>
        </svg>
      {/if}
    </button>
    <button class="close-btn" onclick={onClose} aria-label="Close">
      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
        <line x1="3" y1="3" x2="11" y2="11"/>
        <line x1="11" y1="3" x2="3" y2="11"/>
      </svg>
    </button>
  </div>
</div>

<style>
  .pr-header {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px;
    height: 36px;
    background: #181818;
    border-bottom: 1px solid var(--explorer-border, #3f484e);
    flex-shrink: 0;
    cursor: grab;
    user-select: none;
  }

  .pr-header:active { cursor: grabbing; }

  .hdr-left,
  .hdr-right {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }

  .pr-title {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 13px;
    font-weight: 600;
    color: var(--main-text, #d0d0d0);
    pointer-events: none;
    white-space: nowrap;
    max-width: 50%;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .hdr-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    color: rgba(255,255,255,0.45);
    cursor: pointer;
    padding: 0;
    transition: color 0.1s, background 0.1s, border-color 0.1s;
  }

  .hdr-btn svg { width: 14px; height: 14px; }

  .hdr-btn:hover {
    background: rgba(255,255,255,0.07);
    color: rgba(255,255,255,0.75);
  }

  .hdr-tgl--on {
    color: var(--accent, #90c396);
    border-color: rgba(144,195,150,0.3);
  }

  .hdr-tgl--on:hover {
    color: var(--accent, #90c396);
    background: rgba(144,195,150,0.1);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    color: rgba(255,255,255,0.4);
    cursor: pointer;
    padding: 0;
    transition: color 0.1s, background 0.1s;
  }

  .close-btn svg { width: 12px; height: 12px; }

  .close-btn:hover {
    background: rgba(220,50,50,0.18);
    color: #ff6b6b;
    border-color: rgba(220,50,50,0.3);
  }
</style>
