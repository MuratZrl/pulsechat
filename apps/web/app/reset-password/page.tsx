"use client";

import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiClient } from "../lib/api-client";
import { PasswordInput } from "../components/password-input";
import { validatePassword } from "../lib/validation";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const router = useRouter();

  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Invalid reset link — no token found");
      return;
    }

    const pwErr = validatePassword(newPw);
    if (pwErr) {
      setError(pwErr);
      return;
    }

    if (newPw !== confirmPw) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post("/auth/reset-password", {
        token,
        newPassword: newPw,
      });
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="space-y-4">
        <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
          Invalid reset link. Please request a new one.
        </div>
        <Link
          href="/forgot-password"
          className="block w-full rounded-md bg-indigo-600 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-indigo-500"
        >
          Request new reset link
        </Link>
      </div>
    );
  }

  return success ? (
    <div className="space-y-4">
      <div className="rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-400">
        Password reset successfully! Redirecting to sign in...
      </div>
    </div>
  ) : (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      <PasswordInput
        id="new-password"
        value={newPw}
        onChange={setNewPw}
        label="New Password"
        showStrength={true}
      />

      <PasswordInput
        id="confirm-password"
        value={confirmPw}
        onChange={setConfirmPw}
        label="Confirm Password"
      />

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
      >
        {submitting ? "Resetting..." : "Reset password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg bg-sidebar p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            Set new password
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Enter your new password below
          </p>
        </div>

        <Suspense>
          <ResetPasswordForm />
        </Suspense>

        <p className="text-center text-sm text-text-secondary">
          <Link
            href="/login"
            className="font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
