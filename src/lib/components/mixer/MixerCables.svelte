<script lang="ts">
  // Dumb SVG renderer — all measurement/geometry recompute logic lives in
  // Mixer.svelte. Rendered as a plain local overlay (NOT portalled onto
  // <body> like DragTooltip) — see "Mixer" in CLAUDE.md for why the portal
  // trick doesn't apply here.
  import { bezierPath } from './cableGeometry';

  let {
    paths,
    dragPath,
  }: {
    paths:    { id: number; x1: number; y1: number; x2: number; y2: number }[];
    dragPath: { x1: number; y1: number; x2: number; y2: number } | null;
  } = $props();
</script>

<svg class="cables" aria-hidden="true">
  {#each paths as p (p.id)}
    <path class="cable" d={bezierPath(p.x1, p.y1, p.x2, p.y2)} />
  {/each}
  {#if dragPath}
    <path class="cable cable--drag" d={bezierPath(dragPath.x1, dragPath.y1, dragPath.x2, dragPath.y2)} />
  {/if}
</svg>

<style>
  .cables {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 5;
    overflow: visible;
  }

  .cable {
    /* Plain stroke, no SVG filter — drop-shadow() forces a per-frame
       software rasterization pass in WebKitGTK that isn't worth paying for
       a decorative shadow on a purely cosmetic cable. */
    fill: none;
    stroke: #1c1c1c;
    stroke-width: 4;
    stroke-linecap: round;
  }

  .cable--drag {
    stroke: var(--accent, #90c396);
    stroke-width: 3;
    opacity: 0.8;
  }
</style>
