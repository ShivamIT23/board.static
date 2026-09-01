"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import {
    Mic, MicOff, Video as VideoIcon, VideoOff,
    Maximize2, Minimize2, MonitorUp, MonitorOff,
    Radio, UserCheck, MessageCircle
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DemoStreamProps {
    userName?: string;
    isCollapsed?: boolean;
    isChatOpen?: boolean;
    isVideoExpanded?: boolean;
    onExpandChange?: (expanded: boolean) => void;
    onToggleChat?: () => void;
    isMobile?: boolean;
}

export default function DemoStream({
    userName = "Teacher",
    isCollapsed = false,
    isChatOpen = true,
    isVideoExpanded,
    onExpandChange,
    onToggleChat,
    isMobile = false,
}: DemoStreamProps) {
    const [isMicOn, setIsMicOn] = useState(false);
    const [isCameraOn, setIsCameraOn] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [internalIsExpanded, setInternalIsExpanded] = useState(false);

    const isExpanded = isVideoExpanded !== undefined ? isVideoExpanded : internalIsExpanded;

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const expandedVideoRef = useRef<HTMLVideoElement>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const screenStreamRef = useRef<MediaStream | null>(null);

    // Stop camera track
    const stopCamera = useCallback(() => {
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getVideoTracks().forEach((t) => t.stop());
            if (!isMicOn) {
                mediaStreamRef.current.getTracks().forEach((t) => t.stop());
                mediaStreamRef.current = null;
            }
        }
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (expandedVideoRef.current) expandedVideoRef.current.srcObject = null;
        setIsCameraOn(false);
    }, [isMicOn]);

    // Stop mic track
    const stopMic = useCallback(() => {
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getAudioTracks().forEach((t) => t.stop());
            if (!isCameraOn) {
                mediaStreamRef.current.getTracks().forEach((t) => t.stop());
                mediaStreamRef.current = null;
            }
        }
        setIsMicOn(false);
    }, [isCameraOn]);

    // Toggle camera
    const toggleCamera = async () => {
        if (isCameraOn) {
            stopCamera();
            toast.info("Camera turned off");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: isMicOn,
            });

            mediaStreamRef.current = stream;
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
                localVideoRef.current.play().catch(() => {});
            }
            if (expandedVideoRef.current) {
                expandedVideoRef.current.srcObject = stream;
                expandedVideoRef.current.play().catch(() => {});
            }
            setIsCameraOn(true);
            toast.success("Camera preview active (Local Demo)");
        } catch (err) {
            console.error("Camera access error:", err);
            toast.error("Could not access camera. Please allow camera permissions in browser.");
        }
    };

    // Toggle mic
    const toggleMic = async () => {
        if (isMicOn) {
            stopMic();
            toast.info("Microphone muted");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: isCameraOn,
            });

            mediaStreamRef.current = stream;
            setIsMicOn(true);
            toast.success("Microphone active (Local Demo)");
        } catch (err) {
            console.error("Microphone access error:", err);
            toast.error("Could not access microphone. Please check permissions.");
        }
    };

    // Toggle screen share
    const toggleScreenShare = async () => {
        if (isScreenSharing) {
            if (screenStreamRef.current) {
                screenStreamRef.current.getTracks().forEach((track) => track.stop());
                screenStreamRef.current = null;
            }
            setIsScreenSharing(false);
            toast.info("Screen sharing stopped");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            screenStreamRef.current = stream;
            stream.getVideoTracks()[0].onended = () => {
                setIsScreenSharing(false);
                screenStreamRef.current = null;
            };
            setIsScreenSharing(true);
            toast.success("Screen sharing active (Demo)");
        } catch (err) {
            console.warn("Screen share cancelled:", err);
        }
    };

    const toggleExpand = (expand: boolean) => {
        setInternalIsExpanded(expand);
        onExpandChange?.(expand);
        // reattach stream to the active video element
        setTimeout(() => {
            if (mediaStreamRef.current) {
                if (expand && expandedVideoRef.current) {
                    expandedVideoRef.current.srcObject = mediaStreamRef.current;
                    expandedVideoRef.current.play().catch(() => {});
                } else if (!expand && localVideoRef.current) {
                    localVideoRef.current.srcObject = mediaStreamRef.current;
                    localVideoRef.current.play().catch(() => {});
                }
            }
        }, 50);
    };

    // Clean up on unmount
    useEffect(() => {
        return () => {
            if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach((t) => t.stop());
            if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach((t) => t.stop());
        };
    }, []);

    // ─── EXPANDED FULL VIEW OVER WHITEBOARD (SCREENSHOT 4) ───
    if (isExpanded) {
        return (
            <div
                className={cn(
                    "fixed top-10 md:top-12 left-0 bottom-0 z-40 bg-slate-200/95 dark:bg-slate-950/95 backdrop-blur-xl p-2 sm:p-6 flex flex-col justify-between animate-in fade-in zoom-in-95 duration-200 transition-all",
                    isChatOpen && !isMobile ? "right-0 sm:right-64 md:right-80" : "right-0"
                )}
            >
                <div className="w-full flex-1 bg-slate-200/90 dark:bg-slate-950 rounded-xl sm:rounded-2xl border border-slate-300 dark:border-slate-800/90 shadow-2xl relative overflow-hidden flex flex-col justify-between p-2.5 sm:p-4">
                    <video
                        ref={expandedVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className={cn(
                            "absolute inset-0 w-full h-full object-contain z-0 transition-opacity duration-300",
                            (isCameraOn || isScreenSharing) ? "opacity-100" : "opacity-0 pointer-events-none"
                        )}
                    />

                    {/* Top Status and Restore Whiteboard */}
                    <div className="flex items-center justify-between z-10 gap-2">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <div className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-[10px] sm:text-xs font-semibold text-slate-800 dark:text-slate-200 backdrop-blur-md shadow-md">
                                <UserCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-500 dark:text-emerald-400" />
                                <span>Teacher (You)</span>
                            </div>
                            {(isMicOn || isCameraOn || isScreenSharing) && (
                                <span className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-xs font-extrabold bg-red-500/20 text-red-500 dark:text-red-400 border border-red-500/40 animate-pulse backdrop-blur-md shadow-md">
                                    <Radio className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                    {isScreenSharing ? "SCREEN SHARE" : "LIVE"}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => toggleExpand(false)}
                                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 text-[10px] sm:text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 backdrop-blur-md shadow-xl transition-all cursor-pointer"
                                title="Restore Whiteboard"
                            >
                                <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 dark:text-emerald-400" />
                                <span>Restore Whiteboard</span>
                            </button>
                        </div>
                    </div>

                    {/* Middle Center Controls when camera is off */}
                    {!isCameraOn && (
                        <div className="flex flex-col items-center justify-center gap-2 sm:gap-4 my-auto z-10">
                            <div className="flex items-center justify-center gap-3 sm:gap-4">
                                <button
                                    type="button"
                                    onClick={toggleMic}
                                    className={cn(
                                        "p-3 sm:p-4 rounded-xl sm:rounded-2xl border flex items-center justify-center transition-all shadow-2xl cursor-pointer hover:scale-105 active:scale-95",
                                        isMicOn
                                            ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/30"
                                            : "bg-white/90 dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
                                    )}
                                    title={isMicOn ? "Mute Microphone" : "Unmute Microphone"}
                                >
                                    {isMicOn ? (
                                        <Mic className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-500 dark:text-emerald-400 animate-pulse" />
                                    ) : (
                                        <MicOff className="w-6 h-6 sm:w-8 sm:h-8" />
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={toggleCamera}
                                    className={cn(
                                        "p-3 sm:p-4 rounded-xl sm:rounded-2xl border flex items-center justify-center shadow-2xl transition-all cursor-pointer hover:scale-105 active:scale-95",
                                        isCameraOn
                                            ? "bg-blue-500/20 border-blue-500/50 text-blue-600 dark:text-blue-400 hover:bg-blue-500/30"
                                            : "bg-white/90 dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
                                    )}
                                    title={isCameraOn ? "Stop Camera" : "Start Camera"}
                                >
                                    <VideoOff className="w-6 h-6 sm:w-8 sm:h-8" />
                                </button>
                            </div>
                            <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 tracking-wide">
                                Audio: <span className={isMicOn ? "text-emerald-500 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"}>{isMicOn ? "ON" : "OFF"}</span>
                                {" • "}
                                Video: <span className={isCameraOn ? "text-blue-500 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}>{isCameraOn ? "ON" : "OFF"}</span>
                            </p>
                        </div>
                    )}

                    {/* Bottom Control Bar */}
                    <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-3 z-10 mt-auto bg-white/90 dark:bg-slate-950/90 backdrop-blur-md px-2.5 sm:px-4 py-1.5 sm:py-2.5 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 mx-auto shadow-2xl max-w-full overflow-x-auto">
                        <button
                            type="button"
                            onClick={toggleMic}
                            className={cn(
                                "flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border font-bold text-[10px] sm:text-xs transition-all cursor-pointer shrink-0",
                                isMicOn
                                    ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/30"
                                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                            )}
                        >
                            {isMicOn ? <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <MicOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                            <span>{isMicOn ? "Mic ON" : "Mic OFF"}</span>
                        </button>
                        <button
                            type="button"
                            onClick={toggleCamera}
                            className={cn(
                                "flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border font-bold text-[10px] sm:text-xs transition-all cursor-pointer shrink-0",
                                isCameraOn
                                    ? "bg-blue-500/20 border-blue-500/50 text-blue-600 dark:text-blue-400 hover:bg-blue-500/30"
                                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                            )}
                        >
                            {isCameraOn ? <VideoIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <VideoOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                            <span>{isCameraOn ? "Camera ON" : "Camera OFF"}</span>
                        </button>
                        <button
                            type="button"
                            onClick={toggleScreenShare}
                            className={cn(
                                "flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border font-bold text-[10px] sm:text-xs transition-all cursor-pointer shrink-0",
                                isScreenSharing
                                    ? "bg-purple-500/20 border-purple-500/50 text-purple-600 dark:text-purple-400 hover:bg-purple-500/30"
                                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                            )}
                        >
                            {isScreenSharing ? <MonitorOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <MonitorUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                            <span>{isScreenSharing ? "Stop Share" : "Share Screen"}</span>
                        </button>
                        {/* <button
                            type="button"
                            onClick={() => toggleExpand(false)}
                            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-[10px] sm:text-xs font-bold transition-all cursor-pointer shrink-0"
                        >
                            <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span>Restore Whiteboard</span>
                        </button> */}
                    </div>
                </div>

                {/* Floating Chat Bubble Button when Chat is Minimized */}
                {onToggleChat && !isChatOpen && (
                    <button
                        type="button"
                        onClick={onToggleChat}
                        className="absolute bottom-3 right-3 sm:bottom-5 sm:right-5 p-2.5 sm:p-3 rounded-full border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 text-blue-500 dark:text-blue-400 shadow-2xl hover:scale-110 transition-all cursor-pointer z-50 flex items-center justify-center"
                        title="Open Chat Sidebar"
                    >
                        <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                )}
            </div>
        );
    }

    // ─── MOBILE PiP FLOATING THUMBNAIL ───────────────────────
    if (isMobile) {
        return (
            <div className="fixed top-12 right-2 z-50 w-28 rounded-xl overflow-hidden shadow-2xl border border-border/60 bg-slate-200/90 dark:bg-slate-950/90 backdrop-blur-md">
                <div className="relative aspect-video">
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className={cn(
                            "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
                            isCameraOn ? "opacity-100" : "opacity-0 pointer-events-none"
                        )}
                    />

                    {/* Center icon when camera is off */}
                    {!isCameraOn && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <VideoOff className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                        </div>
                    )}

                    {/* LIVE indicator */}
                    {(isMicOn || isCameraOn) && (
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
                    <button
                        type="button"
                        onClick={toggleMic}
                        className={cn(
                            "p-1 rounded-md transition-all cursor-pointer",
                            isMicOn ? "text-emerald-500" : "text-slate-400"
                        )}
                    >
                        {isMicOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                    </button>
                    <button
                        type="button"
                        onClick={toggleCamera}
                        className={cn(
                            "p-1 rounded-md transition-all cursor-pointer",
                            isCameraOn ? "text-blue-500" : "text-slate-400"
                        )}
                    >
                        {isCameraOn ? <VideoIcon className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
                    </button>
                </div>
            </div>
        );
    }

    // ─── NORMAL SIDEBAR STREAM VIEW (SCREENSHOTS 2 & 3) ───
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

                {/* Top Badge: Teacher (You) */}
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

                {/* Center Buttons when Camera is OFF */}
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
                                {isMicOn ? <Mic className="w-5 h-5 text-emerald-500" /> : <MicOff className="w-5 h-5 text-slate-500" />}
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
                                {isCameraOn ? <VideoIcon className="w-5 h-5 text-blue-500" /> : <VideoOff className="w-5 h-5 text-slate-500" />}
                            </button>
                        </div>
                        <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 tracking-wide">
                            Audio: <span className={isMicOn ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-slate-500"}>{isMicOn ? "ON" : "OFF"}</span>
                            {" • "}
                            Video: <span className="text-slate-500">OFF</span>
                        </p>
                    </div>
                )}

                {/* Bottom Controls when Camera is ON */}
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
