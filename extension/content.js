// Runs in every page. Fills login forms on request from the popup — never runs on its own.

function setNativeValue(el, value) {
  const proto = Object.getPrototypeOf(el);
  const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
  descriptor.set.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function isVisible(el) {
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && el.offsetParent !== null;
}

function findPasswordField() {
  const candidates = Array.from(document.querySelectorAll('input[type="password"]')).filter(isVisible);
  return candidates[0] ?? null;
}

function findUsernameField(passwordField) {
  const form = passwordField ? passwordField.closest("form") : null;
  const scope = form ?? document;

  const selectors = [
    'input[type="email"]',
    'input[autocomplete="username"]',
    'input[autocomplete="email"]',
    'input[name*="user" i]',
    'input[id*="user" i]',
    'input[name*="email" i]',
    'input[id*="email" i]',
    'input[type="text"]',
  ];

  for (const selector of selectors) {
    const match = Array.from(scope.querySelectorAll(selector)).filter(isVisible)[0];
    if (match) return match;
  }

  return null;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "PADLOCK_AUTOFILL") {
    const passwordField = findPasswordField();
    const usernameField = findUsernameField(passwordField);

    let filled = 0;

    if (usernameField && message.username) {
      setNativeValue(usernameField, message.username);
      filled++;
    }

    if (passwordField && message.password) {
      setNativeValue(passwordField, message.password);
      filled++;
    }

    sendResponse({
      ok: filled > 0,
      filledUsername: Boolean(usernameField && message.username),
      filledPassword: Boolean(passwordField && message.password),
    });

    return true;
  }

  if (message?.type === "PADLOCK_CAPTURE") {
    const passwordField = findPasswordField();
    const usernameField = findUsernameField(passwordField);

    sendResponse({
      username: usernameField?.value || "",
      password: passwordField?.value || "",
    });

    return true;
  }
});

// --- Save-prompt on form submit -------------------------------------------

document.addEventListener(
  "submit",
  (e) => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement)) return;

    const passwordField = Array.from(form.querySelectorAll('input[type="password"]')).filter(
      isVisible
    )[0];
    if (!passwordField || !passwordField.value) return;

    const usernameField = findUsernameField(passwordField);

    // Fire-and-forget: the page may navigate away immediately after this handler
    // returns, so we don't wait for a response — background.js stashes the
    // capture per-tab and the next page load on this tab retrieves it.
    chrome.runtime.sendMessage({
      type: "PADLOCK_CAPTURE_SUBMIT",
      username: usernameField?.value || "",
      password: passwordField.value,
      host: location.hostname.replace(/^www\./, ""),
    });
  },
  true
);

function showSavePromptBanner(capture, isUpdate) {
  if (document.getElementById("padlock-save-prompt-host")) return;

  const host = document.createElement("div");
  host.id = "padlock-save-prompt-host";
  host.style.cssText =
    "all:initial;position:fixed;top:16px;right:16px;z-index:2147483647;display:block;";
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `
    <style>
      .banner {
        font-family: -apple-system, "Segoe UI", Arial, sans-serif;
        width: 280px;
        background: #ffffff;
        color: #1c1c1c;
        border: 1px solid #dde1e5;
        border-top: 3px solid #ffbe2e;
        border-radius: 4px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
        padding: 12px 14px;
      }
      .row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
      .badge {
        width: 20px; height: 20px; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        border: 2px solid #ffbe2e; border-radius: 2px;
        color: #0f2d52; font-weight: 700; font-size: 11px;
      }
      .title { font-weight: 700; font-size: 13px; }
      .desc { font-size: 12px; color: #4d5661; margin: 0 0 10px; }
      .actions { display: flex; gap: 6px; }
      button {
        font-family: inherit; font-size: 11px; font-weight: 600;
        border-radius: 3px; padding: 6px 10px; cursor: pointer; border: 1px solid transparent;
      }
      .save { background: #14396a; border-color: #0f2d52; color: #fff; flex: 1; }
      .never { background: transparent; border-color: #dde1e5; color: #1c1c1c; }
      .dismiss {
        margin-left: auto; background: transparent; border: none; color: #9aa5b1;
        font-size: 14px; padding: 0 2px; cursor: pointer;
      }
    </style>
    <div class="banner">
      <div class="row">
        <span class="badge">P</span>
        <span class="title">Padlock</span>
        <button class="dismiss" data-action="dismiss" aria-label="Dismiss">&times;</button>
      </div>
      <p class="desc">${
        isUpdate ? "Update the saved password for" : "Save this password for"
      } <strong>${escapeHtml(capture.username || "this account")}</strong> on ${escapeHtml(capture.host)}?</p>
      <div class="actions">
        <button class="save" data-action="save">${isUpdate ? "Update" : "Save"}</button>
        <button class="never" data-action="never">Never for this site</button>
      </div>
    </div>
  `;

  function remove() {
    host.remove();
  }

  shadow.querySelector('[data-action="dismiss"]').addEventListener("click", remove);

  shadow.querySelector('[data-action="never"]').addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "PADLOCK_IGNORE_HOST", host: capture.host });
    remove();
  });

  shadow.querySelector('[data-action="save"]').addEventListener("click", async (e) => {
    const button = e.currentTarget;
    button.disabled = true;
    button.textContent = "Saving…";

    const response = await chrome.runtime.sendMessage({
      type: "PADLOCK_SAVE_CAPTURE",
      username: capture.username,
      password: capture.password,
      host: capture.host,
    });

    if (response?.ok) {
      button.textContent = "Saved";
      setTimeout(remove, 1200);
    } else {
      button.disabled = false;
      button.textContent = isUpdate ? "Update" : "Save";
      shadow.querySelector(".desc").textContent =
        response?.error || "Couldn't save — try the Padlock popup instead.";
    }
  });

  setTimeout(remove, 15000);
}

