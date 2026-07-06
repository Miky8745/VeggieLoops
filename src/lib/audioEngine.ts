import { invoke } from '@tauri-apps/api/core';
import type { ChannelData } from '$lib/types';
import { buildMultisample, pickFromFolder, type MultisampleFolder } from '$lib/multisample';

const LOOKAHEAD = 0.1;  // seconds to schedule ahead
const INTERVAL  = 25;   // ms between scheduler ticks
const RAMP      = 0.0005; // 0.5ms de-click ramp — short enough not to affect transients

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterOut: AudioNode | null = null;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private scheduledStep  = 0;
  private nextStepTime   = 0;
  private patternLength  = 16;
  private getBpm:      () => number         = () => 120;
  private getChannels: () => ChannelData[]  = () => [];
  private bufferCache   = new Map<string, AudioBuffer>();
  // Deduplicates concurrent loads: multiple ticks requesting the same
  // uncached path share one IPC call instead of firing N in parallel.
  private loadingPromises = new Map<string, Promise<AudioBuffer | null>>();
  // Same dedup shape as bufferCache/loadingPromises above, but for a folder's
  // file listing (used to build a channel's multisample map the first time
  // it's played from).
  private folderCache   = new Map<string, MultisampleFolder>();
  private folderLoadingPromises = new Map<string, Promise<MultisampleFolder | null>>();

  // Read by the rAF loop in ChannelRack for visual sync
  startAudioTime = 0;
  stepDuration   = 0.5; // always kept current in tick()

  private async ensureCtx(): Promise<AudioContext> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      // Limiter: only acts near 0 dBFS so it prevents clipping without
      // coloring the sound during normal single-channel use.
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -6;
      comp.knee.value      = 0;
      comp.ratio.value     = 20;
      comp.attack.value    = 0.001;
      comp.release.value   = 0.05;
      comp.connect(this.ctx.destination);
      this.masterOut = comp;
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    return this.ctx;
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
  private triggerPitched(ch: ChannelData, targetPitch: number, vol: number, pan: number, playTime: number) {
    if (ch.sampleFolder) {
      const folderPath = ch.sampleFolder;
      this.resolveFolder(folderPath).then(folder => {
        const picked = folder && pickFromFolder(folder, targetPitch);
        if (picked) this.scheduleHit(picked.path, picked.rate, vol, pan, playTime);
      });
    } else if (ch.samplePath) {
      const rate = 2 ** ((targetPitch - 60) / 12);
      this.scheduleHit(ch.samplePath, rate, vol, pan, playTime);
    }
  }

  private scheduleHit(path: string, rate: number, vol: number, pan: number, playTime: number) {
    this.loadSample(path).then(buf => {
      if (!buf || !this.ctx) return;
      // If the load resolved more than 50ms after the beat, skip it —
      // playing a stale beat causes a pile-up of out-of-time hits.
      // Within 50ms, clamp to now so the gain schedule stays valid.
      if (this.ctx.currentTime - playTime > 0.05) return;
      this.playSample(buf, vol, pan, Math.max(playTime, this.ctx.currentTime + RAMP), rate);
    });
  }

  private playSample(buf: AudioBuffer, volume: number, pan: number, time: number, playbackRate = 1) {
    if (!this.ctx || !this.masterOut) return;
    const src  = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = playbackRate;
    const gain = this.ctx.createGain();
    const vol  = Math.max(0, Math.min(1, volume));
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
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = pan * 2 - 1; // 0..1 → -1..1
    src.connect(gain).connect(panner).connect(this.masterOut);
    src.start(time);
  }

  private tick() {
    if (!this.ctx) return;
    const bpm      = this.getBpm();
    this.stepDuration = 60 / bpm / 4; // sixteenth note — 4 steps per beat
    const lookAhead = this.ctx.currentTime + LOOKAHEAD;

    while (this.nextStepTime < lookAhead) {
      const step     = this.scheduledStep % this.patternLength;
      const playTime = this.nextStepTime;

      for (const ch of this.getChannels()) {
        if (ch.muted || (!ch.samplePath && !ch.sampleFolder)) continue;
        const pan = ch.pan;

        // A channel with any piano-roll notes plays purely from note data
        // (pitched, velocity-scaled); otherwise it falls back to the plain
        // boolean step sequencer, unchanged from before notes existed.
        if (ch.notes.length > 0) {
          for (const note of ch.notes) {
            if (note.start !== step) continue;
            this.triggerPitched(ch, note.pitch, ch.volume * note.velocity, pan, playTime);
          }
        } else if (ch.steps[step]) {
          this.triggerPitched(ch, 60, ch.volume, pan, playTime);
        }
      }

      this.scheduledStep++;
      this.nextStepTime += 60 / bpm / 4;
    }

    this.timerId = setTimeout(() => this.tick(), INTERVAL);
  }

  async start(
    getBpm:      () => number,
    getChannels: () => ChannelData[],
    patternLength: number,
  ) {
    const ctx = await this.ensureCtx();
    this.getBpm        = getBpm;
    this.getChannels   = getChannels;
    this.patternLength = patternLength;
    this.scheduledStep = 0;
    this.stepDuration  = 60 / getBpm() / 4;
    this.nextStepTime  = ctx.currentTime + 0.05;
    this.startAudioTime = this.nextStepTime;
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
