"use client";

import React, { useEffect, useState, useRef } from "react";
import { Room, RoomEvent, Track, LocalTrackPublication, RemoteTrackPublication, RemoteParticipant } from "livekit-client";
import { Mic, MicOff, Video as VideoIcon, VideoOff, Volume2, VolumeX, Radio, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LiveKitStreamProps {
  roomId: string;
  userId: string;
  userName: string;
  isTeacher: boolean;
  socketUrl: string;
  isCollapsed?: boolean;
}

export default function LiveKitStream({
  roomId,
  userId,
  userName,
  isTeacher,
  socketUrl,
  isCollapsed = false,
}: LiveKitStreamProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isMutedByStudent, setIsMutedByStudent] = useState(false);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [isTeacherAudioActive, setIsTeacherAudioActive] = useState(false);
  const [teacherName, setTeacherName] = useState<string>("Teacher");

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Initialize and connect LiveKit room
  useEffect(() => {
    if (!roomId || !userId) return;

    let activeRoom: Room | null = null;

    const connectLiveKit = async () => {
      try {
        // 1. Fetch LiveKit token from socket-provider
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

        // 2. Create LiveKit room instance
        const roomInstance = new Room({
          adaptiveStream: true,
          dynacast: true,
          videoCaptureDefaults: {
            resolution: { width: 1280, height: 720, frameRate: 30 },
          },
        });

        activeRoom = roomInstance;
        setRoom(roomInstance);

        // 3. Register event handlers
        roomInstance.on(RoomEvent.Connected, () => {
          console.log("[LiveKit] Connected to room:", roomId);
        });

        roomInstance.on(RoomEvent.Disconnected, () => {
          console.log("[LiveKit] Disconnected from room:", roomId);
          setHasRemoteVideo(false);
          setIsTeacherAudioActive(false);
        });

        // Local track published (Teacher sees their own stream)
        roomInstance.on(RoomEvent.LocalTrackPublished, (pub: LocalTrackPublication) => {
          if (pub.track && pub.track.kind === Track.Kind.Video && localVideoRef.current) {
            pub.track.attach(localVideoRef.current);
          }
        });

        // Track subscribed event (Students receive Teacher's tracks)
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

        // 4. Connect to LiveKit server
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

  // Attach local camera video feed whenever camera state changes to active
  useEffect(() => {
    if (!room || !isTeacher) return;

    if (isCameraOn) {
      const timer = setTimeout(() => {
        const pub = Array.from(room.localParticipant.videoTrackPublications.values()).find(
          (p) => p.track && p.track.kind === Track.Kind.Video
        ) as LocalTrackPublication | undefined;

        if (pub && pub.track && localVideoRef.current) {
          pub.track.attach(localVideoRef.current);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isCameraOn, room, isTeacher]);

  // Toggle Microphone (Teacher only)
  const toggleMic = async () => {
    if (!room || !isTeacher) return;
    try {
      const nextState = !isMicOn;
      await room.localParticipant.setMicrophoneEnabled(nextState);
      setIsMicOn(nextState);
      toast.info(nextState ? "Microphone turned ON" : "Microphone turned OFF");
    } catch (err: unknown) {
      console.error("[LiveKit Mic Error]:", err);
      toast.error("Could not access microphone");
    }
  };

  // Toggle Camera (Teacher only)
  const toggleCamera = async () => {
    if (!room || !isTeacher) return;
    try {
      const nextState = !isCameraOn;
      await room.localParticipant.setCameraEnabled(nextState);
      setIsCameraOn(nextState);

      toast.info(nextState ? "Camera turned ON" : "Camera turned OFF");
    } catch (err: unknown) {
      console.error("[LiveKit Camera Error]:", err);
      toast.error("Could not access camera");
    }
  };

  // Student toggle mute audio
  const toggleStudentMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMutedByStudent;
      setIsMutedByStudent(!isMutedByStudent);
    }
  };

  // ─── COMPACT COLLAPSED VIEW (When Chat Sidebar is Closed) ───
  if (isCollapsed) {
    if (isTeacher) {
      return (
        <div className="p-1 bg-muted/20 border-b border-border shrink-0 w-full flex flex-col items-center">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-slate-950 border border-slate-800 shadow-md relative overflow-hidden flex flex-col items-center justify-center">
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
            {!isCameraOn && (
              <div className="flex gap-1 z-10">
                <button
                  type="button"
                  onClick={toggleMic}
                  className={cn("p-1 rounded-lg border text-[10px]", isMicOn ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-slate-900 border-slate-800 text-slate-500")}
                  title={isMicOn ? "Mute Mic" : "Unmute Mic"}
                >
                  {isMicOn ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
                </button>
                <button
                  type="button"
                  onClick={toggleCamera}
                  className={cn("p-1 rounded-lg border text-[10px]", isCameraOn ? "bg-blue-500/20 border-blue-500/40 text-blue-400" : "bg-slate-900 border-slate-800 text-slate-500")}
                  title={isCameraOn ? "Stop Camera" : "Start Camera"}
                >
                  {isCameraOn ? <VideoIcon className="w-3 h-3" /> : <VideoOff className="w-3 h-3" />}
                </button>
              </div>
            )}
            {isCameraOn && (
              <span className="absolute top-1 left-1 w-2 h-2 rounded-full bg-red-500 animate-pulse z-10" />
            )}
          </div>
        </div>
      );
    }

    // Student Compact View
    return (
      <div className="p-1 bg-muted/20 border-b border-border shrink-0 w-full flex flex-col items-center">
        <audio ref={audioRef} autoPlay />
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-slate-950 border border-slate-800 shadow-md relative overflow-hidden flex flex-col items-center justify-center">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={cn(
              "absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-300",
              hasRemoteVideo ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
          />
          {!hasRemoteVideo && (
            <div className="flex items-center justify-center z-10 text-slate-500">
              {isTeacherAudioActive ? <Mic className="w-4 h-4 text-emerald-400 animate-pulse" /> : <VideoOff className="w-4 h-4 text-slate-600" />}
            </div>
          )}
          {hasRemoteVideo && (
            <span className="absolute top-1 left-1 w-2 h-2 rounded-full bg-red-500 animate-pulse z-10" />
          )}
        </div>
      </div>
    );
  }

  // ─── TEACHER EXPANDED VIEW ───
  if (isTeacher) {
    return (
      <div className="p-2.5 bg-muted/20 border-b border-border shrink-0">
        <div className="w-full aspect-video bg-slate-950 rounded-xl border border-slate-800/90 shadow-md relative overflow-hidden flex flex-col justify-between p-3">
          {/* Live Video Feed of Teacher */}
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

          {/* Top Header Overlay */}
          <div className="flex items-center justify-between z-10">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-900/80 border border-slate-800 text-[11px] font-semibold text-slate-300 backdrop-blur-md shadow-sm">
              <UserCheck className="w-3 h-3 text-emerald-400" />
              <span>Teacher (You)</span>
            </div>

            {(isMicOn || isCameraOn) && (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse backdrop-blur-md shadow-sm">
                <Radio className="h-3 w-3" />
                LIVE
              </span>
            )}
          </div>

          {/* Center Control Buttons (Visible when Camera is OFF) */}
          {!isCameraOn && (
            <div className="flex flex-col items-center justify-center gap-2 my-auto z-10">
              <div className="flex items-center justify-center gap-3">
                {/* Mic Button */}
                <button
                  type="button"
                  onClick={toggleMic}
                  className={cn(
                    "flex items-center justify-center p-3 rounded-2xl border transition-all duration-200 shadow-xl",
                    isMicOn
                      ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/30"
                      : "bg-slate-900/90 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white"
                  )}
                  title={isMicOn ? "Mute Microphone" : "Unmute Microphone"}
                >
                  {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5 text-slate-500" />}
                </button>

                {/* Camera Button */}
                <button
                  type="button"
                  onClick={toggleCamera}
                  className={cn(
                    "flex items-center justify-center p-3 rounded-2xl border transition-all duration-200 shadow-xl",
                    isCameraOn
                      ? "bg-blue-500/20 border-blue-500/50 text-blue-400 hover:bg-blue-500/30"
                      : "bg-slate-900/90 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white"
                  )}
                  title={isCameraOn ? "Stop Camera" : "Start Camera"}
                >
                  {isCameraOn ? <VideoIcon className="w-5 h-5" /> : <VideoOff className="w-5 h-5 text-slate-500" />}
                </button>
              </div>

              <p className="text-[10px] font-semibold text-slate-400 tracking-wide">
                Audio: <span className={isMicOn ? "text-emerald-400 font-bold" : "text-slate-500"}>{isMicOn ? "ON" : "OFF"}</span>
                {" • "}
                Video: <span className="text-slate-500">OFF</span>
              </p>
            </div>
          )}

          {/* Bottom Overlay Controls (Visible when Camera is ON) */}
          {isCameraOn && (
            <div className="flex items-center justify-center gap-3 z-10 mt-auto bg-slate-950/80 backdrop-blur-md p-1.5 rounded-xl border border-slate-800/80 mx-auto shadow-lg">
              <button
                type="button"
                onClick={toggleMic}
                className={cn(
                  "p-2 rounded-lg border transition-all",
                  isMicOn ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                )}
              >
                {isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={toggleCamera}
                className={cn(
                  "p-2 rounded-lg border transition-all",
                  isCameraOn ? "bg-blue-500/20 border-blue-500/40 text-blue-400" : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
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
      <div className="w-full aspect-video bg-slate-950 rounded-xl border border-slate-800/90 shadow-md relative overflow-hidden flex flex-col justify-between p-3">
        {/* Hidden audio element for receiving teacher's voice */}
        <audio ref={audioRef} autoPlay />

        {/* Teacher's Live Video Feed when Camera is ON */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={cn(
            "absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-300",
            hasRemoteVideo ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        />

        {/* Top Header Overlay for Student */}
        <div className="flex items-center justify-between z-10">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-900/80 border border-slate-800 text-[11px] font-semibold text-slate-300 backdrop-blur-md shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{teacherName}&apos;s Stream</span>
          </div>

          {hasRemoteVideo && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse backdrop-blur-md shadow-sm">
              <Radio className="h-3 w-3" />
              LIVE
            </span>
          )}

          {/* Audio Mute/Unmute for Student */}
          <button
            type="button"
            onClick={toggleStudentMute}
            className="p-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white backdrop-blur-md transition-colors"
            title={isMutedByStudent ? "Unmute Teacher Audio" : "Mute Teacher Audio"}
          >
            {isMutedByStudent ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Black Screen Status View for Student when Teacher's Camera is OFF */}
        {!hasRemoteVideo && (
          <div className="flex flex-col items-center justify-center gap-2 my-auto z-10 text-center">
            <div className="flex items-center justify-center gap-3">
              {/* Audio Indicator */}
              <div
                className={cn(
                  "p-3 rounded-2xl border flex items-center justify-center transition-colors",
                  isTeacherAudioActive
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-slate-900/80 border-slate-800 text-slate-500"
                )}
              >
                {isTeacherAudioActive ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </div>

              {/* Video Indicator */}
              <div className="p-3 rounded-2xl border bg-slate-900/80 border-slate-800 text-slate-500 flex items-center justify-center">
                <VideoOff className="w-5 h-5" />
              </div>
            </div>

            <p className="text-[10px] font-semibold text-slate-400 tracking-wide">
              Audio: <span className={isTeacherAudioActive ? "text-emerald-400 font-bold" : "text-slate-500"}>{isTeacherAudioActive ? "ON" : "OFF"}</span>
              {" • "}
              Video: <span className="text-slate-500">OFF</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
