<script lang="ts">
  let { keyLabel, valueText }: { keyLabel: string; valueText: string } = $props();
</script>

<div class="drag-tooltip" role="status">
  <span class="dt-key">{keyLabel}</span><span class="dt-sep">:</span> <span class="dt-val">{valueText}</span>
</div>

<style>
  .drag-tooltip {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 6px;
    padding: 3px 8px;
    background: #252525;
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 5px;
    box-shadow: 0 4px 14px rgba(0,0,0,0.6);
    font-family: 'DM Mono', 'Cascadia Code', monospace;
    font-size: 11px;
    white-space: nowrap;
    pointer-events: none;
    z-index: 20;
  }

  .dt-key {
    color: rgba(255,255,255,0.55);
    letter-spacing: 0.05em;
  }

  .dt-sep {
    color: rgba(255,255,255,0.35);
    margin: 0 1px;
  }

  .dt-val {
    color: var(--accent, #90c396);
    font-weight: 600;
  }
</style>
