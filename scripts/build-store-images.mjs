/**
 * Builds the Chrome Web Store image set from the harness captures.
 *
 * Design rules held constant across all seven images so the listing reads as
 * one system:
 *   - Navy field (#0f2d52 -> #071831), gold (#ffbe2e) reserved for accents only
 *   - A single gold hairline anchoring the bottom edge
 *   - Serif headline / sans sub-line, left-aligned, consistent baselines
 *   - The product capture always sits in a light device frame with one shadow
 *
 * Screenshot text lives OUTSIDE the device frame. The frame contains only the
 * real capture — never marketing copy composited to look like part of the UI,
 * which is what got the first submission rejected as spam.
 */
import sharp from "sharp";
import { mkdirSync } from "fs";

const NAVY = "#0f2d52";
const NAVY_DEEP = "#071831";
const GOLD = "#ffbe2e";
const PAPER = "#f5f7fb";
const MUTED = "#aebbcd";

const OUT = "store-assets";
mkdirSync(OUT, { recursive: true });

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Segoe UI', Arial, Helvetica, sans-serif";

/** Shared padlock glyph — same geometry as the extension icon and site header. */
function lock(color = GOLD, keyhole = NAVY_DEEP) {
  return `
    <path d="M184 232 V182 a72 72 0 0 1 144 0 V232"
          fill="none" stroke="${color}" stroke-width="34" stroke-linecap="round"/>
    <rect x="150" y="224" width="212" height="166" rx="30" fill="${color}"/>
    <circle cx="256" cy="284" r="24" fill="${keyhole}"/>
    <rect x="244" y="300" width="24" height="54" rx="8" fill="${keyhole}"/>`;
}

/**
 * Wraps at word boundaries. A fixed character slice splits words mid-glyph,
 * which reads as a rendering bug in a store listing.
 */
