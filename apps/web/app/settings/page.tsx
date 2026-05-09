"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../contexts/auth-context";
import { useToast } from "../components/toast";
import { Avatar } from "../components/avatar";
import { AvatarPicker, AvatarSelection } from "../components/avatar-picker";
import { PasswordInput } from "../components/password-input";
import { validatePassword } from "../lib/validation";
import { apiClient } from "../lib/api-client";
import { UserProfile } from "../types";

export default function SettingsPage() {
  const {
    user, loading, updateProfile, changePassword, deleteAccount,
  } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  // Profile state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  // Two parallel slots, mirroring the backend's mutual-exclusion rule. At
  // most one is non-null at any moment. The avatar picker emits both fields
  // explicitly on Apply so we always know the user's intent.
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPreset, setAvatarPreset] = useState<string | null>(null);
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
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }
    if (user) {
      setName(user.name);
      setEmail(user.email);
      // Fetch full profile from API for bio + avatar fields
      apiClient
        .get<UserProfile>("/users/me")
        .then((profile) => {
          setBio(profile.bio || "");
          setAvatarUrl(profile.avatarUrl ?? null);
          setAvatarPreset(profile.avatarPreset ?? null);
        })
        .catch(() => {
          // Fallback: use what's on the user object
        });
    }
  }, [user, loading, router]);

  async function handleProfileSave(e: FormEvent) {
    e.preventDefault();
    setProfileError("");
    if (!name.trim()) {
      setProfileError("Name is required");
      return;
    }
    // Send both avatar fields explicitly. The DTO/service treats `null` as
    // "clear this column", so sending the inactive slot as null guarantees
    // the DB ends up consistent (preset xor custom URL, never both).
    // Email is read-only — backend doesn't accept email updates, so only
    // send the fields it actually persists.
    const result = await updateProfile({
      name: name.trim(),
      bio,
      avatarUrl,
      avatarPreset,
    });
    if (result.success) {
      showToast("Profile updated", "success");
    } else {
      setProfileError(result.error || "Failed to update profile");
    }
  }

  function handleAvatarSelect(selection: AvatarSelection) {
    setAvatarUrl(selection.avatarUrl);
    setAvatarPreset(selection.avatarPreset);
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
            <Avatar
              name={name || "U"}
              size="xl"
              avatarUrl={avatarUrl}
              avatarPreset={avatarPreset}
            />
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
                Email (cannot be changed)
              </label>
              <input
                id="settings-email"
                type="email"
                value={email}
                disabled={true}
                className="mt-1 block w-full cursor-not-allowed rounded-md border border-border bg-input px-3 py-2 text-sm text-text-secondary opacity-60 focus:outline-none"
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

        {/* Password Section */}
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
              <PasswordInput
                id="delete-password"
                value={deletePw}
                onChange={setDeletePw}
                label="Enter your password to confirm"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletePw("");
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
          currentAvatarPreset={avatarPreset}
          onSelect={handleAvatarSelect}
          onClose={() => setShowAvatarPicker(false)}
        />
      )}
    </div>
  );
}
