<script lang="ts">
  // Idle/static vertical meter — audioEngine has no per-mixer-channel
  // AnalyserNode yet (only the master stereo pair PeakMeter.svelte reads),
  // so there's no real level to display here. This is visual scaffolding
  // for future wiring, not a generalization of PeakMeter.svelte (which
  // stays hardcoded to the toolbar's master-bus taps) — it deliberately
  // renders zero fake data rather than faking activity.
  let {
    height = 80,
    giant  = false,
  }: {
    height?: number;
    giant?:  boolean;
  } = $props();
</script>

<div class="meter" class:meter--giant={giant} style="height:{height}px" aria-hidden="true">
  <div class="meter-bar"></div>
  {#if giant}
    <div class="meter-bar"></div>
  {/if}
</div>

<style>
  .meter {
    display: flex;
    gap: 3px;
    align-items: flex-end;
    flex-shrink: 0;
  }

  .meter-bar {
    width: 8px;
    height: 100%;
    background: #1c2a1c;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 2px;
  }

  .meter--giant .meter-bar {
    width: 14px;
  }
</style>
