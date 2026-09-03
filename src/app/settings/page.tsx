"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import {
  deriveKey,
  checkVerifier,
  decryptEntry,
  encryptEntry,
  generateSalt,
  createVerifier,
  DEFAULT_PBKDF2_ITERATIONS,
  type EncryptedPayload,
} from "@/lib/crypto";
import { useKey } from "@/lib/keyContext";
import { useTheme } from "@/lib/themeContext";
import { useSettings } from "@/lib/settingsContext";
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  PasswordInput,
  SiteHeader,
  PageContainer,
} from "@/components/ui";

const AUTO_LOCK_OPTIONS = [
  { label: "5 minutes", ms: 5 * 60 * 1000 },
  { label: "10 minutes", ms: 10 * 60 * 1000 },
  { label: "15 minutes", ms: 15 * 60 * 1000 },
  { label: "30 minutes", ms: 30 * 60 * 1000 },
];

export default function SettingsPage() {
  const router = useRouter();
  const { setKey, clearKey, autoLockMs, setAutoLockMs } = useKey();
  const { theme, setTheme } = useTheme();
  const { settings, updateSetting } = useSettings();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setUser(data.user);
      setLoading(false);
    });
  }, [router]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    clearKey();
    router.replace("/login");
  }

  async function handleSignOutEverywhere() {
    await supabase.auth.signOut({ scope: "global" });
    clearKey();
    router.replace("/login");
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword.length < 8) {
      setError("New master password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session || !user) {
        router.replace("/login");
        return;
      }

      setProgress("Verifying current master password…");
      const { data: userRow, error: userRowError } = await supabase
        .from("users")
        .select("salt, verifier, pbkdf2_iterations")
        .eq("id", user.id)
        .eq("deleted", false)
        .single();

      if (userRowError || !userRow) {
        setError("Could not load your vault. Try again.");
        setSubmitting(false);
        setProgress(null);
        return;
      }

      // Falls back to the legacy default for any row from before this column
      // existed — see supabase/migrations/0010_pbkdf2_iterations.sql.
      const oldIterations = (userRow.pbkdf2_iterations as number | null) ?? 250_000;
      const oldKey = await deriveKey(currentPassword, userRow.salt as number[], oldIterations);
      const isValid = await checkVerifier(oldKey, userRow.verifier as EncryptedPayload);

      if (!isValid) {
        setError("Current master password is incorrect.");
        setSubmitting(false);
        setProgress(null);
        return;
      }

      setProgress("Loading your saved entries…");
      const { data: sites, error: sitesError } = await supabase
        .from("sites")
        .select("id, passwords(id, encrypted_password, created_at, deleted)")
        .eq("user_id", user.id)
        .eq("deleted", false);

      if (sitesError) {
        setError(sitesError.message);
        setSubmitting(false);
        setProgress(null);
        return;
      }

      const activePasswords = (sites ?? []).flatMap((site) => {
        const rows = (site.passwords ?? []) as {
          id: string;
          encrypted_password: EncryptedPayload;
          created_at: string;
          deleted: boolean;
        }[];
        const active = rows
          .filter((p) => !p.deleted)
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
        return active ? [active] : [];
      });

      setProgress(`Re-encrypting ${activePasswords.length} entries…`);
      const newSalt = generateSalt();
      const newKey = await deriveKey(newPassword, newSalt);
      const newVerifier = await createVerifier(newKey);

      const updates = await Promise.all(
        activePasswords.map(async (p) => {
          const plaintext = await decryptEntry(oldKey, p.encrypted_password);
          const encrypted_password = await encryptEntry(newKey, plaintext);
          return { id: p.id, encrypted_password };
        })
      );

      setProgress("Saving…");
      const response = await fetch("/api/account/change-master-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          salt: newSalt,
          verifier: newVerifier,
          pbkdf2Iterations: DEFAULT_PBKDF2_ITERATIONS,
          updates,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? "Failed to change master password.");
        setSubmitting(false);
        setProgress(null);
        return;
      }

      setKey(newKey);
      setSuccess("Master password changed. Your vault is still unlocked.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== "DELETE") return;

    setDeleting(true);
    setDeleteError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        router.replace("/login");
        return;
      }

      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setDeleteError(body.error ?? "Failed to delete account.");
        setDeleting(false);
        return;
      }

      await supabase.auth.signOut();
      clearKey();
      router.replace("/");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Something went wrong.");
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <PageContainer className="flex flex-1 items-center justify-center">
          <p className="text-sm text-foreground-muted">Loading&hellip;</p>
        </PageContainer>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <PageContainer className="max-w-2xl">
        <h1 className="font-serif text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Manage your master password and vault preferences.
        </p>

        <Card className="mt-6">
          <CardHeader>
            <h2 className="text-sm font-bold uppercase tracking-wide text-foreground-muted">
              Change master password
            </h2>
          </CardHeader>
          <CardBody>
            <p className="mb-4 text-xs leading-relaxed text-foreground-muted">
              This re-encrypts every saved entry with a new key. It can take a moment for large
              vaults — don&apos;t close this tab while it&apos;s running.
            </p>

            <form onSubmit={handleChangePassword}>
              <PasswordInput
                label="Current master password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
              <PasswordInput
                label="New master password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              <PasswordInput
                label="Confirm new master password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />

              {error && <Alert variant="error">{error}</Alert>}
              {success && <Alert variant="success">{success}</Alert>}
              {progress && !error && (
                <p className="mb-4 text-xs font-semibold text-navy-700 dark:text-gold-500">
                  {progress}
                </p>
              )}

              <Button type="submit" disabled={submitting}>
                {submitting ? "Changing…" : "Change master password"}
              </Button>
            </form>
          </CardBody>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <h2 className="text-sm font-bold uppercase tracking-wide text-foreground-muted">
              Auto-lock
            </h2>
          </CardHeader>
          <CardBody>
            <p className="mb-4 text-xs leading-relaxed text-foreground-muted">
              Your vault automatically locks after this much inactivity, clearing the decryption
              key from memory.
            </p>
            <div className="flex flex-wrap gap-2">
              {AUTO_LOCK_OPTIONS.map((option) => (
                <Button
                  key={option.ms}
                  variant={autoLockMs === option.ms ? "primary" : "secondary"}
                  onClick={() => {
                    setAutoLockMs(option.ms);
                    updateSetting("auto_lock_ms", option.ms);
                  }}
                  className="px-4 py-2 text-xs"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <h2 className="text-sm font-bold uppercase tracking-wide text-foreground-muted">
              Appearance
            </h2>
          </CardHeader>
          <CardBody>
            <p className="mb-4 text-xs leading-relaxed text-foreground-muted">
              Applies immediately and syncs across your devices.
            </p>
            <div className="flex gap-2">
              {(["light", "dark"] as const).map((option) => (
                <Button
                  key={option}
                  variant={theme === option ? "primary" : "secondary"}
                  onClick={() => {
                    setTheme(option);
                    updateSetting("theme", option);
                  }}
                  className="px-4 py-2 text-xs capitalize"
                >
                  {option}
                </Button>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card className="mt-6 border-red-600">
          <CardHeader>
            <h2 className="text-sm font-bold uppercase tracking-wide text-red-600">Security</h2>
          </CardHeader>
          <CardBody>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={settings.never_show_passwords}
                onChange={(e) => updateSetting("never_show_passwords", e.target.checked)}
              />
              <span>
                <span className="block text-sm font-medium text-foreground">
                  Never show passwords
                </span>
                <span className="block text-xs text-foreground-muted">
                  Turns off every &ldquo;Show&rdquo;/reveal control for saved passwords across the
                  website — dashboard, export, and the add/edit forms always stay masked. Your
                  master password fields are unaffected, since you still need to check those for
                  typos.
                </span>
              </span>
            </label>

            <label className="mt-4 flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={settings.hint_only_mode}
                onChange={(e) => updateSetting("hint_only_mode", e.target.checked)}
              />
              <span>
                <span className="block text-sm font-medium text-foreground">
                  Show hint instead of autofilling password
                </span>
                <span className="block text-xs text-foreground-muted">
                  When the extension autofills a site that has a hint set (see the entry&rsquo;s
                  edit form), it shows the hint instead of filling in the real password.
                  Entries without a hint autofill normally either way.
                </span>
              </span>
            </label>
          </CardBody>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <h2 className="text-sm font-bold uppercase tracking-wide text-foreground-muted">
              Dashboard
            </h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <label
              className={`flex items-start gap-3 ${
                settings.never_show_passwords ? "opacity-50" : ""
              }`}
            >
              <input
                type="checkbox"
                className="mt-0.5"
                checked={settings.reveal_password_default}
                disabled={settings.never_show_passwords}
                onChange={(e) => updateSetting("reveal_password_default", e.target.checked)}
              />
              <span>
                <span className="block text-sm font-medium text-foreground">
                  Show passwords by default
                </span>
                <span className="block text-xs text-foreground-muted">
                  {settings.never_show_passwords
                    ? 'Disabled while "Never show passwords" is on.'
                    : "Passwords appear in plain text on the dashboard instead of masked with dots."}
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={settings.expand_all_items_default}
                onChange={(e) => updateSetting("expand_all_items_default", e.target.checked)}
              />
              <span>
                <span className="block text-sm font-medium text-foreground">
                  Expand &ldquo;All items&rdquo; by default
                </span>
                <span className="block text-xs text-foreground-muted">
                  Applies to the browser extension&apos;s popup — keeps the full entry list
                  expanded instead of collapsed.
                </span>
              </span>
            </label>
          </CardBody>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <h2 className="text-sm font-bold uppercase tracking-wide text-foreground-muted">
              Session
            </h2>
          </CardHeader>
          <CardBody>
            <p className="mb-4 text-xs leading-relaxed text-foreground-muted">
              Signed in somewhere you don&apos;t recognize? This signs out every device and
              browser using your account, not just this one.
            </p>
            <Button variant="danger" onClick={handleSignOutEverywhere}>
              Sign out of all devices
            </Button>
          </CardBody>
        </Card>

        <Card className="mt-6 border-red-600">
          <CardHeader>
            <h2 className="text-sm font-bold uppercase tracking-wide text-red-600">
              Danger zone
            </h2>
          </CardHeader>
          <CardBody>
            <p className="mb-4 text-xs leading-relaxed text-foreground-muted">
              Permanently deletes your vault, notes, settings, and account record. This cannot be
              undone — export your vault first if you want a copy.
            </p>

            <label className="mb-1.5 block text-sm font-semibold text-foreground">
              Type DELETE to confirm
            </label>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="mb-4 w-full max-w-xs rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/30"
            />

            {deleteError && <Alert variant="error">{deleteError}</Alert>}

            <Button
              variant="danger"
              disabled={deleteConfirmText !== "DELETE" || deleting}
              onClick={handleDeleteAccount}
            >
              {deleting ? "Deleting…" : "Delete my account"}
            </Button>
          </CardBody>
        </Card>
      </PageContainer>
    </div>
  );
}
