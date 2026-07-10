import { invoke } from '@tauri-apps/api/core';
import type { ChannelData } from '$lib/types';
import { buildMultisample, pickFromFolder, type MultisampleFolder } from '$lib/multisample';
import { channelLoopLength } from '$lib/channelLoop';

const LOOKAHEAD = 0.1;  // seconds to schedule ahead
const INTERVAL  = 25;   // ms between scheduler ticks
const RAMP      = 0.0005; // 0.5ms de-click ramp — short enough not to affect transients
// How late loadSample() is allowed to resolve past a hit's intended playTime
// before scheduleHit() drops it — guards the scheduler against an audible
// pile-up of stale beats. Widened from an earlier 50ms: a cold IPC read +
// decodeAudioData() routinely exceeds that on the very first trigger of a
// given sample, which silently dropped the hit entirely instead of playing
// it. previewNote() bypasses this cutoff altogether (see allowLate below)
// since a one-shot audition has no pile-up concern.
const STALE_CUTOFF_SEC = 0.15;

// Fixed ADSR envelope applied to piano-roll notes (not plain step-sequencer
// one-shots) so a note actually stops when its length says it should,
// instead of ringing out to the sample's full recorded duration.
const ATTACK  = 0.001;     // samples already carry their own natural attack
const DECAY   = 0.05;  // 50ms
const SUSTAIN = 0.7;   // sustain level, fraction of peak volume
const RELEASE = 0.05;  // 50ms

