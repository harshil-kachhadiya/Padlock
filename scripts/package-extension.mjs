/**
 * Packages extension/ into public/padlock-extension.zip so the site can offer
 * it as a direct download while the Chrome Web Store listing is pending.
 *
 * The zip is committed rather than built on deploy: Vercel's build image has
 * no zip tooling, and this only needs regenerating when the extension changes.
 * Run it with `npm run package:extension` after editing anything in extension/.
 */
import { execFileSync } from "child_process";
import { existsSync, mkdirSync, rmSync, readFileSync } from "fs";
import { resolve } from "path";

const SRC = resolve("extension");
const OUT = resolve("public/padlock-extension.zip");

if (!existsSync(SRC)) {
  console.error("extension/ not found");
  process.exit(1);
}

mkdirSync(resolve("public"), { recursive: true });
rmSync(OUT, { force: true });

function tryZip() {
  try {
    // Prefer the `zip` CLI (macOS/Linux). -X drops extra file attributes.
    execFileSync("zip", ["-r", "-X", OUT, "."], { cwd: SRC, stdio: "pipe" });
    return "zip";
  } catch {
    // Windows fallback.
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `Compress-Archive -Path '${SRC}\\*' -DestinationPath '${OUT}' -Force`,
      ],
      { stdio: "pipe" }
    );
    return "Compress-Archive";
  }
}

const tool = tryZip();
const { version } = JSON.parse(readFileSync(resolve(SRC, "manifest.json"), "utf8"));
console.log(`packaged extension v${version} -> public/padlock-extension.zip (via ${tool})`);
