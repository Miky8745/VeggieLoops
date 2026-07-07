<script lang="ts">
  import type { ChannelData, FileDropDetail } from '$lib/types';
  import Dial from './Dial.svelte';
  import ScrollField from './ScrollField.svelte';
  import { formatChannelLabel } from '$lib/sampleName';
  import { channelStore } from '$lib/channelStore.svelte';
  import { channelLoopLength } from '$lib/channelLoop';
  import MiniNoteRoll from './pianoroll/MiniNoteRoll.svelte';

  let {
    channel,
    nameColWidth,
    selected,
    activeStep = -1,
    onSelect,
    onStepChange,
    onSampleDrop,
    onOpenPianoRoll,
  }: {
    channel:      ChannelData;
    nameColWidth: number;
    selected:     boolean;
    activeStep?:  number;
    onSelect:     (e: MouseEvent) => void;
    onStepChange: (step: number, active: boolean) => void;
    onSampleDrop: (drop: FileDropDetail) => void;
    onOpenPianoRoll: () => void;
  } = $props();

  function formatPan(v: number): string {
    if (v === 0.5) return 'C';
    return v < 0.5 ? `L${Math.round((0.5 - v) * 200)}` : `R${Math.round((v - 0.5) * 200)}`;
  }

  // Paint mode shared across all rows via module-level state
  // (reset on global pointerup)

  let dragOver = $state(false);
  let dropEl = $state<HTMLElement | null>(null);

  $effect(() => {
    if (!dropEl) return;
    const el = dropEl;
    function onEnter() { dragOver = true; }
    function onLeave() { dragOver = false; }
    function onDrop(e: Event) {
      dragOver = false;
      onSampleDrop((e as CustomEvent<FileDropDetail>).detail);
    }
    el.addEventListener('filedragenter', onEnter);
    el.addEventListener('filedragleave', onLeave);
    el.addEventListener('filedrop', onDrop);
    return () => {
      el.removeEventListener('filedragenter', onEnter);
      el.removeEventListener('filedragleave', onLeave);
      el.removeEventListener('filedrop', onDrop);
    };
  });

  let sampleLabel = $derived(formatChannelLabel(channel));
  let isEmpty = $derived(channel.samplePath === null && channel.sampleFolder === null);

  // This channel may loop independently at a shorter length than the shared
  // pattern (e.g. a 1-bar kick inside a 4-bar pattern) — activeStep is fed
  // the raw, whole-pattern step, so it must be wrapped to this channel's own
  // loop length before comparing against the fixed 0-15 step buttons/preview,
  // otherwise the highlight only shows during the pattern's first cycle.
  let chLoopLength = $derived(channelLoopLength(channel, channelStore.activeLength, channelStore.barLength));
  let wrappedStep = $derived(activeStep >= 0 ? activeStep % chLoopLength : -1);

  // Sequencer paint
  let painting = $state<boolean | null>(null); // true=activate, false=deactivate

  function stepMousedown(e: MouseEvent, i: number) {
    e.preventDefault();
    if (e.button === 2) {
      painting = false;
      onStepChange(i, false);
    } else if (e.button === 0) {
      painting = true;
      onStepChange(i, true);
    }
  }

  function stepPointerenter(e: PointerEvent, i: number) {
    if (painting === null) return;
    // only when a button is held
    if (e.buttons === 0) { painting = null; return; }
    onStepChange(i, painting);
  }

  function globalPointerup() {
    painting = null;
  }

  // Step color group: 0,2 = grey; 1,3 = orange/red
  function stepGroup(i: number) {
    return Math.floor(i / 4) % 2; // 0 or 1
  }

  // Mini piano-roll preview (replaces the step buttons for note-based channels)
</script>

<svelte:window onpointerup={globalPointerup} />

