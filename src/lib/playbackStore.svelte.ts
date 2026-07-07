import { audioEngine } from './audioEngine';
import { channelStore } from './channelStore.svelte';

// The single, unified playback clock. Owns the live rAF loop + audioEngine
// start/stop orchestration (moved out of ChannelRack.svelte, which used to
// run this itself — meaning playback silently stopped advancing its visual
// position if that window was ever closed). Mirrors historyStore.svelte.ts's
// $effect.root() pattern for a module-singleton's live reactive effect.
class PlaybackStore {
  isPlaying = $state(false);
  tempo = $state(120);
  currentStep = $state(-1);          // floored step, existing consumers (discrete highlights)
  currentStepFraction = $state(0);   // continuous position, for the smooth playhead line
  soloChannelId = $state<number | null>(null); // set by the Piano Roll's own play button
  transportMode = $state<'pattern' | 'song'>('pattern');

  #rafId = 0;
  #stopEffect: (() => void) | null = null;

  #currentChannels() {
    return this.soloChannelId != null
      ? channelStore.channels.filter(c => c.id === this.soloChannelId)
      : channelStore.channels;
  }

  startWatching() {
    if (this.#stopEffect) return;
    this.#stopEffect = $effect.root(() => {
      $effect(() => {
        if (this.isPlaying) {
          audioEngine.stop();
          audioEngine.start(
            () => this.tempo,
            () => this.#currentChannels(),
            () => channelStore.activeLength,
            () => channelStore.barLength,
          );
          this.#startRaf();
        } else {
          audioEngine.stop();
          this.#stopRaf();
          this.currentStep = -1;
          this.currentStepFraction = 0;
        }
      });
    });
  }

  stopWatching() {
    this.#stopEffect?.();
    this.#stopEffect = null;
    this.#stopRaf();
    audioEngine.stop();
  }

  #startRaf() {
    const frame = () => {
      if (!this.isPlaying) return;
      const { step, fraction } = audioEngine.getPosition();
      if (step >= 0) {
        this.currentStep = step;
        this.currentStepFraction = fraction;
      }
      this.#rafId = requestAnimationFrame(frame);
    };
    cancelAnimationFrame(this.#rafId);
    this.#rafId = requestAnimationFrame(frame);
  }

  #stopRaf() {
    cancelAnimationFrame(this.#rafId);
    this.#rafId = 0;
  }

  // Called whenever the active pattern changes (patternStore's
  // selectedPatternId setter) so the clock never keeps counting through a
  // pattern switch — if playing, actually restarts the audible loop at step
  // 0 of the new pattern; if stopped, just snaps the visual marker to idle.
  restartFromZero() {
    if (this.isPlaying) {
      audioEngine.stop();
      audioEngine.start(
        () => this.tempo,
        () => this.#currentChannels(),
        () => channelStore.activeLength,
        () => channelStore.barLength,
      );
    } else {
      this.currentStep = -1;
      this.currentStepFraction = 0;
    }
  }
}

export const playback = new PlaybackStore();
