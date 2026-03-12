"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { User } from "../types";
import {
  apiClient,
  setTokens,
  clearTokens,
  getAccessToken,
} from "../lib/api-client";
import { disconnectSocket } from "../hooks/useSocket";

export type SocialProvider = "google" | "github" | "discord";

export interface SocialLink {
  provider: SocialProvider;
  providerUserId: string;
  providerEmail: string;
  providerName: string;
  linkedAt: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (
    email: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<{ success: boolean; error?: string }>;
  register: (
    name: string,
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (updates: {
    name?: string;
    email?: string;
    bio?: string;
    avatarUrl?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => { success: boolean; error?: string };
  deleteAccount: (password: string) => { success: boolean; error?: string };
  socialLogin: (
    provider: SocialProvider,
    providerUserId: string,
    providerEmail: string,
    providerName: string
  ) => { success: boolean; error?: string };
  linkSocial: (
    provider: SocialProvider,
    providerUserId: string,
    providerEmail: string,
    providerName: string
  ) => { success: boolean; error?: string };
  unlinkSocial: (provider: SocialProvider) => {
    success: boolean;
    error?: string;
  };
  getSocialLinks: () => SocialLink[];
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session by validating stored JWT against the API
  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    apiClient
      .get<User>("/auth/me")
      .then((me) => setUser(me))
      .catch(() => clearTokens())
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string, _rememberMe = true) {
    try {
      const data = await apiClient.post<{
        user: User;
        accessToken: string;
        refreshToken: string;
      }>("/auth/login", { email, password });
      setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      return { success: true };
    } catch (e: unknown) {
      return {
        success: false,
        error: e instanceof Error ? e.message : "Login failed",
      };
    }
  }

  async function register(name: string, email: string, password: string) {
    try {
      const data = await apiClient.post<{
        user: User;
        accessToken: string;
        refreshToken: string;
      }>("/auth/register", { name, email, password });
      setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      return { success: true };
    } catch (e: unknown) {
      return {
        success: false,
        error: e instanceof Error ? e.message : "Registration failed",
      };
    }
  }

  function logout() {
    clearTokens();
    disconnectSocket();
    setUser(null);
  }

  async function updateProfile(updates: {
    name?: string;
    email?: string;
    bio?: string;
    avatarUrl?: string;
  }) {
    if (!user) return { success: false, error: "Not authenticated" };
    try {
      const updated = await apiClient.patch<User>("/users/me", updates);
      setUser(updated);
      return { success: true };
    } catch (e: unknown) {
      return {
        success: false,
        error: e instanceof Error ? e.message : "Update failed",
      };
    }
  }

  // ── Stubs for features not yet in backend ───────────────────────────────────

  function changePassword(_currentPassword: string, _newPassword: string) {
    return { success: false, error: "Password change not available yet" };
  }

  function deleteAccount(_password: string) {
    return { success: false, error: "Account deletion not available yet" };
  }

  function socialLogin(
    _provider: SocialProvider,
    _providerUserId: string,
    _providerEmail: string,
    _providerName: string
  ) {
    return { success: false, error: "Social login not available yet" };
  }

  function linkSocial(
    _provider: SocialProvider,
    _providerUserId: string,
    _providerEmail: string,
    _providerName: string
  ) {
    return { success: false, error: "Social linking not available yet" };
  }

  function unlinkSocial(_provider: SocialProvider) {
    return { success: false, error: "Social unlinking not available yet" };
  }

  function getSocialLinks(): SocialLink[] {
    return [];
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        updateProfile,
        changePassword,
        deleteAccount,
        socialLogin,
        linkSocial,
        unlinkSocial,
        getSocialLinks,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
