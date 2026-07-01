<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { ChannelData } from '$lib/types';
  import Dial from './Dial.svelte';
  import ScrollField from './ScrollField.svelte';
  import ChannelRow from './ChannelRow.svelte';
  import { playback } from '$lib/playbackStore.svelte';
  import { audioEngine } from '$lib/audioEngine';

  let { show = $bindable() }: { show: boolean } = $props();

  // ── Window drag ────────────────────────────────────────────────────
  let x = $state(120);
  let y = $state(80);
  let winDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  function onHeaderMousedown(e: MouseEvent) {
    const t = e.target as HTMLElement;
    if (t.closest('button, [role="slider"], [role="spinbutton"], .resize-handle')) return;
    winDragging = true;
    dragOffsetX = e.clientX - x;
    dragOffsetY = e.clientY - y;
    e.preventDefault();
  }

  // ── Name column resize ─────────────────────────────────────────────
  let nameColWidth = $state(140);
  let colResizing = false;
  let resizeStartX = 0;
  let resizeStartW = 0;

  function onResizeMousedown(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    colResizing = true;
    resizeStartX = e.clientX;
    resizeStartW = nameColWidth;
  }

  // ── Global mouse tracking ──────────────────────────────────────────
  function onWindowMousemove(e: MouseEvent) {
    if (winDragging) {
      x = e.clientX - dragOffsetX;
      y = e.clientY - dragOffsetY;
    }
    if (colResizing) {
      nameColWidth = Math.max(80, Math.min(280, resizeStartW + (e.clientX - resizeStartX)));
    }
  }

  function onWindowMouseup() {
    winDragging = false;
    colResizing = false;
  }

  // ── Header toggles ─────────────────────────────────────────────────
  let loopStart   = $state(false);
  let loopMode    = $state(false);
  let graphEditor = $state(false);
  let prOverview  = $state(false);

  // ── Swing & pattern length ─────────────────────────────────────────
  let swing         = $state(0);
  let patternLength = $state(16);

  // ── Playback / audio engine ────────────────────────────────────────
  let rafId = 0;

  function startRaf() {
    function frame() {
      if (!playback.isPlaying) return;
      const elapsed = audioEngine.currentTime - audioEngine.startAudioTime;
      if (elapsed >= 0) {
        playback.currentStep = Math.floor(elapsed / audioEngine.stepDuration) % patternLength;
      }
      rafId = requestAnimationFrame(frame);
    }
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(frame);
  }

  function stopRaf() {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }

  // Using getter closures so channels/tempo are read live inside the engine
  // without becoming reactive dependencies of this effect.
  $effect(() => {
    if (playback.isPlaying) {
      audioEngine.stop();
      audioEngine.start(
        () => playback.tempo,
        () => channels,
        patternLength,
      );
      startRaf();
    } else {
      audioEngine.stop();
      stopRaf();
      playback.currentStep = -1;
    }
  });

  onDestroy(() => {
    audioEngine.stop();
    stopRaf();
  });

  // ── Dropdowns ──────────────────────────────────────────────────────
  let optionsOpen = $state(false);
  let filterOpen  = $state(false);
  let filter      = $state<'all' | 'unsorted'>('all');

  function toggleOptions(e: MouseEvent) {
    e.stopPropagation();
    optionsOpen = !optionsOpen;
    if (optionsOpen) filterOpen = false;
  }

  function toggleFilter(e: MouseEvent) {
    e.stopPropagation();
    filterOpen = !filterOpen;
    if (filterOpen) optionsOpen = false;
  }

  function closeDropdowns() {
    optionsOpen = false;
    filterOpen = false;
  }

  // ── Channels ───────────────────────────────────────────────────────
  let nextId = 1;

  function makeChannel(id: number): ChannelData {
    return {
      id,
      samplePath: null,
      muted: false,
      pan: 0.5,
      volume: 0.8,
      mixerTrack: 0,
      steps: Array(16).fill(false) as boolean[],
    };
  }

  let channels = $state<ChannelData[]>([makeChannel(0)]);

  function addChannel() {
    channels.push(makeChannel(nextId++));
  }

  // ── Selection ──────────────────────────────────────────────────────
  let selectedIds     = $state(new Set<number>());
  let lastSelectedIdx = -1;

  function handleSelect(i: number, e: MouseEvent) {
    const id = channels[i].id;
    if (e.ctrlKey || e.metaKey) {
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id); else next.add(id);
      selectedIds = next;
    } else if (e.shiftKey && lastSelectedIdx >= 0) {
      const lo = Math.min(lastSelectedIdx, i);
      const hi = Math.max(lastSelectedIdx, i);
      selectedIds = new Set(channels.slice(lo, hi + 1).map(c => c.id));
    } else {
      selectedIds = new Set([id]);
    }
    lastSelectedIdx = i;
  }

  function close() { show = false; }
