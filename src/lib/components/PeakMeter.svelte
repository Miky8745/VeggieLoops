<script lang="ts">
  // Toolbar's stereo peak meter — two horizontal bars driven by the
  // left/right analyser taps off audioEngine's master bus. Scaled in dBFS
  // (not raw linear amplitude) so "max" lines up with actual 0dBFS clipping
  // and normal listening levels don't all bunch up near the left edge — see
  // "Toolbar audio monitor & peak meter" in CLAUDE.md.
  import { audioEngine } from '$lib/audioEngine';
  import { playback } from '$lib/playbackStore.svelte';

  // Fast attack (jumps straight to a new, higher peak), slow release (decays
  // by this factor per frame otherwise) — the classic VU-meter feel.
  const RELEASE = 0.85;

  // dB range mapped onto the bar's 0..1 width. 0dB = full digital scale
  // (clipping) = the bar's true right edge; anything at/below MIN_DB reads
  // as empty.
  const MIN_DB = -48;

  // How long a peak stays marked by the hold line before it can be
  // overtaken by a lower, more recent peak.
  const HOLD_WINDOW_MS = 5000;

  const GREEN  = [159, 218, 175] as const; // matches app's --accent-ish green
  const YELLOW = [224, 195, 74]  as const;
  const RED    = [224, 80, 80]   as const; // matches the toolbar's record-on red

  let levelL = $state(0); // 0..1, already dB-scaled
  let levelR = $state(0);
  let holdL  = $state(0); // 0..1, max of levelL over the trailing HOLD_WINDOW_MS
  let holdR  = $state(0);

  let rafId = 0;
  let dataL: Uint8Array | null = null;
  let dataR: Uint8Array | null = null;
  let ampL = 0; // running linear-amplitude peak (pre-dB), attack/release smoothed
  let ampR = 0;
  let historyL: { t: number; level: number }[] = [];
  let historyR: { t: number; level: number }[] = [];

  function peakOf(analyser: AnalyserNode, buf: Uint8Array): number {
    analyser.getByteTimeDomainData(buf);
    let peak = 0;
    for (let i = 0; i < buf.length; i++) {
      const dev = Math.abs(buf[i] - 128) / 128;
      if (dev > peak) peak = dev;
    }
    return peak;
  }

  function ampToFraction(amp: number): number {
    if (amp <= 0) return 0;
    const db = 20 * Math.log10(amp);
    return Math.max(0, Math.min(1, (db - MIN_DB) / -MIN_DB));
  }

  function pushHold(history: { t: number; level: number }[], level: number, now: number): number {
    history.push({ t: now, level });
    while (history.length && now - history[0].t > HOLD_WINDOW_MS) history.shift();
    let max = 0;
    for (const s of history) if (s.level > max) max = s.level;
    return max;
  }

  function frame() {
    const stereo = audioEngine.getStereoAnalysers();
    if (!playback.isPlaying || !stereo) {
      levelL = levelR = 0;
      holdL = holdR = 0;
      ampL = ampR = 0;
      historyL = [];
      historyR = [];
      rafId = 0;
      return;
    }
    if (!dataL || dataL.length !== stereo.left.fftSize)  dataL = new Uint8Array(stereo.left.fftSize);
    if (!dataR || dataR.length !== stereo.right.fftSize) dataR = new Uint8Array(stereo.right.fftSize);
    const peakL = peakOf(stereo.left, dataL);
    const peakR = peakOf(stereo.right, dataR);
    ampL = peakL > ampL ? peakL : ampL * RELEASE;
    ampR = peakR > ampR ? peakR : ampR * RELEASE;
    levelL = ampToFraction(ampL);
    levelR = ampToFraction(ampR);
    const now = performance.now();
    holdL = pushHold(historyL, levelL, now);
    holdR = pushHold(historyR, levelR, now);
    rafId = requestAnimationFrame(frame);
  }

  // Mirrors playbackStore's own rAF convention — only runs while playing.
  $effect(() => {
    if (playback.isPlaying) {
      if (!rafId) rafId = requestAnimationFrame(frame);
    } else {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      levelL = levelR = 0;
      holdL = holdR = 0;
    }
    return () => { if (rafId) cancelAnimationFrame(rafId); };
  });

  function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  // Green up to 75%, green->yellow up to 90%, yellow->red the rest of the
  // way — stays calm through normal levels and only reddens as a channel
  // actually approaches 0dBFS.
  function colorForLevel(frac: number): string {
    let c: readonly [number, number, number];
    if (frac < 0.75) {
      c = GREEN;
    } else if (frac < 0.9) {
      const t = (frac - 0.75) / 0.15;
      c = [lerp(GREEN[0], YELLOW[0], t), lerp(GREEN[1], YELLOW[1], t), lerp(GREEN[2], YELLOW[2], t)];
    } else {
      const t = Math.min(1, (frac - 0.9) / 0.1);
      c = [lerp(YELLOW[0], RED[0], t), lerp(YELLOW[1], RED[1], t), lerp(YELLOW[2], RED[2], t)];
    }
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  }
</script>

<div class="tb-peak" aria-label="Stereo peak meter">
  <div class="tb-peak-bar">
    <div class="tb-peak-fill" style="width: {levelL * 100}%; background: {colorForLevel(levelL)}"></div>
    <div class="tb-peak-hold" style="left: {holdL * 100}%"></div>
  </div>
  <div class="tb-peak-bar">
    <div class="tb-peak-fill" style="width: {levelR * 100}%; background: {colorForLevel(levelR)}"></div>
    <div class="tb-peak-hold" style="left: {holdR * 100}%"></div>
  </div>
</div>

<style>
  .tb-peak {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 0 10px;
    justify-content: center;
    flex-shrink: 0;
  }
  .tb-peak-bar {
    position: relative;
    width: 72px;
    height: 9px;
    background: #1c2a1c;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 2px;
    overflow: hidden;
  }
  .tb-peak-fill {
    height: 100%;
    border-radius: 1px;
    transition: background 0.1s linear;
  }
  .tb-peak-hold {
    position: absolute;
    top: 0;
    width: 2px;
    height: 100%;
    background: rgba(255, 255, 255, 0.75);
    transform: translateX(-1px);
  }
</style>
