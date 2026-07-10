<script lang="ts">
  import FloatingWindow, { type WorkspaceBounds } from './FloatingWindow.svelte';
  import ScrollField from './ScrollField.svelte';
  import { patternStore } from '$lib/patternStore.svelte';
  import { channelStore } from '$lib/channelStore.svelte';
  import { placementStore } from '$lib/placementStore.svelte';
  import type { PatternData, Placement } from '$lib/types';

  const TRACK_PANEL_W = 180;
  const PATTERNS_PANEL_W = 168;
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
  let pixelsPerBeat = $derived(barWidth / channelStore.beatsPerBar);

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

  // ── Pattern placements (drag from the patterns panel onto the timeline) ──
  let gridEl = $state<HTMLDivElement | undefined>();

  type DragState = { patternId: number; x: number; y: number; placementId?: number; grabBeat: number };
  let pendingDrag = $state<{ patternId: number; startX: number; startY: number; placementId?: number; grabBeat: number } | null>(null);
  let dragging = $state<DragState | null>(null);

  function patternOf(id: number): PatternData | undefined {
    return patternStore.patterns.find(p => p.id === id);
  }

  function onPatternPointerDown(e: PointerEvent, pattern: PatternData) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.sf-wrap')) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    pendingDrag = { patternId: pattern.id, startX: e.clientX, startY: e.clientY, grabBeat: 0 };
  }

  function onPlacementPointerDown(e: PointerEvent, placement: Placement) {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (!gridEl) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const rect = gridEl.getBoundingClientRect();
    const beatUnderCursor = (e.clientX - rect.left - TRACK_PANEL_W) / pixelsPerBeat;
    pendingDrag = {
      patternId: placement.patternId,
      startX: e.clientX,
      startY: e.clientY,
      placementId: placement.id,
      grabBeat: beatUnderCursor - placement.startBeat,
    };
  }

  function findTrackIdAt(x: number, y: number): number | null {
    const el = document.elementsFromPoint(x, y).find(el => el.hasAttribute('data-track-id'));
    return el ? Number(el.getAttribute('data-track-id')) : null;
  }

  function removePlacement(id: number) {
    placementStore.remove(id);
  }

  $effect(() => {
    function onMove(e: PointerEvent) {
      if (pendingDrag) {
        const dx = e.clientX - pendingDrag.startX;
        const dy = e.clientY - pendingDrag.startY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
          dragging = { ...pendingDrag, x: e.clientX, y: e.clientY };
          pendingDrag = null;
        }
      } else if (dragging) {
        dragging = { ...dragging, x: e.clientX, y: e.clientY };
      }
    }

    function onUp() {
      if (dragging && gridEl) {
        const trackId = findTrackIdAt(dragging.x, dragging.y);
        if (trackId != null) {
          const rect = gridEl.getBoundingClientRect();
          const rawBeat = (dragging.x - rect.left - TRACK_PANEL_W) / pixelsPerBeat - dragging.grabBeat;
          const startBeat = Math.max(0, Math.round(rawBeat));
          if (dragging.placementId != null) {
            placementStore.update(dragging.placementId, { trackId, startBeat });
          } else {
            placementStore.add(dragging.patternId, trackId, startBeat);
          }
        }
      }
      dragging = null;
      pendingDrag = null;
    }

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
  });
</script>

<FloatingWindow
  id="playlist"
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

