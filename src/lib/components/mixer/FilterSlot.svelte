<script lang="ts">
  import type { FilterSlotData } from '$lib/mixerStore.svelte';

  // Bound live to the store's $state object (same convention as
  // MixerChannelStrip/ChannelRow — mutate the passed object directly rather
  // than threading a bindable primitive through).
  let {
    slot,
    index,
  }: {
    slot:  FilterSlotData;
    index: number;
  } = $props();
</script>

<div class="slot">
  <span class="slot-index">{index + 1}</span>
  <span class="slot-name">Empty</span>
  <button
    class="slot-toggle"
    class:slot-toggle--on={slot.enabled}
    onclick={() => slot.enabled = !slot.enabled}
    aria-label="Toggle filter slot {index + 1}"
    aria-pressed={slot.enabled}
    title={slot.enabled ? 'Enabled' : 'Bypassed'}
  ></button>
</div>

<style>
  .slot {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .slot-index {
    width: 14px;
    font-family: 'DM Mono', 'Cascadia Code', monospace;
    font-size: 10px;
    color: rgba(255, 255, 255, 0.3);
    flex-shrink: 0;
  }

  .slot-name {
    flex: 1;
    font-size: 11px;
    color: var(--main-text-muted, #666);
    font-style: italic;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .slot-toggle {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #1c1c1c;
    border: 1px solid rgba(255, 255, 255, 0.15);
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    transition: background 0.1s, border-color 0.1s, box-shadow 0.1s;
  }

  .slot-toggle--on {
    background: var(--accent, #90c396);
    border-color: var(--accent, #90c396);
    box-shadow: 0 0 4px rgba(144, 195, 150, 0.7);
  }
</style>
