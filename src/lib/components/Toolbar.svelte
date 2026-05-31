<script lang="ts">
  import type { MenuItem } from '$lib/types';
  import MenuBar from './MenuBar.svelte';
  import { playback } from '$lib/playbackStore.svelte';

  let {
    menus,
    showExplorer    = $bindable(true),
    showChannelRack = $bindable(false),
    showPianoRoll   = $bindable(false),
    showPlaylist    = $bindable(true),
    showMixer       = $bindable(false),
  }: {
    menus: { name: string; items: MenuItem[] }[];
    showExplorer?:    boolean;
    showChannelRack?: boolean;
    showPianoRoll?:   boolean;
    showPlaylist?:    boolean;
    showMixer?:       boolean;
  } = $props();

  // Transport
  let isPlaying   = $state(false);
  let isPaused    = $state(false);
  let isRecording = $state(false);

  // Display — tempo is sourced from the shared playback store
  let position     = $state({ beat: 1, step: 1, tick: 0 });
  let patternMode  = $state<'pattern' | 'song'>('pattern');

  // Row-1 toggles
  let typingKeyboard = $state(false);
  let precount       = $state(false);
  let loopRecord     = $state(false);
  let metronome      = $state(false);

  // Row-2 toggles
  let autoScroll     = $state(false);
  let oneClickRecord = $state(false);

  // Dropdowns
  let snapping        = $state('1/4');
  let selectedPattern = $state(1);

  // Modifier key indicators
  let shiftDown = $state(false);
  let altDown   = $state(false);
  let ctrlDown  = $state(false);

  let posDisplay = $derived(
    `${position.beat}:${position.step}:${String(position.tick).padStart(2, '0')}`
  );

  $effect(() => {
    function onDown(e: KeyboardEvent) {
      if (e.key === 'Shift')   shiftDown = true;
      if (e.key === 'Alt')     altDown   = true;
      if (e.key === 'Control') ctrlDown  = true;
    }
    function onUp(e: KeyboardEvent) {
      if (e.key === 'Shift')   shiftDown = false;
      if (e.key === 'Alt')     altDown   = false;
      if (e.key === 'Control') ctrlDown  = false;
    }
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup',   onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup',   onUp);
    };
  });

  function play() {
    if (isPlaying) { isPlaying = false; isPaused = false; }
    else           { isPlaying = true;  isPaused = false; }
  }
  function stop() {
    isPlaying = false; isPaused = false;
    position = { beat: 1, step: 1, tick: 0 };
  }
  function pause() {
    if (isPlaying)      { isPlaying = false; isPaused = true; }
    else if (isPaused)  { isPlaying = true;  isPaused = false; }
  }

  function onTempoWheel(e: WheelEvent) {
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    playback.tempo = Math.max(20, Math.min(999, playback.tempo - Math.sign(e.deltaY) * step));
  }
</script>

