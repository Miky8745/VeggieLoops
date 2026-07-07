<script lang="ts">
  import { untrack } from 'svelte';

  let { keyLabel, valueText, anchorEl }: { keyLabel: string; valueText: string; anchorEl: HTMLElement } = $props();

  // Positioned from the anchor's live viewport rect, captured once at
  // mount — the anchor doesn't move mid-drag (only the mouse does), so a
  // one-time read is enough. untrack() makes that intentional (this
  // component only exists for the lifetime of one drag gesture) rather
  // than an accidental non-reactive read of a prop.
  const anchorRect = untrack(() => anchorEl.getBoundingClientRect());

  // Mounted straight onto <body> rather than in its normal DOM position,
  // so it escapes any ancestor's `overflow: hidden`/`auto` clipping (e.g.
  // the Channel Rack's channel list, or the floating window chrome itself)
  // — position: fixed alone doesn't help, since overflow clipping applies
  // to descendants regardless of their own positioning scheme.
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  }
</script>

<div
  class="drag-tooltip"
  role="status"
  use:portal
  style="left:{anchorRect.left + anchorRect.width / 2}px; top:{anchorRect.top}px;"
>
  <span class="dt-key">{keyLabel}</span><span class="dt-sep">:</span> <span class="dt-val">{valueText}</span>
</div>

<style>
  .drag-tooltip {
    position: fixed;
    transform: translate(-50%, calc(-100% - 6px));
    padding: 3px 8px;
    background: #252525;
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 5px;
    box-shadow: 0 4px 14px rgba(0,0,0,0.6);
    font-family: 'DM Mono', 'Cascadia Code', monospace;
    font-size: 11px;
    white-space: nowrap;
    pointer-events: none;
    z-index: 10000;
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
