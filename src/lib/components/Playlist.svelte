<script lang="ts">
  const TRACK_PANEL_W = 180;
  const RULER_H = 24;

  interface Track {
    id: number;
    name: string;
    color: string;
  }

  let trackHeight = $state(48);
  let barWidth = $state(40);
  let barCount = $state(64);

  let tracks = $state<Track[]>([
    { id: 1, name: 'Track 1', color: '#E07800' },
    { id: 2, name: 'Track 2', color: '#E07800' },
    { id: 3, name: 'Track 3', color: '#E07800' },
    { id: 4, name: 'Track 4', color: '#E07800' },
    { id: 5, name: 'Track 5', color: '#E07800' },
    { id: 6, name: 'Track 6', color: '#E07800' },
    { id: 7, name: 'Track 7', color: '#E07800' },
    { id: 8, name: 'Track 8', color: '#E07800' },
  ]);

  let groupCount = $derived(Math.ceil(barCount / 4));
  let totalWidth = $derived(TRACK_PANEL_W + barCount * barWidth);

  const SHADE_A = '#1C1C1C';
  const SHADE_B = '#222222';
  const RULER_A = '#151515';
  const RULER_B = '#1A1A1A';

  function cellBg(barIndex: number): string {
    return Math.floor(barIndex / 4) % 2 === 0 ? SHADE_A : SHADE_B;
  }

  function rulerBg(groupIndex: number): string {
    return groupIndex % 2 === 0 ? RULER_A : RULER_B;
  }
</script>

<div
  class="playlist"
  style="--track-h: {trackHeight}px; --bar-w: {barWidth}px; --ruler-h: {RULER_H}px; --panel-w: {TRACK_PANEL_W}px;"
>
  <div class="grid" style="width: {totalWidth}px;">
    <!-- Ruler row -->
    <div class="ruler-row">
      <div class="ruler-corner"></div>
      {#each Array.from({ length: groupCount }) as _, gi}
        {@const barsInGroup = Math.min(4, barCount - gi * 4)}
        <div
          class="ruler-group"
          style="background: {rulerBg(gi)}; width: {barsInGroup * barWidth}px;"
        >
          <span class="bar-num">{gi * 4 + 1}</span>
        </div>
      {/each}
    </div>

    <!-- Track rows -->
    {#each tracks as track (track.id)}
      <div class="track-row">
        <div class="track-panel" style="--tc: {track.color}">
          <span class="color-strip"></span>
          <span class="track-name-text">{track.name}</span>
        </div>
        {#each Array.from({ length: barCount }) as _, bi}
          <div
            class="bar-cell"
            class:group-start={bi % 4 === 0}
            style="background: {cellBg(bi)};"
          ></div>
        {/each}
      </div>
    {/each}
  </div>
</div>

<style>
  .playlist {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  .grid {
    display: flex;
    flex-direction: column;
    min-height: 100%;
  }

  /* ── Ruler ─────────────────────────────────── */
  .ruler-row {
    display: flex;
    height: var(--ruler-h);
    position: sticky;
    top: 0;
    z-index: 2;
    flex-shrink: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .ruler-corner {
    width: var(--panel-w);
    flex-shrink: 0;
    background: #131313;
    border-right: 1px solid var(--main-border);
    position: sticky;
    left: 0;
    z-index: 3;
  }

  .ruler-group {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    padding-left: 5px;
    border-right: 1px solid rgba(255, 255, 255, 0.04);
    box-sizing: border-box;
  }

  .bar-num {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.22);
    letter-spacing: 0.03em;
    font-variant-numeric: tabular-nums;
    user-select: none;
    pointer-events: none;
  }

  /* ── Track rows ─────────────────────────────── */
  .track-row {
    display: flex;
    height: var(--track-h);
    flex-shrink: 0;
    border-bottom: 1px solid rgba(0, 0, 0, 0.35);
  }

  .track-panel {
    width: var(--panel-w);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    background: #181818;
    border-right: 1px solid var(--main-border);
    position: sticky;
    left: 0;
    z-index: 1;
    padding: 0 10px;
    overflow: hidden;
  }

  .color-strip {
    width: 3px;
    height: 20px;
    border-radius: 2px;
    background: var(--tc);
    flex-shrink: 0;
  }

  .track-name-text {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    user-select: none;
  }

  /* ── Bar cells ──────────────────────────────── */
  .bar-cell {
    width: var(--bar-w);
    flex-shrink: 0;
    border-right: 1px solid rgba(0, 0, 0, 0.25);
    cursor: pointer;
    box-sizing: border-box;
    transition: background 0.08s;
  }

  .bar-cell.group-start {
    border-left: 1px solid rgba(255, 255, 255, 0.06);
  }

  .bar-cell:hover {
    background: rgba(255, 255, 255, 0.07) !important;
  }

  /* ── Scrollbars ─────────────────────────────── */
  .playlist::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .playlist::-webkit-scrollbar-track {
    background: #141414;
  }

  .playlist::-webkit-scrollbar-thumb {
    background: var(--main-border);
    border-radius: 4px;
  }

  .playlist::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.18);
  }

  .playlist::-webkit-scrollbar-corner {
    background: #141414;
  }
</style>
