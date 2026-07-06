<script lang="ts">
  import { channelStore } from '$lib/channelStore.svelte';
  import { playback } from '$lib/playbackStore.svelte';
  import { formatChannelLabel } from '$lib/sampleName';
  import { KEY_COL_W, RULER_H, LANE_H } from '$lib/pianoroll/pitch';
  import FloatingWindow, { type WorkspaceBounds } from './FloatingWindow.svelte';
  import PianoRollHeader from './pianoroll/PianoRollHeader.svelte';
  import PianoKeys from './pianoroll/PianoKeys.svelte';
  import PianoRollRuler from './pianoroll/PianoRollRuler.svelte';
  import NoteGrid from './pianoroll/NoteGrid.svelte';
  import VelocityLane from './pianoroll/VelocityLane.svelte';
  import PianoRollOverview from './pianoroll/PianoRollOverview.svelte';

  let {
    show = $bindable(),
    workspaceBounds,
    showPianoRollOverview = $bindable(false),
  }: { show: boolean; workspaceBounds: WorkspaceBounds; showPianoRollOverview?: boolean } = $props();

  let tool = $state<'draw' | 'select'>('draw');
  let selectedNoteIds = $state(new Set<number>());
  let gridScrollLeft = $state(0);
  let gridScrollTop = $state(0);
  let gridViewportWidth = $state(0);
  let noteGridRef: NoteGrid | undefined = $state();

  let channel = $derived(channelStore.selectedChannel);
  let channelName = $derived(channel ? formatChannelLabel(channel) : 'No channel');

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

  function handleSeek(x: number) {
    noteGridRef?.scrollTo(x, gridScrollTop);
  }

  // Playing from the Piano Roll's own button solos just this channel — the
  // shared clock/engine still only ever runs once (see playbackStore).
  function handleTogglePlay() {
    if (playback.isPlaying) {
      playback.isPlaying = false;
    } else if (channel) {
      playback.soloChannelId = channel.id;
      playback.isPlaying = true;
    }
  }
</script>

{#if channel}
  <FloatingWindow
    bind:show
    {workspaceBounds}
    x={220} y={140} width={760} height={480}
    minWidth={400} minHeight={260}
  >
    {#snippet header({ onDragStart, maximized, toggleMaximize })}
      <PianoRollHeader
        bind:tool
        title={channelName}
        {maximized}
        isPlaying={playback.isPlaying}
        onClose={close}
        onDragStart={onDragStart}
        onToggleMaximize={toggleMaximize}
        onTogglePlay={handleTogglePlay}
      />
    {/snippet}

    <div class="pr-shell">
      {#if showPianoRollOverview}
        <div class="pr-overview-slot">
          <PianoRollOverview
            {channel}
            patternLength={channelStore.patternLength}
            activeStep={playback.currentStep}
            scrollLeft={gridScrollLeft}
            viewportWidth={gridViewportWidth}
            onSeek={handleSeek}
          />
        </div>
      {/if}
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
            bind:this={noteGridRef}
            {channel}
            {tool}
            bind:selectedNoteIds
            patternLength={channelStore.patternLength}
            activeStep={playback.currentStep}
            currentStepFraction={playback.isPlaying ? playback.currentStepFraction : -1}
            onScroll={handleScroll}
            onViewportResize={(w) => gridViewportWidth = w}
          />
        </div>
        <div class="pr-vel-corner"></div>
        <div class="pr-vel-slot">
          <VelocityLane {channel} {selectedNoteIds} scrollLeft={gridScrollLeft} patternLength={channelStore.patternLength} />
        </div>
      </div>
    </div>
  </FloatingWindow>
{/if}

<style>
  .pr-shell {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .pr-overview-slot {
    flex-shrink: 0;
    height: 40px;
    padding: 4px 8px;
    background: #181818;
    border-bottom: 1px solid var(--explorer-border, #3f484e);
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
    border-right: 1px solid var(--explorer-border, #3f484e);
    border-bottom: 1px solid var(--explorer-border, #3f484e);
  }

  .pr-ruler-slot { min-width: 0; }
  .pr-keys-slot  { min-height: 0; border-right: 1px solid var(--explorer-border, #3f484e); }
  .pr-grid-slot  { min-width: 0; min-height: 0; }
  .pr-vel-slot   { min-width: 0; border-top: 1px solid var(--explorer-border, #3f484e); }
</style>
