<script lang="ts">
  // Toolbar's audio monitor ("blackbox"). Click toggles between an
  // oscilloscope (raw waveform) and a spectrum analyzer (FFT magnitude per
  // frequency bucket), both read from audioEngine's master-bus analyser —
  // see "Monitor blackbox" in CLAUDE.md.
  import { audioEngine } from '$lib/audioEngine';
  import { playback } from '$lib/playbackStore.svelte';

  const WIDTH  = 100;
  const HEIGHT = 38;
  const WAVE_COLOR = '#9fdaaf';
  const BAR_COUNT  = 20;

  // Autoscale tuning, shared shape for both modes: fast attack (a louder
  // frame immediately claims the new ceiling) + slow per-frame decay (the
  // ceiling drifts back down over roughly a second rather than flickering
  // frame to frame), each with a floor so near-silence settles to a flat
  // line / empty bars instead of amplifying noise into full-scale jitter.
  const WAVE_RELEASE    = 0.965;
  const WAVE_GAIN_FLOOR = 0.04; // min amplitude (0..1) treated as "full scale"
  const FREQ_RELEASE    = 0.965;
  const FREQ_GAIN_FLOOR = 24;   // min byte magnitude (0..255) treated as "full scale"

  let mode = $state<'wave' | 'spectrum'>('wave');
  let canvasEl: HTMLCanvasElement;
  let rafId = 0;
  let waveData: Uint8Array | null = null;
  let freqData: Uint8Array | null = null;
  let waveGain = WAVE_GAIN_FLOOR;
  let freqGain = FREQ_GAIN_FLOOR;

  function drawIdle(g: CanvasRenderingContext2D) {
    g.clearRect(0, 0, WIDTH, HEIGHT);
    g.strokeStyle = WAVE_COLOR;
    g.globalAlpha = 0.35;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, HEIGHT / 2);
    g.lineTo(WIDTH, HEIGHT / 2);
    g.stroke();
    g.globalAlpha = 1;
  }

  function drawWave(g: CanvasRenderingContext2D, analyser: AnalyserNode) {
    if (!waveData || waveData.length !== analyser.fftSize) waveData = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(waveData);

    // Autoscale: find this frame's own peak deviation first, fold it into
    // the running gain ceiling (fast attack), then draw scaled by that
    // ceiling — so the loudest sample this frame always lands exactly at
    // the edge, never clipped off-canvas, while quiet passages get scaled
    // up to stay visible.
    let maxDev = 0;
    for (let i = 0; i < waveData.length; i++) {
      const dev = Math.abs(waveData[i] - 128);
      if (dev > maxDev) maxDev = dev;
    }
    const frameGain = maxDev / 128;
    waveGain = frameGain > waveGain ? frameGain : waveGain * WAVE_RELEASE;
    const scale = 1 / Math.max(WAVE_GAIN_FLOOR, waveGain);

    g.clearRect(0, 0, WIDTH, HEIGHT);
    g.strokeStyle = WAVE_COLOR;
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 0; i < waveData.length; i++) {
      const x = (i / (waveData.length - 1)) * WIDTH;
      const dev = (waveData[i] - 128) / 128;
      const y = HEIGHT / 2 - dev * scale * (HEIGHT / 2);
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }

  // Exponential bucket edges so low frequencies (where most musical energy
  // sits) get more than the first pixel or two of a linear bin->pixel map.
  function binEdge(bar: number, bins: number): number {
    return Math.min(bins - 1, Math.max(1, Math.round(bins ** (bar / BAR_COUNT))));
  }

  function drawSpectrum(g: CanvasRenderingContext2D, analyser: AnalyserNode) {
    const bins = analyser.frequencyBinCount;
    if (!freqData || freqData.length !== bins) freqData = new Uint8Array(bins);
    analyser.getByteFrequencyData(freqData);

    // Same autoscale shape as drawWave: this frame's own peak bin claims the
    // gain ceiling first (fast attack), then every bar is drawn relative to
    // that ceiling so a quiet passage still uses the full height.
    let maxVal = 0;
    for (let i = 0; i < bins; i++) if (freqData[i] > maxVal) maxVal = freqData[i];
    freqGain = maxVal > freqGain ? maxVal : freqGain * FREQ_RELEASE;
    const gain = Math.max(FREQ_GAIN_FLOOR, freqGain);

    g.clearRect(0, 0, WIDTH, HEIGHT);
    g.fillStyle = WAVE_COLOR;
    const barW = WIDTH / BAR_COUNT;
    for (let i = 0; i < BAR_COUNT; i++) {
      const lo = binEdge(i, bins);
      const hi = Math.max(lo + 1, binEdge(i + 1, bins));
      let peak = 0;
      for (let b = lo; b < hi && b < bins; b++) peak = Math.max(peak, freqData[b]);
      const h = Math.min(1, peak / gain) * HEIGHT;
      g.fillRect(i * barW + 0.5, HEIGHT - h, barW - 1, h);
    }
  }

  function frame() {
    const g = canvasEl?.getContext('2d');
    const analyser = audioEngine.getAnalyser();
    if (!g) return;
    if (!playback.isPlaying || !analyser) {
      drawIdle(g);
      rafId = 0;
      return;
    }
    if (mode === 'wave') drawWave(g, analyser); else drawSpectrum(g, analyser);
    rafId = requestAnimationFrame(frame);
  }

  // Mirrors playbackStore's own rAF convention (see #startRaf there): the
  // loop only runs while transport is playing, so the monitor sits idle
  // (flat line) the rest of the time instead of burning a frame budget on a
  // silent signal.
  $effect(() => {
    if (playback.isPlaying) {
      if (!rafId) rafId = requestAnimationFrame(frame);
    } else {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      waveGain = WAVE_GAIN_FLOOR;
      freqGain = FREQ_GAIN_FLOOR;
      const g = canvasEl?.getContext('2d');
      if (g) drawIdle(g);
    }
    return () => { if (rafId) cancelAnimationFrame(rafId); };
  });
</script>

<button
  class="blackbox"
  onclick={() => mode = mode === 'wave' ? 'spectrum' : 'wave'}
  title={mode === 'wave' ? 'Oscilloscope — click for spectrum analyzer' : 'Spectrum analyzer — click for oscilloscope'}
  aria-label="Audio monitor"
>
  <canvas bind:this={canvasEl} width={WIDTH} height={HEIGHT}></canvas>
</button>

<style>
  .blackbox {
    width: 100px;
    height: 38px;
    background: #0f0f0f;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 3px;
    margin: 0 6px;
    padding: 0;
    flex-shrink: 0;
    cursor: pointer;
    display: block;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
