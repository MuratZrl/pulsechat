"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../contexts/auth-context";
import { useToast } from "../components/toast";
import { PasswordInput } from "../components/password-input";
import { validateEmail, validatePassword } from "../lib/validation";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const { register, user, loading } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/chat");
    }
  }, [user, loading, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!name || !email || !password) {
      setError("Please fill in all fields");
      return;
    }

    if (!validateEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }

    const pwError = validatePassword(password);
    if (pwError) {
      setError(pwError);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const result = await register(name, email, password);
    if (result.success) {
      showToast("Account created!", "success");
      router.push("/chat");
    } else {
      setError(result.error || "Registration failed");
    }
  }

  if (loading) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg bg-sidebar p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            Create account
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Get started with PulseChat
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-text-secondary"
            >
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Your name"
            />
          </div>

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
            showStrength={true}
          />

          <PasswordInput
            id="confirmPassword"
            value={confirmPassword}
            onChange={setConfirmPassword}
            label="Confirm Password"
          />

          <button
            type="submit"
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
          >
            Create account
          </button>
        </form>

        <p className="text-center text-sm text-text-secondary">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>

    </div>
  );
}
