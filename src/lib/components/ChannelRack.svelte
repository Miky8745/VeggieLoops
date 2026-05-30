<script lang="ts">
  let { show = $bindable() }: { show: boolean } = $props();

  let x = $state(120);
  let y = $state(80);
  let dragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  function close() { show = false; }

  function onHeaderMousedown(e: MouseEvent) {
    if ((e.target as HTMLElement).closest('.close-btn')) return;
    dragging = true;
    dragOffsetX = e.clientX - x;
    dragOffsetY = e.clientY - y;
    e.preventDefault();
  }

  function onMousemove(e: MouseEvent) {
    if (!dragging) return;
    x = e.clientX - dragOffsetX;
    y = e.clientY - dragOffsetY;
  }

  function onMouseup() {
    dragging = false;
  }
</script>

<svelte:window onmousemove={onMousemove} onmouseup={onMouseup} />

{#if show}
  <div
    class="rack"
    role="dialog"
    aria-label="Channel Rack"
    tabindex="-1"
    style="left: {x}px; top: {y}px"
  >
    <div
      class="rack-header"
      onmousedown={onHeaderMousedown}
      role="presentation"
    >
      <h2 class="rack-title">Channel Rack</h2>
      <button class="close-btn" onclick={close} aria-label="Close">×</button>
    </div>
    <div class="rack-body">
      <p class="coming-soon">Coming soon</p>
    </div>
  </div>
{/if}

<style>
  .rack {
    position: fixed;
    width: 640px;
    min-height: 400px;
    background: var(--explorer-bg);
    border: 1px solid var(--explorer-border);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
    z-index: 100;
  }

  .rack-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px 11px;
    border-bottom: 1px solid var(--explorer-border);
    flex-shrink: 0;
    cursor: grab;
    user-select: none;
  }

  .rack-header:active { cursor: grabbing; }

  .rack-title {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 17px;
    font-weight: 600;
    color: var(--main-text);
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--main-text-muted);
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    transition: background 0.1s, color 0.1s;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--main-text);
  }

  .rack-body {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .coming-soon {
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--main-text-muted);
    opacity: 0.5;
  }
</style>
