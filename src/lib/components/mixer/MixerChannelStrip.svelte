<script lang="ts">
  import Slider from '../Slider.svelte';
  import JackPort from './JackPort.svelte';
  import PeakMeterVertical from './PeakMeterVertical.svelte';
  import { MASTER_TRACK_ID, type MixerChannelData } from '$lib/mixerStore.svelte';

  let {
    variant,
    data,
    inConnected  = false,
    outConnected = false,
    onPortMount,
    onPortUnmount,
    onPortDown,
  }: {
    variant: 'master' | 'channel';
    data: MixerChannelData;
    inConnected?:  boolean;
    outConnected?: boolean;
    onPortMount:   (trackId: number, kind: 'in' | 'out', el: HTMLElement) => void;
    onPortUnmount: (trackId: number, kind: 'in' | 'out') => void;
    onPortDown:    (trackId: number, kind: 'in' | 'out', e: MouseEvent) => void;
  } = $props();

  let label = $derived(data.id === MASTER_TRACK_ID ? 'MASTER' : `CH ${data.id}`);
</script>

<div class="strip" class:strip--master={variant === 'master'}>
  <span class="strip-label">{label}</span>

  <div class="strip-meter-fader">
    <PeakMeterVertical giant={variant === 'master'} height={variant === 'master' ? 150 : 90} />
    <Slider bind:value={data.volume} min={0} max={2} defaultValue={0.8} height={variant === 'master' ? 150 : 90} tooltipKey="VOL" />
  </div>

  <button
    class="filter-btn"
    class:filter-btn--on={data.filterEnabled}
    onclick={() => data.filterEnabled = !data.filterEnabled}
    aria-pressed={data.filterEnabled}
    title="Filter"
  >
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round">
      <path d="M1 2h12L9 7v5H5V7L1 2z"/>
    </svg>
  </button>

  <div class="strip-ports">
    <JackPort kind="in" trackId={data.id} connected={inConnected} {onPortMount} {onPortUnmount} {onPortDown} />
    {#if variant !== 'master'}
      <JackPort kind="out" trackId={data.id} connected={outConnected} {onPortMount} {onPortUnmount} {onPortDown} />
    {/if}
  </div>
</div>

<style>
  .strip {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    width: 64px;
    flex-shrink: 0;
    padding: 10px 6px;
    background: var(--btn-bg, #252525);
    border: 1px solid var(--btn-border, #383838);
    border-radius: 6px;
  }

  .strip--master {
    width: 110px;
  }

  .strip-label {
    font-family: 'DM Mono', 'Cascadia Code', monospace;
    font-size: 10px;
    letter-spacing: 0.05em;
    color: var(--main-text, #d0d0d0);
  }

  .strip--master .strip-label {
    font-weight: 700;
    color: var(--accent, #90c396);
  }

  .strip-meter-fader {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }

  .filter-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid var(--btn-border, #383838);
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.45);
    cursor: pointer;
    padding: 0;
    transition: color 0.1s, background 0.1s, border-color 0.1s;
  }

  .filter-btn svg { width: 13px; height: 13px; }

  .filter-btn:hover {
    background: rgba(255, 255, 255, 0.07);
    color: rgba(255, 255, 255, 0.75);
  }

  .filter-btn--on {
    color: var(--accent, #90c396);
    border-color: rgba(144, 195, 150, 0.4);
    background: rgba(144, 195, 150, 0.1);
  }

  .strip-ports {
    display: flex;
    gap: 10px;
  }
</style>
