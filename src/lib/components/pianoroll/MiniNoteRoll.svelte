<script lang="ts">
  import type { Note } from '$lib/types';
  import { STEP_W, stepToX, patternWidth } from '$lib/pianoroll/pitch';

  let {
    notes,
    patternLength,
    activeStep = -1,
    rowHeight = 28,
    fit = 'steps',
  }: {
    notes: Note[];
    patternLength: number;
    activeStep?: number;
    rowHeight?: number;
    fit?: 'steps' | 'stretch';
  } = $props();

  const MINI_MARGIN = 3;
  const MINI_MIN_BAR_H = 3;

  let pitchRange = $derived.by(() => {
    let min = Infinity, max = -Infinity;
    for (const n of notes) {
      if (n.pitch < min) min = n.pitch;
      if (n.pitch > max) max = n.pitch;
    }
    return { min, max };
  });

  function barHeight() {
    const span = Math.max(1, pitchRange.max - pitchRange.min);
    return Math.max(MINI_MIN_BAR_H, (rowHeight - 2 * MINI_MARGIN) / (span + 1));
  }

  function barTop(pitch: number) {
    const span = Math.max(1, pitchRange.max - pitchRange.min);
    const barH = barHeight();
    return MINI_MARGIN + ((pitchRange.max - pitch) / span) * (rowHeight - 2 * MINI_MARGIN - barH);
  }
</script>

{#if fit === 'stretch'}
  <div class="mini-roll mini-roll--stretch" style="height:{rowHeight}px;">
    {#each notes as note (note.id)}
      <div
        class="mini-note"
        style="left:{note.start / patternLength * 100}%; top:{barTop(note.pitch)}px; width:{note.length / patternLength * 100}%; height:{barHeight()}px;"
      ></div>
    {/each}
    {#if activeStep >= 0}
      <div class="mini-playhead" style="left:{activeStep / patternLength * 100}%; width:{1 / patternLength * 100}%;"></div>
    {/if}
  </div>
{:else}
  <div class="mini-roll" style="width:{patternWidth(patternLength)}px; height:{rowHeight}px;">
    {#each notes as note (note.id)}
      <div
        class="mini-note"
        style="left:{stepToX(note.start)}px; top:{barTop(note.pitch)}px; width:{note.length * STEP_W - 1}px; height:{barHeight()}px;"
      ></div>
    {/each}
    {#if activeStep >= 0}
      <div class="mini-playhead" style="left:{stepToX(activeStep)}px; width:{STEP_W}px;"></div>
    {/if}
  </div>
{/if}

<style>
  .mini-roll {
    position: relative;
    border-radius: 3px;
    background: #1c1c1c;
    overflow: hidden;
    flex-shrink: 0;
  }

  .mini-roll--stretch {
    width: 100%;
  }

  .mini-note {
    position: absolute;
    box-sizing: border-box;
    background: var(--accent, #90c396);
    border: 1px solid rgba(0,0,0,0.4);
    border-radius: 2px;
  }

  .mini-playhead {
    position: absolute;
    top: 0;
    bottom: 0;
    background: rgba(255,255,255,0.08);
    outline: 1px solid rgba(255,255,255,0.3);
    pointer-events: none;
  }
</style>
