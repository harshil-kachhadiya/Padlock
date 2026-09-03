/**
 * YouTube thumbnail: 1280x720, the size YouTube expects for a custom thumb.
 *
 * Deliberately low word count — a thumbnail is read at roughly 210px wide in a
 * sidebar, so anything longer than a few words is illegible where it matters.
 */
import sharp from "sharp";

const W = 1280;
const H = 720;

const NAVY = "#0f2d52";
const NAVY_DEEP = "#071831";
const GOLD = "#ffbe2e";
const PAPER = "#f5f7fb";
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Segoe UI', Arial, Helvetica, sans-serif";

function lock(color = GOLD, keyhole = NAVY_DEEP) {
  return `
    <path d="M184 232 V182 a72 72 0 0 1 144 0 V232"
          fill="none" stroke="${color}" stroke-width="34" stroke-linecap="round"/>
    <rect x="150" y="224" width="212" height="166" rx="30" fill="${color}"/>
    <circle cx="256" cy="284" r="24" fill="${keyhole}"/>
    <rect x="244" y="300" width="24" height="54" rx="8" fill="${keyhole}"/>`;
}

async function run() {
  const shot = await sharp("video/src/vault.png")
    .trim({ background: "#f3f4f6", threshold: 10 })
    .resize({ width: 360, height: 520, fit: "inside" })
    .toBuffer();
  const meta = await sharp(shot).metadata();

  const pad = 11;
  const chrome = 34;
  const frameW = meta.width + pad * 2;
  const frameH = meta.height + chrome + pad;
  const fx = W - frameW - 90;
  const fy = Math.round((H - frameH) / 2);

  const bg = `
  <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
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
    <ellipse cx="${fx + frameW / 2}" cy="${H / 2}" rx="420" ry="380" fill="url(#glow)"/>

    <g transform="translate(84, 88) scale(0.115)">${lock()}</g>
    <text x="146" y="136" font-family="${SERIF}" font-size="40" font-weight="700" fill="${PAPER}">Padlock</text>

    <!-- Large enough to survive being scaled to sidebar size. -->
    <text x="84" y="300" font-family="${SERIF}" font-size="76" font-weight="700" fill="${PAPER}">It can't read</text>
    <text x="84" y="384" font-family="${SERIF}" font-size="76" font-weight="700" fill="${PAPER}">your passwords.</text>
    <text x="84" y="452" font-family="${SANS}" font-size="27" font-weight="700" fill="${GOLD}" letter-spacing="2">ZERO-KNOWLEDGE PASSWORD MANAGER</text>

    <g transform="translate(84, 520)">
      <rect x="0" y="0" width="286" height="62" rx="7" fill="${GOLD}"/>
      <text x="143" y="41" font-family="${SANS}" font-size="26" font-weight="700"
            fill="${NAVY_DEEP}" text-anchor="middle">Free for Chrome</text>
    </g>

    <rect x="0" y="${H - 7}" width="${W}" height="7" fill="${GOLD}"/>
  </svg>`;

  const frame = `
  <svg width="${frameW}" height="${frameH}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="sh" x="-60%" y="-60%" width="220%" height="220%">
        <feDropShadow dx="0" dy="20" stdDeviation="26" flood-color="#000" flood-opacity="0.45"/>
      </filter>
    </defs>
    <g filter="url(#sh)">
      <rect width="${frameW}" height="${frameH}" rx="13" fill="#e8ebef"/>
      <circle cx="23" cy="17" r="5.5" fill="#ff5f57"/>
      <circle cx="42" cy="17" r="5.5" fill="#febc2e"/>
      <circle cx="61" cy="17" r="5.5" fill="#28c840"/>
    </g>
  </svg>`;

  await sharp(Buffer.from(bg))
    .composite([
      { input: Buffer.from(frame), left: fx, top: fy },
      { input: shot, left: fx + pad, top: fy + chrome },
    ])
    .flatten({ background: NAVY_DEEP })
    .removeAlpha()
    .jpeg({ quality: 92 })
    .toFile("video/youtube-thumbnail-1280x720.jpg");

  console.log("wrote video/youtube-thumbnail-1280x720.jpg");
}

run();