// One-off audition sound for the Piano Roll (click/place/move a note) —
// short so rapid pitch-row sweeps during a drag don't pile up into mud.
const PREVIEW_DURATION = 0.15;
const PREVIEW_VELOCITY = 0.8; // matches NoteGrid's createNote() default note velocity

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterOut: AudioNode | null = null;
  // Tap off the master bus for visualization (Toolbar's blackbox monitor +
  // stereo peak meter). Pure analysis nodes — never connected onward to
  // destination themselves, so adding/removing them can't affect audible
  // output. `analyser` sees the full mixed signal (used for the
  // oscilloscope/spectrum); `analyserL`/`analyserR` sit behind a splitter for
  // the two independent peak-meter bars.
  private analyser: AnalyserNode | null = null;
  private analyserL: AnalyserNode | null = null;
  private analyserR: AnalyserNode | null = null;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private scheduledStep  = 0;
  private nextStepTime   = 0;
  private getBpm:          () => number         = () => 120;
  private getChannels:     () => ChannelData[]  = () => [];
  private getBarLength:    () => number         = () => 16;
  private getActiveLength: () => number         = () => 16;
  private bufferCache   = new Map<string, AudioBuffer>();
  // Deduplicates concurrent loads: multiple ticks requesting the same
  // uncached path share one IPC call instead of firing N in parallel.
  private loadingPromises = new Map<string, Promise<AudioBuffer | null>>();
  // Same dedup shape as bufferCache/loadingPromises above, but for a folder's
  // file listing (used to build a channel's multisample map the first time
  // it's played from).
  private folderCache   = new Map<string, MultisampleFolder>();
  private folderLoadingPromises = new Map<string, Promise<MultisampleFolder | null>>();

  stepDuration   = 0.5; // always kept current in tick()
  // Audio-context time the current loop cycle began. Advanced forward by
  // exactly one cycle each time real time crosses one (see getPosition())
  // rather than staying fixed at playback start, so a growing activeLength
  // (e.g. auto-extending the pattern while drawing notes) can't retroactively
  // change where "elapsed time so far" lands under a new, larger divisor.
  private loopAnchorTime = 0;

  private buildCtx(): AudioContext {
    const ctx = new AudioContext();
    // Limiter: only acts near 0 dBFS so it prevents clipping without
    // coloring the sound during normal single-channel use.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -6;
    comp.knee.value      = 0;
    comp.ratio.value     = 20;
    comp.attack.value    = 0.001;
    comp.release.value   = 0.05;
    comp.connect(ctx.destination);
    this.masterOut = comp;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.75;
    comp.connect(analyser);
    this.analyser = analyser;

    const splitter = ctx.createChannelSplitter(2);
    comp.connect(splitter);
    const analyserL = ctx.createAnalyser();
    const analyserR = ctx.createAnalyser();
    analyserL.fftSize = 1024;
    analyserR.fftSize = 1024;
    splitter.connect(analyserL, 0);
    splitter.connect(analyserR, 1);
    this.analyserL = analyserL;
    this.analyserR = analyserR;

    return ctx;
  }

  // Full mixed-down master signal, for the Toolbar blackbox's oscilloscope
  // (getByteTimeDomainData) / spectrum (getByteFrequencyData) modes. Null
  // until the AudioContext has been built (warmUp()/ensureCtx()).
  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  // Independent left/right taps for the Toolbar's stereo peak meter. Null
  // until the AudioContext has been built.
  getStereoAnalysers(): { left: AnalyserNode; right: AnalyserNode } | null {
    if (!this.analyserL || !this.analyserR) return null;
    return { left: this.analyserL, right: this.analyserR };
  }

  // Eagerly constructs the AudioContext without resuming it, so the actual
  // first user-gesture-triggered sound doesn't pay context-construction
  // latency on top of its own sample load — safe to call anytime since
  // construction (unlike resume()) never requires a user gesture.
  warmUp(): void {
    if (!this.ctx) this.ctx = this.buildCtx();
  }

  private async ensureCtx(): Promise<AudioContext> {
    if (!this.ctx) this.ctx = this.buildCtx();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    return this.ctx;
  }

  // Fire-and-forget warm-up of a channel's sample(s) into the cache ahead of
  // playback — piggybacks entirely on loadSample()/resolveFolder()'s own
  // dedup Maps, so this never duplicates an IPC/decode already in flight or
  // already cached, whether triggered by preload, real playback, or both.
  preloadChannel(ch: ChannelData): void {
    if (ch.samplePath) this.loadSample(ch.samplePath);
    if (ch.sampleFolder) {
      const folderPath = ch.sampleFolder;
      this.resolveFolder(folderPath).then(folder => {
        if (!folder) return;
        // Mirrors pickFromFolder()'s own selection rule: once any pitched
        // entries exist, only those are ever chosen; allPaths is only used
        // as the random fallback when pitched is empty.
        const paths = folder.pitched.length > 0 ? folder.pitched.map(e => e.path) : folder.allPaths;
        for (const p of paths) this.loadSample(p);
      });
    }
  }

  preloadChannels(channels: ChannelData[]): void {
    for (const ch of channels) this.preloadChannel(ch);
  }

  async loadSample(relativePath: string): Promise<AudioBuffer | null> {
    if (this.bufferCache.has(relativePath)) return this.bufferCache.get(relativePath)!;
    if (this.loadingPromises.has(relativePath)) return this.loadingPromises.get(relativePath)!;
    const p = (async () => {
      try {
        const bytes = await invoke<number[]>('read_audio_bytes', { relativePath });
        const ctx   = await this.ensureCtx();
        const buf   = await ctx.decodeAudioData(new Uint8Array(bytes).buffer);
        this.bufferCache.set(relativePath, buf);
        return buf;
      } catch {
        return null;
      } finally {
        this.loadingPromises.delete(relativePath);
      }
    })();
    this.loadingPromises.set(relativePath, p);
    return p;
  }

  // One-off audition of a channel's sound at `pitch`, independent of the
  // scheduler/transport — used by the Piano Roll to preview a note on
  // click/place/move. Safe to call at any time; lazily creates the
  // AudioContext exactly like loadSample() does.
  async previewNote(ch: ChannelData, pitch: number): Promise<void> {
    const ctx = await this.ensureCtx();
    const playTime = ctx.currentTime + RAMP;
    this.triggerPitched(ch, pitch, ch.volume * PREVIEW_VELOCITY, ch.pan, playTime, PREVIEW_DURATION, true);
  }

  private async resolveFolder(folderPath: string): Promise<MultisampleFolder | null> {
    if (this.folderCache.has(folderPath)) return this.folderCache.get(folderPath)!;
    if (this.folderLoadingPromises.has(folderPath)) return this.folderLoadingPromises.get(folderPath)!;
    const p = (async () => {
      try {
        const names = await invoke<string[]>('list_dir_files', { relativePath: folderPath });
        const resolved = buildMultisample(names, folderPath);
        this.folderCache.set(folderPath, resolved);
        return resolved;
      } catch {
        return null;
      } finally {
        this.folderLoadingPromises.delete(folderPath);
      }
    })();
    this.folderLoadingPromises.set(folderPath, p);
    return p;
  }

  // Schedules one hit for a channel at targetPitch (a note's own pitch, or
  // 60 for a plain step-sequencer trigger) — resolves either a single sample
  // (rate relative to middle C, as always) or a multisample folder (rate
  // relative to whichever recorded sample is nearest targetPitch).
  private triggerPitched(ch: ChannelData, targetPitch: number, vol: number, pan: number, playTime: number, durationSeconds?: number, allowLate = false) {
    if (ch.sampleFolder) {
      const folderPath = ch.sampleFolder;
      this.resolveFolder(folderPath).then(folder => {
        const picked = folder && pickFromFolder(folder, targetPitch);
        if (picked) this.scheduleHit(picked.path, picked.rate, vol, pan, playTime, durationSeconds, allowLate);
      });
    } else if (ch.samplePath) {
      const rate = 2 ** ((targetPitch - 60) / 12);
      this.scheduleHit(ch.samplePath, rate, vol, pan, playTime, durationSeconds, allowLate);
    }
  }

  private scheduleHit(path: string, rate: number, vol: number, pan: number, playTime: number, durationSeconds?: number, allowLate = false) {
    this.loadSample(path).then(buf => {
      if (!buf || !this.ctx) return;
      // If the load resolved more than STALE_CUTOFF_SEC after the beat, skip
      // it — playing a stale beat causes a pile-up of out-of-time hits.
      // allowLate (previewNote's one-shot auditions) bypasses this entirely.
      // Within the cutoff, clamp to now so the gain schedule stays valid.
      if (!allowLate && this.ctx.currentTime - playTime > STALE_CUTOFF_SEC) return;
      this.playSample(buf, vol, pan, Math.max(playTime, this.ctx.currentTime + RAMP), rate, durationSeconds);
    });
  }

  private playSample(buf: AudioBuffer, volume: number, pan: number, time: number, playbackRate = 1, durationSeconds?: number) {
    if (!this.ctx || !this.masterOut) return;
    const src  = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = playbackRate;
    const gain = this.ctx.createGain();
    // Channel volume now goes up to 200% (see ChannelRow's Volume dial) —
    // clamped to 2 rather than 1, with the master compressor guarding
    // against clipping when a boosted channel is at or near full velocity.
    const vol  = Math.max(0, Math.min(2, volume));
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = pan * 2 - 1; // 0..1 → -1..1
    src.connect(gain).connect(panner).connect(this.masterOut);

    if (durationSeconds !== undefined) {
      // Piano-roll note: envelope + explicit stop scaled to the note's own
      // length, so it actually ends when the piano roll says it should
      // instead of ringing out to the sample's full recorded duration.
      const attack  = Math.min(ATTACK, durationSeconds * 0.3);
      const decay   = Math.min(DECAY, Math.max(0, durationSeconds * 0.3 - attack));
      const release = Math.min(RELEASE, durationSeconds * 0.3);
      const sustainLevel = vol * SUSTAIN;
      const decayEnd     = time + attack + decay;
      const releaseStart = Math.max(decayEnd, time + durationSeconds - release);

      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(vol, time + attack);
      gain.gain.linearRampToValueAtTime(sustainLevel, decayEnd);
      gain.gain.setValueAtTime(sustainLevel, releaseStart);
      gain.gain.linearRampToValueAtTime(0, releaseStart + release);

      src.start(time);
      src.stop(releaseStart + release);
    } else {
      // Plain step-sequencer one-shot: ring out to the sample's own end,
      // unchanged from before notes existed.
      // Start at full volume immediately — the 0.5ms micro-ramp only guards
      // against DC-offset pops and is inaudible on transient material.
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(vol, time + RAMP);
      // Fade out the last 0.5ms to prevent an end-of-buffer click. Playback
      // rate stretches/compresses the buffer's audible duration, so the end
      // time must scale with it too.
      const end = time + buf.duration / playbackRate;
      gain.gain.setValueAtTime(vol, Math.max(time + RAMP, end - RAMP));
      gain.gain.linearRampToValueAtTime(0, end);
      src.start(time);
    }
  }

  private tick() {
    if (!this.ctx) return;
    const bpm      = this.getBpm();
    this.stepDuration = 60 / bpm / 4; // sixteenth note — 4 steps per beat
    const barLength = this.getBarLength();
    const activeLength = this.getActiveLength(); // computed once per tick, reused for every channel
    const lookAhead = this.ctx.currentTime + LOOKAHEAD;

    while (this.nextStepTime < lookAhead) {
      const step     = this.scheduledStep;
      const playTime = this.nextStepTime;

      for (const ch of this.getChannels()) {
        if (ch.muted || (!ch.samplePath && !ch.sampleFolder)) continue;
        const pan = ch.pan;

        // Each channel loops on its own content length (see
        // channelLoop.ts) rather than all sharing the overall active
        // length — a channel with 16 beats of content inside a 32-beat
        // active region plays twice instead of once-then-silence.
        const loopLength = channelLoopLength(ch, activeLength, barLength);
        const chStep = step % loopLength;

        // A channel with any piano-roll notes plays purely from note data
        // (pitched, velocity-scaled); otherwise it falls back to the plain
        // boolean step sequencer, unchanged from before notes existed.
        if (ch.notes.length > 0) {
          for (const note of ch.notes) {
            // note.start can be fractional (Shift-free-moved/resized in the
            // Piano Roll) — match on its containing whole step, then offset
            // playTime by the sub-step remainder so the fractional position
            // is still audible at the right moment instead of never matching.
            if (Math.floor(note.start) !== chStep) continue;
            const subStepOffset = (note.start - Math.floor(note.start)) * this.stepDuration;
            const durationSeconds = note.length * this.stepDuration;
            this.triggerPitched(ch, note.pitch, ch.volume * note.velocity, pan, playTime + subStepOffset, durationSeconds);
          }
        } else if (ch.steps[chStep]) {
          this.triggerPitched(ch, 60, ch.volume, pan, playTime);
        }
      }

      // Wrapped immediately rather than left to grow unbounded, so
      // scheduledStep always stays inside [0, activeLength) — the same
      // reasoning as loopAnchorTime above.
      this.scheduledStep = (this.scheduledStep + 1) % activeLength;
      this.nextStepTime += 60 / bpm / 4;
    }

    this.timerId = setTimeout(() => this.tick(), INTERVAL);
  }

  // Where playback is right now, for the rAF loop driving the visual
  // playhead. Mirrors tick()'s scheduling math but derived from real
  // elapsed time (what's audibly playing) rather than the lookahead-scheduled
  // step. Advances loopAnchorTime forward a full cycle at a time instead of
  // computing (elapsed % activeLength) directly off an ever-growing elapsed
  // value, which would jump whenever activeLength changes mid-loop.
  getPosition(): { step: number; fraction: number } {
    if (!this.ctx) return { step: -1, fraction: 0 };
    let elapsed = this.ctx.currentTime - this.loopAnchorTime;
    if (elapsed < 0) return { step: -1, fraction: 0 };
    let activeLength = this.getActiveLength();
    while (elapsed >= activeLength * this.stepDuration) {
      this.loopAnchorTime += activeLength * this.stepDuration;
      elapsed = this.ctx.currentTime - this.loopAnchorTime;
      activeLength = this.getActiveLength();
    }
    const raw = elapsed / this.stepDuration;
    return { step: Math.floor(raw), fraction: raw };
  }

  async start(
    getBpm:      () => number,
    getChannels: () => ChannelData[],
    getActiveLength: () => number,
    getBarLength: () => number = () => 16,
  ) {
    const ctx = await this.ensureCtx();
    this.getBpm          = getBpm;
    this.getChannels     = getChannels;
    this.getBarLength    = getBarLength;
    this.getActiveLength = getActiveLength;
    this.scheduledStep   = 0;
    this.stepDuration  = 60 / getBpm() / 4;
    this.nextStepTime  = ctx.currentTime + 0.05;
    this.loopAnchorTime = this.nextStepTime;
    this.tick();
  }

  stop() {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  get currentTime() {
    return this.ctx?.currentTime ?? 0;
  }
}

export const audioEngine = new AudioEngine();
