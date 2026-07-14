<script lang="ts">
  import Knob from '../Knob.svelte';
  import type { PortState } from '$lib/mixerStore.svelte';

  // Presentational jack socket with 3 cycling states (right-click to
  // advance passive -> sending -> knob -> passive). It still reports its own
  // DOM element (for Mixer.svelte's cable-geometry measurements) and
  // left-click mousedown up via callback props — Mixer.svelte owns all
  // cable-drag/store decisions — but state/level themselves are plain
  // bindable props (same convention as data.volume/data.filterEnabled
  // elsewhere), not routed through a store method.
  let {
    kind,
    trackId,
    connected = false,
    portState = $bindable<PortState>('passive'),
    level = $bindable(1),
    onPortMount,
    onPortUnmount,
    onPortDown,
  }: {
    kind:      'in' | 'out';
    trackId:   number;
    connected?: boolean;
    portState?: PortState;
    level?:    number;
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
    // Only the left button starts a cable drag — a right-click (button 2)
    // fires this same mousedown before its contextmenu event, and must not
    // also kick off a cable drag alongside the state cycle below.
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onPortDown(trackId, kind, e);
  }

  function onContextMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    portState = portState === 'passive' ? 'sending' : portState === 'sending' ? 'knob' : 'passive';
  }
</script>

<div
  class="jack-wrap"
  class:jack-wrap--connected={connected}
  bind:this={el}
  data-jack-track-id={trackId}
  data-jack-kind={kind}
  onmousedown={portState === 'knob' ? undefined : onMousedown}
  oncontextmenu={onContextMenu}
  role="button"
  tabindex="-1"
  aria-label="{kind === 'in' ? 'Side-chain input' : 'Side-chain output'} port"
  title={kind === 'in' ? 'IN' : 'OUT'}
>
  {#if portState === 'knob'}
    <Knob bind:value={level} size={13} tooltipKey={kind === 'in' ? 'IN SEND' : 'OUT SEND'} />
  {:else}
    <div class="jack">
      {#if portState === 'passive'}
        <svg class="jack-icon" viewBox="0 0 13 13">
          <polygon points="6.5,3 10,9.5 3,9.5" fill="rgba(255,255,255,0.45)" />
        </svg>
      {:else}
        <svg class="jack-icon" viewBox="0 0 13 13">
          <polygon points="6.5,10 3,4.5 5.25,4.5 5.25,2.5 7.75,2.5 7.75,4.5 10,4.5" fill="var(--accent, #90c396)" />
        </svg>
      {/if}
    </div>
  {/if}
</div>

<style>
  .jack-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: filter 0.12s;
  }

  .jack-wrap--connected {
    filter: drop-shadow(0 0 4px rgba(144, 195, 150, 0.7));
  }

  .jack {
    width: 13px;
    height: 13px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #3a3a3a, #0c0c0c 70%);
    border: 1px solid rgba(255, 255, 255, 0.18);
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.8), 0 1px 1px rgba(255, 255, 255, 0.04);
    cursor: crosshair;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: border-color 0.12s;
  }

  .jack:hover {
    border-color: rgba(255, 255, 255, 0.4);
  }

  .jack-icon {
    width: 8px;
    height: 8px;
    pointer-events: none;
  }
</style>