</script>

<svelte:window onmousemove={onWindowMousemove} onmouseup={onWindowMouseup} />

{#if show}
  <!-- Backdrop to close dropdowns when clicking outside them -->
  {#if optionsOpen || filterOpen}
    <div class="dd-backdrop" onmousedown={closeDropdowns} role="presentation"></div>
  {/if}

  <div
    class="rack"
    role="dialog"
    aria-label="Channel Rack"
    tabindex="-1"
    style="left:{x}px; top:{y}px;"
  >
    <!-- ══ TITLE BAR ══════════════════════════════════════════════════ -->
    <div class="rack-header" onmousedown={onHeaderMousedown} role="toolbar" aria-label="Channel Rack controls" tabindex="-1">

      <!-- Left group -->
      <div class="hdr-left">
        <!-- 1. Channel options -->
        <div class="dd-wrap">
          <button class="hdr-btn" onclick={toggleOptions} aria-label="Channel options" title="Channel options">
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
              <circle cx="7" cy="7" r="2.2"/>
              <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.9 2.9l1.1 1.1M10 10l1.1 1.1M11.1 2.9L10 4M4 10l-1.1 1.1"/>
            </svg>
          </button>
          {#if optionsOpen}
            <div class="dropdown" role="menu">
              <button class="dd-item" role="menuitem" onclick={closeDropdowns}>Channel settings</button>
              <button class="dd-item" role="menuitem" onclick={closeDropdowns}>Rename</button>
              <button class="dd-item" role="menuitem" onclick={closeDropdowns}>Color</button>
            </div>
          {/if}
        </div>

        <!-- 2. Loop start toggle -->
        <button
          class="hdr-btn hdr-tgl"
          class:hdr-tgl--on={loopStart}
          onclick={(e) => { e.stopPropagation(); loopStart = !loopStart; }}
          aria-label="Loop start mode"
          title="Loop start mode"
        >
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 7a5 5 0 1 0 5-5"/>
            <polyline points="7,1 7,3.5 4.5,2.2"/>
          </svg>
        </button>

        <!-- 3. Filter dropdown -->
        <div class="dd-wrap">
          <button class="hdr-btn hdr-filter" onclick={toggleFilter} aria-label="Filter" title="Filter">
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round">
              <path d="M1 2h12L9 7v5H5V7L1 2z"/>
            </svg>
            <span class="filter-label">{filter === 'all' ? 'ALL' : 'UNSORTED'}</span>
          </button>
          {#if filterOpen}
            <div class="dropdown" role="menu">
              <button class="dd-item" class:dd-item--active={filter === 'all'} role="menuitem"
                onclick={() => { filter = 'all'; filterOpen = false; }}>All</button>
              <button class="dd-item" class:dd-item--active={filter === 'unsorted'} role="menuitem"
                onclick={() => { filter = 'unsorted'; filterOpen = false; }}>Unsorted</button>
            </div>
          {/if}
        </div>

        <!-- 4. Resize handle -->
        <div
          class="resize-handle"
          onmousedown={onResizeMousedown}
          role="slider"
          aria-label="Resize name column"
          title="Drag to resize sample name column"
          aria-valuenow={nameColWidth}
          aria-valuemin={80}
          aria-valuemax={280}
          tabindex="0"
        >
          <svg viewBox="0 0 8 14" fill="currentColor">
            <circle cx="4" cy="3"  r="1.5"/>
            <circle cx="4" cy="7"  r="1.5"/>
            <circle cx="4" cy="11" r="1.5"/>
          </svg>
        </div>

        <!-- 5. Play/stop toggle -->
        <button
          class="hdr-btn hdr-tgl"
          class:hdr-tgl--on={playback.isPlaying}
          onclick={(e) => { e.stopPropagation(); playback.isPlaying = !playback.isPlaying; }}
          aria-label={playback.isPlaying ? 'Stop' : 'Play'}
          title={playback.isPlaying ? 'Stop' : 'Play'}
        >
          {#if playback.isPlaying}
            <svg viewBox="0 0 14 14" fill="currentColor">
              <rect x="3" y="3" width="3" height="8" rx="0.5"/>
              <rect x="8" y="3" width="3" height="8" rx="0.5"/>
            </svg>
          {:else}
            <svg viewBox="0 0 14 14" fill="currentColor">
              <path d="M4 2.5l7 4.5-7 4.5z"/>
            </svg>
          {/if}
        </button>
      </div>

      <!-- Center title -->
      <span class="rack-title">Channel Rack</span>

      <!-- Right group -->
      <div class="hdr-right">
        <!-- 7. Swing dial -->
        <div class="dial-group">
          <Dial bind:value={swing} defaultValue={0} showArc={true} size={26} sensitivity={180} />
          <span class="dial-label">SWING</span>
        </div>

        <!-- 8. Pattern length -->
        <div class="sf-group">
          <ScrollField bind:value={patternLength} min={1} max={999} width={34} />
          <span class="dial-label">LEN</span>
        </div>

        <!-- 9. Loop mode -->
        <button
          class="hdr-btn hdr-tgl"
          class:hdr-tgl--on={loopMode}
          onclick={(e) => { e.stopPropagation(); loopMode = !loopMode; }}
          aria-label="Loop mode"
          title="Loop mode"
        >
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 7a5 5 0 1 0-5 5"/>
            <polyline points="7,13 7,10.5 9.5,11.8"/>
          </svg>
        </button>

        <!-- 10. Graph editor -->
        <button
          class="hdr-btn hdr-tgl"
          class:hdr-tgl--on={graphEditor}
          onclick={(e) => { e.stopPropagation(); graphEditor = !graphEditor; }}
          aria-label="Graph editor"
          title="Graph editor"
        >
          <svg viewBox="0 0 14 14" fill="currentColor">
            <rect x="1"   y="6" width="3" height="7" rx="0.5"/>
            <rect x="5.5" y="3" width="3" height="10" rx="0.5"/>
            <rect x="10"  y="5" width="3" height="8" rx="0.5"/>
          </svg>
        </button>

        <!-- 11. Piano roll overview -->
        <button
          class="hdr-btn hdr-tgl"
          class:hdr-tgl--on={prOverview}
          onclick={(e) => { e.stopPropagation(); prOverview = !prOverview; }}
          aria-label="Piano roll overview"
          title="Piano roll overview"
        >
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1">
            <rect x="1" y="1" width="12" height="12" rx="1"/>
            <line x1="1"  y1="5"  x2="13" y2="5"/>
            <line x1="1"  y1="9"  x2="13" y2="9"/>
            <line x1="5"  y1="1"  x2="5"  y2="13"/>
            <line x1="9"  y1="1"  x2="9"  y2="13"/>
            <rect x="5" y="1" width="4" height="4" fill="currentColor" opacity="0.45" stroke="none"/>
          </svg>
        </button>

        <!-- 12. Close -->
        <button class="close-btn" onclick={close} aria-label="Close">
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <line x1="3" y1="3" x2="11" y2="11"/>
            <line x1="11" y1="3" x2="3" y2="11"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- ══ CHANNEL LIST ═══════════════════════════════════════════════ -->
    <div class="rack-list" id="rack-list">
      {#each channels as ch, i (ch.id)}
        <ChannelRow
          channel={ch}
          {nameColWidth}
          selected={selectedIds.has(ch.id)}
          activeStep={playback.currentStep}
          onSelect={(e) => handleSelect(i, e)}
          onStepChange={(step, active) => { channels[i].steps[step] = active; }}
          onSampleDrop={(name) => { channels[i].samplePath = name; audioEngine.loadSample(name); }}
        />
      {/each}
    </div>

    <!-- ══ BOTTOM BAR ═════════════════════════════════════════════════ -->
    <div class="rack-footer">
      <button class="add-btn" onclick={addChannel} aria-label="Add channel" title="Add channel">+</button>
      <div class="h-scroll-track" role="scrollbar" aria-controls="rack-list" aria-orientation="horizontal" aria-valuenow={0} aria-valuemin={0} aria-valuemax={100}>
        <div class="h-scroll-thumb"></div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* ── Backdrop ──────────────────────────────────────────────────── */
  .dd-backdrop {
    position: fixed;
    inset: 0;
    z-index: 150;
  }

  /* ── Rack window ───────────────────────────────────────────────── */
  .rack {
    position: fixed;
    width: 720px;
    min-height: 200px;
    max-height: 80vh;
    background: var(--explorer-bg, #1e1e1e);
    border: 1px solid var(--explorer-border, #2a2a2a);
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 16px 48px rgba(0,0,0,0.5);
    z-index: 100;
    overflow: hidden;
  }

  /* ── Header ────────────────────────────────────────────────────── */
  .rack-header {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px;
    height: 40px;
    background: #181818;
    border-bottom: 1px solid var(--explorer-border, #2a2a2a);
    flex-shrink: 0;
    cursor: grab;
    user-select: none;
  }

  .rack-header:active { cursor: grabbing; }

  .hdr-left,
  .hdr-right {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }

  .rack-title {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 14px;
    font-weight: 600;
    color: var(--main-text, #d0d0d0);
    pointer-events: none;
    white-space: nowrap;
  }

  /* ── Header buttons ────────────────────────────────────────────── */
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
    color: var(--accent, #e07800);
    border-color: rgba(224,120,0,0.3);
  }

  .hdr-tgl--on:hover {
    color: var(--accent, #e07800);
    background: rgba(224,120,0,0.1);
  }

  /* Filter button (wider due to label) */
  .hdr-filter {
    width: auto;
    gap: 3px;
    padding: 0 5px;
  }

  .filter-label {
    font-size: 9px;
    letter-spacing: 0.06em;
    font-family: 'DM Mono', monospace;
    line-height: 1;
  }

  /* Resize handle */
  .resize-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 26px;
    cursor: col-resize;
    color: rgba(255,255,255,0.3);
    border-radius: 3px;
    transition: color 0.1s, background 0.1s;
    flex-shrink: 0;
  }

  .resize-handle:hover {
    color: rgba(255,255,255,0.65);
    background: rgba(255,255,255,0.07);
  }

  .resize-handle svg { width: 8px; height: 14px; }

  /* Dial + label group */
  .dial-group,
  .sf-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
  }

  .dial-label {
    font-size: 7px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.3);
    font-family: 'DM Mono', monospace;
    line-height: 1;
    pointer-events: none;
  }

  /* Close button */
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
    margin-left: 2px;
  }

  .close-btn svg { width: 12px; height: 12px; }

  .close-btn:hover {
    background: rgba(220,50,50,0.18);
    color: #ff6b6b;
    border-color: rgba(220,50,50,0.3);
  }

  /* ── Dropdowns ─────────────────────────────────────────────────── */
  .dd-wrap {
    position: relative;
  }

  .dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 151;
    background: #242424;
    border: 1px solid var(--explorer-border, #333);
    border-radius: 5px;
    box-shadow: 0 6px 18px rgba(0,0,0,0.5);
    min-width: 130px;
    padding: 3px;
    display: flex;
    flex-direction: column;
  }

  .dd-item {
    background: transparent;
    border: none;
    color: rgba(255,255,255,0.7);
    font-size: 12px;
    text-align: left;
    padding: 5px 10px;
    border-radius: 3px;
    cursor: pointer;
    transition: background 0.08s, color 0.08s;
  }

  .dd-item:hover {
    background: rgba(255,255,255,0.07);
    color: var(--main-text, #d0d0d0);
  }

  .dd-item--active {
    color: var(--accent, #e07800);
  }

  /* ── Channel list ──────────────────────────────────────────────── */
  .rack-list {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 60px;
  }

  .rack-list::-webkit-scrollbar { width: 6px; }
  .rack-list::-webkit-scrollbar-track { background: transparent; }
  .rack-list::-webkit-scrollbar-thumb {
    background: var(--explorer-border, #333);
    border-radius: 3px;
  }

  /* ── Footer ────────────────────────────────────────────────────── */
  .rack-footer {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: #181818;
    border-top: 1px solid var(--explorer-border, #2a2a2a);
    flex-shrink: 0;
    height: 28px;
  }

  .add-btn {
    width: 20px;
    height: 20px;
    border-radius: 3px;
    border: 1px solid rgba(255,255,255,0.15);
    background: transparent;
    color: rgba(255,255,255,0.6);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    transition: background 0.1s, color 0.1s, border-color 0.1s;
    flex-shrink: 0;
  }

  .add-btn:hover {
    background: rgba(255,255,255,0.08);
    color: var(--main-text, #d0d0d0);
    border-color: rgba(255,255,255,0.3);
  }

  .h-scroll-track {
    flex: 1;
    height: 8px;
    background: rgba(255,255,255,0.05);
    border-radius: 4px;
    border: 1px solid rgba(255,255,255,0.07);
    overflow: hidden;
  }

  .h-scroll-thumb {
    width: 40%;
    height: 100%;
    background: rgba(255,255,255,0.18);
    border-radius: 4px;
  }
</style>
