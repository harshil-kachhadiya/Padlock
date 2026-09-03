/**
 * Encodes the rendered frames plus the soundtrack into an upload-ready MP4.
 *
 * Targets YouTube's recommended 1080p specs: H.264 high profile, yuv420p,
 * closed GOP at 2x framerate, AAC-LC 320k, and faststart so the moov atom sits
 * at the front of the file.
 */
import { execFileSync } from "child_process";
import ffmpeg from "ffmpeg-static";
import { statSync } from "fs";

const FPS = 30;
const OUT = "video/padlock-promo-30s.mp4";

const args = [
  "-y",
  "-loglevel", "error",
  "-stats",
  "-framerate", String(FPS),
  "-i", "video/frames/f%04d.png",
  "-i", "video/audio/soundtrack.wav",
  "-c:v", "libx264",
  "-preset", "slow",
  "-crf", "18",
  "-profile:v", "high",
  "-level", "4.1",
  "-pix_fmt", "yuv420p",
  "-g", String(FPS * 2),
  "-keyint_min", String(FPS),
  "-sc_threshold", "0",
  "-c:a", "aac",
  "-b:a", "320k",
  "-ar", "48000",
  "-ac", "2",
  // Video and audio differ by ~0.1s; end on whichever finishes first.
  "-shortest",
  "-movflags", "+faststart",
  OUT,
];

execFileSync(ffmpeg, args, { stdio: "inherit" });
console.log(`\nwrote ${OUT} — ${(statSync(OUT).size / 1024 / 1024).toFixed(2)} MB`);
