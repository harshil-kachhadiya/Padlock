import sharp from "sharp";

const NAVY = "#0f2d52";
const NAVY_DARK = "#0a1f3a";
const GOLD = "#ffbe2e";
const WHITE = "#f5f7fb";

const CANVAS_W = 1280;
const CANVAS_H = 800;

const shots = [
  {
    file: "store-assets/harness/vault-raw.png",
    out: "store-assets/screenshot-1-vault.png",
    caption: "Your entire vault, one click away",
    sub: "Autofill, copy, edit, or delete any saved login right from the popup",
  },
  {
    file: "store-assets/harness/add-entry-raw.png",
    out: "store-assets/screenshot-2-generator.png",
    caption: "Built-in strong password generator",
    sub: "Customize length and character rules, with live strength feedback",
  },
  {
    file: "store-assets/harness/unlock-raw.png",
    out: "store-assets/screenshot-3-unlock.png",
    caption: "Zero-knowledge by design",
    sub: "Your master password unlocks the vault locally — it never leaves your device",
  },
];

async function buildFrame(caption, sub) {
  return `
  <svg width="${CANVAS_W}" height="${CANVAS_H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="${CANVAS_W}" y2="${CANVAS_H}" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="${NAVY}"/>
        <stop offset="1" stop-color="${NAVY_DARK}"/>
      </linearGradient>
    </defs>
    <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#g)"/>
    <text x="80" y="110" font-family="Georgia, 'Times New Roman', serif" font-size="46" font-weight="700" fill="${WHITE}">${caption}</text>
    <text x="80" y="150" font-family="Arial, sans-serif" font-size="21" fill="${GOLD}">${sub}</text>
  </svg>`;
}

async function run() {
  for (const shot of shots) {
    const trimmed = await sharp(shot.file).trim({ background: "#f3f4f6", threshold: 8 }).toBuffer();
    const meta = await sharp(trimmed).metadata();

    // Fit the popup screenshot into a device-frame box on the right two-thirds of the canvas
    const boxW = 620;
    const boxH = 560;
    const scale = Math.min(boxW / meta.width, boxH / meta.height);
    const targetW = Math.round(meta.width * scale);
    const targetH = Math.round(meta.height * scale);

    const resized = await sharp(trimmed).resize(targetW, targetH).toBuffer();

    // Browser-chrome frame around the popup image
    const chromeH = 34;
    const frameW = targetW + 24;
    const frameH = targetH + chromeH + 12;

    const frameSvg = `
      <svg width="${frameW}" height="${frameH}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="18" stdDeviation="28" flood-color="#000" flood-opacity="0.35"/>
          </filter>
        </defs>
        <g filter="url(#shadow)">
          <rect x="0" y="0" width="${frameW}" height="${frameH}" rx="14" fill="#e5e7eb"/>
          <circle cx="22" cy="17" r="6" fill="#ff5f57"/>
          <circle cx="42" cy="17" r="6" fill="#febc2e"/>
          <circle cx="62" cy="17" r="6" fill="#28c840"/>
        </g>
      </svg>`;

    const background = await buildFrame(shot.caption, shot.sub);

    const canvasX = CANVAS_W - frameW - 90;
    const canvasY = Math.round((CANVAS_H - frameH) / 2) + 20;

    await sharp(Buffer.from(background))
      .composite([
        { input: Buffer.from(frameSvg), left: canvasX, top: canvasY },
        { input: resized, left: canvasX + 12, top: canvasY + chromeH },
      ])
      .flatten({ background: NAVY_DARK })
      .png()
      .toFile(shot.out);

    console.log("wrote", shot.out);
  }
}

run();