(async function checkForPendingSavePrompt() {
  const capture = await chrome.runtime.sendMessage({
    type: "PADLOCK_GET_PENDING_CAPTURE",
    currentHost: location.hostname.replace(/^www\./, ""),
  });
  if (!capture) return;

  const decision = await chrome.runtime.sendMessage({
    type: "PADLOCK_CHECK_SHOULD_PROMPT",
    host: capture.host,
    username: capture.username,
    password: capture.password,
  });

  if (decision?.show) {
    showSavePromptBanner(capture, decision.isUpdate);
  }
})();

// --- Click-a-field-to-see-saved-logins dropdown ---------------------------

function escapeHtml(str) {
  return String(str).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

let dropdownHost = null;
let dropdownField = null;

function removeDropdown() {
  if (dropdownHost) dropdownHost.remove();
  dropdownHost = null;
  dropdownField = null;
}

function positionDropdown(hostEl, fieldEl) {
  const rect = fieldEl.getBoundingClientRect();
  hostEl.style.top = `${rect.bottom + window.scrollY + 4}px`;
  hostEl.style.left = `${rect.left + window.scrollX}px`;
  hostEl.style.width = `${Math.max(rect.width, 220)}px`;
}

function isSuggestableField(el) {
  if (!(el instanceof HTMLInputElement)) return false;
  if (el.type === "password") return isVisible(el);

  const passwordField = findPasswordField();
  return Boolean(passwordField && el === findUsernameField(passwordField));
}

async function showSuggestionsDropdown(fieldEl) {
  if (dropdownField === fieldEl) return;
  removeDropdown();

  const host = document.createElement("div");
  host.style.cssText = "all:initial;position:absolute;z-index:2147483647;display:block;";
  document.documentElement.appendChild(host);
  positionDropdown(host, fieldEl);

  dropdownHost = host;
  dropdownField = fieldEl;

  const shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `
    <style>
      .list {
        font-family: -apple-system, "Segoe UI", Arial, sans-serif;
        background: #ffffff;
        border: 1px solid #dde1e5;
        border-top: 2px solid #ffbe2e;
        border-radius: 4px;
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);
        overflow: hidden;
      }
      .loading, .empty { padding: 10px 12px; font-size: 12px; color: #4d5661; }
      .item {
        display: flex; flex-direction: column; align-items: flex-start;
        width: 100%; text-align: left; padding: 8px 12px;
        border: none; border-bottom: 1px solid #f1f3f5;
        background: transparent; cursor: pointer; font-family: inherit;
      }
      .item:last-child { border-bottom: none; }
      .item:hover { background: #f8f9fa; }
      .item-name { font-size: 12px; font-weight: 700; color: #1c1c1c; }
      .item-user { font-size: 11px; color: #4d5661; }
    </style>
    <div class="list"><div class="loading">Loading saved logins&hellip;</div></div>
  `;

  const currentHost = location.hostname.replace(/^www\./, "");
  const response = await chrome.runtime.sendMessage({
    type: "PADLOCK_LIST_ENTRIES_FOR_HOST",
    host: currentHost,
  });

  if (dropdownField !== fieldEl) return; // focus moved on while we were awaiting

  const listEl = shadow.querySelector(".list");

  if (response?.status === "locked") {
    listEl.innerHTML = `<div class="empty">Padlock is locked — open the popup to unlock</div>`;
    return;
  }

  if (!response?.entries?.length) {
    removeDropdown();
    return;
  }

  listEl.innerHTML = response.entries
    .map(
      (entry) => `
        <button class="item" data-id="${escapeHtml(entry.id)}">
          <span class="item-name">${escapeHtml(entry.siteName)}</span>
          <span class="item-user">${escapeHtml(entry.username)}</span>
        </button>`
    )
    .join("");

  listEl.querySelectorAll(".item").forEach((btn) => {
    btn.addEventListener("mousedown", async (e) => {
      e.preventDefault(); // keep focus on the field so this still counts as a click
      const siteId = btn.dataset.id;
      const creds = await chrome.runtime.sendMessage({ type: "PADLOCK_GET_CREDENTIALS", siteId });
      removeDropdown();
      if (!creds?.ok) return;

      const passwordField = findPasswordField();
      const usernameField = findUsernameField(passwordField);
      if (usernameField && creds.username) setNativeValue(usernameField, creds.username);
      if (passwordField && creds.password) setNativeValue(passwordField, creds.password);
    });
  });
}

document.addEventListener("focusin", (e) => {
  if (isSuggestableField(e.target)) {
    showSuggestionsDropdown(e.target);
  } else {
    removeDropdown();
  }
});

document.addEventListener("focusout", () => {
  setTimeout(removeDropdown, 150);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") removeDropdown();
});

window.addEventListener(
  "scroll",
  () => {
    if (dropdownHost && dropdownField) positionDropdown(dropdownHost, dropdownField);
  },
  true
);
