<script lang="ts">
  import { MIN_PITCH, MAX_PITCH, KEY_H, GRID_TOTAL_H, isBlackKey, isCNote, pitchName } from '$lib/pianoroll/pitch';

  let { scrollTop, highlightPitches = new Set<number>() }: { scrollTop: number; highlightPitches?: Set<number> } = $props();

  const pitches = Array.from({ length: MAX_PITCH - MIN_PITCH + 1 }, (_, i) => MAX_PITCH - i);
</script>

<div class="keys-viewport">
  <div class="keys-content" style="height:{GRID_TOTAL_H}px; transform: translateY(-{scrollTop}px);">
    {#each pitches as p, i (p)}
      {@const belowP = pitches[i + 1]}
      {@const noBorder = isBlackKey(p) || (belowP !== undefined && isBlackKey(belowP))}
      {@const highlighted = highlightPitches.has(p)}
      {@const csharpBelowCHighlighted = p % 12 === 1 && highlightPitches.has(p - 1)}
      <div
        class="key-row"
        class:key-row--c={isCNote(p)}
        class:key-row--no-border={noBorder}
        class:key-row--csharp={p % 12 === 1}
        class:key-row--highlighted={highlighted && !isBlackKey(p)}
        class:key-row--csharp-below-highlighted={csharpBelowCHighlighted}
        style="height:{KEY_H}px;"
      >
        {#if isBlackKey(p)}
          <div class="black-key" class:black-key--highlighted={highlighted}></div>
        {:else}
          <span class="key-label" class:key-label--c={isCNote(p)}>{pitchName(p)}</span>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .keys-viewport {
    height: 100%;
    overflow: hidden;
    position: relative;
    background: #161616;
  }

  .keys-content {
    position: relative;
  }

  .key-row {
    position: relative;
    box-sizing: border-box;
    background: #d8d8d8;
    border-bottom: 1px solid rgba(0,0,0,0.35);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 6px;
  }

  /* C rows are shaded grey so octave boundaries are easy to scan at a glance. */
  .key-row--c { background: #b8b8b8; border-bottom: 1px solid rgba(255,255,255,0.15); }

  /* Real pianos have no visible seam between a white key and the black key
     sitting on top of/beside it — only white-to-white boundaries with no
     black key between them (E/F, B/C) show a line. */
  .key-row--no-border { border-bottom: none; }

  /* Greying out the bottom half of the exposed white sliver next to C#'s
     black key (the part not covered by .black-key) makes the row read as
     if it had shifted up, away from the grey C row below it. */
  .key-row--csharp { background: linear-gradient(to bottom, #d8d8d8 50%, #b8b8b8 50%); }

  /* Orange highlight while a note is being created/resized/moved in the grid
     (see NoteGrid's highlightPitches). Whole row for plain white/C keys;
     only the nested .black-key div for black-key rows, since the row's own
     white/grey background must stay put. The C# row's gradient bottom stop
     is tinted independently whenever the C row directly below it (p-1) is
     highlighted, so the C key's grey-sliver illusion into the C# row above
     it isn't broken when only the C row's own highlight changes. */
  .key-row--highlighted { background: var(--pr-key-highlight, #ff9c33); }

  .key-row--csharp-below-highlighted {
    background: linear-gradient(to bottom, #d8d8d8 50%, var(--pr-key-highlight, #ff9c33) 50%);
  }

  /* Real black keys are shorter (don't reach as far toward the grid) and
     slimmer (don't fill the full semitone row) than the white keys they
     interrupt — the row itself stays full height so it still lines up
     1:1 with the note grid. */
  .black-key {
    position: absolute;
    left: 0;
    top: 2px;
    bottom: 2px;
    width: 62%;
    background: #1a1a1a;
    border-radius: 0 2px 2px 0;
    box-shadow: 1px 0 2px rgba(0,0,0,0.4);
    pointer-events: none;
  }

  /* Compound selector (not source order) so this reliably beats the base
     .black-key background regardless of where it's declared in the file. */
  .black-key.black-key--highlighted { background: var(--pr-key-highlight, #ff9c33); }

  .key-label {
    font-size: 8px;
    font-family: 'DM Mono', monospace;
    color: rgba(0,0,0,0.45);
    line-height: 1;
    pointer-events: none;
    z-index: 1;
  }

  /* C is the octave anchor — make its label read more prominently than the
     other white-key labels. */
  .key-label--c {
    color: #222;
    font-weight: 700;
  }
</style>
