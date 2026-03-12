"use client";

import { useState } from "react";
import { SocialProvider } from "../contexts/auth-context";

interface MockAccount {
  id: string;
  name: string;
  email: string;
  initials: string;
  color: string;
}

const MOCK_ACCOUNTS: Record<SocialProvider, MockAccount[]> = {
  google: [
    { id: "google-1", name: "Alice Johnson", email: "alice@gmail.com", initials: "AJ", color: "bg-red-500" },
    { id: "google-2", name: "Bob Smith", email: "bob.smith@gmail.com", initials: "BS", color: "bg-blue-500" },
    { id: "google-3", name: "Carol White", email: "carol.w@gmail.com", initials: "CW", color: "bg-emerald-500" },
  ],
  github: [
    { id: "github-1", name: "alice-dev", email: "alice@github.com", initials: "AD", color: "bg-purple-500" },
    { id: "github-2", name: "bob-codes", email: "bob@github.com", initials: "BC", color: "bg-orange-500" },
    { id: "github-3", name: "carol-eng", email: "carol@github.com", initials: "CE", color: "bg-teal-500" },
  ],
  discord: [
    { id: "discord-1", name: "AliceGamer#1234", email: "alice@discord.com", initials: "AG", color: "bg-indigo-500" },
    { id: "discord-2", name: "BobStreams#5678", email: "bob@discord.com", initials: "BS", color: "bg-pink-500" },
    { id: "discord-3", name: "CarolMod#9012", email: "carol@discord.com", initials: "CM", color: "bg-amber-500" },
  ],
};

const PROVIDER_LABELS: Record<SocialProvider, string> = {
  google: "Google",
  github: "GitHub",
  discord: "Discord",
};

interface SocialAuthModalProps {
  provider: SocialProvider;
  onAuth: (data: {
    provider: SocialProvider;
    providerUserId: string;
    providerEmail: string;
    providerName: string;
  }) => void;
  onClose: () => void;
}

export function SocialAuthModal({ provider, onAuth, onClose }: SocialAuthModalProps) {
  const [loading, setLoading] = useState(false);
  const accounts = MOCK_ACCOUNTS[provider];
  const label = PROVIDER_LABELS[provider];

  function handleSelect(account: MockAccount) {
    setLoading(true);
    setTimeout(() => {
      onAuth({
        provider,
        providerUserId: account.id,
        providerEmail: account.email,
        providerName: account.name,
      });
    }, 400);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-sm rounded-lg border border-border bg-sidebar p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-indigo-500" />
            <p className="text-sm text-text-secondary">
              Signing in with {label}...
            </p>
          </div>
        ) : (
          <>
            <h3 className="mb-1 text-sm font-semibold text-text-primary">
              Sign in with {label}
            </h3>
            <p className="mb-4 text-xs text-text-secondary">
              Choose a mock account to continue
            </p>

            <div className="space-y-1">
              {accounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => handleSelect(account)}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-hover"
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${account.color}`}
                  >
                    {account.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">
                      {account.name}
                    </p>
                    <p className="truncate text-xs text-text-secondary">
                      {account.email}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={onClose}
                className="rounded-md px-4 py-2 text-sm text-text-secondary hover:bg-hover hover:text-text-primary"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
