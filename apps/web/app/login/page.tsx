"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, SocialProvider } from "../contexts/auth-context";
import { useToast } from "../components/toast";
import { PasswordInput } from "../components/password-input";
import { SocialLoginButtons } from "../components/social-login-buttons";
import { SocialAuthModal } from "../components/social-auth-modal";
import { validateEmail } from "../lib/validation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [socialProvider, setSocialProvider] = useState<SocialProvider | null>(null);
  const { login, socialLogin, user, loading } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/chat");
    }
  }, [user, loading, router]);

  function handleSocialAuth(data: { provider: SocialProvider; providerUserId: string; providerEmail: string; providerName: string }) {
    const result = socialLogin(data.provider, data.providerUserId, data.providerEmail, data.providerName);
    if (result.success) {
      showToast("Welcome!", "success");
      router.push("/chat");
    } else {
      setError(result.error || "Social login failed");
    }
    setSocialProvider(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    if (!validateEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }

    const result = await login(email, password, rememberMe);
    if (result.success) {
      showToast("Welcome back!", "success");
      router.push("/chat");
    } else {
      setError(result.error || "Login failed");
    }
  }

  if (loading) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg bg-sidebar p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Sign in to your account
          </p>
        </div>

        <SocialLoginButtons onSelect={setSocialProvider} mode="login" />

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-text-secondary"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="you@example.com"
            />
          </div>

          <PasswordInput
            id="password"
            value={password}
            onChange={setPassword}
            label="Password"
          />

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-border bg-input accent-indigo-600"
            />
            <span className="text-sm text-text-secondary">Remember me</span>
          </label>

          <button
            type="submit"
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
          >
            Sign in
          </button>
        </form>

        <p className="text-center text-sm text-text-secondary">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>

      {socialProvider && (
        <SocialAuthModal
          provider={socialProvider}
          onAuth={handleSocialAuth}
          onClose={() => setSocialProvider(null)}
        />
      )}
    </div>
  );
}
