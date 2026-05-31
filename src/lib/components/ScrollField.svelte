<script lang="ts">
  let {
    value    = $bindable(1),
    min      = 0,
    max      = 999,
    step     = 1,
    decimals = 0,
    width    = 36,
    label    = '',
  }: {
    value?:    number;
    min?:      number;
    max?:      number;
    step?:     number;
    decimals?: number;
    width?:    number;
    label?:    string;
  } = $props();

  let display = $derived(value.toFixed(decimals));

  let dragStartY = 0;
  let dragStartVal = 0;
  let dragging = false;

  function clamp(v: number) {
    return Math.max(min, Math.min(max, v));
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const dir = e.deltaY < 0 ? 1 : -1;
    value = clamp(value + dir * step);
  }

  function onMousedown(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragging = true;
    dragStartY = e.clientY;
    dragStartVal = value;
  }

  function onMousemove(e: MouseEvent) {
    if (!dragging) return;
    const delta = dragStartY - e.clientY;
    value = clamp(dragStartVal + Math.round(delta / 4) * step);
  }

  function onMouseup() {
    dragging = false;
  }
</script>

<svelte:window onmousemove={onMousemove} onmouseup={onMouseup} />

<div class="sf-wrap" style="width:{width}px;" onwheel={onWheel} onmousedown={onMousedown} role="spinbutton" aria-valuenow={value} aria-valuemin={min} aria-valuemax={max} tabindex="0">
  <span class="sf-val">{display}</span>
  {#if label}
    <span class="sf-label">{label}</span>
  {/if}
</div>

<style>
  .sf-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: #111;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 3px;
    padding: 1px 2px;
    cursor: ns-resize;
    user-select: none;
    flex-shrink: 0;
  }

  .sf-val {
    font-family: 'DM Mono', 'Cascadia Code', monospace;
    font-size: 11px;
    color: var(--main-text);
    line-height: 1.2;
    white-space: nowrap;
  }

  .sf-label {
    font-size: 7px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--main-text-muted);
    line-height: 1;
  }
</style>
