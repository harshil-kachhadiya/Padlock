// Shared domain-matching helpers — used by popup.js and background.js.

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Second-level suffixes where the registrable domain needs 3 labels, not 2
// (e.g. "example.co.uk", not just "co.uk"). Small pragmatic list, not a full PSL.
const TWO_LABEL_SUFFIXES = new Set([
  "co.uk", "org.uk", "ac.uk", "gov.uk",
  "co.in", "com.au", "co.nz", "co.za",
  "com.br", "com.cn", "co.jp", "co.kr",
]);

function registrableDomain(host) {
  if (!host) return "";
  const parts = host.split(".");
  if (parts.length <= 2) return host;

  const lastTwo = parts.slice(-2).join(".");
  if (TWO_LABEL_SUFFIXES.has(lastTwo) && parts.length > 2) {
    return parts.slice(-3).join(".");
  }
  return lastTwo;
}

function hostsMatch(a, b) {
  if (!a || !b) return false;
  return registrableDomain(a) === registrableDomain(b);
}

function exactHostsMatch(a, b) {
  if (!a || !b) return false;
  return a.replace(/^www\./, "").toLowerCase() === b.replace(/^www\./, "").toLowerCase();
}
