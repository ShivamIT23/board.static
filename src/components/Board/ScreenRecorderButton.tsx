"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Video, Square, Loader2, Download, ChevronDown, Gauge, Wifi, Monitor, Cpu } from "lucide-react";
import { toast } from "sonner";
import { saveRecordingAction } from "@/app/actions/recording";

const API_BASE =
  process.env.NEXT_PUBLIC_RECORDER_API_URL ||
  "https://recording.shivam-gupta.in";

const CHUNK_INTERVAL_MS = 10000; // 10s per chunk

type RecordingPhase = "idle" | "recording" | "merging" | "done" | "error";
type ResolutionKey = "auto" | "360p" | "480p" | "720p" | "1080p";

// ─── Resolution Presets ─────────────────────────────────────────────
interface ResolutionPreset {
  label: string;
  width: number;
  height: number;
  bitrate: number;      // videoBitsPerSecond for MediaRecorder
  frameRate: number;
  mergeKey: string;      // sent to Go backend for ffmpeg
}

const RESOLUTION_PRESETS: Record<Exclude<ResolutionKey, "auto">, ResolutionPreset> = {
  "360p": { label: "360p",  width: 640,  height: 360,  bitrate: 1_000_000, frameRate: 24, mergeKey: "360p" },
  "480p": { label: "480p",  width: 854,  height: 480,  bitrate: 1_500_000, frameRate: 24, mergeKey: "480p" },
  "720p": { label: "720p",  width: 1280, height: 720,  bitrate: 3_000_000, frameRate: 30, mergeKey: "720p" },
  "1080p":{ label: "1080p", width: 1920, height: 1080, bitrate: 5_000_000, frameRate: 30, mergeKey: "1080p" },
};

// ─── Auto-Detection Logic ───────────────────────────────────────────
// Navigator.connection types (Chrome/Edge only)
interface NetworkInformation {
  downlink?: number;       // Mbps estimated bandwidth
  effectiveType?: string;  // "slow-2g" | "2g" | "3g" | "4g"
  rtt?: number;            // Round-trip time in ms
}

function detectBestResolution(): { key: Exclude<ResolutionKey, "auto">; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0; // higher = can handle higher resolution

  // ── 1. Upload Bandwidth (most important, weight 40%) ──
  const conn = (navigator as unknown as { connection?: NetworkInformation }).connection;
  if (conn) {
    const downlink = conn.downlink ?? 10; // Mbps
    const effectiveType = conn.effectiveType ?? "4g";

    if (effectiveType === "slow-2g" || effectiveType === "2g" || downlink < 1) {
      score += 0;
      reasons.push(`Bandwidth: ~${downlink.toFixed(1)} Mbps (slow) → 360p`);
    } else if (effectiveType === "3g" || downlink < 3) {
      score += 1;
      reasons.push(`Bandwidth: ~${downlink.toFixed(1)} Mbps (moderate) → 480p`);
    } else if (downlink < 8) {
      score += 2;
      reasons.push(`Bandwidth: ~${downlink.toFixed(1)} Mbps (good) → 720p`);
    } else {
      score += 3;
      reasons.push(`Bandwidth: ~${downlink.toFixed(1)} Mbps (fast) → 1080p`);
    }
  } else {
    // No connection API — assume moderate
    score += 2;
    reasons.push("Bandwidth: unknown (assuming good) → 720p");
  }

  // ── 2. Screen Resolution (weight 30%) ──
  const screenH = window.screen.height * (window.devicePixelRatio || 1);
  if (screenH < 600) {
    score += 0;
    reasons.push(`Screen: ${window.screen.width}×${window.screen.height} (small) → 360p`);
  } else if (screenH < 900) {
    score += 1;
    reasons.push(`Screen: ${window.screen.width}×${window.screen.height} → 480p`);
  } else if (screenH < 1440) {
    score += 2;
    reasons.push(`Screen: ${window.screen.width}×${window.screen.height} → 720p`);
  } else {
    score += 3;
    reasons.push(`Screen: ${window.screen.width}×${window.screen.height} (HiDPI/4K) → 1080p`);
  }

  // ── 3. Device Performance (weight 30%) ──
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8; // GB

  if (cores <= 2 || memory <= 2) {
    score += 0;
    reasons.push(`Device: ${cores} cores, ${memory}GB RAM (low-end) → 360p`);
  } else if (cores <= 4 || memory <= 4) {
    score += 1;
    reasons.push(`Device: ${cores} cores, ${memory}GB RAM (mid-range) → 480p`);
  } else if (cores <= 8) {
    score += 2;
    reasons.push(`Device: ${cores} cores, ${memory}GB RAM (good) → 720p`);
  } else {
    score += 3;
    reasons.push(`Device: ${cores} cores, ${memory}GB RAM (powerful) → 1080p`);
  }

  // ── Final Score → Resolution (max score = 9) ──
  // Score 0-2: 360p, 3-4: 480p, 5-6: 720p, 7-9: 1080p
  let picked: Exclude<ResolutionKey, "auto">;
  if (score <= 2) picked = "360p";
  else if (score <= 4) picked = "480p";
  else if (score <= 6) picked = "720p";
  else picked = "1080p";

  return { key: picked, reasons };
}

