<script lang="ts">
  // Dumb/presentational jack socket — same treatment as DragTooltip.svelte:
  // no store access, no connect/disconnect logic. It just reports its own
  // DOM element (for Mixer.svelte's cable-geometry measurements) and mouse
  // events up via callback props; Mixer.svelte owns all cable-drag/store
  // decisions.
  let {
    kind,
    trackId,
    connected = false,
    onPortMount,
    onPortUnmount,
    onPortDown,
  }: {
    kind:      'in' | 'out';
    trackId:   number;
    connected?: boolean;
    onPortMount:   (trackId: number, kind: 'in' | 'out', el: HTMLElement) => void;
    onPortUnmount: (trackId: number, kind: 'in' | 'out') => void;
    onPortDown:    (trackId: number, kind: 'in' | 'out', e: MouseEvent) => void;
  } = $props();

  let el = $state<HTMLElement | null>(null);

  $effect(() => {
    if (!el) return;
    onPortMount(trackId, kind, el);
    return () => onPortUnmount(trackId, kind);
  });

  function onMousedown(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onPortDown(trackId, kind, e);
  }
</script>

<div
  class="jack"
  class:jack--connected={connected}
  bind:this={el}
  data-jack-track-id={trackId}
  data-jack-kind={kind}
  onmousedown={onMousedown}
  role="button"
  tabindex="-1"
  aria-label="{kind === 'in' ? 'Side-chain input' : 'Side-chain output'} port"
  title={kind === 'in' ? 'IN' : 'OUT'}
></div>

<style>
  .jack {
    width: 13px;
    height: 13px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #3a3a3a, #0c0c0c 70%);
    border: 1px solid rgba(255, 255, 255, 0.18);
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.8), 0 1px 1px rgba(255, 255, 255, 0.04);
    cursor: crosshair;
    flex-shrink: 0;
    transition: box-shadow 0.12s, border-color 0.12s;
  }

  .jack:hover {
    border-color: rgba(255, 255, 255, 0.4);
  }

  .jack--connected {
    border-color: var(--accent, #90c396);
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.8), 0 0 5px rgba(144, 195, 150, 0.7);
  }
</style>
