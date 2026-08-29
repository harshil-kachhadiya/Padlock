// Soft rate-limit for repeated failed unlock attempts. This is a UX
// deterrent only — the master-password check is inherently client-side (by
// design, so the server never sees it), so this cannot be a real security
// boundary against someone bypassing the UI directly. It just slows down
// casual guessing in the normal unlock form, escalating on repeat offenses.

const MAX_ATTEMPTS = 5;
const BASE_LOCKOUT_MS = 30_000; // 30s, doubles per escalation

type LockoutState = {
  attempts: number;
  lockedUntil: number;
  lockoutTier: number;
};

const DEFAULT_STATE: LockoutState = { attempts: 0, lockedUntil: 0, lockoutTier: 0 };

function storageKey(userId: string) {
  return `padlock-lockout-${userId}`;
}

export function loadLockoutState(userId: string): LockoutState {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveLockoutState(userId: string, state: LockoutState) {
  window.localStorage.setItem(storageKey(userId), JSON.stringify(state));
}

export function recordFailedAttempt(userId: string): LockoutState {
  const state = loadLockoutState(userId);
  state.attempts += 1;

  if (state.attempts >= MAX_ATTEMPTS) {
    state.lockoutTier += 1;
    state.lockedUntil = Date.now() + BASE_LOCKOUT_MS * 2 ** (state.lockoutTier - 1);
    state.attempts = 0;
  }

  saveLockoutState(userId, state);
  return state;
}

export function recordSuccess(userId: string) {
  saveLockoutState(userId, { ...DEFAULT_STATE });
}

export function attemptsRemaining(state: LockoutState): number {
  return Math.max(MAX_ATTEMPTS - state.attempts, 0);
}

export function isLockedOut(state: LockoutState): boolean {
  return Date.now() < state.lockedUntil;
}

export function secondsUntilUnlocked(state: LockoutState): number {
  return Math.max(Math.ceil((state.lockedUntil - Date.now()) / 1000), 0);
}
