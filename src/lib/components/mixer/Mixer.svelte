<script lang="ts">
  import FloatingWindow, { type WorkspaceBounds } from '../FloatingWindow.svelte';
  import MixerChannelStrip from './MixerChannelStrip.svelte';
  import MixerCables from './MixerCables.svelte';
  import FilterSlot from './FilterSlot.svelte';
  import { mixerStore, MASTER_TRACK_ID } from '$lib/mixerStore.svelte';

  let { show = $bindable(), workspaceBounds }: { show: boolean; workspaceBounds: WorkspaceBounds } = $props();

  function close() { show = false; }

  // ── Port registry ─────────────────────────────────────────────────────
  // Plain (non-reactive) map — port DOM elements themselves never need to
  // be reactive state, only the geometry derived from them does (via
  // geometryTick below).
  const portEls = new Map<string, HTMLElement>();
  function portKey(trackId: number, kind: 'in' | 'out') { return `${trackId}-${kind}`; }

  function onPortMount(trackId: number, kind: 'in' | 'out', el: HTMLElement) {
    portEls.set(portKey(trackId, kind), el);
    geometryTick++;
  }
  function onPortUnmount(trackId: number, kind: 'in' | 'out') {
    portEls.delete(portKey(trackId, kind));
    geometryTick++;
  }

  // ── Cable-drag gesture ───────────────────────────────────────────────
  let dragFrom = $state<{ trackId: number; kind: 'in' | 'out' } | null>(null);
  let dragPos  = $state<{ x: number; y: number } | null>(null);

  function onPortDown(trackId: number, kind: 'in' | 'out', e: MouseEvent) {
    // Picking up an already-connected port detaches its existing cable
    // first, then starts a fresh drag from the now-free port — the same
    // "pick up and rewire" gesture as a real patchbay.
    const existing = mixerStore.connectionForPort(trackId, kind);
    if (existing) mixerStore.disconnect(existing.id);
    dragFrom = { trackId, kind };
    dragPos = { x: e.clientX, y: e.clientY };
  }

  // Raw mousemove can fire far faster than the display refresh rate (into
  // the hundreds of Hz on some mice/drivers), and dragPath's derivation
  // below forces a synchronous layout read (getBoundingClientRect) on every
  // change to dragPos — updating it unthrottled turned every pixel of
  // cursor movement during a cable drag into a forced-reflow layout thrash,
  // which is what was freezing the app. Coalesce to one update per animation
  // frame instead, the same rAF-throttle pattern already used for scroll.
  let dragMoveRaf = 0;
  let pendingDragXY: { x: number; y: number } | null = null;

  function onWindowMousemove(e: MouseEvent) {
    if (!dragFrom) return;
    pendingDragXY = { x: e.clientX, y: e.clientY };
    if (dragMoveRaf) return;
    dragMoveRaf = requestAnimationFrame(() => {
      dragPos = pendingDragXY;
      dragMoveRaf = 0;
    });
  }

  function onWindowMouseup(e: MouseEvent) {
    if (!dragFrom) return;
    if (dragMoveRaf) { cancelAnimationFrame(dragMoveRaf); dragMoveRaf = 0; }
    const target = document.elementsFromPoint(e.clientX, e.clientY)
      .find(el => el.hasAttribute('data-jack-track-id'));
    if (target) {
      const toTrackId = Number(target.getAttribute('data-jack-track-id'));
      const toKind = target.getAttribute('data-jack-kind') as 'in' | 'out';
      if (toKind !== dragFrom.kind && toTrackId !== dragFrom.trackId) {
        const outSide = dragFrom.kind === 'out' ? dragFrom : { trackId: toTrackId, kind: toKind };
        const inSide  = dragFrom.kind === 'in'  ? dragFrom : { trackId: toTrackId, kind: toKind };
        mixerStore.connect(outSide.trackId, inSide.trackId);
      }
    }
    dragFrom = null;
    dragPos = null;
  }

  // ── Cable geometry ───────────────────────────────────────────────────
  // getBoundingClientRect() reads aren't reactive on their own, so
  // geometryTick is bumped manually on every event that can move a port
  // (mount/unmount, resize, scroll) to force paths/dragPath to recompute.
  // Whole-window drag/resize/maximize needs no such wiring — the overlay is
  // a plain DOM descendant of the same moving FloatingWindow, so its
  // measurements (relative to cableZoneEl, not the viewport) stay correct
  // automatically as the window moves.
  let geometryTick = $state(0);
  let cableZoneEl = $state<HTMLElement | undefined>();
  let channelScrollEl = $state<HTMLElement | undefined>();

  function portCenter(el: HTMLElement, zoneRect: DOMRect) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 - zoneRect.left, y: r.top + r.height / 2 - zoneRect.top };
  }

  let paths = $derived.by(() => {
    geometryTick;
    if (!cableZoneEl) return [];
    const zoneRect = cableZoneEl.getBoundingClientRect();
    const list: { id: number; x1: number; y1: number; x2: number; y2: number }[] = [];
    for (const c of mixerStore.connections) {
      const fromEl = portEls.get(portKey(c.fromTrackId, 'out'));
      const toEl = portEls.get(portKey(c.toTrackId, 'in'));
      if (!fromEl || !toEl) continue;
      const p1 = portCenter(fromEl, zoneRect);
      const p2 = portCenter(toEl, zoneRect);
      list.push({ id: c.id, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
    }
    return list;
  });

  let dragPath = $derived.by(() => {
    geometryTick;
    if (!dragFrom || !dragPos || !cableZoneEl) return null;
    const fromEl = portEls.get(portKey(dragFrom.trackId, dragFrom.kind));
    if (!fromEl) return null;
    const zoneRect = cableZoneEl.getBoundingClientRect();
    const p1 = portCenter(fromEl, zoneRect);
    const p2 = { x: dragPos.x - zoneRect.left, y: dragPos.y - zoneRect.top };
    // Drawn OUT -> cursor regardless of which end the drag started from, so
    // the preview cable always "hangs" the same visual direction as a
    // committed cable would.
    return dragFrom.kind === 'out'
      ? { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }
      : { x1: p2.x, y1: p2.y, x2: p1.x, y2: p1.y };
  });

  $effect(() => {
    if (!cableZoneEl) return;
    const ro = new ResizeObserver(() => geometryTick++);
    ro.observe(cableZoneEl);
    function onResize() { geometryTick++; }
    window.addEventListener('resize', onResize);
    return () => { ro.disconnect(); window.removeEventListener('resize', onResize); };
  });

  let scrollRaf = 0;
  function onChannelScroll() {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => { geometryTick++; scrollRaf = 0; });
  }
</script>

<svelte:window onmousemove={onWindowMousemove} onmouseup={onWindowMouseup} />

<FloatingWindow
  id="mixer"
  bind:show
  {workspaceBounds}
  x={100} y={100} width={900} height={380}
  minWidth={560} minHeight={280}
>
  {#snippet header({ onDragStart, maximized, toggleMaximize })}
    <div class="mixer-header" onmousedown={onDragStart} role="toolbar" aria-label="Mixer controls" tabindex="-1">
      <span class="mixer-title">Mixer</span>
      <div class="hdr-right">
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

  <div class="mixer-body">
    <div class="cable-zone" bind:this={cableZoneEl}>
      <MixerChannelStrip
        variant="master"
        data={mixerStore.master}
        inConnected={!!mixerStore.connectionForPort(MASTER_TRACK_ID, 'in')}
        {onPortMount} {onPortUnmount} {onPortDown}
      />

      <div class="v-divider"></div>

      <div class="channels-scroll" bind:this={channelScrollEl} onscroll={onChannelScroll}>
        {#each mixerStore.channels as ch (ch.id)}
          <MixerChannelStrip
            variant="channel"
            data={ch}
            inConnected={!!mixerStore.connectionForPort(ch.id, 'in')}
            outConnected={!!mixerStore.connectionForPort(ch.id, 'out')}
            {onPortMount} {onPortUnmount} {onPortDown}
          />
        {/each}
        <button class="add-channel-btn" onclick={() => mixerStore.addChannel()} aria-label="Add channel" title="Add channel">+</button>
      </div>

      <MixerCables {paths} {dragPath} />
    </div>

    <div class="v-divider"></div>

    <div class="filter-rack">
      <div class="filter-rack-title">Filters</div>
      <div class="filter-rack-list">
        {#each mixerStore.filterSlots as slot, i (slot.id)}
          <FilterSlot {slot} index={i} />
        {/each}
      </div>
    </div>
  </div>
</FloatingWindow>

<style>
  .mixer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px;
    height: 34px;
    background: #181818;
    border-bottom: 1px solid var(--explorer-border, #3f484e);
    flex-shrink: 0;
    cursor: grab;
    user-select: none;
  }

  .mixer-header:active { cursor: grabbing; }

  .mixer-title {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 14px;
    font-weight: 600;
    color: var(--main-text, #d0d0d0);
    pointer-events: none;
  }

  .hdr-right {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .hdr-btn, .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.45);
    cursor: pointer;
    padding: 0;
    transition: color 0.1s, background 0.1s, border-color 0.1s;
  }

  .hdr-btn svg, .close-btn svg { width: 13px; height: 13px; }

  .hdr-btn:hover { background: rgba(255, 255, 255, 0.07); color: rgba(255, 255, 255, 0.75); }

  .close-btn:hover {
    background: rgba(220, 50, 50, 0.18);
    color: #ff6b6b;
    border-color: rgba(220, 50, 50, 0.3);
  }

  .mixer-body {
    flex: 1;
    min-height: 0;
    display: flex;
    background: var(--main-bg, #1a1a1a);
    overflow: hidden;
  }

  .cable-zone {
    position: relative;
    display: flex;
    align-items: stretch;
    min-width: 0;
    flex: 1;
    overflow: hidden;
  }

  .v-divider {
    width: 1px;
    background: var(--explorer-border, #3f484e);
    flex-shrink: 0;
  }

  .channels-scroll {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .channels-scroll::-webkit-scrollbar { height: 6px; }
  .channels-scroll::-webkit-scrollbar-track { background: transparent; }
  .channels-scroll::-webkit-scrollbar-thumb {
    background: var(--explorer-border, #333);
    border-radius: 3px;
  }

  .cable-zone > :global(.strip--master) {
    margin: 12px 0 12px 12px;
  }

  .add-channel-btn {
    width: 28px;
    height: 28px;
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
    flex-shrink: 0;
    transition: background 0.1s, color 0.1s, border-color 0.1s;
  }

  .add-channel-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--main-text, #d0d0d0);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .filter-rack {
    width: 190px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background: var(--explorer-bg, #1e1e1e);
  }

  .filter-rack-title {
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--main-text-muted, #666);
    padding: 8px 10px;
    border-bottom: 1px solid var(--explorer-border, #3f484e);
    flex-shrink: 0;
  }

  .filter-rack-list {
    flex: 1;
    overflow-y: auto;
  }

  .filter-rack-list::-webkit-scrollbar { width: 6px; }
  .filter-rack-list::-webkit-scrollbar-track { background: transparent; }
  .filter-rack-list::-webkit-scrollbar-thumb {
    background: var(--explorer-border, #333);
    border-radius: 3px;
  }
</style>