// ─── Component ──────────────────────────────────────────────────────
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

  // Resolution state
  const [selectedResolution, setSelectedResolution] = useState<ResolutionKey>("auto");
  const [autoDetectedRes, setAutoDetectedRes] = useState<Exclude<ResolutionKey, "auto"> | null>(null);
  const [autoReasons, setAutoReasons] = useState<string[]>([]);
  const [showResDropdown, setShowResDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const micGainRef = useRef<GainNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const stoppingRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const canvasTickRef = useRef<NodeJS.Timeout | null>(null);
  const activeResolutionRef = useRef<Exclude<ResolutionKey, "auto">>("720p");

  // Listen for LiveKit mic toggle events to mute/unmute recording mic
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (micGainRef.current) {
        micGainRef.current.gain.value = detail?.enabled ? 1 : 0;
        console.log(`[Recorder] Mic gain set to ${detail?.enabled ? 1 : 0}`);
      }
    };
    window.addEventListener("recorder-mic-toggle", handler);
    return () => window.removeEventListener("recorder-mic-toggle", handler);
  }, []);

  // Run auto-detection on mount
  useEffect(() => {
    const result = detectBestResolution();
    setAutoDetectedRes(result.key);
    setAutoReasons(result.reasons);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowResDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Resolve the effective resolution key
  const effectiveRes: Exclude<ResolutionKey, "auto"> =
    selectedResolution === "auto" ? (autoDetectedRes ?? "720p") : selectedResolution;

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

  const handleStart = async () => {
    try {
      setPhase("idle");
      setElapsedSeconds(0);
      setChunkCount(0);
      setDownloadUrl(null);
      stoppingRef.current = false;

      // Mobile Browser Check: getDisplayMedia is disabled by W3C specification on mobile browsers
      if (typeof navigator === "undefined" || !navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== "function") {
        toast.error("Screen recording is supported on Desktop & Laptop browsers. Mobile web browsers do not allow in-browser screen capture.");
        return;
      }


      // Re-detect if on auto (connection conditions may have changed)
      let resKey = effectiveRes;
      if (selectedResolution === "auto") {
        const fresh = detectBestResolution();
        setAutoDetectedRes(fresh.key);
        setAutoReasons(fresh.reasons);
        resKey = fresh.key;
      }
      activeResolutionRef.current = resKey;
      const preset = RESOLUTION_PRESETS[resKey];

      toast.info(`Recording at ${preset.label} (${preset.width}×${preset.height})`, { duration: 2000 });

      // Start session on Go backend (pass current class sessionId if available)
      const sessionRes = await fetch(`${API_BASE}/api/sessions/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId || undefined }),
      });
      if (!sessionRes.ok) {
        throw new Error("Failed to initialize recording session on backend");
      }
      const sessionData = await sessionRes.json();
      sessionIdRef.current = sessionData.sessionId;


      // Get screen stream at the selected resolution
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: preset.width },
          height: { ideal: preset.height },
          frameRate: { ideal: preset.frameRate },
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

      streamRef.current = displayStream;

      // Capture teacher's microphone audio separately.
      // getDisplayMedia only captures tab/system audio — the teacher's mic
      // audio goes directly to LiveKit over WebRTC, so it's NOT in the tab output.
      // We use getUserMedia to grab the mic and mix both audio sources together.
      let micStream: MediaStream | null = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        });
        micStreamRef.current = micStream;
        console.log("[Recorder] Microphone captured for recording");
      } catch (micErr) {
        console.warn("[Recorder] Could not capture microphone — recording without mic audio:", micErr);
      }

      // Mix audio sources: tab audio (from getDisplayMedia) + mic audio (from getUserMedia)
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const destination = audioCtx.createMediaStreamDestination();

      // Add tab/system audio tracks if present
      const tabAudioTracks = displayStream.getAudioTracks();
      if (tabAudioTracks.length > 0) {
        const tabSource = audioCtx.createMediaStreamSource(new MediaStream(tabAudioTracks));
        tabSource.connect(destination);
        console.log("[Recorder] Tab audio mixed into recording");
      }

      // Add microphone audio if captured — routed through a GainNode
      // so LiveKit mic toggle can mute/unmute recording mic in real-time
      if (micStream && micStream.getAudioTracks().length > 0) {
        const micSource = audioCtx.createMediaStreamSource(micStream);
        const micGain = audioCtx.createGain();
        micGain.gain.value = 1; // start unmuted
        micGainRef.current = micGain;
        micSource.connect(micGain);
        micGain.connect(destination);
        console.log("[Recorder] Mic audio mixed into recording (with gain control)");
      }

      // Build the final combined stream: display video + mixed audio
      const combinedStream = new MediaStream([
        ...displayStream.getVideoTracks(),
        ...destination.stream.getAudioTracks(),
      ]);

      displayStream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (!stoppingRef.current) handleStop();
      });

      setPhase("recording");
      toast.success("Recording started!");
      recordingLoop(combinedStream, preset);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("Failed to start recording:", err);
      toast.error(errorMsg || "Could not start screen recording");
      setPhase("error");
    }
  };

  const handleStop = useCallback(async () => {
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
    // Clean up mic stream and audio context
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    const resKey = activeResolutionRef.current;
    const preset = RESOLUTION_PRESETS[resKey];

    setPhase("merging");
    toast.loading("Submitting recording for processing...", { id: "recorder-toast" });

    try {
      const res = await fetch(`${API_BASE}/api/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          resolution: preset.mergeKey,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.downloadUrl) {
        throw new Error(data.error || "Failed to submit merge job");
      }

      // Merge is now async (202 Accepted) — save predicted URL immediately
      const rawUrl = data.fullUrl || data.downloadUrl || "";
      const finalVideoUrl = (rawUrl.startsWith("http://") || rawUrl.startsWith("https://"))
        ? rawUrl
        : `${API_BASE}${rawUrl}`;
      setDownloadUrl(finalVideoUrl);
      setPhase("done");


      // Optimistic save: store predicted URL with status "processing"
      const activeSessionId = sessionId || sessionIdRef.current;
      if (activeSessionId) {
        const dbResult = await saveRecordingAction(
          activeSessionId,
          finalVideoUrl,
          preset.mergeKey,
          data.chunkCount || 1,
          "processing"
        );

        if (!dbResult.success) {
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
  }, [phase, sessionId]);

  // Handle tab closure and end class events while recording is active
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (phase === "recording" && sessionIdRef.current) {
        try {
          const resKey = activeResolutionRef.current;
          const blob = new Blob(
            [JSON.stringify({ sessionId: sessionIdRef.current, resolution: RESOLUTION_PRESETS[resKey].mergeKey })],
            { type: "application/json" }
          );
          navigator.sendBeacon(`${API_BASE}/api/merge`, blob);
        } catch (e) {
          console.error("Beacon merge send failed:", e);
        }
      }
    };

    const handleEndClassEvent = () => {
      if (phase === "recording") {
        handleStop();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("end-class-recording", handleEndClassEvent);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("end-class-recording", handleEndClassEvent);
    };
  }, [phase, handleStop]);

  // Clean up media streams on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
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

  const recordingLoop = async (stream: MediaStream, preset: ResolutionPreset) => {
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
      ? "video/webm;codecs=vp8,opus"
      : "video/webm";

    let chunkIndex = 0;

    // Use a SINGLE continuous MediaRecorder for the entire session.
    // timeslice fires ondataavailable every CHUNK_INTERVAL_MS (10s).
    // This preserves continuous audio/video timestamps across chunks
    // and eliminates static-frame artifacts from repeated start/stop cycles.
    const mr = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: preset.bitrate,
    });
    mediaRecorderRef.current = mr;

    mr.ondataavailable = (ev) => {
      if (ev.data.size > 0 && !stoppingRef.current) {
        const blob = new Blob([ev.data], { type: mimeType });
        const currentIdx = chunkIndex++;
        setChunkCount(chunkIndex);
        uploadChunk(blob, currentIdx, sessionIdRef.current!).catch(console.error);
      }
    };

    // Start with timeslice — fires ondataavailable every CHUNK_INTERVAL_MS
    mr.start(CHUNK_INTERVAL_MS);
  };




  if (role !== "teacher") return null;

  // Resolution display label
  const resLabel = selectedResolution === "auto"
    ? `Auto (${autoDetectedRes ?? "720p"})`
    : selectedResolution;

  // Icon for the reason type
  const reasonIcon = (reason: string) => {
    if (reason.startsWith("Bandwidth")) return <Wifi size={10} className="shrink-0 text-blue-400" />;
    if (reason.startsWith("Screen")) return <Monitor size={10} className="shrink-0 text-purple-400" />;
    if (reason.startsWith("Device")) return <Cpu size={10} className="shrink-0 text-amber-400" />;
    return null;
  };

  return (
    <div className="flex items-center gap-1 shrink-0 px-2 border-r border-border/50 h-8">
      {/* ─── Resolution Picker (visible only when idle) ─── */}
      {phase === "idle" && (
        <div className="relative z-999" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setShowResDropdown(!showResDropdown)}
            className="flex items-center gap-1 px-1.5 h-7 rounded-[4px] border border-border/60 bg-muted/40 hover:bg-muted/70 text-muted-foreground transition-all text-[10px] font-bold cursor-pointer"
            title="Recording Quality"
          >
            <Gauge size={12} />
            <span className="hidden sm:inline">{resLabel}</span>
            <ChevronDown size={10} className={`transition-transform ${showResDropdown ? "rotate-180" : ""}`} />
          </button>

          {showResDropdown && (
            <div className="absolute top-full z-999 left-0 mt-1 w-52 bg-popover border border-border rounded-[5px] shadow-xl py-1 animate-in fade-in slide-in-from-top-1 duration-150">
              {/* Auto option */}
              <button
                type="button"
                onClick={() => { setSelectedResolution("auto"); setShowResDropdown(false); }}
                className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors cursor-pointer ${
                  selectedResolution === "auto"
                    ? "bg-primary/10 text-primary font-bold"
                    : "hover:bg-muted/50 text-foreground"
                }`}
              >
                <Gauge size={12} />
                <div className="flex-1">
                  <span className="font-bold">Auto</span>
                  <span className="text-muted-foreground ml-1">({autoDetectedRes ?? "720p"})</span>
                </div>
                {selectedResolution === "auto" && <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-black">ACTIVE</span>}
              </button>

              <div className="h-px bg-border/60 my-1" />

              {/* Manual options */}
              {(Object.keys(RESOLUTION_PRESETS) as Exclude<ResolutionKey, "auto">[]).map((key) => {
                const p = RESOLUTION_PRESETS[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setSelectedResolution(key); setShowResDropdown(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors cursor-pointer ${
                      selectedResolution === key
                        ? "bg-primary/10 text-primary font-bold"
                        : "hover:bg-muted/50 text-foreground"
                    }`}
                  >
                    <span className="font-bold w-10">{p.label}</span>
                    <span className="text-muted-foreground text-[10px]">
                      {p.width}×{p.height} · {(p.bitrate / 1_000_000).toFixed(1)}Mbps · {p.frameRate}fps
                    </span>
                  </button>
                );
              })}

              {/* Auto detection reasons */}
              {selectedResolution === "auto" && autoReasons.length > 0 && (
                <>
                  <div className="h-px bg-border/60 my-1" />
                  <div className="px-3 py-1.5 space-y-1">
                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">Why {autoDetectedRes}?</span>
                    {autoReasons.map((r, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        {reasonIcon(r)}
                        <span>{r.split(" → ")[0]}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Record Button ─── */}
      {phase === "idle" && (
        <button
          type="button"
          onClick={handleStart}
          className="flex items-center gap-1.5 p-1.5 h-8 rounded-[5px] border border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all duration-300 shadow-sm cursor-pointer"
          title="Start Recording Screen"
        >
          <Video size={16} />
          <span className="hidden xl:block text-[10px] font-black uppercase tracking-wider">
            Record
          </span>
        </button>
      )}

      {/* ─── Recording Active ─── */}
      {phase === "recording" && (
        <button
          type="button"
          onClick={handleStop}
          className="flex items-center gap-1.5 p-1.5 h-8 rounded-[5px] border border-red-500 bg-red-500 text-white hover:bg-red-600 transition-all duration-300 shadow-md animate-pulse cursor-pointer"
          title="Click to Stop Recording"
        >
          <Square size={14} className="fill-current" />
          <span className="text-[10px] font-black tracking-wider">
            {formatTimer(elapsedSeconds)} ({chunkCount})
            <span className="ml-1 opacity-70">{activeResolutionRef.current}</span>
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
          className="flex items-center gap-1.5 p-1.5 h-8 rounded-[5px] border border-red-500/40 bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all duration-300 cursor-pointer"
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
