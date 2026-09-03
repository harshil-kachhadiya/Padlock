/**
 * Generates static harness pages for Chrome Web Store screenshots.
 *
 * Each page reuses the extension's real markup and its real styles.css, with
 * sample data filled in — so a capture is a genuine render of the shipping UI,
 * not a mockup. Only states the extension actually has are represented here.
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";

const css = readFileSync("extension/styles.css", "utf8");
const OUT = "store-assets/harness";
mkdirSync(OUT, { recursive: true });

const COPY_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>`;
const EDIT_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
const DEL_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>`;

function entry(name, username, reason) {
  return `
    <li class="entry">
      <div class="entry-info">
        <div class="entry-name">${name}</div>
        <div class="entry-username">${username}</div>
        ${reason ? `<div class="entry-match-reason">${reason}</div>` : ""}
      </div>
      <div class="entry-actions">
        <button class="btn btn-primary btn-sm">Autofill</button>
        <button class="entry-icon-btn" aria-label="Copy password">${COPY_ICON}</button>
        <button class="entry-icon-btn" aria-label="Edit entry">${EDIT_ICON}</button>
        <button class="entry-icon-btn entry-icon-btn-danger" aria-label="Delete entry">${DEL_ICON}</button>
      </div>
    </li>`;
}

function page(body, extra = "") {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Padlock</title>
    <style>
${css}
${extra}
    </style>
  </head>
  <body>
    <header class="header">
      <span class="badge">P</span>
      <div>
        <div class="title">Padlock</div>
        <div class="subtitle">Secure Credential Vault</div>
      </div>
    </header>
    <main class="app">
${body}
    </main>
  </body>
</html>`;
}

const pages = {
  // 1. The vault, scoped to the current site plus everything else.
  vault: page(`
      <div class="panel">
        <div class="vault-header">
          <h1>Your vault</h1>
          <div>
            <button class="btn btn-ghost btn-sm">Lock</button>
            <button class="btn btn-ghost btn-sm">Sign out</button>
          </div>
        </div>
        <button class="btn btn-secondary">+ Add entry</button>

        <p class="section-label">This site &mdash; code.example.com</p>
        <ul class="entry-list">
          ${entry("Code Hosting", "joe@example.com", "matched code.example.com")}
        </ul>

        <details class="all-section" open>
          <summary class="section-summary">All items</summary>
          <ul class="entry-list">
            ${entry("Mail Account", "joe@example.com")}
            ${entry("Streaming Service", "joe@example.com")}
            ${entry("Shopping Site", "joe@example.com")}
          </ul>
        </details>
      </div>`),

  // 2. Generator open, with the strength meter in its "strong" state.
  generator: page(`
      <div class="panel">
        <h1 id="entry-form-title">Add entry</h1>
        <input type="text" class="input" value="Code Hosting" />
        <input type="text" class="input" value="code.example.com" />
        <input type="text" class="input" value="joe@example.com" />

        <div class="password-row">
          <input type="text" class="input input-inline" value="qX8!vR2kLp9$mZ4t" />
          <button type="button" class="icon-btn">&#128065;</button>
        </div>

        <div class="strength-meter">
          <div class="strength-track"><span style="width:100%;background:var(--green);"></span></div>
          <span class="strength-label" style="color:var(--green);">Strong</span>
        </div>

        <details class="gen-section" open>
          <summary class="section-summary">Generate a strong password</summary>
          <div class="gen-panel">
            <div class="gen-row">
              <label>Length</label>
              <input type="range" min="8" max="32" value="16" />
              <span class="gen-length-value">16</span>
            </div>
            <label class="gen-checkbox"><input type="checkbox" checked /> Uppercase (A&ndash;Z)</label>
            <label class="gen-checkbox"><input type="checkbox" checked /> Numbers (0&ndash;9)</label>
            <label class="gen-checkbox"><input type="checkbox" checked /> Symbols (!@#$)</label>
            <button type="button" class="btn btn-secondary btn-sm">Generate password</button>
          </div>
        </details>

        <button class="btn btn-primary">Save</button>
        <button class="btn btn-ghost">Cancel</button>
      </div>`),

  // 3. Master-password unlock — the zero-knowledge boundary.
  unlock: page(`
      <div class="panel">
        <h1>Unlock vault</h1>
        <p class="muted">Enter your master password. It is never sent anywhere.</p>
        <input type="password" class="input" value="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;" />
        <button class="btn btn-primary">Unlock</button>
        <button class="btn btn-ghost">Sign out</button>
      </div>`),

  // 4. Google identity step, kept separate from encryption.
  signin: page(`
      <div class="panel">
        <h1>Sign in</h1>
        <p class="muted">Verify your identity to continue to Padlock.</p>
        <button class="btn btn-primary" style="margin-top:16px;">Sign in with Google</button>
      </div>`),

  // 5. Copy-to-clipboard toast with its auto-clear notice.
  clipboard: page(`
      <div class="panel">
        <div class="vault-header">
          <h1>Your vault</h1>
          <div>
            <button class="btn btn-ghost btn-sm">Lock</button>
            <button class="btn btn-ghost btn-sm">Sign out</button>
          </div>
        </div>
        <button class="btn btn-secondary">+ Add entry</button>

        <p class="section-label">This site &mdash; watch.example.com</p>
        <ul class="entry-list">
          ${entry("Streaming Service", "joe@example.com", "matched watch.example.com")}
        </ul>

        <details class="all-section" open>
          <summary class="section-summary">All items</summary>
          <ul class="entry-list">
            ${entry("Code Hosting", "joe@example.com")}
            ${entry("Mail Account", "joe@example.com")}
          </ul>
        </details>
      </div>
      <div class="toast toast-success show" style="position:static;transform:none;margin:16px auto 0;max-width:290px;">
        <span>Password copied &mdash; clears in 20s</span>
      </div>`),
};

for (const [name, html] of Object.entries(pages)) {
  writeFileSync(`${OUT}/${name}.html`, html);
  console.log("wrote", `${OUT}/${name}.html`);
}
