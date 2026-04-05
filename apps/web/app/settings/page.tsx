"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, SocialProvider, SocialLink } from "../contexts/auth-context";
import { useToast } from "../components/toast";
import { Avatar } from "../components/avatar";
import { AvatarPicker } from "../components/avatar-picker";
import { PasswordInput } from "../components/password-input";
import { SocialAuthModal } from "../components/social-auth-modal";
import { validateEmail, validatePassword } from "../lib/validation";
import { apiClient } from "../lib/api-client";
import { UserProfile } from "../types";

const PROVIDER_ICONS: Record<SocialProvider, React.ReactNode> = {
  google: (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  ),
  github: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-text-primary">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  ),
  discord: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#5865F2">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  ),
};

const PROVIDER_LABELS: Record<SocialProvider, string> = {
  google: "Google",
  github: "GitHub",
  discord: "Discord",
};

export default function SettingsPage() {
  const {
    user, loading, updateProfile, changePassword, deleteAccount,
    linkSocial, unlinkSocial, getSocialLinks,
  } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  // Profile state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [profileError, setProfileError] = useState("");

  // Password state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState("");

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePw, setDeletePw] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState("");

  // Social state
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [linkProvider, setLinkProvider] = useState<SocialProvider | null>(null);
  const [isSocialOnly, setIsSocialOnly] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setSocialLinks(getSocialLinks());
      // Fetch full profile from API for bio and avatarUrl
      apiClient
        .get<UserProfile>("/users/me")
        .then((profile) => {
          setBio(profile.bio || "");
          setAvatarUrl(profile.avatarUrl || null);
        })
        .catch(() => {
          // Fallback: use what's on the user object
        });
    }
  }, [user, loading, router, getSocialLinks]);

  async function handleProfileSave(e: FormEvent) {
    e.preventDefault();
    setProfileError("");
    if (!name.trim()) {
      setProfileError("Name is required");
      return;
    }
    if (!validateEmail(email)) {
      setProfileError("Please enter a valid email address");
      return;
    }
    const result = await updateProfile({ name: name.trim(), email, bio, avatarUrl: avatarUrl || undefined });
    if (result.success) {
      showToast("Profile updated", "success");
    } else {
      setProfileError(result.error || "Failed to update profile");
    }
  }

  function handleAvatarSelect(url: string | null) {
    setAvatarUrl(url);
  }

  async function handlePasswordSave(e: FormEvent) {
    e.preventDefault();
    setPwError("");
    if (!currentPw || !newPw) {
      setPwError("Please fill in all fields");
      return;
    }
    const pwErr = validatePassword(newPw);
    if (pwErr) {
      setPwError(pwErr);
      return;
    }
    if (newPw !== confirmPw) {
      setPwError("Passwords do not match");
      return;
    }
    const result = await changePassword(currentPw, newPw);
    if (result.success) {
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      showToast("Password changed", "success");
    } else {
      setPwError(result.error || "Failed to change password");
    }
  }

  async function handleDeleteAccount() {
    setDeleteError("");
    if (isSocialOnly) {
      if (deleteConfirmText !== "DELETE") {
        setDeleteError("Type DELETE to confirm");
        return;
      }
      const result = await deleteAccount("");
      if (result.success) {
        showToast("Account deleted", "info");
        router.replace("/login");
      } else {
        setDeleteError(result.error || "Failed to delete account");
      }
    } else {
      if (!deletePw) {
        setDeleteError("Password is required");
        return;
      }
      const result = await deleteAccount(deletePw);
      if (result.success) {
        showToast("Account deleted", "info");
        router.replace("/login");
      } else {
        setDeleteError(result.error || "Failed to delete account");
      }
    }
  }

  function handleLinkSocial(data: {
    provider: SocialProvider;
    providerUserId: string;
    providerEmail: string;
    providerName: string;
  }) {
    const result = linkSocial(data.provider, data.providerUserId, data.providerEmail, data.providerName);
    if (result.success) {
      setSocialLinks(getSocialLinks());
      showToast(`${PROVIDER_LABELS[data.provider]} linked`, "success");
    } else {
      showToast(result.error || "Failed to link account", "error");
    }
    setLinkProvider(null);
  }

  function handleUnlinkSocial(provider: SocialProvider) {
    const result = unlinkSocial(provider);
    if (result.success) {
      setSocialLinks(getSocialLinks());
      showToast(`${PROVIDER_LABELS[provider]} unlinked`, "info");
    } else {
      showToast(result.error || "Failed to unlink", "error");
    }
  }

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/chat"
            className="rounded-md p-1.5 text-text-secondary hover:bg-hover hover:text-text-primary"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-text-primary">Settings</h1>
        </div>

        {/* Profile Section */}
        <form onSubmit={handleProfileSave} className="mb-6 rounded-lg border border-border bg-sidebar p-6">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Profile</h2>

          {profileError && (
            <div className="mb-4 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {profileError}
            </div>
          )}

          <div className="mb-4 flex items-center gap-4">
            <Avatar name={name || "U"} size="xl" avatarUrl={avatarUrl} />
            <button
              type="button"
              onClick={() => setShowAvatarPicker(true)}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-hover hover:text-text-primary"
            >
              Change avatar
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="settings-name" className="block text-sm font-medium text-text-secondary">
                Name
              </label>
              <input
                id="settings-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-text-primary focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="settings-email" className="block text-sm font-medium text-text-secondary">
                Email
              </label>
              <input
                id="settings-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-text-primary focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="settings-bio" className="block text-sm font-medium text-text-secondary">
                Bio
              </label>
              <textarea
                id="settings-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="mt-1 block w-full resize-none rounded-md border border-border bg-input px-3 py-2 text-sm text-text-primary focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Tell others about yourself"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Save Profile
            </button>
          </div>
        </form>

        {/* Linked Accounts Section */}
        <div className="mb-6 rounded-lg border border-border bg-sidebar p-6">
          <h2 className="mb-1 text-sm font-semibold text-text-primary">Linked Accounts</h2>
          <p className="mb-4 text-xs text-text-secondary">
            Connect social accounts for easier sign-in
          </p>

          <div className="space-y-3">
            {(["google", "github", "discord"] as SocialProvider[]).map((provider) => {
              const link = socialLinks.find((l) => l.provider === provider);
              return (
                <div
                  key={provider}
                  className="flex items-center justify-between rounded-md border border-border px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    {PROVIDER_ICONS[provider]}
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {PROVIDER_LABELS[provider]}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {link ? link.providerEmail : "Not connected"}
                      </p>
                    </div>
                  </div>
                  {link ? (
                    <button
                      type="button"
                      onClick={() => handleUnlinkSocial(provider)}
                      className="rounded-md border border-red-500/50 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
                    >
                      Unlink
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setLinkProvider(provider)}
                      className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-hover hover:text-text-primary"
                    >
                      Connect
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Password Section */}
        {isSocialOnly ? (
          <div className="mb-6 rounded-lg border border-border bg-sidebar p-6">
            <h2 className="mb-2 text-sm font-semibold text-text-primary">Password</h2>
            <p className="text-xs text-text-secondary">
              Your account uses social login. Set a password to also enable email/password sign-in.
            </p>
          </div>
        ) : (
          <form onSubmit={handlePasswordSave} className="mb-6 rounded-lg border border-border bg-sidebar p-6">
            <h2 className="mb-4 text-sm font-semibold text-text-primary">Change Password</h2>

            {pwError && (
              <div className="mb-4 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {pwError}
              </div>
            )}

            <div className="space-y-4">
              <PasswordInput
                id="current-password"
                value={currentPw}
                onChange={setCurrentPw}
                label="Current Password"
              />
              <PasswordInput
                id="new-password"
                value={newPw}
                onChange={setNewPw}
                label="New Password"
                showStrength={true}
              />
              <PasswordInput
                id="confirm-new-password"
                value={confirmPw}
                onChange={setConfirmPw}
                label="Confirm New Password"
              />
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Update Password
              </button>
            </div>
          </form>
        )}

        {/* Danger Zone */}
        <div className="rounded-lg border border-red-500/30 bg-sidebar p-6">
          <h2 className="mb-2 text-sm font-semibold text-red-400">Danger Zone</h2>
          <p className="mb-4 text-xs text-text-secondary">
            Once you delete your account, there is no going back. Please be certain.
          </p>

          {!showDeleteConfirm ? (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-md border border-red-500/50 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10"
            >
              Delete my account
            </button>
          ) : (
            <div className="space-y-3">
              {deleteError && (
                <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {deleteError}
                </div>
              )}
              {isSocialOnly ? (
                <div>
                  <label className="block text-sm font-medium text-text-secondary">
                    Type <strong className="text-red-400">DELETE</strong> to confirm
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-text-primary focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="DELETE"
                  />
                </div>
              ) : (
                <PasswordInput
                  id="delete-password"
                  value={deletePw}
                  onChange={setDeletePw}
                  label="Enter your password to confirm"
                />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletePw("");
                    setDeleteConfirmText("");
                    setDeleteError("");
                  }}
                  className="rounded-md px-4 py-2 text-sm text-text-secondary hover:bg-hover"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
                >
                  Permanently delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showAvatarPicker && (
        <AvatarPicker
          currentAvatarUrl={avatarUrl}
          onSelect={handleAvatarSelect}
          onClose={() => setShowAvatarPicker(false)}
        />
      )}

      {linkProvider && (
        <SocialAuthModal
          provider={linkProvider}
          onAuth={handleLinkSocial}
          onClose={() => setLinkProvider(null)}
        />
      )}
    </div>
  );
}
