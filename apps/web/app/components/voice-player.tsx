"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Attachment } from "../types";

interface VoicePlayerProps {
  attachment: Attachment;
  isOwn: boolean;
}

export function VoicePlayer({ attachment, isOwn }: VoicePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const duration = attachment.duration || 0;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      audioRef.current?.pause();
      if (intervalRef.current) clearInterval(intervalRef.current);
      setIsPlaying(false);
    } else {
      // Try real playback
      if (attachment.url && !attachment.url.startsWith("mock-")) {
        if (!audioRef.current) {
          audioRef.current = new Audio(attachment.url);
          audioRef.current.onended = () => {
            setIsPlaying(false);
            setProgress(0);
            if (intervalRef.current) clearInterval(intervalRef.current);
          };
        }
        audioRef.current.play();
      }

      // Visual simulation
      setIsPlaying(true);
      setProgress(0);
      const step = 100 / (duration || 5);
      intervalRef.current = setInterval(() => {
        setProgress((p) => {
          if (p >= 100) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setIsPlaying(false);
            return 0;
          }
          return p + step;
        });
      }, 1000);
    }
  }, [isPlaying, attachment.url, duration]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Mock waveform bars
  const bars = Array.from({ length: 24 }, (_, i) => {
    const seed = (i * 7 + 3) % 13;
    return 4 + seed * 1.5;
  });

  return (
    <div className={`flex items-center gap-2 rounded-lg py-1 ${isOwn ? "" : ""}`}>
      {/* Play/Pause button */}
      <button
        onClick={togglePlay}
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-colors ${
          isOwn ? "bg-indigo-500 hover:bg-indigo-400" : "bg-indigo-600 hover:bg-indigo-500"
        } text-white`}
      >
        {isPlaying ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Waveform */}
      <div className="flex flex-1 items-center gap-px">
        {bars.map((h, i) => {
          const filled = progress > (i / bars.length) * 100;
          return (
            <div
              key={i}
              className={`w-1 rounded-full transition-colors ${
                filled
                  ? isOwn ? "bg-white" : "bg-indigo-500"
                  : isOwn ? "bg-indigo-300/50" : "bg-text-secondary/30"
              }`}
              style={{ height: `${h}px` }}
            />
          );
        })}
      </div>

      {/* Duration */}
      <span className={`flex-shrink-0 text-[10px] ${isOwn ? "text-indigo-200" : "text-text-secondary"}`}>
        {formatTime(duration)}
      </span>
    </div>
  );
}
