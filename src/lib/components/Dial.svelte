<script lang="ts">
  import DragTooltip from './DragTooltip.svelte';

  let {
    value        = $bindable(0),
    defaultValue = 0,
    showArc      = false,
    size         = 28,
    sensitivity  = 200,
    tooltipKey   = '',
    format       = (v: number) => `${Math.round(v * 100)}%`,
  }: {
    value?:        number;
    defaultValue?: number;
    showArc?:      boolean;
    size?:         number;
    sensitivity?:  number;
    tooltipKey?:   string;
    format?:       (value: number) => string;
  } = $props();

  let dragging = $state(false);

  // 300° sweep: value=0 → 210° from top, value=1 → 510°=150° from top
  let angle = $derived(210 + value * 300);

  // SVG canvas: 32×32, radius 12, center (16,16)
  const CX = 16, CY = 16, R = 12;

  function pt(deg: number) {
    const rad = (deg - 90) * (Math.PI / 180);
    return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) };
  }

  // Static background arc path (210° → 150° clockwise = 300°)
  const bgPath = (() => {
    const s = pt(210), e = pt(510);
    return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${R} ${R} 0 1 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
  })();

  // Reactive fill arc path
  let fillPath = $derived.by(() => {
    if (value <= 0) return '';
    const s = pt(210);
    const sweep = value * 300;
    const e = pt(210 + sweep);
    const large = sweep > 180 ? 1 : 0;
    return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
  });

  // Indicator dot position on the arc
  let tipX = $derived(CX + (R - 2.5) * Math.cos((angle - 90) * Math.PI / 180));
  let tipY = $derived(CY + (R - 2.5) * Math.sin((angle - 90) * Math.PI / 180));

  function onMousedown(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragging = true;
  }

  function onMousemove(e: MouseEvent) {
    if (!dragging) return;
    value = Math.max(0, Math.min(1, value - e.movementY / sensitivity));
  }

  function onMouseup() {
    dragging = false;
  }

  function onDblclick(e: MouseEvent) {
    e.stopPropagation();
    value = defaultValue;
  }
</script>

<svelte:window onmousemove={onMousemove} onmouseup={onMouseup} />

<div
  class="dial-wrap"
  style="width:{size}px; height:{size}px;"
  onmousedown={onMousedown}
  ondblclick={onDblclick}
  role="slider"
  aria-valuenow={value}
  aria-valuemin={0}
  aria-valuemax={1}
  tabindex="0"
>
  {#if showArc}
    <svg class="dial-svg" viewBox="0 0 32 32" width={size} height={size}>
      <path d={bgPath} fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="2.5" stroke-linecap="round" />
      {#if value > 0}
        <path d={fillPath} fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" />
      {/if}
      <circle cx={tipX} cy={tipY} r="2" fill="var(--accent)" />
    </svg>
  {:else}
    <div class="knob" style="width:{size}px; height:{size}px; transform: rotate({angle}deg);">
      <div class="knob-dot"></div>
    </div>
  {/if}
  {#if dragging && tooltipKey}
    <DragTooltip keyLabel={tooltipKey} valueText={format(value)} />
  {/if}
</div>

<style>
  .dial-wrap {
    position: relative;
    cursor: ns-resize;
    user-select: none;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dial-svg {
    display: block;
    overflow: visible;
  }

  .knob {
    border-radius: 50%;
    background: radial-gradient(circle at 40% 35%, #3a3a3a, #1c1c1c);
    border: 1px solid rgba(255,255,255,0.12);
    position: relative;
    box-shadow: 0 1px 3px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07);
    flex-shrink: 0;
  }

  .knob-dot {
    position: absolute;
    top: 3px;
    left: 50%;
    transform: translateX(-50%);
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: rgba(255,255,255,0.75);
  }
</style>
