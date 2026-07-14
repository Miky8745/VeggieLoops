<script lang="ts">
  import DragTooltip from './DragTooltip.svelte';

  // Same drag-to-set contract as Dial.svelte, but the value readout is a
  // full-circle rim (active-colored portion vs. inactive-colored portion)
  // instead of a rotating indicator dot — used for JackPort's "knob" state.
  let {
    value        = $bindable(0),
    defaultValue = 0,
    max          = 1,
    size         = 24,
    sensitivity  = 200,
    activeColor   = 'var(--accent, #90c396)',
    inactiveColor = 'rgba(255,255,255,0.18)',
    tooltipKey   = '',
    format       = (v: number) => `${Math.round(v * 100)}%`,
  }: {
    value?:         number;
    defaultValue?:  number;
    max?:           number;
    size?:          number;
    sensitivity?:   number;
    activeColor?:   string;
    inactiveColor?: string;
    tooltipKey?:    string;
    format?:        (value: number) => string;
  } = $props();

  let dragging = $state(false);

  // SVG canvas: 32×32, radius 12, center (16,16) — same reference frame as Dial.
  const CX = 16, CY = 16, R = 12;

  function pt(deg: number) {
    const rad = (deg - 90) * (Math.PI / 180);
    return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) };
  }

  // Full background ring — a closed circle can't be a single SVG arc command
  // (start === end), so it's drawn as two semicircle arcs back to back.
  const bgPath = `M ${pt(0).x.toFixed(2)} ${pt(0).y.toFixed(2)} A ${R} ${R} 0 1 1 ${pt(180).x.toFixed(2)} ${pt(180).y.toFixed(2)} A ${R} ${R} 0 1 1 ${pt(0).x.toFixed(2)} ${pt(0).y.toFixed(2)}`;

  // Reactive fill arc, 0deg to (value/max)*360deg
  let fillPath = $derived.by(() => {
    if (value <= 0) return '';
    const sweep = (value / max) * 360;
    if (sweep >= 360) return bgPath;
    const s = pt(0), e = pt(sweep);
    const large = sweep > 180 ? 1 : 0;
    return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
  });

  function onMousedown(e: MouseEvent) {
    // Only the left button drags the value — a right-click (button 2) is
    // used elsewhere (JackPort) to cycle state, and must not also start a
    // drag gesture here.
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    dragging = true;
  }

  function onMousemove(e: MouseEvent) {
    if (!dragging) return;
    value = Math.max(0, Math.min(max, value - (e.movementY / sensitivity) * max));
  }

  function onMouseup() {
    dragging = false;
  }

  function onDblclick(e: MouseEvent) {
    e.stopPropagation();
    value = defaultValue;
  }

  let wrapEl = $state<HTMLElement | null>(null);
</script>

<svelte:window onmousemove={onMousemove} onmouseup={onMouseup} />

<div
  class="knob-wrap"
  bind:this={wrapEl}
  style="width:{size}px; height:{size}px;"
  onmousedown={onMousedown}
  ondblclick={onDblclick}
  role="slider"
  aria-valuenow={value}
  aria-valuemin={0}
  aria-valuemax={max}
  tabindex="0"
>
  <div class="knob-body"></div>
  <svg class="knob-svg" viewBox="0 0 32 32" width={size} height={size}>
    <path d={bgPath} fill="none" stroke={inactiveColor} stroke-width="2.5" />
    {#if value > 0}
      <path d={fillPath} fill="none" stroke={activeColor} stroke-width="2.5" stroke-linecap="round" />
    {/if}
  </svg>
  {#if dragging && tooltipKey && wrapEl}
    <DragTooltip keyLabel={tooltipKey} valueText={format(value)} anchorEl={wrapEl} />
  {/if}
</div>

<style>
  .knob-wrap {
    position: relative;
    cursor: ns-resize;
    user-select: none;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .knob-body {
    position: absolute;
    inset: 4px;
    border-radius: 50%;
    background: radial-gradient(circle at 40% 35%, #3a3a3a, #1c1c1c);
    box-shadow: 0 1px 3px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07);
  }

  .knob-svg {
    position: relative;
    display: block;
    overflow: visible;
  }
</style>
