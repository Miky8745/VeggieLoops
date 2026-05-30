#!/usr/bin/env bash
# Downloads LMMS samples from https://github.com/LMMS/lmms/tree/master/data/samples
# Run from: data/samples/

set -euo pipefail

BASE="https://raw.githubusercontent.com/LMMS/lmms/master/data/samples"
API="https://api.github.com/repos/LMMS/lmms/contents/data/samples"

dl() {
  local url="$1"
  local dest="$2"
  if [[ ! -f "$dest" ]]; then
    echo "Downloading $dest"
    curl -fsSL "$url" -o "$dest"
  fi
}

# basses
for f in bass01 bass_acid01 bass_acid02 bass_hard01 bass_hard02 bass_punch01 \
          horror_bass01 matrix1000_pluck01 rave_bass01 rave_bass02 rave_bass03 \
          rave_bass04 synth_acid01 synth_acid02 techno_synth01; do
  dl "$BASE/basses/$f.ogg" "basses/$f.ogg"
done

# bassloops (filenames have spaces)
declare -a bassloops=(
  "briff01 - 140 BPM"
  "rave_bass01 - 180 BPM"
  "rave_bass02 - 180 BPM"
  "tb303_01 - 123 BPM"
  "techno_bass01 - 140 BPM"
  "techno_bass02 - 140 BPM"
  "techno_synth01 - 140 BPM"
  "techno_synth02 - 140 BPM"
  "techno_synth03 - 130 BPM"
  "techno_synth04 - 140 BPM"
)
for f in "${bassloops[@]}"; do
  enc="${f// /%20}"
  dl "$BASE/bassloops/$enc.ogg" "bassloops/$f.ogg"
done

# beats
declare -a beats=(
  "909beat01 - 122 BPM"
  "break01 - 168 BPM"
  "break02 - 141 BPM"
  "break03 - 168 BPM"
  "electro_beat01 - 120 BPM"
  "electro_beat02 - 119 BPM"
  "house_loop01 - 142 BPM"
  "jungle01 - 168 BPM"
  "rave_hihat01 - 180 BPM"
  "rave_hihat02 - 180 BPM"
  "rave_kick01 - 180 BPM"
  "rave_kick02 - 180 BPM"
  "rave_snare01 - 180 BPM"
)
for f in "${beats[@]}"; do
  enc="${f// /%20}"
  dl "$BASE/beats/$enc.ogg" "beats/$f.ogg"
done

# drums
for f in bassdrum01 bassdrum02 bassdrum03 bassdrum04 bassdrum_acoustic01 bassdrum_acoustic02 \
          clap01 clap02 clap03 clap04 clav01 clav02 crash01 crash02 \
          hihat_closed01 hihat_closed02 hihat_closed03 hihat_closed04 hihat_closed05 \
          hihat_foot_pedal01 hihat_opened01 hihat_opened02 hihat_opened03 \
          kick01 kick02 kick03 kick04 kick_distorted01 kick_hard01 kick_hardcore01 \
          kick_hiphop01 kick_long01 kick_soft01 kick_soft02 \
          nasty_bass01 nasty_rim01 nasty_snare01 \
          ride01 ride02 rim01 \
          shaker01 shaker02 shaker03 sidestick01 \
          snare01 snare02 snare03 snare04 snare05 snare06 snare07 \
          snare_acoustic01 snare_electro01 snare_harsh01 \
          snare_hiphop01 snare_hiphop02 snare_muffled01 snare_muffled02 \
          snare_rim01 snare_short01 \
          tom01 tom02 tom03 tom04 tom05 tom_hi01 tom_low01 tom_mid01 \
          wood01 zap01 zap02 zap03; do
  dl "$BASE/drums/$f.ogg" "drums/$f.ogg"
done

# drumsynth — fetch subdirectory listings at runtime and download
echo "Fetching drumsynth subdirectory listings..."
for subdir in acoustic cr78 cr8000 effects electro farfisa ferraro instrument \
              jorgensohn latin linn magnetboy misc misc_bass misc_claps misc_electro \
              misc_fx misc_hats misc_perc misc_synth r_n_b tr606 tr77 tr808 tr909; do
  mkdir -p "drumsynth/$subdir"
  listing=$(curl -fsSL "$API/drumsynth/$subdir")
  while IFS=$'\t' read -r name dlurl; do
    if [[ -n "$name" && -n "$dlurl" && "$dlurl" != "null" ]]; then
      dl "$dlurl" "drumsynth/$subdir/$name"
    fi
  done < <(echo "$listing" | jq -r '.[] | select(.type == "file") | [.name, .download_url] | @tsv')
