<script lang="ts">
  import { MIN_PITCH, MAX_PITCH, KEY_H, GRID_TOTAL_H, isBlackKey, isCNote, pitchName } from '$lib/pianoroll/pitch';

  let { scrollTop }: { scrollTop: number } = $props();

  const pitches = Array.from({ length: MAX_PITCH - MIN_PITCH + 1 }, (_, i) => MAX_PITCH - i);
</script>

<div class="keys-viewport">
  <div class="keys-content" style="height:{GRID_TOTAL_H}px; transform: translateY(-{scrollTop}px);">
    {#each pitches as p (p)}
      <div
        class="key-row"
        class:key-row--black={isBlackKey(p)}
        class:key-row--white={!isBlackKey(p)}
        class:key-row--c={isCNote(p)}
        style="height:{KEY_H}px;"
      >
        {#if isCNote(p)}
          <span class="key-label">{pitchName(p)}</span>
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
    box-sizing: border-box;
    border-bottom: 1px solid rgba(0,0,0,0.35);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 6px;
  }

  .key-row--white { background: #d8d8d8; }
  .key-row--black { background: #1a1a1a; }
  .key-row--c { border-bottom: 1px solid rgba(255,255,255,0.15); }

  .key-label {
    font-size: 8px;
    font-family: 'DM Mono', monospace;
    color: #333;
    line-height: 1;
    pointer-events: none;
  }

  .key-row--black .key-label { color: rgba(255,255,255,0.5); }
</style>
