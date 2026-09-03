/**
 * Renders the promo video frame by frame at 1920x1080 / 30fps.
 *
 * Everything is drawn from the same design tokens as the store images, and the
 * product shots are the real popup captures — no invented UI. Scene copy is
 * kept beside the device frame, never composited into it.
 */
import sharp from "sharp";
import { mkdirSync, existsSync, rmSync } from "fs";

const W = 1920;
const H = 1080;
const FPS = 30;
const DURATION = 30; // seconds
const TOTAL = FPS * DURATION;

const NAVY = "#0f2d52";
const NAVY_DEEP = "#071831";
const GOLD = "#ffbe2e";
const PAPER = "#f5f7fb";
const MUTED = "#aebbcd";
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Segoe UI', Arial, Helvetica, sans-serif";

const OUT = "video/frames";
if (existsSync(OUT)) rmSync(OUT, { recursive: true });
mkdirSync(OUT, { recursive: true });

/* ---------------------------- easing ---------------------------- */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
const easeInOut = (t) => (clamp(t) < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** Progress of `t` within [start,end], eased. */
const seg = (t, start, end, ease = easeOut) =>
  ease(clamp((t - start) / (end - start)));

/* ---------------------------- storyboard ---------------------------- */
/**
 * 0.0 - 4.0   logo builds
 * 4.0 - 8.0   thesis line
 * 8.0 - 14.0  scene: vault / autofill
 * 14.0 - 20.0 scene: generator
 * 20.0 - 25.5 scene: zero-knowledge
 * 25.5 - 30.0 call to action
 */
const SCENES = [
  {
    at: 8,
    until: 14,
    shot: "video/src/vault.png",
    kicker: "ONE CLICK TO FILL",
    head: "Your logins, right where you need them",
    bullets: ["Matched to the site you're on", "Autofill, copy, edit, delete", "Right-click to fill anywhere"],
  },
  {
    at: 14,
    until: 20,
    shot: "video/src/generator.png",
    kicker: "BUILT-IN GENERATOR",
    head: "Strong passwords, generated on the spot",
    bullets: ["8 to 32 characters", "Live strength feedback", "Never reuse a password again"],
  },
  {
    at: 20,
    until: 25.5,
    shot: "video/src/unlock.png",
    kicker: "ZERO-KNOWLEDGE",
    head: "Your master password never leaves your device",
    bullets: ["AES-256-GCM encryption", "PBKDF2, 250,000 iterations", "We only ever store ciphertext"],
  },
];

function lock(color = GOLD, keyhole = NAVY_DEEP) {
  return `
    <path d="M184 232 V182 a72 72 0 0 1 144 0 V232"
          fill="none" stroke="${color}" stroke-width="34" stroke-linecap="round"/>
    <rect x="150" y="224" width="212" height="166" rx="30" fill="${color}"/>
    <circle cx="256" cy="284" r="24" fill="${keyhole}"/>
    <rect x="244" y="300" width="24" height="54" rx="8" fill="${keyhole}"/>`;
}

function wrap(text, maxChars) {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && `${line} ${word}`.length > maxChars) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

/** Shared background with a slow parallax drift so frames are never static. */
function background(t) {
  const drift = Math.sin(t * 0.16) * 60;
  const glowY = H / 2 + Math.cos(t * 0.2) * 40;
  return `
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="${W}" y2="${H}" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="${NAVY}"/>
        <stop offset="1" stop-color="${NAVY_DEEP}"/>
      </linearGradient>
      <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#2f63a0" stop-opacity="0.5"/>
        <stop offset="1" stop-color="#2f63a0" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <ellipse cx="${1250 + drift}" cy="${glowY}" rx="620" ry="540" fill="url(#glow)"/>`;
}

const goldBar = `<rect x="0" y="${H - 8}" width="${W}" height="8" fill="${GOLD}"/>`;

/* ---------------------------- scene painters ---------------------------- */

function paintLogo(t) {
  // 0-4s: glyph scales in, wordmark and tagline follow, whole lockup drifts up.
  const inP = seg(t, 0.2, 1.6);
  const wordP = seg(t, 1.0, 2.2);
  const tagP = seg(t, 1.8, 3.0);
  const outP = seg(t, 3.4, 4.0, easeInOut);

  const scale = 0.55 + inP * 0.45;
  const lift = -outP * 70;
  const alpha = 1 - outP;

  return `
    <g opacity="${alpha.toFixed(3)}" transform="translate(0, ${lift.toFixed(1)})">
      <g transform="translate(${W / 2}, 400) scale(${(0.62 * scale).toFixed(4)}) translate(-256, -256)"
         opacity="${inP.toFixed(3)}">${lock()}</g>
      <text x="${W / 2}" y="700" font-family="${SERIF}" font-size="118" font-weight="700"
            fill="${PAPER}" text-anchor="middle" opacity="${wordP.toFixed(3)}">Padlock</text>
      <text x="${W / 2}" y="762" font-family="${SANS}" font-size="30" font-weight="700"
            fill="${GOLD}" text-anchor="middle" letter-spacing="5"
            opacity="${tagP.toFixed(3)}">ZERO-KNOWLEDGE PASSWORD MANAGER</text>
    </g>`;
}

function paintThesis(t) {
  // 4-8s: the core promise, revealed line by line.
  const l1 = seg(t, 4.1, 5.1);
  const l2 = seg(t, 4.7, 5.7);
  const subP = seg(t, 5.6, 6.6);
  const outP = seg(t, 7.4, 8.0, easeInOut);
  const alpha = 1 - outP;
  const lift = -outP * 60;

  return `
    <g opacity="${alpha.toFixed(3)}" transform="translate(0, ${lift.toFixed(1)})">
      <text x="${W / 2}" y="470" font-family="${SERIF}" font-size="86" font-weight="700"
            fill="${PAPER}" text-anchor="middle" opacity="${l1.toFixed(3)}">A password manager</text>
      <text x="${W / 2}" y="580" font-family="${SERIF}" font-size="86" font-weight="700"
            fill="${PAPER}" text-anchor="middle" opacity="${l2.toFixed(3)}">that cannot read your passwords.</text>
      <text x="${W / 2}" y="668" font-family="${SANS}" font-size="32"
            fill="${MUTED}" text-anchor="middle" opacity="${subP.toFixed(3)}">Everything is encrypted in your browser before it is sent anywhere.</text>
    </g>`;
}

function paintScene(scene, t) {
  const local = t - scene.at;
  const span = scene.until - scene.at;
  const inP = seg(t, scene.at + 0.1, scene.at + 1.0);
  const outP = seg(t, scene.until - 0.55, scene.until, easeInOut);
  const alpha = Math.min(inP, 1 - outP);

  // Copy slides in from the left; the device frame rises from the right.
  const copyX = -80 * (1 - inP) + -50 * outP;
  const frameY = 60 * (1 - inP) + -40 * outP;
  // Slow push-in keeps the shot alive across the scene.
  const zoom = 1 + (local / span) * 0.035;

  const kick = seg(t, scene.at + 0.15, scene.at + 0.8);
  const headLines = wrap(scene.head, 22);
  const head = headLines
    .map(
      (line, i) =>
        `<text x="${140 + copyX}" y="${404 + i * 78}" font-family="${SERIF}" font-size="66"
               font-weight="700" fill="${PAPER}"
               opacity="${seg(t, scene.at + 0.3 + i * 0.12, scene.at + 1.1 + i * 0.12).toFixed(3)}">${line}</text>`
    )
    .join("");

  const bullets = scene.bullets
    .map((b, i) => {
      const p = seg(t, scene.at + 0.9 + i * 0.22, scene.at + 1.7 + i * 0.22);
      return `
      <g opacity="${p.toFixed(3)}" transform="translate(${140 + copyX + (1 - p) * 24}, ${404 + headLines.length * 78 + 54 + i * 62})">
        <circle cx="10" cy="-8" r="6" fill="${GOLD}"/>
        <text x="36" y="0" font-family="${SANS}" font-size="32" fill="${PAPER}" opacity="0.92">${b}</text>
      </g>`;
    })
    .join("");

  return {
    svg: `
    <g opacity="${alpha.toFixed(3)}">
      <text x="${140 + copyX}" y="316" font-family="${SANS}" font-size="24" font-weight="700"
            fill="${GOLD}" letter-spacing="4.5" opacity="${kick.toFixed(3)}">${scene.kicker}</text>
      ${head}
      ${bullets}
    </g>`,
    frameY,
    zoom,
    alpha,
  };
}

function paintCta(t) {
  const inP = seg(t, 25.7, 26.7);
  const btnP = seg(t, 26.4, 27.4);
  const urlP = seg(t, 27.0, 28.0);
  // Gentle breathing on the button so the final hold isn't frozen.
  const pulse = 1 + Math.sin((t - 26.4) * 2.4) * 0.012 * btnP;

  return `
    <g opacity="${inP.toFixed(3)}">
      <g transform="translate(${W / 2}, 330) scale(0.30) translate(-256, -256)">${lock()}</g>
      <text x="${W / 2}" y="560" font-family="${SERIF}" font-size="96" font-weight="700"
            fill="${PAPER}" text-anchor="middle">Padlock</text>
      <text x="${W / 2}" y="628" font-family="${SANS}" font-size="32"
            fill="${MUTED}" text-anchor="middle">Free. No ads. No tracking.</text>

      <g opacity="${btnP.toFixed(3)}" transform="translate(${W / 2}, 740) scale(${pulse.toFixed(4)})">
        <rect x="-250" y="-46" width="500" height="92" rx="8" fill="${GOLD}"/>
        <text x="0" y="14" font-family="${SANS}" font-size="36" font-weight="700"
              fill="${NAVY_DEEP}" text-anchor="middle">Add to Chrome — free</text>
      </g>

      <text x="${W / 2}" y="880" font-family="${SANS}" font-size="30" font-weight="700"
            fill="${PAPER}" text-anchor="middle" opacity="${urlP.toFixed(3)}">padlock.extention.in</text>
    </g>`;
}

/* ---------------------------- frame assembly ---------------------------- */

// Pre-scale each product shot once rather than per frame.
const shots = new Map();
for (const scene of SCENES) {
  const buf = await sharp(scene.shot)
    .trim({ background: "#f3f4f6", threshold: 10 })
    // Bound both axes so a short, wide capture does not dwarf a tall one.
    .resize({ width: 560, height: 660, fit: "inside" })
    .toBuffer();
  shots.set(scene.shot, buf);
}

function deviceFrame(w, h) {
  const chrome = 40;
  const pad = 13;
  return `
  <svg width="${w + pad * 2}" height="${h + chrome + pad}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="sh" x="-60%" y="-60%" width="220%" height="220%">
        <feDropShadow dx="0" dy="26" stdDeviation="34" flood-color="#000" flood-opacity="0.45"/>
      </filter>
    </defs>
    <g filter="url(#sh)">
      <rect width="${w + pad * 2}" height="${h + chrome + pad}" rx="16" fill="#e8ebef"/>
      <circle cx="28" cy="20" r="6.5" fill="#ff5f57"/>
      <circle cx="50" cy="20" r="6.5" fill="#febc2e"/>
      <circle cx="72" cy="20" r="6.5" fill="#28c840"/>
    </g>
  </svg>`;
}

for (let f = 0; f < TOTAL; f++) {
  const t = f / FPS;
  let overlay = "";
  const composites = [];

  if (t < 4.05) overlay += paintLogo(t);
  if (t >= 4 && t < 8.05) overlay += paintThesis(t);
  if (t >= 25.5) overlay += paintCta(t);

  const active = SCENES.find((s) => t >= s.at && t < s.until);
  if (active) {
    const painted = paintScene(active, t);
    overlay += painted.svg;

    const base = shots.get(active.shot);
    const meta = await sharp(base).metadata();
    const w = Math.round(meta.width * painted.zoom);
    const h = Math.round(meta.height * painted.zoom);
    const capture = await sharp(base).resize(w, h).toBuffer();

    const chrome = 40;
    const pad = 13;
    const fx = Math.round(W - (w + pad * 2) - 190);
    const fy = Math.round((H - (h + chrome + pad)) / 2 + painted.frameY);

    // Fade the frame with the scene by pre-multiplying its alpha.
    const a = painted.alpha;
    if (a > 0.01) {
      const frameBuf = await sharp(Buffer.from(deviceFrame(w, h)))
        .composite([{ input: capture, left: pad, top: chrome }])
        .ensureAlpha(a)
        .png()
        .toBuffer();
      composites.push({ input: frameBuf, left: fx, top: fy });
    }
  }

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    ${background(t)}
    ${goldBar}
  </svg>`;

  const overlaySvg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${overlay}</svg>`;

  await sharp(Buffer.from(svg))
    .composite([...composites, { input: Buffer.from(overlaySvg) }])
    .flatten({ background: NAVY_DEEP })
    .removeAlpha()
    .png({ compressionLevel: 6 })
    .toFile(`${OUT}/f${String(f).padStart(4, "0")}.png`);

  if (f % 90 === 0) console.log(`frame ${f}/${TOTAL} (t=${t.toFixed(1)}s)`);
}

console.log(`done — ${TOTAL} frames`);