done

# effects
for f in chroma_sound_effect01 explode01 filter_sweep01 scratch01 \
          start01 start02 stop01 warp01 warp02 wind_chimes01; do
  dl "$BASE/effects/$f.ogg" "effects/$f.ogg"
done

# instruments
for f in bassslap01 bassslap02 cello01 \
          church_organ01 church_organ02 church_organ03 church_organ04 \
          e_organ01 e_piano_accord01 e_piano_accord02 flute01 harpsichord01 \
          piano01 piano02 \
          steel_guitar01 steel_guitar_heavy_distorted01 \
          steel_guitar_medium_distorted01 steel_guitar_slight_distorted01 \
          trumpet01 violin_double_stop01 violin_fingered01 violin_pizzicato01; do
  dl "$BASE/instruments/$f.ogg" "instruments/$f.ogg"
done

# latin
declare -a latin=(
  "latin_brass01 - 140 BPM"
  "latin_guitar01 - 126 BPM"
  "latin_guitar02 - 140 BPM"
  "latin_guitar03 - 120 BPM"
)
for f in "${latin[@]}"; do
  enc="${f// /%20}"
  dl "$BASE/latin/$enc.ogg" "latin/$f.ogg"
done

# misc
for f in applause01 "bass!" breath01 "buzz!" \
          dong01 dong02 dong03 electric_ping01 \
          hit01 hit02 metalish_dong01 metronome01 metronome02 \
          raving_crowd01 snaph01 undefined01; do
  enc="${f//!/%21}"
  dl "$BASE/misc/$enc.ogg" "misc/$f.ogg"
done

# shapes (.wav and .ogg mix)
for f in additive.wav additive2.wav \
          bunglist.wav bunglist2.wav bunglist3.wav bunglist4.wav bunglist5.wav \
          bunglist6.wav bunglist7.wav bunglist8.wav bunglist9.wav \
          harmonics.wav low_sine.wav micro.wav moog.wav roundbass.wav \
          technobass.wav technosynth1.wav technosynth2.wav technosynth3.wav \
          technosynth4.wav technosynth5.wav technosynth6.wav \
          vowel_a.wav vowel_u.wav; do
  dl "$BASE/shapes/$f" "shapes/$f"
done
for f in roundsaw.ogg "saw+sine.wav" sine_dist.ogg smooth_inv_saw.ogg \
          smooth_inv_saw2.ogg smooth_inv_saw_dist.ogg; do
  enc="${f//+/%2B}"
  dl "$BASE/shapes/$enc" "shapes/$f"
done

# stringsnpads
for f in bell_choir01 bell_choir02 chorus01 chorus02 heaven_strings01 \
          juno_pad01 korg_poly6_drone01 nord_ambient01 orion_string01 \
          rave_choir01 space_strings01 space_strings02 space_strings03 strings01; do
  dl "$BASE/stringsnpads/$f.ogg" "stringsnpads/$f.ogg"
done

# waveforms (.flac)
for f in 10saw 10sine 10sqr 10tri analogsqr fmsaw1 fmsine fmsine2 halfsine impulse \
          lfo_trancegate_quarter lfo_trancegate_sawdecay_quarter \
          lfo_trancegate_sinedecay_quarter lfo_trancegate_triplet_half \
          lfo_trancegate_triplet_half_2 lfo_trancegate_triplet_quarter \
          lfo_trancegate_whole lfo_trancegate_whole_2 \
          modsqr saw1 saw2 sinesaw \
          w2_addsyn w2_angrysaw w2_hexagon w2_invsine w2_invsineabs \
          w2_invsinehalf w2_noisy w2_rad w2_sawsine w2_sharp "w2_w-wave"; do
  dl "$BASE/waveforms/$f.flac" "waveforms/$f.flac"
done

echo "Done."
