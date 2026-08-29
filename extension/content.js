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
      filledPassword: Boolean(passwordField),
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