function wrap(text, maxChars) {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && `${line} ${word}`.length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function field(w, h) {
  return `
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="${w}" y2="${h}" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="${NAVY}"/>
        <stop offset="1" stop-color="${NAVY_DEEP}"/>
      </linearGradient>
      <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#2a5891" stop-opacity="0.55"/>
        <stop offset="1" stop-color="#2a5891" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/>`;
}

/* ------------------------------------------------------------------ *
 * Screenshots — 1280x800, capture framed on the right, copy on left
 * ------------------------------------------------------------------ */

const SHOTS = [
  {
    src: "vault.html",
    raw: "store-assets/harness/vault-raw.png",
    out: "screenshot-1-vault.png",
    kicker: "ONE CLICK TO FILL",
    head: ["Your logins, right where", "you need them"],
    sub: "Padlock surfaces the entries saved for the site you're on, with everything else one click away.",
    bullets: ["Domain-matched suggestions", "Autofill, copy, edit, delete", "Search as your vault grows"],
  },
  {
    src: "generator.html",
    raw: "store-assets/harness/generator-raw.png",
    out: "screenshot-2-generator.png",
    kicker: "BUILT-IN GENERATOR",
    head: ["Strong passwords,", "generated on the spot"],
    sub: "Set the length and character rules, and watch the strength meter respond as you type.",
    bullets: ["8-32 characters", "crypto.getRandomValues", "Live strength feedback"],
  },
  {
    src: "unlock.html",
    raw: "store-assets/harness/unlock-raw.png",
    out: "screenshot-3-zero-knowledge.png",
    kicker: "ZERO-KNOWLEDGE",
    head: ["Your master password", "never leaves your device"],
    sub: "It derives your AES-256 key locally through PBKDF2. Our servers only ever hold ciphertext.",
    bullets: ["AES-256-GCM encryption", "PBKDF2, 250,000 iterations", "No password recovery, by design"],
  },
  {
    src: "clipboard.html",
    raw: "store-assets/harness/clipboard-raw.png",
    out: "screenshot-4-clipboard.png",
    kicker: "SAFER CLIPBOARD",
    head: ["Copied passwords", "clear themselves"],
    sub: "Anything you copy is wiped from the clipboard after 20 seconds, checked live and on next open.",
    bullets: ["20-second auto-clear", "Click a username to copy it", "Auto-lock on idle"],
  },
  {
    src: "signin.html",
    raw: "store-assets/harness/signin-raw.png",
    out: "screenshot-5-signin.png",
    kicker: "SIGN IN WITH GOOGLE",
    head: ["Identity and encryption,", "kept separate"],
    sub: "Google proves who you are. It has nothing to do with your encryption key, which only you hold.",
    bullets: ["No separate account", "One vault, web and extension", "Free, with no ads"],
  },
];

async function buildShot(shot) {
  const W = 1280;
  const H = 800;

  const trimmed = await sharp(shot.raw)
    .trim({ background: "#f3f4f6", threshold: 10 })
    .toBuffer();
  const meta = await sharp(trimmed).metadata();

  // Fit the capture into the right-hand column.
  const boxW = 430;
  const boxH = 620;
  const scale = Math.min(boxW / meta.width, boxH / meta.height);
  const shotW = Math.round(meta.width * scale);
  const shotH = Math.round(meta.height * scale);
  const capture = await sharp(trimmed).resize(shotW, shotH).toBuffer();

  const chrome = 30;
  const pad = 10;
  const frameW = shotW + pad * 2;
  const frameH = shotH + chrome + pad;
  const frameX = W - frameW - 96;
  const frameY = Math.round((H - frameH) / 2);

  const bullets = shot.bullets
    .map(
      (b, i) => `
      <g transform="translate(96, ${498 + i * 40})">
        <circle cx="7" cy="-4" r="3.5" fill="${GOLD}"/>
        <text x="24" y="0" font-family="${SANS}" font-size="20" fill="${PAPER}" opacity="0.9">${b}</text>
      </g>`
    )
    .join("");

  const head = shot.head
    .map(
      (line, i) =>
        `<text x="96" y="${300 + i * 54}" font-family="${SERIF}" font-size="46" font-weight="700" fill="${PAPER}">${line}</text>`
    )
    .join("");

  const subTop = 300 + shot.head.length * 54 + 22;
  const sub = wrap(shot.sub, 58)
    .map(
      (line, i) =>
        `<text x="96" y="${subTop + i * 28}" font-family="${SANS}" font-size="20" fill="${MUTED}">${line}</text>`
    )
    .join("");

  const bg = `
  <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    ${field(W, H)}
    <ellipse cx="${frameX + frameW / 2}" cy="${H / 2}" rx="460" ry="400" fill="url(#glow)"/>

    <!-- Logo lockup: glyph and wordmark share a baseline, side by side. -->
    <g transform="translate(96, 108) scale(0.088)">${lock()}</g>
    <text x="146" y="152" font-family="${SERIF}" font-size="30" font-weight="700" fill="${PAPER}">Padlock</text>

    <text x="96" y="252" font-family="${SANS}" font-size="15" font-weight="700"
          fill="${GOLD}" letter-spacing="2.5">${shot.kicker}</text>
    ${head}
    ${sub}
    ${bullets}

    <rect x="0" y="${H - 6}" width="${W}" height="6" fill="${GOLD}"/>
  </svg>`;

  const frame = `
  <svg width="${frameW}" height="${frameH}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="sh" x="-60%" y="-60%" width="220%" height="220%">
        <feDropShadow dx="0" dy="22" stdDeviation="30" flood-color="#000" flood-opacity="0.42"/>
      </filter>
    </defs>
    <g filter="url(#sh)">
      <rect width="${frameW}" height="${frameH}" rx="13" fill="#e8ebef"/>
      <circle cx="21" cy="15" r="5" fill="#ff5f57"/>
      <circle cx="38" cy="15" r="5" fill="#febc2e"/>
      <circle cx="55" cy="15" r="5" fill="#28c840"/>
    </g>
  </svg>`;

  await sharp(Buffer.from(bg))
    .composite([
      { input: Buffer.from(frame), left: frameX, top: frameY },
      { input: capture, left: frameX + pad, top: frameY + chrome },
    ])
    // The store spec requires 24-bit PNG with no alpha channel; flatten alone
    // composites onto the background but leaves the channel in place.
    .flatten({ background: NAVY_DEEP })
    .removeAlpha()
    .png()
    .toFile(`${OUT}/${shot.out}`);

  console.log("wrote", shot.out);
}

/* ------------------------------------------------------------------ *
 * Promo tiles
 * ------------------------------------------------------------------ */

async function buildSmallTile() {
  const W = 440;
  const H = 280;
  const svg = `
  <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    ${field(W, H)}
    <ellipse cx="${W / 2}" cy="96" rx="150" ry="120" fill="url(#glow)"/>
    <g transform="translate(${W / 2 - 44}, 44) scale(0.172)">${lock()}</g>
    <text x="${W / 2}" y="206" font-family="${SERIF}" font-size="42" font-weight="700"
          fill="${PAPER}" text-anchor="middle">Padlock</text>
    <text x="${W / 2}" y="234" font-family="${SANS}" font-size="13" font-weight="700"
          fill="${GOLD}" text-anchor="middle" letter-spacing="1.6">ZERO-KNOWLEDGE PASSWORD MANAGER</text>
    <rect x="0" y="${H - 5}" width="${W}" height="5" fill="${GOLD}"/>
  </svg>`;
  await sharp(Buffer.from(svg)).flatten({ background: NAVY_DEEP }).png().toFile(`${OUT}/promo-small-440x280.png`);
  console.log("wrote promo-small-440x280.png");
}

async function buildMarquee() {
  const W = 1400;
  const H = 560;
  /**
   * Only features the EXTENSION ships. Secure notes and TOTP codes exist on
   * the website but not in the popup — claiming them on the store listing
   * would be a misleading-functionality violation.
   */
  const points = [
    "Autofill on any site",
    "Built-in password generator",
    "Right-click to fill, no popup needed",
  ];
  const bullets = points
    .map(
      (p, i) => `
      <g transform="translate(560, ${344 + i * 42})">
        <circle cx="8" cy="-5" r="4.5" fill="${GOLD}"/>
        <text x="28" y="0" font-family="${SANS}" font-size="23" fill="${PAPER}" opacity="0.92">${p}</text>
      </g>`
    )
    .join("");

  const svg = `
  <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    ${field(W, H)}
    <ellipse cx="300" cy="${H / 2}" rx="330" ry="300" fill="url(#glow)"/>
    <g transform="translate(170, 160) scale(0.47)">${lock()}</g>

    <text x="560" y="208" font-family="${SERIF}" font-size="92" font-weight="700" fill="${PAPER}">Padlock</text>
    <text x="560" y="264" font-family="${SANS}" font-size="30" font-weight="700"
          fill="${GOLD}" letter-spacing="1.2">Zero-knowledge password manager</text>
    <text x="560" y="306" font-family="${SANS}" font-size="22" fill="${MUTED}">Encrypted in your browser. Never readable on our servers.</text>
    ${bullets}

    <rect x="0" y="${H - 7}" width="${W}" height="7" fill="${GOLD}"/>
  </svg>`;
  await sharp(Buffer.from(svg)).flatten({ background: NAVY_DEEP }).png().toFile(`${OUT}/promo-marquee-1400x560.png`);
  console.log("wrote promo-marquee-1400x560.png");
}

async function run() {
  for (const shot of SHOTS) await buildShot(shot);
  await buildSmallTile();
  await buildMarquee();
}

run();
