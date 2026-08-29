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
        .select("salt, verifier")
        .eq("id", user.id)
        .eq("deleted", false)
        .single();

      if (userRowError || !userRow) {
        setError("Could not load your vault. Try again.");
        setSubmitting(false);
        setProgress(null);
        return;
      }

      const oldKey = await deriveKey(currentPassword, userRow.salt as number[]);
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
        body: JSON.stringify({ salt: newSalt, verifier: newVerifier, updates }),
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
      <SiteHeader userEmail={user?.email} onSignOut={handleSignOut} />

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

        <Card className="mt-6">
          <CardHeader>
            <h2 className="text-sm font-bold uppercase tracking-wide text-foreground-muted">
              Dashboard
            </h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={settings.reveal_password_default}
                onChange={(e) => updateSetting("reveal_password_default", e.target.checked)}
              />
              <span>
                <span className="block text-sm font-medium text-foreground">
                  Show passwords by default
                </span>
                <span className="block text-xs text-foreground-muted">
                  Passwords appear in plain text on the dashboard instead of masked with dots.
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
      </PageContainer>
    </div>
  );
}
