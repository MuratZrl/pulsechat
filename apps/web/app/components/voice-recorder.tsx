"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Attachment } from "../types";

interface VoiceRecorderProps {
  onSend: (attachment: Attachment) => void;
  onCancel: () => void;
}

export function VoiceRecorder({ onSend, onCancel }: VoiceRecorderProps) {
  const [state, setState] = useState<"idle" | "recording" | "recorded">("idle");
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const MAX_DURATION = 60;

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setState("recorded");
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setState("recording");
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((d) => {
          if (d >= MAX_DURATION - 1) {
            stopRecording();
            return d + 1;
          }
          return d + 1;
        });
      }, 1000);
    } catch {
      // Microphone not available — create a mock recording
      setState("recording");
      setDuration(0);
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    } else {
      // Mock mode — create fake audio data
      setState("recorded");
    }
  }, []);

  const handleSend = useCallback(() => {
    const attachment: Attachment = {
      name: "Voice message",
      type: "voice",
      size: `${duration}s`,
      url: audioUrl || `mock-voice-${Date.now()}`,
      duration,
    };
    onSend(attachment);
  }, [audioUrl, duration, onSend]);

  const handleDelete = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setDuration(0);
    setState("idle");
  }, [audioUrl]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // Auto-start recording
  useEffect(() => {
    if (state === "idle") startRecording();
  }, []);

  return (
    <div className="flex items-center gap-2 border-t border-border bg-sidebar px-4 py-2.5">
      {state === "recording" && (
        <>
          {/* Recording indicator */}
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            <span className="text-xs font-medium text-red-400">
              {formatTime(duration)}
            </span>
          </div>

          {/* Waveform bars */}
          <div className="flex flex-1 items-center justify-center gap-0.5">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="w-1 rounded-full bg-indigo-400"
                style={{
                  height: `${8 + Math.random() * 16}px`,
                  animation: `pulse ${0.5 + Math.random() * 0.5}s ease-in-out infinite alternate`,
                  animationDelay: `${i * 0.05}s`,
                }}
              />
            ))}
          </div>

          {/* Stop button */}
          <button
            onClick={stopRecording}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white transition-colors hover:bg-red-400"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
          </button>

          {/* Cancel */}
          <button
            onClick={() => {
              stopRecording();
              onCancel();
            }}
            className="text-xs text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
        </>
      )}

      {state === "recorded" && (
        <>
          {/* Playback */}
          <button
            onClick={() => {
              if (audioUrl) {
                if (!audioRef.current) audioRef.current = new Audio(audioUrl);
                audioRef.current.play();
              }
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white transition-colors hover:bg-indigo-500"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>

          <div className="flex flex-1 items-center gap-2">
            {/* Progress bar placeholder */}
            <div className="flex-1 rounded-full bg-hover h-1.5">
              <div className="h-full w-full rounded-full bg-indigo-500" />
            </div>
            <span className="text-xs text-text-secondary">{formatTime(duration)}</span>
          </div>

          {/* Delete */}
          <button
            onClick={handleDelete}
            className="rounded-md p-1.5 text-text-secondary hover:bg-hover hover:text-red-400"
            title="Delete recording"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>

          {/* Send */}
          <button
            onClick={handleSend}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500"
          >
            Send
          </button>

          {/* Cancel */}
          <button
            onClick={() => {
              handleDelete();
              onCancel();
            }}
            className="text-xs text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
        </>
      )}
    </div>
  );
}