<div class="toolbar">

  <!-- ── Row 1 / Col 1 : Menu section (grey-green) ─────────────────── -->
  <div class="tb-menu">
    <MenuBar {menus} />
  </div>

  <!-- ── Row 1 / Col 2 : Transport + display + toggles + monitor ───── -->
  <div class="tb-r1">

    <!-- Pattern / Song mode switch -->
    <div class="tb-vsep"></div>
    <div class="tb-patsng" role="group" aria-label="Playback mode">
      <button
        class="tb-patsng-btn"
        class:tb-patsng-btn--on={patternMode === 'pattern'}
        onclick={() => patternMode = 'pattern'}
      >PAT</button>
      <button
        class="tb-patsng-btn"
        class:tb-patsng-btn--on={patternMode === 'song'}
        onclick={() => patternMode = 'song'}
      >SNG</button>
    </div>

    <!-- Transport buttons: Play · Stop · Pause · Record -->
    <div class="tb-vsep"></div>
    <div class="tb-transport">
      <button class="tb-xp" class:tb-xp--on={isPlaying} onclick={play} title="Play">
        <svg width="12" height="13" viewBox="0 0 12 13" fill="currentColor" aria-hidden="true">
          <path d="M1 1 L11 6.5 L1 12 Z"/>
        </svg>
      </button>
      <button class="tb-xp" onclick={stop} title="Stop">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor" aria-hidden="true">
          <rect x="0.5" y="0.5" width="10" height="10" rx="1.5"/>
        </svg>
      </button>
      <button class="tb-xp" class:tb-xp--on={isPaused} onclick={pause} title="Pause">
        <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true">
          <rect x="0" y="0" width="3.5" height="12" rx="1"/>
          <rect x="6.5" y="0" width="3.5" height="12" rx="1"/>
        </svg>
      </button>
      <button class="tb-xp tb-xp--rec" class:tb-xp--on={isRecording} onclick={() => isRecording = !isRecording} title="Record">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor" aria-hidden="true">
          <circle cx="5.5" cy="5.5" r="5"/>
        </svg>
      </button>
    </div>

    <!-- Tempo (scrollable) -->
    <div class="tb-vsep"></div>
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="tb-display tb-display--tempo" role="group" aria-label="Tempo" onwheel={onTempoWheel}>
      <span class="tb-dlabel">BPM</span>
      <span class="tb-dvalue">{playback.tempo.toFixed(1)}</span>
    </div>

    <!-- Song position -->
    <div class="tb-vsep"></div>
    <div class="tb-display" role="group" aria-label="Song position">
      <span class="tb-dlabel">POS</span>
      <span class="tb-dvalue">{posDisplay}</span>
    </div>

    <!-- Feature toggles -->
    <div class="tb-vsep"></div>
    <div class="tb-toggles">

      <!-- Typing keyboard → piano -->
      <button class="tb-tgl" class:tb-tgl--on={typingKeyboard} onclick={() => typingKeyboard = !typingKeyboard} title="Typing keyboard to piano">
        <svg width="20" height="13" viewBox="0 0 20 13" fill="currentColor" aria-hidden="true">
          <!-- keyboard body -->
          <rect x="0" y="1" width="7.5" height="7.5" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.1"/>
          <rect x="1" y="2.5" width="1.8" height="1.8" rx="0.4"/>
          <rect x="3.5" y="2.5" width="1.8" height="1.8" rx="0.4"/>
          <rect x="5.8" y="2.5" width="1" height="1.8" rx="0.4"/>
          <rect x="1" y="5.2" width="5.5" height="1.8" rx="0.4"/>
          <!-- arrow -->
          <path d="M8.8 5 L10.3 5 M9.5 3.8 L10.4 5 L9.5 6.2" stroke-width="1.1" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
          <!-- piano: 3 white keys + 2 black keys -->
          <rect x="11.5" y="0" width="2.2" height="13" rx="0.6"/>
          <rect x="14.5" y="0" width="2.2" height="13" rx="0.6"/>
          <rect x="17.5" y="0" width="2.2" height="13" rx="0.6"/>
          <rect x="13" y="0" width="1.8" height="7.5" rx="0.4" style="fill: var(--sidebar-bg)"/>
          <rect x="16" y="0" width="1.8" height="7.5" rx="0.4" style="fill: var(--sidebar-bg)"/>
        </svg>
      </button>

      <!-- Precount 3·2·1 -->
      <button class="tb-tgl" class:tb-tgl--on={precount} onclick={() => precount = !precount} title="Recording precount (3–2–1)">
        <span class="tb-321">3·2·1</span>
      </button>

      <!-- Loop record -->
      <button class="tb-tgl" class:tb-tgl--on={loopRecord} onclick={() => loopRecord = !loopRecord} title="Loop recording">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12.5 5 A6 6 0 1 0 11 10.5"/>
          <path d="M11 14 L11 10 L14.5 10"/>
          <circle cx="7" cy="7" r="2" fill="currentColor" stroke="none"/>
        </svg>
      </button>

      <!-- Metronome -->
      <button class="tb-tgl" class:tb-tgl--on={metronome} onclick={() => metronome = !metronome} title="Metronome">
        <svg width="12" height="15" viewBox="0 0 12 15" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M1.5 14 L6 1 L10.5 14 Z"/>
          <line x1="6" y1="14" x2="9.5" y2="5"/>
          <circle cx="6" cy="14" r="1" fill="currentColor" stroke="none"/>
        </svg>
      </button>
    </div>

    <!-- Monitor placeholder -->
    <div class="tb-vsep"></div>
    <div class="tb-monitor" aria-label="Monitor (placeholder)"></div>

    <!-- Stereo peak meter -->
    <div class="tb-peak" aria-label="Stereo peak meter">
      <div class="tb-peak-bar"></div>
      <div class="tb-peak-bar"></div>
    </div>
  </div>

  <!-- ── Row 2 / Col 1 : Info box (auto-matches menu section width) ── -->
  <div class="tb-info">
    <span class="tb-info-line">Ready</span>
    <span class="tb-info-line tb-info-muted">VeggieLoops</span>
  </div>

  <!-- ── Row 2 / Col 2 : Panel toggles · snap · pattern · key badges ─ -->
  <div class="tb-r2">
    <div class="tb-vsep-sm"></div>

    <!-- Explorer -->
    <button class="tb-pb" class:tb-pb--on={showExplorer} onclick={() => showExplorer = !showExplorer} title="File Explorer">
      <svg width="13" height="12" viewBox="0 0 13 12" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M0.5 2.5 H5 L6.5 4 H12.5 V11 H0.5 Z"/>
        <line x1="0.5" y1="7" x2="12.5" y2="7"/>
      </svg>
    </button>

    <!-- Channel Rack -->
    <button class="tb-pb" class:tb-pb--on={showChannelRack} onclick={() => showChannelRack = !showChannelRack} title="Channel Rack">
      <svg width="13" height="12" viewBox="0 0 13 12" fill="currentColor" aria-hidden="true">
        <rect x="0"    y="2"  width="2" height="10" rx="0.75"/>
        <rect x="2.75" y="0"  width="2" height="12" rx="0.75"/>
        <rect x="5.5"  y="4"  width="2" height="8"  rx="0.75"/>
        <rect x="8.25" y="1"  width="2" height="11" rx="0.75"/>
        <rect x="11"   y="3"  width="2" height="9"  rx="0.75"/>
      </svg>
    </button>

    <!-- Piano Roll -->
    <button class="tb-pb" class:tb-pb--on={showPianoRoll} onclick={() => showPianoRoll = !showPianoRoll} title="Piano Roll">
      <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor" aria-hidden="true">
        <rect x="0"   y="0" width="3.5" height="13" rx="0.75"/>
        <rect x="4.5" y="0" width="3.5" height="13" rx="0.75"/>
        <rect x="9.5" y="0" width="3.5" height="13" rx="0.75"/>
        <rect x="2.3" y="0" width="2.5" height="7.5" rx="0.5" style="fill: var(--main-bg)"/>
        <rect x="7.3" y="0" width="2.5" height="7.5" rx="0.5" style="fill: var(--main-bg)"/>
      </svg>
    </button>

    <!-- Playlist -->
    <button class="tb-pb" class:tb-pb--on={showPlaylist} onclick={() => showPlaylist = !showPlaylist} title="Playlist">
      <svg width="13" height="11" viewBox="0 0 13 11" fill="currentColor" aria-hidden="true">
        <rect x="0" y="0"    width="13" height="2.5" rx="0.75"/>
        <rect x="0" y="4.25" width="13" height="2.5" rx="0.75"/>
        <rect x="0" y="8.5"  width="13" height="2.5" rx="0.75"/>
      </svg>
    </button>

    <!-- Mixer -->
    <button class="tb-pb" class:tb-pb--on={showMixer} onclick={() => showMixer = !showMixer} title="Mixer">
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" aria-hidden="true">
        <line x1="2"   y1="0" x2="2"   y2="13"/>
        <circle cx="2"   cy="4" r="1.4" fill="currentColor" stroke="none"/>
        <line x1="6.5" y1="0" x2="6.5" y2="13"/>
        <circle cx="6.5" cy="8" r="1.4" fill="currentColor" stroke="none"/>
        <line x1="11"  y1="0" x2="11"  y2="13"/>
        <circle cx="11"  cy="5" r="1.4" fill="currentColor" stroke="none"/>
      </svg>
    </button>

    <!-- Auto scroll -->
    <button class="tb-pb" class:tb-pb--on={autoScroll} onclick={() => autoScroll = !autoScroll} title="Auto scroll">
      <svg width="13" height="11" viewBox="0 0 13 11" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="0" y1="1.5" x2="9"  y2="1.5"/>
        <line x1="0" y1="5.5" x2="9"  y2="5.5"/>
        <line x1="0" y1="9.5" x2="9"  y2="9.5"/>
        <path d="M8.5 0 L13 5.5 L8.5 11"/>
      </svg>
    </button>

    <!-- One-click audio recording (mic) -->
    <button class="tb-pb" class:tb-pb--on={oneClickRecord} onclick={() => oneClickRecord = !oneClickRecord} title="One-click audio recording">
      <svg width="10" height="14" viewBox="0 0 10 14" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="2" y="0.5" width="6" height="8" rx="3"/>
        <path d="M0.5 7.5 A4.5 4.5 0 0 0 9.5 7.5"/>
        <line x1="5" y1="12" x2="5" y2="10.5"/>
        <line x1="2.5" y1="13.5" x2="7.5" y2="13.5"/>
      </svg>
    </button>

    <div class="tb-vsep-sm"></div>

    <!-- Snapping -->
    <select class="tb-sel" bind:value={snapping} title="Snapping">
      <option value="1/4">1/4</option>
      <option value="1/2">1/2</option>
    </select>

    <!-- Pattern selection -->
    <select class="tb-sel" bind:value={selectedPattern} title="Pattern">
      {#each Array.from({ length: 8 }, (_, i) => i + 1) as n}
        <option value={n}>Pat {n}</option>
      {/each}
    </select>

    <div class="tb-spacer"></div>

    <!-- Modifier key indicators -->
    <div class="tb-keys">
      <span class="tb-key" class:tb-key--on={shiftDown}>SHF</span>
      <span class="tb-key" class:tb-key--on={altDown}>ALT</span>
      <span class="tb-key" class:tb-key--on={ctrlDown}>CTL</span>
    </div>
  </div>
</div>

<style>
  /* ── Grid wrapper ───────────────────────────────────────────── */
  .toolbar {
    display: grid;
    grid-template-columns: max-content 1fr;
    grid-template-rows: 50px 50px;
    background: var(--sidebar-bg);
    border-bottom: 1px solid var(--sidebar-border);
    flex-shrink: 0;
    user-select: none;
    overflow: hidden;
  }

  /* ── Row 1 / Col 1 : Menu section ──────────────────────────── */
  .tb-menu {
    grid-row: 1;
    grid-column: 1;
    display: flex;
    align-items: center;
    padding: 0 10px;
    background: var(--toolbar-green-bg);
    border-right: 1px solid rgba(0, 0, 0, 0.35);
  }

  /* ── Row 1 / Col 2 : Transport + controls ───────────────────── */
  .tb-r1 {
    grid-row: 1;
    grid-column: 2;
    display: flex;
    align-items: center;
  }

  /* ── Row 2 / Col 1 : Info box ───────────────────────────────── */
  .tb-info {
    grid-row: 2;
    grid-column: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 1px;
    padding: 2px 8px;
    border-top: 1px solid var(--sidebar-border);
    border-right: 1px solid rgba(0, 0, 0, 0.35);
  }

  .tb-info-line {
    font-size: 10px;
    font-family: 'DM Mono', 'Cascadia Code', monospace;
    color: var(--main-text);
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tb-info-muted { color: var(--main-text-muted); }

  /* ── Row 2 / Col 2 : Panel toggles + dropdowns + keys ────────── */
  .tb-r2 {
    grid-row: 2;
    grid-column: 2;
    display: flex;
    align-items: center;
    border-top: 1px solid var(--sidebar-border);
    gap: 1px;
    padding: 0 4px;
  }

  /* ── Separators ─────────────────────────────────────────────── */
  .tb-vsep {
    width: 1px;
    height: 28px;
    background: rgba(255, 255, 255, 0.07);
    margin: 0 8px;
    flex-shrink: 0;
  }
  .tb-vsep-sm {
    width: 1px;
    height: 16px;
    background: rgba(255, 255, 255, 0.07);
    margin: 0 5px;
    flex-shrink: 0;
  }

  /* ── Pattern / Song switch ───────────────────────────────────── */
  .tb-patsng {
    display: flex;
    border: 1px solid var(--sidebar-border);
    border-radius: 4px;
    overflow: hidden;
  }
  .tb-patsng-btn {
    background: transparent;
    border: none;
    color: var(--btn-text);
    font-family: inherit;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.05em;
    padding: 5px 9px;
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
    line-height: 1;
  }
  .tb-patsng-btn + .tb-patsng-btn { border-left: 1px solid var(--sidebar-border); }
  .tb-patsng-btn--on {
    background: var(--accent);
    color: #fff;
  }
  .tb-patsng-btn:not(.tb-patsng-btn--on):hover {
    background: rgba(255, 255, 255, 0.06);
    color: var(--main-text);
  }

  /* ── Transport buttons ───────────────────────────────────────── */
  .tb-transport { display: flex; align-items: center; gap: 3px; }

  .tb-xp {
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--btn-bg);
    border: 1px solid var(--btn-border);
    border-radius: 5px;
    color: var(--btn-text);
    cursor: pointer;
    transition: background 0.1s, color 0.1s, border-color 0.1s;
  }
  .tb-xp:hover { background: var(--btn-hover); color: var(--main-text); }
  .tb-xp--on {
    border-color: var(--accent);
    color: var(--accent);
    background: rgba(224, 120, 0, 0.09);
  }
  .tb-xp--rec { color: #c43b3b; }
  .tb-xp--rec.tb-xp--on {
    color: #e05050;
    border-color: #c43b3b;
    background: rgba(196, 59, 59, 0.12);
  }

  /* ── Display blocks (BPM / position, grey-green bg) ────────── */
  .tb-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--toolbar-green-bg);
    padding: 5px 12px;
    height: 100%;
    gap: 2px;
    cursor: default;
  }
  .tb-display--tempo { cursor: ns-resize; }

  .tb-dlabel {
    font-size: 8.5px;
    font-family: 'DM Mono', 'Cascadia Code', monospace;
    color: rgba(160, 210, 175, 0.55);
    letter-spacing: 0.1em;
    line-height: 1;
  }
  .tb-dvalue {
    font-size: 16px;
    font-family: 'DM Mono', 'Cascadia Code', monospace;
    color: #9fdaaf;
    line-height: 1;
    letter-spacing: 0.02em;
  }

  /* ── Feature toggles (row 1 right cluster) ───────────────────── */
  .tb-toggles { display: flex; align-items: center; gap: 2px; }

  .tb-tgl {
    width: 32px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--btn-text);
    cursor: pointer;
    border-radius: 4px;
    transition: background 0.1s, color 0.1s;
  }
  .tb-tgl:hover { background: rgba(255, 255, 255, 0.05); color: var(--main-text); }
  .tb-tgl--on {
    color: var(--accent);
    background: rgba(224, 120, 0, 0.08);
  }

  .tb-321 {
    font-size: 8.5px;
    font-family: 'DM Mono', 'Cascadia Code', monospace;
    font-weight: 700;
    letter-spacing: 0.01em;
    line-height: 1;
    pointer-events: none;
  }

  /* ── Monitor placeholder ─────────────────────────────────────── */
  .tb-monitor {
    width: 100px;
    height: 38px;
    background: #0f0f0f;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 3px;
    margin: 0 6px;
    flex-shrink: 0;
  }

  /* ── Stereo peak meter ───────────────────────────────────────── */
  .tb-peak {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 0 10px;
    justify-content: center;
    flex-shrink: 0;
  }
  .tb-peak-bar {
    width: 72px;
    height: 9px;
    background: #1c2a1c;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 2px;
  }

  /* ── Row-2 panel buttons ─────────────────────────────────────── */
  .tb-pb {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    background: transparent;
    border: none;
    color: var(--btn-text);
    cursor: pointer;
    border-radius: 3px;
    transition: background 0.1s, color 0.1s;
    flex-shrink: 0;
  }
  .tb-pb:hover { background: rgba(255, 255, 255, 0.05); color: var(--main-text); }
  .tb-pb--on {
    color: var(--accent);
    background: rgba(224, 120, 0, 0.08);
  }

  /* ── Dropdowns ────────────────────────────────────────────────── */
  .tb-sel {
    background: var(--btn-bg);
    border: 1px solid var(--btn-border);
    color: var(--btn-text);
    font-family: inherit;
    font-size: 11px;
    padding: 4px 6px;
    border-radius: 4px;
    cursor: pointer;
    height: 28px;
    outline: none;
    flex-shrink: 0;
  }
  .tb-sel:focus { border-color: var(--accent); }

  /* ── Spacer + key indicators ─────────────────────────────────── */
  .tb-spacer { flex: 1; }

  .tb-keys {
    display: flex;
    gap: 3px;
    padding: 0 8px;
  }
  .tb-key {
    font-size: 9px;
    font-family: 'DM Mono', 'Cascadia Code', monospace;
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: 4px 7px;
    border-radius: 4px;
    background: var(--btn-bg);
    border: 1px solid var(--btn-border);
    color: rgba(255, 255, 255, 0.18);
    transition: background 0.1s, color 0.1s, border-color 0.1s;
    line-height: 1.4;
  }
  .tb-key--on {
    background: rgba(224, 120, 0, 0.14);
    border-color: var(--accent);
    color: var(--accent);
  }
</style>
