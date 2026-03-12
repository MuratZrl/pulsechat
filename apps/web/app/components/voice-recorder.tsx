"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Attachment } from "../types";
import { getAccessToken } from "../lib/api-client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
const SERVER_ORIGIN = API_BASE.replace(/\/api$/, "");

interface VoiceRecorderProps {
  onSend: (attachment: Attachment) => void;
  onCancel: () => void;
}

export function VoiceRecorder({ onSend, onCancel }: VoiceRecorderProps) {
  const [state, setState] = useState<"idle" | "recording" | "recorded" | "uploading">("idle");
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
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
        blobRef.current = blob;
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
      // Microphone not available — mock mode
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
      // Mock mode — no real blob
      setState("recorded");
    }
  }, []);

  const handleSend = useCallback(async () => {
    setUploadError(null);

    if (blobRef.current) {
      // Upload real audio blob
      setState("uploading");
      try {
        const formData = new FormData();
        formData.append("file", blobRef.current, "voice-message.webm");

        const token = getAccessToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`${API_BASE}/upload`, {
          method: "POST",
          headers,
          body: formData,
        });

        if (!res.ok) throw new Error("Upload failed");

        const data = await res.json() as { url: string; name: string; size: string; type: string };
        const attachment: Attachment = {
          name: "Voice message",
          type: "voice",
          size: `${duration}s`,
          url: data.url.startsWith("http") ? data.url : `${SERVER_ORIGIN}${data.url}`,
          duration,
        };
        onSend(attachment);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed");
        setState("recorded");
      }
    } else {
      // Mock/fallback
      const attachment: Attachment = {
        name: "Voice message",
        type: "voice",
        size: `${duration}s`,
        url: audioUrl || `mock-voice-${Date.now()}`,
        duration,
      };
      onSend(attachment);
    }
  }, [audioUrl, duration, onSend]);

  const handleDelete = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    blobRef.current = null;
    setAudioUrl(null);
    setDuration(0);
    setUploadError(null);
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
    <div className="flex flex-col border-t border-border bg-sidebar">
      <div className="flex items-center gap-2 px-4 py-2.5">
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

        {(state === "recorded" || state === "uploading") && (
          <>
            {/* Playback */}
            <button
              onClick={() => {
                if (audioUrl) {
                  if (!audioRef.current) audioRef.current = new Audio(audioUrl);
                  audioRef.current.play();
                }
              }}
              disabled={state === "uploading"}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
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
              disabled={state === "uploading"}
              className="rounded-md p-1.5 text-text-secondary hover:bg-hover hover:text-red-400 disabled:opacity-50"
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
              disabled={state === "uploading"}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-1.5"
            >
              {state === "uploading" && (
                <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {state === "uploading" ? "Sending..." : "Send"}
            </button>

            {/* Cancel */}
            <button
              onClick={() => {
                handleDelete();
                onCancel();
              }}
              disabled={state === "uploading"}
              className="text-xs text-text-secondary hover:text-text-primary disabled:opacity-50"
            >
              Cancel
            </button>
          </>
        )}
      </div>

      {uploadError && (
        <p className="px-4 pb-2 text-xs text-red-400">{uploadError}</p>
      )}
    </div>
  );
}
