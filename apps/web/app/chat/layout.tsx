"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../contexts/auth-context";
import { useToast } from "../components/toast";
import { useSocket } from "../hooks/useSocket";
import { RoomList } from "../components/room-list";
import { ThemeToggle } from "../components/theme-toggle";
import { SoundToggle } from "../components/sound-toggle";
import { LogoutDialog } from "../components/logout-dialog";
import { useTabNotifications } from "../lib/tab-notifications";
import { usePushNotifications } from "../hooks/usePushNotifications";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout, resendVerification } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  // Initialize singleton socket connection as soon as user is authenticated
  useSocket();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);

  useTabNotifications(totalUnread);
  usePushNotifications();

  const handleUnreadChange = useCallback((total: number) => {
    setTotalUnread(total);
  }, []);

  function handleLogout() {
    logout();
    showToast("Logged out", "info");
    setShowLogoutDialog(false);
  }

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  const [verificationSent, setVerificationSent] = useState(false);

  async function handleResendVerification() {
    const result = await resendVerification();
    if (result.success) {
      showToast("Verification email sent", "success");
      setVerificationSent(true);
    } else {
      showToast(result.error || "Failed to send", "error");
    }
  }

  if (loading || !user) return null;

  return (
    <div className="flex h-screen flex-col">
      {/* Email verification banner */}
      {user.emailVerified === false && (
        <div className="flex items-center justify-center gap-2 bg-amber-500/10 px-4 py-2 text-sm text-amber-400">
          <span>Please verify your email address.</span>
          {verificationSent ? (
            <span className="text-green-400">Verification email sent!</span>
          ) : (
            <button
              onClick={handleResendVerification}
              className="font-medium underline hover:text-amber-300"
            >
              Resend verification email
            </button>
          )}
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border bg-sidebar transition-transform duration-200 md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h1 className="text-lg font-semibold text-text-primary">Chats</h1>
          <div className="flex items-center gap-1">
            <SoundToggle />
            <ThemeToggle />
            <Link
              href="/settings"
              className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-hover hover:text-text-primary"
              title="Settings"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </Link>
            <button
              onClick={() => setShowLogoutDialog(true)}
              className="rounded-md px-2 py-1.5 text-xs text-text-secondary transition-colors hover:bg-hover hover:text-text-primary"
            >
              Logout
            </button>
          </div>
        </div>
        <div className="px-4 py-2 text-xs text-text-secondary">
          Signed in as {user.name}
        </div>
        <RoomList onNavigate={() => setSidebarOpen(false)} onUnreadChange={handleUnreadChange} />
      </aside>

      {/* Main chat area */}
      <main className="flex flex-1 flex-col bg-chat">
        {/* Mobile header */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-1 text-text-secondary hover:bg-hover hover:text-text-primary"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <h1 className="text-sm font-semibold text-text-primary">Chats</h1>
        </div>
        {children}
      </main>

      {showLogoutDialog && (
        <LogoutDialog
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutDialog(false)}
        />
      )}
      </div>
    </div>
  );
}
