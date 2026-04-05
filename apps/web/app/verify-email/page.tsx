"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiClient } from "../lib/api-client";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    token ? "loading" : "error"
  );
  const [errorMsg, setErrorMsg] = useState(
    token ? "" : "Invalid verification link — no token found"
  );

  useEffect(() => {
    if (!token) return;

    apiClient
      .post("/auth/verify-email", { token })
      .then(() => setStatus("success"))
      .catch((e: unknown) => {
        setStatus("error");
        setErrorMsg(
          e instanceof Error ? e.message : "Verification failed"
        );
      });
  }, [token]);

  if (status === "loading") {
    return (
      <div className="text-center text-sm text-text-secondary">
        Verifying your email...
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="space-y-4">
        <div className="rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-400">
          Your email has been verified successfully!
        </div>
        <Link
          href="/chat"
          className="block w-full rounded-md bg-indigo-600 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-indigo-500"
        >
          Go to chat
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
        {errorMsg}
      </div>
      <Link
        href="/login"
        className="block w-full rounded-md bg-indigo-600 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-indigo-500"
      >
        Go to sign in
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg bg-sidebar p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            Email Verification
          </h1>
        </div>

        <Suspense>
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  );
}
