"use client";

import { useEffect, useRef } from "react";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { useTheme } from "../contexts/theme-context";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  // Caller-controlled positioning. The composer wants bottom-full / left-0,
  // the message-actions menu wants bottom-full / right-0, etc. — hardcoding
  // either default would break the other call site.
  className?: string;
}

// Subset of emoji-mart's selection payload — we only care about `.native`.
interface EmojiMartEmoji {
  native: string;
  id: string;
  name: string;
}

export function EmojiPicker({
  onSelect,
  onClose,
  className = "absolute bottom-full left-0 z-50 mb-2",
}: EmojiPickerProps) {
  const { theme } = useTheme();
  const ref = useRef<HTMLDivElement>(null);

  // Close when the user clicks anywhere outside the picker. emoji-mart renders
  // its UI inside the wrapper div, so contains() catches in-picker clicks.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div ref={ref} className={className}>
      <Picker
        data={data}
        onEmojiSelect={(emoji: EmojiMartEmoji) => onSelect(emoji.native)}
        theme={theme}
        set="native"
        previewPosition="none"
        skinTonePosition="search"
        maxFrequentRows={2}
      />
    </div>
  );
}
