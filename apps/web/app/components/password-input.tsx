"use client";

import { useState } from "react";
import { getPasswordStrength } from "../lib/validation";

interface PasswordInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label: string;
  showStrength?: boolean;
}

const strengthConfig = {
  weak: { color: "bg-red-500", label: "Weak", width: "w-1/3" },
  medium: { color: "bg-amber-500", label: "Medium", width: "w-2/3" },
  strong: { color: "bg-emerald-500", label: "Strong", width: "w-full" },
};

export function PasswordInput({
  id,
  value,
  onChange,
  placeholder = "••••••••",
  label,
  showStrength = false,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const strength = getPasswordStrength(value);
  const config = strengthConfig[strength];

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-text-secondary"
      >
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="block w-full rounded-md border border-border bg-input px-3 py-2 pr-10 text-sm text-text-primary placeholder:text-text-secondary focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-secondary hover:text-text-primary"
        >
          {visible ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <path d="m1 1 22 22" />
              <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
      {showStrength && value.length > 0 && (
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1 flex-1 rounded-full bg-border">
            <div
              className={`h-1 rounded-full transition-all ${config.color} ${config.width}`}
            />
          </div>
          <span className="text-[10px] text-text-secondary">{config.label}</span>
        </div>
      )}
    </div>
  );
}