<div class="playlist-body" style="--panel-w: {TRACK_PANEL_W}px; --patterns-w: {PATTERNS_PANEL_W}px;">
  <!-- ── Patterns panel ────────────────────────────────────────────── -->
  <div class="patterns-panel">
    <div class="patterns-head">Patterns</div>
    <div class="patterns-list">
      {#each patternStore.patterns as pattern (pattern.id)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
          class="pattern-card"
          class:pattern-card--selected={pattern.id === patternStore.selectedPatternId}
          style="--pc: {pattern.color}"
          onpointerdown={(e) => onPatternPointerDown(e, pattern)}
          onclick={() => patternStore.selectedPatternId = pattern.id}
          role="button"
          tabindex="0"
        >
          <span class="pattern-swatch"></span>
          <span class="pattern-name">{pattern.name}</span>
          <ScrollField bind:value={pattern.lengthBeats} min={0.25} max={999} step={0.25} decimals={2} width={40} label="beats" tooltipKey="LENGTH" />
        </div>
      {/each}
    </div>
    <div class="patterns-footer">
      <button class="add-btn" onclick={() => patternStore.addPattern()} aria-label="Add pattern" title="Add pattern">+</button>
    </div>
  </div>

  <div
    class="playlist"
    style="--track-h: {trackHeight}px; --bar-w: {barWidth}px; --ruler-h: {RULER_H}px; --panel-w: {TRACK_PANEL_W}px;"
  >
    <div class="grid" bind:this={gridEl} style="width: {totalWidth}px;">
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
        <div class="track-row" data-track-id={track.id}>
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
          {#each placementStore.placements.filter(p => p.trackId === track.id) as placement (placement.id)}
            {@const pattern = patternOf(placement.patternId)}
            {#if pattern}
              <div
                class="placed-pattern"
                class:being-dragged={dragging?.placementId === placement.id}
                style="left: {TRACK_PANEL_W + placement.startBeat * pixelsPerBeat}px; width: {pattern.lengthBeats * pixelsPerBeat}px; --pc: {pattern.color}"
                onpointerdown={(e) => onPlacementPointerDown(e, placement)}
                oncontextmenu={(e) => { e.preventDefault(); removePlacement(placement.id); }}
                title="{pattern.name} ({pattern.lengthBeats} beats)"
                role="button"
                tabindex="-1"
              >
                <span class="placed-pattern-name">{pattern.name}</span>
              </div>
            {/if}
          {/each}
        </div>
      {/each}
    </div>
  </div>

  <!-- Drag ghost -->
  {#if dragging}
    {@const pattern = patternOf(dragging.patternId)}
    {#if pattern}
      <div class="drag-ghost" style="left: {dragging.x + 12}px; top: {dragging.y - 10}px; --pc: {pattern.color}" aria-hidden="true">
        <span class="ghost-swatch"></span>
        <span>{pattern.name}</span>
      </div>
    {/if}
  {/if}
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

  .playlist-body {
    flex: 1;
    min-height: 0;
    display: flex;
    position: relative;
  }

  .playlist {
    flex: 1;
    min-height: 0;
    min-width: 0;
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
    position: relative;
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

  /* ── Placed pattern blocks ───────────────────── */
  .placed-pattern {
    position: absolute;
    top: 4px;
    bottom: 4px;
    z-index: 0;
    display: flex;
    align-items: center;
    background: color-mix(in srgb, var(--pc) 30%, #1c1c1c);
    border: 1px solid var(--pc);
    border-radius: 3px;
    padding: 0 6px;
    overflow: hidden;
    cursor: grab;
    box-sizing: border-box;
  }

  .placed-pattern:active { cursor: grabbing; }
  .placed-pattern.being-dragged { opacity: 0.35; }

  .placed-pattern-name {
    font-size: 10.5px;
    color: #efefef;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    user-select: none;
    pointer-events: none;
  }

  /* ── Patterns panel (right of the timeline) ──── */
  .patterns-panel {
    width: var(--patterns-w);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: #181818;
    border-right: 1px solid var(--main-border);
  }

  .patterns-head {
    flex-shrink: 0;
    padding: 7px 10px 6px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--main-text-muted);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .patterns-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .patterns-list::-webkit-scrollbar { width: 6px; }
  .patterns-list::-webkit-scrollbar-thumb { background: var(--main-border); border-radius: 3px; }

  .pattern-card {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 6px 7px;
    background: var(--btn-bg);
    border: 1px solid var(--btn-border);
    border-radius: 4px;
    cursor: grab;
    transition: background 0.1s, border-color 0.1s;
  }

  .pattern-card:active { cursor: grabbing; }
  .pattern-card:hover { background: var(--btn-hover); }

  .pattern-card--selected {
    border-color: var(--pc);
    background: color-mix(in srgb, var(--pc) 14%, var(--btn-bg));
  }

  .pattern-swatch {
    width: 9px;
    height: 9px;
    border-radius: 2px;
    background: var(--pc);
    flex-shrink: 0;
  }

  .pattern-name {
    flex: 1;
    min-width: 0;
    font-size: 12px;
    color: var(--main-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    user-select: none;
  }

  .patterns-footer {
    flex-shrink: 0;
    display: flex;
    justify-content: center;
    padding: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .add-btn {
    width: 22px;
    height: 22px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: transparent;
    color: rgba(255, 255, 255, 0.6);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    transition: background 0.1s, color 0.1s, border-color 0.1s;
  }

  .add-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--main-text);
    border-color: rgba(255, 255, 255, 0.3);
  }

  /* ── Drag ghost ───────────────────────────────── */
  .drag-ghost {
    position: fixed;
    pointer-events: none;
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px 4px 7px;
    background: #252525;
    border: 1px solid var(--pc);
    border-radius: 5px;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.6);
    font-family: inherit;
    font-size: 12.5px;
    color: #D0D0D0;
    white-space: nowrap;
  }

  .ghost-swatch {
    width: 8px;
    height: 8px;
    border-radius: 2px;
    background: var(--pc);
    flex-shrink: 0;
  }
</style>