<div class="ch-row" class:ch-row--selected={selected} oncontextmenu={(e) => e.preventDefault()} role="row" tabindex="-1">
  <!-- Mute dot -->
  <button
    class="mute-dot"
    class:muted={channel.muted}
    onclick={() => { channel.muted = !channel.muted; }}
    aria-label="Toggle mute"
    title="Mute"
  ></button>

  <!-- Pan dial -->
  <Dial bind:value={channel.pan} defaultValue={0.5} size={24} sensitivity={150} tooltipKey="PAN" format={formatPan} />

  <!-- Volume dial: 0-200% (100%/unity gain sits at the top), half-circle
       sweeping left→top→right so max lands on the right, not the bottom. -->
  <Dial
    bind:value={channel.volume}
    defaultValue={0.8}
    max={2}
    sweepStart={270}
    sweepDegrees={180}
    size={24}
    sensitivity={150}
    tooltipKey="VOLUME"
  />

  <!-- Mixer track -->
  <ScrollField bind:value={channel.mixerTrack} min={0} max={125} width={30} tooltipKey="MIXER TRACK" />

  <!-- Sample drop zone -->
  <div
    class="sample-drop"
    class:dragover={dragOver}
    class:empty={isEmpty}
    style="width:{nameColWidth}px; min-width:{nameColWidth}px; max-width:{nameColWidth}px;"
    data-sample-drop
    bind:this={dropEl}
    ondblclick={onOpenPianoRoll}
    role="region"
    aria-label="Sample drop zone"
  >
    <span class="sample-name">{sampleLabel}</span>
  </div>

  <!-- Select toggle -->
  <button
    class="sel-btn"
    class:sel-btn--on={selected}
    onclick={onSelect}
    aria-label="Select channel"
    title="Select"
  ></button>

  <!-- Sequencer buttons / mini piano-roll preview -->
  <div class="steps">
    {#if channel.notes.length > 0}
      <MiniNoteRoll notes={channel.notes} patternLength={chLoopLength} activeStep={wrappedStep} />
    {:else}
      {#each channel.steps as active, i}
        {@const grp = stepGroup(i)}
        <button
          class="step"
          class:step--on={active}
          class:step--grey={grp === 0}
          class:step--orange={grp === 1}
          class:step--playing={i === wrappedStep}
          onmousedown={(e) => stepMousedown(e, i)}
          onpointerenter={(e) => stepPointerenter(e, i)}
          oncontextmenu={(e) => e.preventDefault()}
          aria-label="Step {i + 1}"
          aria-pressed={active}
        ></button>
      {/each}
    {/if}
  </div>
</div>

<style>
  .ch-row {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 8px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    background: transparent;
    transition: background 0.06s;
  }

  .ch-row:hover {
    background: rgba(255,255,255,0.03);
  }

  .ch-row--selected {
    background: rgba(144, 195, 150, 0.08);
  }

  /* Mute dot */
  .mute-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: none;
    background: var(--accent);
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.1s;
    padding: 0;
  }

  .mute-dot.muted {
    background: #444;
  }

  /* Sample drop */
  .sample-drop {
    height: 28px;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 3px;
    background: rgba(0,0,0,0.2);
    display: flex;
    align-items: center;
    padding: 0 6px;
    overflow: hidden;
    cursor: default;
    flex-shrink: 0;
    transition: border-color 0.1s, background 0.1s;
  }

  .sample-drop.dragover {
    border-color: var(--accent);
    background: rgba(144,195,150,0.12);
  }

  .sample-name {
    font-size: 11px;
    color: var(--main-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sample-drop.empty .sample-name {
    color: var(--main-text-muted);
    font-style: italic;
  }

  /* Select button */
  .sel-btn {
    width: 16px;
    height: 16px;
    border-radius: 2px;
    border: 1px solid rgba(255,255,255,0.15);
    background: transparent;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.1s;
    padding: 0;
  }

  .sel-btn--on {
    background: var(--accent);
    border-color: var(--accent);
  }

  /* Steps */
  .steps {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }

  .step {
    width: 24px;
    height: 28px;
    border-radius: 3px;
    border: none;
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    transition: background 0.06s;
  }

  .step--grey     { background: #2e2e2e; }
  .step--orange   { background: #2a1a0e; }

  .step--grey.step--on   { background: #888; }
  .step--orange.step--on { background: var(--accent); }

  .step:hover:not(.step--on) { filter: brightness(1.4); }

  .step--playing { outline: 2px solid rgba(255,255,255,0.55); outline-offset: -2px; }
</style>
