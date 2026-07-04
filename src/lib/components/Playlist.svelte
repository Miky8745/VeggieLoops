<script lang="ts">
  import FloatingWindow, { type WorkspaceBounds } from './FloatingWindow.svelte';

  const TRACK_PANEL_W = 180;
  const RULER_H = 24;

  interface Track {
    id: number;
    name: string;
    color: string;
  }

  let { show = $bindable(true), workspaceBounds }: { show?: boolean; workspaceBounds: WorkspaceBounds } = $props();

  function close() { show = false; }

  let trackHeight = $state(48);
  let barWidth = $state(40);
  let barCount = $state(64);

  let tracks = $state<Track[]>([
    { id: 1, name: 'Track 1', color: '#90C396' },
    { id: 2, name: 'Track 2', color: '#90C396' },
    { id: 3, name: 'Track 3', color: '#90C396' },
    { id: 4, name: 'Track 4', color: '#90C396' },
    { id: 5, name: 'Track 5', color: '#90C396' },
    { id: 6, name: 'Track 6', color: '#90C396' },
    { id: 7, name: 'Track 7', color: '#90C396' },
    { id: 8, name: 'Track 8', color: '#90C396' },
  ]);

  let groupCount = $derived(Math.ceil(barCount / 4));
  let totalWidth = $derived(TRACK_PANEL_W + barCount * barWidth);

  const SHADE_A = '#1C1C1C';
  const SHADE_B = '#222222';
  const RULER_A = '#151515';
  const RULER_B = '#1A1A1A';

  function cellBg(barIndex: number): string {
    return Math.floor(barIndex / 4) % 2 === 0 ? SHADE_A : SHADE_B;
  }

  function rulerBg(groupIndex: number): string {
    return groupIndex % 2 === 0 ? RULER_A : RULER_B;
  }
</script>

<FloatingWindow
  bind:show
  {workspaceBounds}
  maximized={true}
  x={100} y={100} width={900} height={500}
  minWidth={480} minHeight={260}
>
  {#snippet header({ onDragStart, maximized, toggleMaximize })}
    <div class="pl-header" onmousedown={onDragStart} role="toolbar" aria-label="Playlist controls" tabindex="-1">
      <span class="pl-title">Playlist</span>
      <div class="pl-header-right">
        <button
          class="hdr-btn"
          onclick={(e) => { e.stopPropagation(); toggleMaximize(); }}
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
        <button class="close-btn" onclick={close} aria-label="Close">
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <line x1="3" y1="3" x2="11" y2="11"/>
            <line x1="11" y1="3" x2="3" y2="11"/>
          </svg>
        </button>
      </div>
    </div>
  {/snippet}

<div
  class="playlist"
  style="--track-h: {trackHeight}px; --bar-w: {barWidth}px; --ruler-h: {RULER_H}px; --panel-w: {TRACK_PANEL_W}px;"
>
  <div class="grid" style="width: {totalWidth}px;">
    <!-- Ruler row -->
    <div class="ruler-row">
      <div class="ruler-corner"></div>
      {#each Array.from({ length: groupCount }) as _, gi}
        {@const barsInGroup = Math.min(4, barCount - gi * 4)}
        <div
          class="ruler-group"
          style="background: {rulerBg(gi)}; width: {barsInGroup * barWidth}px;"
        >
          <span class="bar-num">{gi * 4 + 1}</span>
        </div>
      {/each}
    </div>

    <!-- Track rows -->
    {#each tracks as track (track.id)}
      <div class="track-row">
        <div class="track-panel" style="--tc: {track.color}">
          <span class="color-strip"></span>
          <span class="track-name-text">{track.name}</span>
        </div>
        {#each Array.from({ length: barCount }) as _, bi}
          <div
            class="bar-cell"
            class:group-start={bi % 4 === 0}
            style="background: {cellBg(bi)};"
          ></div>
        {/each}
      </div>
    {/each}
  </div>
</div>
</FloatingWindow>

<style>
  /* ── Header (mirrors ChannelRack/PianoRollHeader chrome) ──────────── */
  .pl-header {
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

  .pl-header:active { cursor: grabbing; }

  .pl-title {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 13px;
    font-weight: 600;
    color: var(--main-text, #d0d0d0);
    pointer-events: none;
    white-space: nowrap;
  }

  .pl-header-right {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-left: auto;
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

  .playlist {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  .grid {
    display: flex;
    flex-direction: column;
    min-height: 100%;
  }

  /* ── Ruler ─────────────────────────────────── */
  .ruler-row {
    display: flex;
    height: var(--ruler-h);
    position: sticky;
    top: 0;
    z-index: 2;
    flex-shrink: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .ruler-corner {
    width: var(--panel-w);
    flex-shrink: 0;
    background: #131313;
    border-right: 1px solid var(--main-border);
    position: sticky;
    left: 0;
    z-index: 3;
  }

  .ruler-group {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    padding-left: 5px;
    border-right: 1px solid rgba(255, 255, 255, 0.04);
    box-sizing: border-box;
  }

  .bar-num {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.22);
    letter-spacing: 0.03em;
    font-variant-numeric: tabular-nums;
    user-select: none;
    pointer-events: none;
  }

  /* ── Track rows ─────────────────────────────── */
  .track-row {
    display: flex;
    height: var(--track-h);
    flex-shrink: 0;
    border-bottom: 1px solid rgba(0, 0, 0, 0.35);
  }

  .track-panel {
    width: var(--panel-w);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    background: #181818;
    border-right: 1px solid var(--main-border);
    position: sticky;
    left: 0;
    z-index: 1;
    padding: 0 10px;
    overflow: hidden;
  }

  .color-strip {
    width: 3px;
    height: 20px;
    border-radius: 2px;
    background: var(--tc);
    flex-shrink: 0;
  }

  .track-name-text {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    user-select: none;
  }

  /* ── Bar cells ──────────────────────────────── */
  .bar-cell {
    width: var(--bar-w);
    flex-shrink: 0;
    border-right: 1px solid rgba(0, 0, 0, 0.25);
    cursor: pointer;
    box-sizing: border-box;
    transition: background 0.08s;
  }

  .bar-cell.group-start {
    border-left: 1px solid rgba(255, 255, 255, 0.06);
  }

  .bar-cell:hover {
    background: rgba(255, 255, 255, 0.07) !important;
  }

  /* ── Scrollbars ─────────────────────────────── */
  .playlist::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .playlist::-webkit-scrollbar-track {
    background: #141414;
  }

  .playlist::-webkit-scrollbar-thumb {
    background: var(--main-border);
    border-radius: 4px;
  }

  .playlist::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.18);
  }

  .playlist::-webkit-scrollbar-corner {
    background: #141414;
  }
</style>
