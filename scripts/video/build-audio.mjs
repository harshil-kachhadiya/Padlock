/**
 * Builds the promo soundtrack: a synthesized pad, transition whooshes, and the
 * voiceover placed at exact timecodes.
 *
 * Every sound is generated here rather than sourced, so there is no music
 * licence to clear before publishing to YouTube.
 */
import { execFileSync } from "child_process";
import ffmpeg from "ffmpeg-static";
import { mkdirSync } from "fs";

const DURATION = 30;
const SR = 48000;
mkdirSync("video/audio", { recursive: true });

/** A major chord, voiced low so it sits under speech rather than competing. */
const CHORD = [110.0, 164.81, 220.0, 277.18, 329.63];

/** Voiceover placement. Values are start times in seconds. */
const VO = [
  { file: "video/audio/vo1-trim.wav", at: 0.9 },
  { file: "video/audio/vo2-trim.wav", at: 8.5 },
  { file: "video/audio/vo3-trim.wav", at: 14.5 },
  { file: "video/audio/vo4-trim.wav", at: 20.4 },
  // Leads the CTA cut by a beat so the closing line lands inside the video.
  { file: "video/audio/vo5-trim.wav", at: 25.15 },
];

/** Scene transitions get a short filtered-noise sweep. */
const WHOOSH_AT = [4.0, 8.0, 14.0, 20.0, 25.5];

const inputs = [];
const filters = [];
let idx = 0;

/** Everything is forced to stereo/48k before mixing so channel layouts match. */
const STEREO = `aformat=sample_fmts=fltp:sample_rates=${SR}:channel_layouts=stereo`;

// --- pad ---------------------------------------------------------------
const padLabels = [];
for (const freq of CHORD) {
  inputs.push("-f", "lavfi", "-i", `sine=frequency=${freq}:duration=${DURATION}:sample_rate=${SR}`);
  filters.push(`[${idx}:a]${STEREO},volume=0.5[pad${idx}]`);
  padLabels.push(`[pad${idx}]`);
  idx++;
}
filters.push(
  `${padLabels.join("")}amix=inputs=${padLabels.length}:normalize=0[padmix]`,
  // Lowpass rounds off the sine edges; tremolo keeps it from sounding static;
  // aecho adds a little space without needing a reverb impulse.
  `[padmix]lowpass=f=900,tremolo=f=0.25:d=0.35,aecho=0.7:0.6:250:0.28,` +
    `volume=1.0,afade=t=in:st=0:d=2.5,afade=t=out:st=${DURATION - 3}:d=3,${STEREO}[pad]`
);

// --- transition whooshes ----------------------------------------------
const whooshLabels = [];
for (const at of WHOOSH_AT) {
  inputs.push("-f", "lavfi", "-i", `anoisesrc=color=brown:duration=1.1:sample_rate=${SR}`);
  filters.push(
    `[${idx}:a]${STEREO},bandpass=f=760:width_type=o:w=2.4,` +
      `afade=t=in:st=0:d=0.18,afade=t=out:st=0.22:d=0.85,` +
      `volume=0.30,adelay=${Math.round(at * 1000)}|${Math.round(at * 1000)}[wh${idx}]`
  );
  whooshLabels.push(`[wh${idx}]`);
  idx++;
}

// --- voiceover ---------------------------------------------------------
const voLabels = [];
for (const line of VO) {
  inputs.push("-i", line.file);
  filters.push(
    `[${idx}:a]${STEREO},volume=1.0,` +
      `adelay=${Math.round(line.at * 1000)}|${Math.round(line.at * 1000)}[vo${idx}]`
  );
  voLabels.push(`[vo${idx}]`);
  idx++;
}
// asplit because a filter label may only be consumed once, and the narration
// is needed twice: as the sidechain key, and in the final mix.
filters.push(
  `${voLabels.join("")}amix=inputs=${voLabels.length}:normalize=0,${STEREO},asplit=2[vokey][vomain]`
);

// --- final mix ---------------------------------------------------------
// sidechaincompress ducks the pad under the narration so speech stays legible.
filters.push(
  `[pad][vokey]sidechaincompress=threshold=0.03:ratio=4:attack=25:release=450[padducked]`,
  `[padducked]${whooshLabels.join("")}amix=inputs=${1 + whooshLabels.length}:normalize=0[bed]`,
  `[bed][vomain]amix=inputs=2:normalize=0,` +
    // Broadcast-ish level for YouTube, then a hard stop at exactly 30s.
    `loudnorm=I=-15:TP=-1.5:LRA=9,alimiter=limit=0.95,atrim=0:${DURATION},asetpts=N/SR/TB[out]`
);

const args = [
  "-y",
  "-loglevel", "error",
  ...inputs,
  "-filter_complex", filters.join(";"),
  "-map", "[out]",
  "-ac", "2",
  "-ar", String(SR),
  "-c:a", "pcm_s16le",
  "video/audio/soundtrack.wav",
];

execFileSync(ffmpeg, args, { stdio: "inherit" });
console.log("wrote video/audio/soundtrack.wav");
