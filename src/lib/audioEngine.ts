import { invoke } from '@tauri-apps/api/core';
import type { ChannelData } from '$lib/types';

const LOOKAHEAD = 0.1;  // seconds to schedule ahead
const INTERVAL  = 25;   // ms between scheduler ticks

class AudioEngine {
  private ctx: AudioContext | null = null;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private scheduledStep  = 0;
  private nextStepTime   = 0;
  private patternLength  = 16;
  private getBpm:      () => number         = () => 120;
  private getChannels: () => ChannelData[]  = () => [];
  private bufferCache  = new Map<string, AudioBuffer>();

  // Read by the rAF loop in ChannelRack for visual sync
  startAudioTime = 0;
  stepDuration   = 0.5; // always kept current in tick()

  private async ensureCtx(): Promise<AudioContext> {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    return this.ctx;
  }

  async loadSample(relativePath: string): Promise<AudioBuffer | null> {
    if (this.bufferCache.has(relativePath)) return this.bufferCache.get(relativePath)!;
    try {
      const bytes = await invoke<number[]>('read_audio_bytes', { relativePath });
      const ctx   = await this.ensureCtx();
      const buf   = await ctx.decodeAudioData(new Uint8Array(bytes).buffer);
      this.bufferCache.set(relativePath, buf);
      return buf;
    } catch {
      return null;
    }
  }

  private playSample(buf: AudioBuffer, volume: number, pan: number, time: number) {
    if (!this.ctx) return;
    const src    = this.ctx.createBufferSource();
    src.buffer   = buf;
    const gain   = this.ctx.createGain();
    const vol    = Math.max(0, Math.min(1, volume));
    const RAMP   = 0.003; // 3ms anti-click ramp
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(vol, time + RAMP);
    // Fade out the last 3ms so a cut-off sample doesn't click either
    const end = time + buf.duration;
    gain.gain.setValueAtTime(vol, Math.max(time + RAMP, end - RAMP));
    gain.gain.linearRampToValueAtTime(0, end);
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = pan * 2 - 1; // 0..1 → -1..1
    src.connect(gain).connect(panner).connect(this.ctx.destination);
    src.start(time);
  }

  private tick() {
    if (!this.ctx) return;
    const bpm      = this.getBpm();
    this.stepDuration = 60 / bpm / 4; // 16th note = 1/4 of a quarter note
    const lookAhead = this.ctx.currentTime + LOOKAHEAD;

    while (this.nextStepTime < lookAhead) {
      const step     = this.scheduledStep % this.patternLength;
      const playTime = this.nextStepTime;

      for (const ch of this.getChannels()) {
        if (!ch.muted && ch.samplePath && ch.steps[step]) {
          const path = ch.samplePath;
          const vol  = ch.volume;
          const pan  = ch.pan;
          this.loadSample(path).then(buf => {
            if (buf) this.playSample(buf, vol, pan, playTime);
          });
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
