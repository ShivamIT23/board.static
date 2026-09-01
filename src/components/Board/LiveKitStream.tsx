"use client";

import React, { useEffect, useState, useRef } from "react";
import { Room, RoomEvent, Track, LocalTrackPublication, RemoteTrackPublication, RemoteParticipant, setLogLevel } from "livekit-client";
import { Mic, MicOff, Video as VideoIcon, VideoOff, Volume2, VolumeX, Radio, UserCheck, Maximize2, Minimize2, MonitorUp, MonitorOff, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Socket } from "socket.io-client";

// Set LiveKit client log level to warn to suppress non-fatal WebRTC datachannel teardown logs
if (typeof window !== "undefined") {
  try {
    setLogLevel("warn");
  } catch {
    // ignore
  }
}

interface LiveKitStreamProps {
  roomId: string;
  userId: string;
  userName: string;
  isTeacher: boolean;
  socketUrl: string;
  isCollapsed?: boolean;
  isChatOpen?: boolean;
  onExpandChange?: (expanded: boolean) => void;
  onToggleChat?: () => void;
  socket?: Socket | null;
  allowAudio?: boolean;
  allowVideo?: boolean;
  allowScreenSharing?: boolean;
  isMobile?: boolean;
}

export default function LiveKitStream({
  roomId,
  userId,
  userName,
  isTeacher,
  socketUrl,
  isCollapsed = false,
  isChatOpen = true,
  onExpandChange,
  onToggleChat,
  socket = null,
  allowAudio = true,
  allowVideo = true,
  allowScreenSharing = true,
  isMobile = false,
}: LiveKitStreamProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMutedByStudent, setIsMutedByStudent] = useState(false);

  // Toggle Audio Mute for Student (Student only)
  const toggleStudentMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMutedByStudent;
      setIsMutedByStudent(!isMutedByStudent);
    }
  };
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [isTeacherAudioActive, setIsTeacherAudioActive] = useState(false);
  const [teacherName, setTeacherName] = useState<string>("Teacher");
  const [isExpanded, setIsExpanded] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Initialize and connect LiveKit room
  useEffect(() => {
    if (!roomId || !userId) return;

    let activeRoom: Room | null = null;

    const connectLiveKit = async () => {
      try {
        const res = await fetch(`${socketUrl}/api/livekit/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId, userId, userName, isTeacher }),
        });

        if (!res.ok) {
          throw new Error("Failed to fetch LiveKit token");
        }

        const { token, wsUrl } = await res.json();
        const livekitWsUrl = wsUrl || "wss://webrtc-server.shivam-gupta.in";

        const roomInstance = new Room({
          adaptiveStream: true,
          dynacast: true,
          videoCaptureDefaults: {
            resolution: { width: 1280, height: 720, frameRate: 30 },
          },
        });

        activeRoom = roomInstance;
        setRoom(roomInstance);

        roomInstance.on(RoomEvent.Connected, () => {
          console.log("[LiveKit] Connected to room:", roomId);
        });

        roomInstance.on(RoomEvent.Disconnected, () => {
          console.log("[LiveKit] Disconnected from room:", roomId);
          setHasRemoteVideo(false);
          setIsTeacherAudioActive(false);
        });

        roomInstance.on(RoomEvent.LocalTrackPublished, (pub: LocalTrackPublication) => {
          if (pub.track && pub.track.kind === Track.Kind.Video && localVideoRef.current) {
            pub.track.attach(localVideoRef.current);
          }
        });

        roomInstance.on(RoomEvent.LocalTrackUnpublished, (pub: LocalTrackPublication) => {
          if (pub.source === Track.Source.ScreenShare) {
            setIsScreenSharing(false);
            toast.info("Screen sharing stopped");
          }
        });

        roomInstance.on(
          RoomEvent.TrackSubscribed,
          (track: Track, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
            console.log(`[LiveKit] Subscribed to ${track.kind} from ${participant.identity}`);
            setTeacherName(participant.name || "Teacher");

            if (track.kind === Track.Kind.Video && remoteVideoRef.current) {
              track.attach(remoteVideoRef.current);
              setHasRemoteVideo(true);
            } else if (track.kind === Track.Kind.Audio && audioRef.current) {
              track.attach(audioRef.current);
              setIsTeacherAudioActive(true);
            }
          }
        );

        roomInstance.on(
          RoomEvent.TrackUnsubscribed,
          (track: Track) => {
            console.log(`[LiveKit] Unsubscribed from ${track.kind}`);
            track.detach();
            if (track.kind === Track.Kind.Video) {
              setHasRemoteVideo(false);
            } else if (track.kind === Track.Kind.Audio) {
              setIsTeacherAudioActive(false);
            }
          }
        );

        await roomInstance.connect(livekitWsUrl, token);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error("[LiveKit Error]:", errorMsg);
      }
    };

    connectLiveKit();

    return () => {
      if (activeRoom) {
        activeRoom.disconnect();
      }
    };
  }, [roomId, userId, userName, isTeacher, socketUrl]);

  // Toggle Microphone (Teacher only)
  const toggleMic = async () => {
    if (!room || !isTeacher) return;
    if (allowAudio === false) {
      toast.error("Audio is disabled for this class session.");
      return;
    }
    try {
      const nextState = !isMicOn;
      await room.localParticipant.setMicrophoneEnabled(nextState);
      setIsMicOn(nextState);
      toast.info(nextState ? "Microphone turned ON" : "Microphone turned OFF");
      window.dispatchEvent(new CustomEvent("recorder-mic-toggle", { detail: { enabled: nextState } }));
    } catch (err: unknown) {
      console.error("[LiveKit Mic Error]:", err);
      toast.error("Could not access microphone");
    }
  };

  // Toggle Camera (Teacher only)
  const toggleCamera = async () => {
    if (!room || !isTeacher) return;
    if (allowVideo === false) {
      toast.error("Video is disabled for this class session.");
      return;
    }
    try {
      const nextState = !isCameraOn;
      await room.localParticipant.setCameraEnabled(nextState);
      setIsCameraOn(nextState);
      toast.info(nextState ? "Camera turned ON" : "Camera turned OFF");

      if (nextState) {
        setTimeout(() => {
          const pub = Array.from(room.localParticipant.videoTrackPublications.values()).find(
            (p) => p.track && p.track.kind === Track.Kind.Video
          ) as LocalTrackPublication | undefined;
          if (pub && pub.track && localVideoRef.current) {
            pub.track.attach(localVideoRef.current);
          }
        }, 300);
      }
    } catch (err: unknown) {
      console.error("[LiveKit Camera Error]:", err);
      toast.error("Could not access camera");
    }
  };

  // Toggle Screen Share (Teacher only)
  const toggleScreenShare = async () => {
    if (!room || !isTeacher) return;
    if (allowScreenSharing === false) {
      toast.error("Screen sharing is disabled for this class session.");
      return;
    }
    try {
      const nextState = !isScreenSharing;
      await room.localParticipant.setScreenShareEnabled(nextState, { audio: true });
      setIsScreenSharing(nextState);
      if (nextState) {
        toggleExpand(true);
        toast.success("Screen sharing started");
      } else {
        toast.info("Screen sharing stopped");
      }
    } catch (err: unknown) {
      console.error("[LiveKit ScreenShare Error]:", err);
      toast.error("Could not start screen sharing");
    }
  };

  // Toggle expand state and sync to students via socket
  const toggleExpand = (nextState: boolean) => {
    setIsExpanded(nextState);
    if (onExpandChange) onExpandChange(nextState);
    if (isTeacher && socket) {
      socket.emit("video_toggle_expand", {
        roomId,
        payload: { expanded: nextState },
      });
    }
  };

  // Sync video expand/minimize state from teacher to students
  useEffect(() => {
    if (!socket) return;
    const handleExpandSync = (data: { payload?: { expanded?: boolean } }) => {
      if (typeof data?.payload?.expanded === "boolean") {
        setIsExpanded(data.payload.expanded);
        if (onExpandChange) onExpandChange(data.payload.expanded);
      }
    };
    socket.on("video_toggle_expand", handleExpandSync);
    return () => {
      socket.off("video_toggle_expand", handleExpandSync);
    };
  }, [socket, onExpandChange]);

  // Re-attach video track whenever switching between sidebar and expanded view
  useEffect(() => {
    if (!room) return;

    const timer = setTimeout(() => {
      if (isTeacher && isCameraOn && localVideoRef.current) {
        const pub = Array.from(room.localParticipant.videoTrackPublications.values()).find(
          (p) => p.track && p.track.kind === Track.Kind.Video
        ) as LocalTrackPublication | undefined;
        if (pub && pub.track) {
          pub.track.detach(localVideoRef.current);
          pub.track.attach(localVideoRef.current);
        }
      }

      if (!isTeacher && hasRemoteVideo && remoteVideoRef.current) {
        room.remoteParticipants.forEach((participant) => {
          participant.videoTrackPublications.forEach((pub) => {
            if (pub.track && pub.track.kind === Track.Kind.Video && remoteVideoRef.current) {
              pub.track.detach(remoteVideoRef.current);
              pub.track.attach(remoteVideoRef.current);
            }
          });
        });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isExpanded, room, isTeacher, isCameraOn, hasRemoteVideo]);

  if (allowAudio === false && allowVideo === false) {
    return null;
  }

  // ─── FULLSCREEN / EXPANDED VIDEO VIEW (REPLACES WHITEBOARD) ───
  const renderExpandedView = () => {
    return (
      <div
        className={cn(
          "fixed top-12 left-0 bottom-0 z-40 bg-slate-200/95 dark:bg-slate-950/95 backdrop-blur-xl p-3 sm:p-6 flex flex-col justify-between animate-in fade-in zoom-in-95 duration-200 transition-all",
          isChatOpen ? "right-64 sm:right-72 md:right-80" : "right-0"
        )}
      >
        <div className="w-full flex-1 bg-slate-200/90 dark:bg-slate-950 rounded-2xl border border-slate-300 dark:border-slate-800/90 shadow-2xl relative overflow-hidden flex flex-col justify-between p-4">
          <audio ref={audioRef} autoPlay />
          <video
            ref={isTeacher ? localVideoRef : remoteVideoRef}
            autoPlay
            playsInline
            muted={isTeacher}
            className={cn(
              "absolute inset-0 w-full h-full object-contain z-0 transition-opacity duration-300",
              (isTeacher ? (isCameraOn || isScreenSharing) : hasRemoteVideo) ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
          />
          <div className="flex items-center justify-between z-10 gap-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 backdrop-blur-md shadow-md">
                <UserCheck className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                <span>{isTeacher ? "Teacher (You)" : `${teacherName}'s Stream`}</span>
              </div>
              {((isTeacher && (isMicOn || isCameraOn || isScreenSharing)) || (!isTeacher && hasRemoteVideo)) && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-red-500/20 text-red-500 dark:text-red-400 border border-red-500/40 animate-pulse backdrop-blur-md shadow-md">
                  <Radio className="h-3.5 w-3.5" />
                  {isScreenSharing ? "SCREEN SHARE ACTIVE" : "LIVE"}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {onToggleChat && !isChatOpen && (
                <button
                  type="button"
                  onClick={onToggleChat}
                  className={cn(
                    "flex items-center absolute bottom-4 right-4 px-2 py-2 rounded-full border backdrop-blur-md shadow-xl transition-all cursor-pointer",
                    "bg-white/90 dark:bg-slate-900/90 border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                  title="Open Chat Sidebar"
                >
                  <MessageCircle className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                </button>
              )}

              <button
                type="button"
                onClick={() => toggleExpand(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 backdrop-blur-md shadow-xl transition-all cursor-pointer"
                title="Restore Whiteboard"
              >
                <Minimize2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                <span>Restore Whiteboard</span>
              </button>
            </div>
          </div>
          {((isTeacher && !isCameraOn) || (!isTeacher && !hasRemoteVideo)) && (
            <div className="flex flex-col items-center justify-center gap-3 sm:gap-4 my-auto z-10">
              <div className="flex items-center justify-center gap-3 sm:gap-4">
                {isTeacher ? (
                  <>
                    <button
                      type="button"
                      onClick={toggleMic}
                      className={cn(
                        "p-3.5 sm:p-4 rounded-2xl border flex items-center justify-center transition-all shadow-2xl cursor-pointer hover:scale-105 active:scale-95",
                        isMicOn
                          ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/30"
                          : "bg-white/90 dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
                      )}
                      title={isMicOn ? "Mute Microphone" : "Unmute Microphone"}
                    >
                      {isMicOn ? (
                        <Mic className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-500 dark:text-emerald-400 animate-pulse" />
                      ) : (
                        <MicOff className="w-7 h-7 sm:w-8 sm:h-8" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={toggleCamera}
                      className={cn(
                        "p-3.5 sm:p-4 rounded-2xl border flex items-center justify-center shadow-2xl transition-all cursor-pointer hover:scale-105 active:scale-95",
                        isCameraOn
                          ? "bg-blue-500/20 border-blue-500/50 text-blue-600 dark:text-blue-400 hover:bg-blue-500/30"
                          : "bg-white/90 dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
                      )}
                      title={isCameraOn ? "Stop Camera" : "Start Camera"}
                    >
                      {isCameraOn ? (
                        <VideoIcon className="w-7 h-7 sm:w-8 sm:h-8" />
                      ) : (
                        <VideoOff className="w-7 h-7 sm:w-8 sm:h-8" />
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={toggleStudentMute}
                      className={cn(
                        "p-3.5 sm:p-4 rounded-2xl border flex items-center justify-center transition-all shadow-2xl cursor-pointer hover:scale-105 active:scale-95",
                        !isMutedByStudent && isTeacherAudioActive
                          ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/30"
                          : "bg-white/90 dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      )}
                      title={isMutedByStudent ? "Unmute Teacher Audio" : "Mute Teacher Audio"}
                    >
                      {isMutedByStudent ? (
                        <VolumeX className="w-7 h-7 sm:w-8 sm:h-8 text-red-400" />
                      ) : isTeacherAudioActive ? (
                        <Volume2 className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-500 animate-pulse" />
                      ) : (
                        <MicOff className="w-7 h-7 sm:w-8 sm:h-8" />
                      )}
                    </button>
                    <div
                      className="p-3.5 sm:p-4 rounded-2xl border bg-white/90 dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center shadow-2xl"
                      title="Teacher video is off"
                    >
                      <VideoOff className="w-7 h-7 sm:w-8 sm:h-8" />
                    </div>
                  </>
                )}
              </div>
              <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 tracking-wide">
                Audio:{" "}
                <span
                  className={
                    (isTeacher ? isMicOn : !isMutedByStudent && isTeacherAudioActive)
                      ? "text-emerald-500 dark:text-emerald-400"
                      : "text-slate-400 dark:text-slate-500"
                  }
                >
                  {(isTeacher ? isMicOn : !isMutedByStudent && isTeacherAudioActive) ? "ON" : "OFF"}
                </span>
                {" • "}
                Video:{" "}
                <span
                  className={
                    (isTeacher ? isCameraOn : hasRemoteVideo)
                      ? "text-blue-500 dark:text-blue-400"
                      : "text-slate-400 dark:text-slate-500"
                  }
                >
                  {(isTeacher ? isCameraOn : hasRemoteVideo) ? "ON" : "OFF"}
                </span>
              </p>
            </div>
          )}
          <div className="flex items-center justify-center gap-4 z-10 mt-auto bg-white/90 dark:bg-slate-950/90 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 mx-auto shadow-2xl">
            {isTeacher ? (
              <>
                <button
                  type="button"
                  onClick={toggleMic}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl border font-bold text-xs transition-all cursor-pointer",
                    isMicOn
                      ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/30"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                  )}
                >
                  {isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  <span>{isMicOn ? "Mic ON" : "Mic OFF"}</span>
                </button>
                <button
                  type="button"
                  onClick={toggleCamera}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl border font-bold text-xs transition-all cursor-pointer",
                    isCameraOn
                      ? "bg-blue-500/20 border-blue-500/50 text-blue-600 dark:text-blue-400 hover:bg-blue-500/30"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                  )}
                >
                  {isCameraOn ? <VideoIcon className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                  <span>{isCameraOn ? "Camera ON" : "Camera OFF"}</span>
                </button>
                <button
                  type="button"
                  onClick={toggleScreenShare}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl border font-bold text-xs transition-all cursor-pointer",
                    isScreenSharing
                      ? "bg-purple-500/20 border-purple-500/50 text-purple-600 dark:text-purple-400 hover:bg-purple-500/30"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                  )}
                >
                  {isScreenSharing ? <MonitorOff className="w-4 h-4" /> : <MonitorUp className="w-4 h-4" />}
                  <span>{isScreenSharing ? "Stop Share" : "Share Screen"}</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={toggleStudentMute}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
              >
                {isMutedByStudent ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                <span>{isMutedByStudent ? "Unmute Teacher" : "Mute Teacher"}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => toggleExpand(false)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold transition-all cursor-pointer"
            >
              <Minimize2 className="w-4 h-4" />
              <span>Restore Whiteboard</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render expanded overlay if active
  if (isExpanded) {
    return renderExpandedView();
  }

  // ─── MOBILE FLOATING PIP VIEW ───
  if (isMobile) {
    return (
      <div className="fixed top-12 right-2 z-30 w-32 aspect-4/3 rounded-xl bg-slate-200/90 dark:bg-slate-950/90 border border-slate-300 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
        <audio ref={audioRef} autoPlay />
        <div className="relative flex-1 overflow-hidden">
          <video
            ref={isTeacher ? localVideoRef : remoteVideoRef}
            autoPlay
            playsInline
            muted={isTeacher}
            className={cn(
              "absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-300",
              (isTeacher ? isCameraOn : hasRemoteVideo) ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
          />
          {!(isTeacher ? isCameraOn : hasRemoteVideo) && (
            <div className="absolute inset-0 flex items-center justify-center">
              <VideoOff className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            </div>
          )}

          {/* LIVE indicator */}
          {(isTeacher ? (isMicOn || isCameraOn) : (hasRemoteVideo || isTeacherAudioActive)) && (
            <span className="absolute top-1 left-1 flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[7px] font-extrabold bg-red-500/20 text-red-500 border border-red-500/40 animate-pulse">
              <Radio className="h-2 w-2" />
            </span>
          )}

          {/* Expand button */}
          <button
            type="button"
            onClick={() => toggleExpand(true)}
            className="absolute top-1 right-1 p-0.5 rounded-md bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer"
            title="Expand Video"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>

        {/* Bottom control strip */}
        <div className="flex items-center justify-center gap-1.5 py-1 bg-white/80 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800">
          {isTeacher ? (
            <>
              <button
                type="button"
                onClick={toggleMic}
                className={cn("p-1 rounded-md transition-all cursor-pointer", isMicOn ? "text-emerald-500" : "text-slate-400")}
              >
                {isMicOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={toggleCamera}
                className={cn("p-1 rounded-md transition-all cursor-pointer", isCameraOn ? "text-blue-500" : "text-slate-400")}
              >
                {isCameraOn ? <VideoIcon className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={toggleStudentMute}
              className={cn("p-1 rounded-md transition-all cursor-pointer", isMutedByStudent ? "text-red-400" : "text-emerald-500")}
            >
              {isMutedByStudent ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── COLLAPSED SIDEBAR VIEW (THUMBNAIL) ───
  if (isCollapsed) {
    return (
      <div className="p-1 bg-muted/20 border-b border-border shrink-0 w-full flex flex-col items-center">
        <audio ref={audioRef} autoPlay />
        <div
          onClick={() => toggleExpand(true)}
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-slate-200 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 shadow-md relative overflow-hidden flex flex-col items-center justify-center cursor-pointer group"
          title="Click to Expand Video over Whiteboard"
        >
          <video
            ref={isTeacher ? localVideoRef : remoteVideoRef}
            autoPlay
            playsInline
            muted={isTeacher}
            className={cn(
              "absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-300",
              (isTeacher ? isCameraOn : hasRemoteVideo) ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
          />
          {!isCameraOn && !hasRemoteVideo && (
            <div className="flex items-center justify-center z-10 text-slate-500">
              {(isTeacher ? isMicOn : isTeacherAudioActive) ? <Mic className="w-4 h-4 text-emerald-400 animate-pulse" /> : <VideoOff className="w-4 h-4 text-slate-600" />}
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
            <Maximize2 className="w-4 h-4 text-white" />
          </div>
        </div>
      </div>
    );
  }

  // ─── TEACHER EXPANDED VIEW ───
  if (isTeacher) {
    return (
      <div className="p-2.5 bg-muted/20 border-b border-border shrink-0">
        <div className="w-full aspect-video bg-slate-200/80 dark:bg-slate-950 rounded-xl border border-slate-300 dark:border-slate-800/90 shadow-md relative overflow-hidden flex flex-col justify-between p-3">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={cn(
              "absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-300",
              isCameraOn ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
          />

          <div className="flex items-center justify-between z-10">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300 backdrop-blur-md shadow-sm">
              <UserCheck className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
              <span>Teacher (You)</span>
            </div>

            <div className="flex items-center gap-1.5">
              {(isMicOn || isCameraOn) && (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-500/20 text-red-500 dark:text-red-400 border border-red-500/40 animate-pulse backdrop-blur-md shadow-sm">
                  <Radio className="h-3 w-3" />
                  LIVE
                </span>
              )}
              {/* Fullscreen Video Button (Replaces Whiteboard) */}
              <button
                type="button"
                onClick={() => toggleExpand(true)}
                className="p-1 rounded-lg bg-white/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white backdrop-blur-md transition-all cursor-pointer"
                title="Expand Video (Replace Whiteboard)"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {!isCameraOn && (
            <div className="flex flex-col items-center justify-center gap-2 my-auto z-10">
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={toggleMic}
                  className={cn(
                    "flex items-center justify-center p-3 rounded-2xl border transition-all duration-200 shadow-xl cursor-pointer",
                    isMicOn
                      ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/30"
                      : "bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  )}
                  title={isMicOn ? "Mute Microphone" : "Unmute Microphone"}
                >
                  {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5 text-slate-500" />}
                </button>
                <button
                  type="button"
                  onClick={toggleCamera}
                  className={cn(
                    "flex items-center justify-center p-3 rounded-2xl border transition-all duration-200 shadow-xl cursor-pointer",
                    isCameraOn
                      ? "bg-blue-500/20 border-blue-500/50 text-blue-600 dark:text-blue-400 hover:bg-blue-500/30"
                      : "bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  )}
                  title={isCameraOn ? "Stop Camera" : "Start Camera"}
                >
                  {isCameraOn ? <VideoIcon className="w-5 h-5" /> : <VideoOff className="w-5 h-5 text-slate-500" />}
                </button>
              </div>
              <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 tracking-wide">
                Audio: <span className={isMicOn ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-slate-500"}>{isMicOn ? "ON" : "OFF"}</span>
                {" • "}
                Video: <span className="text-slate-500">OFF</span>
              </p>
            </div>
          )}

          {isCameraOn && (
            <div className="flex items-center justify-center gap-3 z-10 mt-auto bg-white/90 dark:bg-slate-950/80 backdrop-blur-md p-1.5 rounded-xl border border-slate-200 dark:border-slate-800/80 mx-auto shadow-lg">
              <button
                type="button"
                onClick={toggleMic}
                className={cn(
                  "p-2 rounded-lg border transition-all cursor-pointer",
                  isMicOn ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-600 dark:text-emerald-400" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                )}
              >
                {isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={toggleCamera}
                className={cn(
                  "p-2 rounded-lg border transition-all cursor-pointer",
                  isCameraOn ? "bg-blue-500/20 border-blue-500/40 text-blue-600 dark:text-blue-400" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                )}
              >
                <VideoIcon className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── STUDENT EXPANDED VIEW ───
  return (
    <div className="p-2.5 bg-muted/20 border-b border-border shrink-0">
      <div className="w-full aspect-video bg-slate-200/80 dark:bg-slate-950 rounded-xl border border-slate-300 dark:border-slate-800/90 shadow-md relative overflow-hidden flex flex-col justify-between p-3">
        <audio ref={audioRef} autoPlay />
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={cn(
            "absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-300",
            hasRemoteVideo ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        />
        <div className="flex items-center justify-between z-10">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300 backdrop-blur-md shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{teacherName}&apos;s Stream</span>
          </div>
          <div className="flex items-center gap-1.5">
            {hasRemoteVideo && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-500/20 text-red-500 dark:text-red-400 border border-red-500/40 animate-pulse backdrop-blur-md shadow-sm">
                <Radio className="h-3 w-3" />
                LIVE
              </span>
            )}
            <button
              type="button"
              onClick={toggleStudentMute}
              className="p-1.5 rounded-lg bg-white/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white backdrop-blur-md transition-colors cursor-pointer"
              title={isMutedByStudent ? "Unmute Teacher Audio" : "Mute Teacher Audio"}
            >
              {isMutedByStudent ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
            {/* Fullscreen Video Button (Replaces Whiteboard) */}
            <button
              type="button"
              onClick={() => toggleExpand(true)}
              className="p-1.5 rounded-lg bg-white/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white backdrop-blur-md transition-all cursor-pointer"
              title="Expand Video (Replace Whiteboard)"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        {!hasRemoteVideo && (
          <div className="flex flex-col items-center justify-center gap-2 my-auto z-10 text-center">
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={toggleStudentMute}
                className={cn(
                  "p-3 rounded-2xl border flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-md",
                  !isMutedByStudent && isTeacherAudioActive
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                    : "bg-white/90 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-500"
                )}
                title={isMutedByStudent ? "Unmute Teacher Audio" : "Mute Teacher Audio"}
              >
                {isMutedByStudent ? (
                  <VolumeX className="w-5 h-5 text-red-400" />
                ) : isTeacherAudioActive ? (
                  <Mic className="w-5 h-5 text-emerald-500" />
                ) : (
                  <MicOff className="w-5 h-5" />
                )}
              </button>
              <div
                className="p-3 rounded-2xl border bg-white/90 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-500 flex items-center justify-center shadow-md"
                title="Teacher video is off"
              >
                <VideoOff className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 tracking-wide">
              Audio:{" "}
              <span
                className={
                  !isMutedByStudent && isTeacherAudioActive
                    ? "text-emerald-600 dark:text-emerald-400 font-bold"
                    : "text-slate-500"
                }
              >
                {!isMutedByStudent && isTeacherAudioActive ? "ON" : "OFF"}
              </span>
              {" • "}
              Video: <span className="text-slate-500">OFF</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
