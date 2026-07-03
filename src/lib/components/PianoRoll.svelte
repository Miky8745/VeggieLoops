<script lang="ts">
  import { channelStore } from '$lib/channelStore.svelte';
  import { playback } from '$lib/playbackStore.svelte';
  import { formatSampleName } from '$lib/sampleName';
  import { KEY_COL_W, RULER_H, LANE_H } from '$lib/pianoroll/pitch';
  import PianoRollHeader from './pianoroll/PianoRollHeader.svelte';
  import PianoKeys from './pianoroll/PianoKeys.svelte';
  import PianoRollRuler from './pianoroll/PianoRollRuler.svelte';
  import NoteGrid from './pianoroll/NoteGrid.svelte';
  import VelocityLane from './pianoroll/VelocityLane.svelte';

  let { show = $bindable() }: { show: boolean } = $props();

  // ── Window drag (mirrors ChannelRack.svelte) ────────────────────────
  let x = $state(220);
  let y = $state(140);
  let winDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  function onHeaderMousedown(e: MouseEvent) {
    const t = e.target as HTMLElement;
    if (t.closest('button')) return;
    winDragging = true;
    dragOffsetX = e.clientX - x;
    dragOffsetY = e.clientY - y;
    e.preventDefault();
  }

  function onWindowMousemove(e: MouseEvent) {
    if (winDragging) {
      x = e.clientX - dragOffsetX;
      y = e.clientY - dragOffsetY;
    }
  }

  function onWindowMouseup() {
    winDragging = false;
  }

  let tool = $state<'draw' | 'select'>('draw');
  let selectedNoteIds = $state(new Set<number>());
  let gridScrollLeft = $state(0);
  let gridScrollTop = $state(0);

  let channel = $derived(channelStore.selectedChannel);
  let channelName = $derived(channel ? formatSampleName(channel.samplePath) : 'No channel');

  // Selection is per-channel edit state — clear it when the focused channel changes.
  $effect(() => {
    channelStore.selectedChannelId;
    selectedNoteIds = new Set();
  });

  // Auto-extend: as soon as any channel has a note reaching into the pattern's
  // last bar, grow the pattern by one more bar so there's always room ahead —
  // lets the user keep drawing notes indefinitely instead of hitting a wall.
  $effect(() => {
    const bar = channelStore.barLength;
    const lastBarStart = channelStore.patternLength - bar;
    for (const ch of channelStore.channels) {
      for (const note of ch.notes) {
        if (note.start + note.length > lastBarStart) {
          channelStore.patternLength += bar;
          return;
        }
      }
    }
  });

  function close() { show = false; }

  function handleScroll(left: number, top: number) {
    gridScrollLeft = left;
    gridScrollTop = top;
  }
</script>

<svelte:window onmousemove={onWindowMousemove} onmouseup={onWindowMouseup} />

{#if show && channel}
  <div class="pr" role="dialog" aria-label="Piano Roll" tabindex="-1" style="left:{x}px; top:{y}px;">
    <PianoRollHeader bind:tool title={channelName} onClose={close} onDragStart={onHeaderMousedown} />
    <div class="pr-body" style="--key-col-w:{KEY_COL_W}px; --ruler-h:{RULER_H}px; --lane-h:{LANE_H}px;">
      <div class="pr-corner"></div>
      <div class="pr-ruler-slot">
        <PianoRollRuler patternLength={channelStore.patternLength} scrollLeft={gridScrollLeft} activeStep={playback.currentStep} />
      </div>
      <div class="pr-keys-slot">
        <PianoKeys scrollTop={gridScrollTop} />
      </div>
      <div class="pr-grid-slot">
        <NoteGrid
          {channel}
          {tool}
          bind:selectedNoteIds
          patternLength={channelStore.patternLength}
          activeStep={playback.currentStep}
          onScroll={handleScroll}
        />
      </div>
      <div class="pr-vel-corner"></div>
      <div class="pr-vel-slot">
        <VelocityLane {channel} {selectedNoteIds} scrollLeft={gridScrollLeft} patternLength={channelStore.patternLength} />
      </div>
    </div>
  </div>
{/if}

<style>
  .pr {
    position: fixed;
    width: 760px;
    height: 480px;
    background: var(--explorer-bg, #1e1e1e);
    border: 1px solid var(--explorer-border, #2a2a2a);
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 16px 48px rgba(0,0,0,0.5);
    z-index: 100;
    overflow: hidden;
  }

  .pr-body {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: var(--key-col-w) 1fr;
    grid-template-rows: var(--ruler-h) 1fr var(--lane-h);
  }

  .pr-corner,
  .pr-vel-corner {
    background: #181818;
    border-right: 1px solid var(--explorer-border, #2a2a2a);
    border-bottom: 1px solid var(--explorer-border, #2a2a2a);
  }

  .pr-ruler-slot { min-width: 0; }
  .pr-keys-slot  { min-height: 0; border-right: 1px solid var(--explorer-border, #2a2a2a); }
  .pr-grid-slot  { min-width: 0; min-height: 0; }
  .pr-vel-slot   { min-width: 0; border-top: 1px solid var(--explorer-border, #2a2a2a); }
</style>
