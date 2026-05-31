class PlaybackStore {
  isPlaying = $state(false);
  tempo     = $state(120);
  currentStep = $state(-1);
}

export const playback = new PlaybackStore();
