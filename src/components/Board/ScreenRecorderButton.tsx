"use client";

import React, { useState, useRef, useEffect } from "react";
import { Video, Square, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { saveRecordingAction } from "@/app/actions/recording";

const API_BASE =
  process.env.NEXT_PUBLIC_RECORDER_API_URL ||
  "https://recorder-api.shivam-gupta.in";

const CHUNK_INTERVAL_MS = 10000; // 10s per chunk

type RecordingPhase = "idle" | "recording" | "merging" | "done" | "error";

interface ScreenRecorderButtonProps {
  sessionId?: string;
  role?: "teacher" | "student";
}

export default function ScreenRecorderButton({
  sessionId,
  role = "teacher",
}: ScreenRecorderButtonProps) {
  const [phase, setPhase] = useState<RecordingPhase>("idle");
  const [chunkCount, setChunkCount] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const stoppingRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const canvasTickRef = useRef<NodeJS.Timeout | null>(null);

  // Timer for elapsed recording duration
  useEffect(() => {
    if (phase === "recording") {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (canvasTickRef.current) clearInterval(canvasTickRef.current);
    };
  }, [phase]);

  // Clean up media streams on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const uploadChunk = async (
    blob: Blob,
    chunkIdx: number,
    sessId: string
  ): Promise<boolean> => {
    const formData = new FormData();
    formData.append("sessionId", sessId);
    formData.append("index", chunkIdx.toString());
    formData.append(
      "chunk",
      blob,
      `chunk_${chunkIdx.toString().padStart(4, "0")}.webm`
    );

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(`${API_BASE}/api/upload-chunk`, {
          method: "POST",
          body: formData,
        });
        if (res.ok) return true;
      } catch {
        console.warn(`Chunk ${chunkIdx} upload attempt ${attempt} failed`);
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    return false;
  };

  const recordingLoop = async (stream: MediaStream) => {
    let index = 0;
    while (!stoppingRef.current && stream.active) {
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
        ? "video/webm;codecs=vp8,opus"
        : "video/webm";

      const mr = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 3000000,
      });
      mediaRecorderRef.current = mr;

      const chunkPromise = new Promise<Blob | null>((resolve) => {
        const parts: Blob[] = [];
        mr.ondataavailable = (ev) => {
          if (ev.data.size > 0) parts.push(ev.data);
        };
        mr.onstop = () => {
          if (parts.length === 0) resolve(null);
          else resolve(new Blob(parts, { type: mimeType }));
        };
      });

      mr.start();

      await new Promise((r) => setTimeout(r, CHUNK_INTERVAL_MS));

      if (mr.state !== "inactive") {
        mr.stop();
      }

      const blob = await chunkPromise;
      if (!blob || stoppingRef.current) break;

      const currentIdx = index++;
      setChunkCount(index);
      uploadChunk(blob, currentIdx, sessionIdRef.current!).catch(console.error);
    }
  };

  const handleStart = async () => {
    try {
      setPhase("idle");
      setElapsedSeconds(0);
      setChunkCount(0);
      setDownloadUrl(null);
      stoppingRef.current = false;

      // Start session on Go backend
      const sessionRes = await fetch(`${API_BASE}/api/sessions/start`, {
        method: "POST",
      });
      if (!sessionRes.ok) {
        throw new Error("Failed to initialize recording session on backend");
      }
      const sessionData = await sessionRes.json();
      sessionIdRef.current = sessionData.sessionId;

      // Get current tab screen stream for full whiteboard class recording (1080p HD)
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
          displaySurface: "browser",
        },
        preferCurrentTab: true,
        selfBrowserSurface: "include",
        surfaceSwitching: "include",
        audio: true,
      } as DisplayMediaStreamOptions & {
        preferCurrentTab?: boolean;
        selfBrowserSurface?: string;
        surfaceSwitching?: string;
      });

      streamRef.current = stream;

      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (!stoppingRef.current) handleStop();
      });

      setPhase("recording");
      toast.success("Recording started!");
      recordingLoop(stream);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("Failed to start recording:", err);
      toast.error(errorMsg || "Could not start screen recording");
      setPhase("error");
    }
  };

  const handleStop = async () => {
    if (stoppingRef.current || phase !== "recording") return;
    stoppingRef.current = true;

    if (canvasTickRef.current) {
      clearInterval(canvasTickRef.current);
      canvasTickRef.current = null;
    }

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    setPhase("merging");
    toast.loading("Submitting recording for processing...", { id: "recorder-toast" });

    try {
      const res = await fetch(`${API_BASE}/api/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          resolution: "720p",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.downloadUrl) {
        throw new Error(data.error || "Failed to submit merge job");
      }

      // Merge is now async (202 Accepted) — save predicted URL immediately
      const finalVideoUrl = data.fullUrl || `${API_BASE}${data.downloadUrl}`;
      setDownloadUrl(finalVideoUrl);
      setPhase("done");

      // Optimistic save: store predicted URL with status "processing"
      // The Go worker will update it to "completed" via api.tutorarc.cloud callback
      const activeSessionId = sessionId || sessionIdRef.current;
      if (activeSessionId) {
        const dbResult = await saveRecordingAction(
          activeSessionId,
          finalVideoUrl,
          "720p",
          data.chunkCount || 1,
          "processing"
        );

        if (!dbResult.success) {
          // console.warn("Direct Server Action save failed, trying local API route fallback...", dbResult.error);
          // await fetch("/api/recordings/save", {
          //   method: "POST",
          //   headers: { "Content-Type": "application/json" },
          //   body: JSON.stringify({
          //     sessionId: activeSessionId,
          //     recordingUrl: finalVideoUrl,
          //     resolution: "720p",
          //     chunkCount: data.chunkCount || 1,
          //   }),
          // }).catch((err) => console.error("API route save fallback failed:", err));
          console.warn("Optimistic recording save failed:", dbResult.error);
        }
      }

      toast.success("Recording saved! Processing in background...", { id: "recorder-toast" });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("Merge error:", err);
      setPhase("error");
      toast.error(errorMsg || "Failed to submit recording", {
        id: "recorder-toast",
      });
    }
  };

  if (role !== "teacher") return null;

  return (
    <div className="flex items-center gap-1.5 shrink-0 px-2 border-r border-border/50 h-8">
      {phase === "idle" && (
        <button
          type="button"
          onClick={handleStart}
          className="flex items-center gap-1.5 p-1.5 h-8 rounded-[5px] border border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all duration-300 shadow-sm"
          title="Start Recording Screen"
        >
          <Video size={16} />
          <span className="hidden xl:block text-[10px] font-black uppercase tracking-wider">
            Record
          </span>
        </button>
      )}

      {phase === "recording" && (
        <button
          type="button"
          onClick={handleStop}
          className="flex items-center gap-1.5 p-1.5 h-8 rounded-[5px] border border-red-500 bg-red-500 text-white hover:bg-red-600 transition-all duration-300 shadow-md animate-pulse"
          title="Click to Stop Recording"
        >
          <Square size={14} className="fill-current" />
          <span className="text-[10px] font-black tracking-wider">
            {formatTimer(elapsedSeconds)} ({chunkCount})
          </span>
        </button>
      )}

      {phase === "merging" && (
        <div className="flex items-center gap-1.5 p-1.5 h-8 rounded-[5px] border border-amber-500/30 bg-amber-500/10 text-amber-500">
          <Loader2 size={16} className="animate-spin" />
          <span className="hidden xl:block text-[10px] font-black uppercase tracking-wider">
            Merging...
          </span>
        </div>
      )}

      {phase === "done" && downloadUrl && (
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          download
          className="flex items-center gap-1.5 p-1.5 h-8 rounded-[5px] border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-all duration-300 shadow-sm"
          title="Download Recording"
        >
          <Download size={16} />
          <span className="hidden xl:block text-[10px] font-black uppercase tracking-wider">
            Download
          </span>
        </a>
      )}

      {phase === "error" && (
        <button
          type="button"
          onClick={handleStart}
          className="flex items-center gap-1.5 p-1.5 h-8 rounded-[5px] border border-red-500/40 bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all duration-300"
          title="Retry Recording"
        >
          <Video size={16} />
          <span className="hidden xl:block text-[10px] font-black uppercase tracking-wider">
            Retry
          </span>
        </button>
      )}
    </div>
  );
}
