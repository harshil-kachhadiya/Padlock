import sharp from "sharp";
import { mkdirSync } from "fs";

const NAVY = "#0f2d52";
const NAVY_DARK = "#0a1f3a";
const GOLD = "#ffbe2e";
const WHITE = "#f5f7fb";

mkdirSync("src/app", { recursive: true });

/** The same padlock glyph used by the extension icon and the site header. */
function lockGlyph(scale = 1, color = GOLD, keyholeColor = NAVY_DARK) {
  return `
    <g transform="scale(${scale})">
      <path d="M184 232 V182 a72 72 0 0 1 144 0 V232"
            fill="none" stroke="${color}" stroke-width="34" stroke-linecap="round"/>
      <rect x="150" y="224" width="212" height="166" rx="30" fill="${color}"/>
      <circle cx="256" cy="284" r="24" fill="${keyholeColor}"/>
      <rect x="244" y="300" width="24" height="54" rx="8" fill="${keyholeColor}"/>
    </g>`;
}

// favicon.ico source + app icon (512 -> 32/180)
const iconSvg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="96" fill="${NAVY}"/>
  ${lockGlyph(1)}
</svg>`;

// Open Graph / Twitter card image (1200x630)
const ogSvg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${NAVY}"/>
      <stop offset="1" stop-color="${NAVY_DARK}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <rect x="0" y="612" width="1200" height="18" fill="${GOLD}"/>
  <g transform="translate(96, 150) scale(0.62)">
    ${lockGlyph(1)}
  </g>
  <text x="420" y="270" font-family="Georgia, 'Times New Roman', serif" font-size="82" font-weight="700" fill="${WHITE}">Padlock</text>
  <text x="420" y="330" font-family="Arial, Helvetica, sans-serif" font-size="34" fill="${GOLD}">Zero-Knowledge Password Manager</text>
  <text x="420" y="392" font-family="Arial, Helvetica, sans-serif" font-size="25" fill="${WHITE}" opacity="0.86">Encrypted in your browser. Never on our servers.</text>
</svg>`;

async function run() {
  await sharp(Buffer.from(iconSvg)).resize(32, 32).png().toFile("src/app/icon.png");
  await sharp(Buffer.from(iconSvg)).resize(180, 180).png().toFile("src/app/apple-icon.png");
  await sharp(Buffer.from(ogSvg)).png().toFile("src/app/opengraph-image.png");
  await sharp(Buffer.from(ogSvg)).png().toFile("src/app/twitter-image.png");
  console.log("site assets written");
}

run();
