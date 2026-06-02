"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"
import { useSocket } from "@/hooks/use-socket"
import { 
    Play, 
    Pause, 
    Volume2, 
    VolumeX, 
    X, 
    SkipBack, 
    SkipForward, 
    Tv 
} from "lucide-react"

// ─── Global singleton: ensures the YT IFrame API is loaded exactly once ──
let ytApiPromise: Promise<void> | null = null

function loadYTApi(): Promise<void> {
    // Already fully loaded
    if ((window as any).YT?.Player) {
        return Promise.resolve()
    }

    // Already loading — return the same promise
    if (ytApiPromise) return ytApiPromise

    ytApiPromise = new Promise<void>((resolve) => {
        // Define callback BEFORE inserting the script
        const prev = (window as any).onYouTubeIframeAPIReady
        ;(window as any).onYouTubeIframeAPIReady = () => {
            if (typeof prev === "function") prev()
            resolve()
        }

        // Insert script tag (only once)
        if (!document.getElementById("yt-iframe-api")) {
            const tag = document.createElement("script")
            tag.id = "yt-iframe-api"
            tag.src = "https://www.youtube.com/iframe_api"
            const firstScript = document.getElementsByTagName("script")[0]
            firstScript?.parentNode?.insertBefore(tag, firstScript)
        }
    })

    return ytApiPromise
}

// ─── Types ────────────────────────────────────────────────────
interface YTVideoPlayerProps {
    role: "teacher" | "student"
    sessionId: string
    youtubeState: {
        videoId: string
        playStatus: "playing" | "paused"
        currentTime: number
        lastUpdated: number
    }
    onClose?: () => void
}

// YT PlayerState constants
const YT_UNSTARTED = -1
const YT_ENDED = 0
const YT_PLAYING = 1
const YT_PAUSED = 2
const YT_BUFFERING = 3
const YT_CUED = 5

export default function YTVideoPlayer({ role, sessionId, youtubeState, onClose }: YTVideoPlayerProps) {
    const { socket } = useSocket()
    const containerRef = useRef<HTMLDivElement>(null)
    const playerRef = useRef<any>(null)
    const [playerReady, setPlayerReady] = useState(false)

    // Playback state
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [volume, setVolume] = useState(50)
    const [isMuted, setIsMuted] = useState(false)

    const [isDragging, setIsDragging] = useState(false)
    const currentVideoIdRef = useRef<string | null>(null)
    const iframeIdRef = useRef(`yt-player-${sessionId}-${Date.now()}`)

    // Track whether an ad is currently playing (for students)
    const isAdPlayingRef = useRef(false)
    // Suppress sync-back during programmatic seeks
    const isSyncingRef = useRef(false)

    // ─── 1. Load API + Create Player ──────────────────────────
    useEffect(() => {
        let destroyed = false

        async function init() {
            await loadYTApi()
            if (destroyed || !containerRef.current) return

            // Create a fresh div for the player
            const iframeId = iframeIdRef.current
            let playerDiv = document.getElementById(iframeId)
            if (!playerDiv) {
                playerDiv = document.createElement("div")
                playerDiv.id = iframeId
                containerRef.current.appendChild(playerDiv)
            }

            playerRef.current = new (window as any).YT.Player(iframeId, {
                width: '100%',
                height: '100%',
                videoId: youtubeState.videoId,
                playerVars: {
                    controls: 0,
                    disablekb: 1,
                    fs: 0,
                    modestbranding: 1,
                    rel: 0,
                    showinfo: 0,
                    iv_load_policy: 3,
                    playsinline: 1,
                },
                events: {
                    onReady: (event: any) => {
                        if (destroyed) return
                        setPlayerReady(true)
                        setDuration(event.target.getDuration() || 0)
                        event.target.setVolume(volume)
                        currentVideoIdRef.current = youtubeState.videoId
                    },
                    onStateChange: (event: any) => {
                        if (destroyed) return
                        const state = event.data

                        // ── Ad detection for students ──
                        // When an ad plays, YT fires states like -1, 5, 3
                        // in rapid succession before/after the ad.
                        // We detect this to avoid UI flicker on students.
                        if (role === "student") {
                            if (state === YT_UNSTARTED || state === YT_CUED) {
                                isAdPlayingRef.current = true
                                return // Don't update UI during ad transitions
                            }
                            if (state === YT_BUFFERING && isAdPlayingRef.current) {
                                return // Still in ad territory
                            }
                            if (state === YT_PLAYING) {
                                isAdPlayingRef.current = false
                            }
                        }

                        if (state === YT_PLAYING) {
                            setIsPlaying(true)
                        } else if (state === YT_PAUSED || state === YT_ENDED) {
                            setIsPlaying(false)
                        }
                    },
                },
            })
        }

        init()

        return () => {
            destroyed = true
            if (playerRef.current) {
                try {
                    playerRef.current.destroy()
                } catch (e) {
                    console.error("Error destroying YT player", e)
                }
                playerRef.current = null
                setPlayerReady(false)
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId])

    // ─── 2. Keep local time updated ───────────────────────────
    useEffect(() => {
        if (!playerReady || !playerRef.current || isDragging) return

        const interval = setInterval(() => {
            try {
                const t = playerRef.current?.getCurrentTime?.()
                if (t !== undefined) setCurrentTime(t)

                if (duration === 0) {
                    const d = playerRef.current?.getDuration?.()
                    if (d) setDuration(d)
                }
            } catch (e) { /* player may be destroyed */ }
        }, 250)

        return () => clearInterval(interval)
    }, [playerReady, isDragging, duration])

    // ─── 3. Sync loop — react to youtubeState prop changes ────
    useEffect(() => {
        if (!playerReady || !playerRef.current) return

        const { videoId: targetVideoId, playStatus, currentTime: targetTime, lastUpdated } = youtubeState

        // Video ID changed — load new video
        if (currentVideoIdRef.current !== targetVideoId) {
            currentVideoIdRef.current = targetVideoId
            playerRef.current.loadVideoById(targetVideoId)
            return
        }

        // Calculate expected playback position accounting for network delay
        let expectedTime = targetTime
        if (playStatus === "playing") {
            const elapsed = (Date.now() - lastUpdated) / 1000
            expectedTime = targetTime + elapsed
        }

        // Correct drift > 2 seconds (handles post-ad resync)
        try {
            const localTime = playerRef.current.getCurrentTime()
            const drift = Math.abs(localTime - expectedTime)

            if (drift > 2) {
                isSyncingRef.current = true
                playerRef.current.seekTo(expectedTime, true)
                setCurrentTime(expectedTime)
                // Reset sync flag after seek completes
                setTimeout(() => { isSyncingRef.current = false }, 500)
            }
        } catch (e) { /* player may not be ready */ }

        // Sync play/pause state
        if (playStatus === "playing") {
            playerRef.current.playVideo()
            setIsPlaying(true)
        } else {
            playerRef.current.pauseVideo()
            setIsPlaying(false)
        }
    }, [youtubeState, playerReady])

    // ─── 4. Teacher heartbeat — keep students aligned ─────────
    useEffect(() => {
        if (role !== "teacher" || !playerReady || !playerRef.current || !isPlaying) return

        const heartbeat = setInterval(() => {
            if (!socket) return
            try {
                const cur = playerRef.current.getCurrentTime()
                socket.emit("yt_sync", {
                    roomId: sessionId,
                    payload: {
                        videoId: youtubeState.videoId,
                        playStatus: "playing",
                        currentTime: cur,
                        lastUpdated: Date.now(),
                    },
                })
            } catch (e) { /* player may be destroyed */ }
        }, 10000)

        return () => clearInterval(heartbeat)
    }, [role, playerReady, isPlaying, youtubeState.videoId, socket, sessionId])

    // ─── 5. Teacher-only actions ──────────────────────────────
    const handlePlayPause = useCallback(() => {
        if (role !== "teacher" || !playerReady || !playerRef.current || !socket) return

        const nextStatus = isPlaying ? "paused" : "playing"
        const curTime = playerRef.current.getCurrentTime()

        if (nextStatus === "playing") {
            playerRef.current.playVideo()
        } else {
            playerRef.current.pauseVideo()
        }
        setIsPlaying(!isPlaying)

        socket.emit("yt_sync", {
            roomId: sessionId,
            payload: {
                videoId: youtubeState.videoId,
                playStatus: nextStatus,
                currentTime: curTime,
                lastUpdated: Date.now(),
            },
        })
    }, [role, playerReady, isPlaying, socket, sessionId, youtubeState.videoId])

    const handleSeek = useCallback((newTime: number) => {
        if (role !== "teacher" || !playerReady || !playerRef.current || !socket) return

        playerRef.current.seekTo(newTime, true)
        setCurrentTime(newTime)

        socket.emit("yt_sync", {
            roomId: sessionId,
            payload: {
                videoId: youtubeState.videoId,
                playStatus: isPlaying ? "playing" : "paused",
                currentTime: newTime,
                lastUpdated: Date.now(),
            },
        })
    }, [role, playerReady, isPlaying, socket, sessionId, youtubeState.videoId])

    const handleRewind = useCallback(() => {
        if (!playerReady || !playerRef.current) return
        const cur = playerRef.current.getCurrentTime()
        handleSeek(Math.max(0, cur - 10))
    }, [playerReady, handleSeek])

    const handleFastForward = useCallback(() => {
        if (!playerReady || !playerRef.current) return
        const cur = playerRef.current.getCurrentTime()
        handleSeek(Math.min(duration, cur + 10))
    }, [playerReady, duration, handleSeek])

    const handleClose = useCallback(() => {
        if (role !== "teacher" || !socket) return
        socket.emit("yt_close", { roomId: sessionId })
        onClose?.()
    }, [role, socket, sessionId, onClose])

    // ─── 6. Local volume (both teacher & student) ─────────────
    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = parseInt(e.target.value)
        setVolume(v)
        if (playerReady && playerRef.current) {
            playerRef.current.setVolume(v)
            if (v > 0 && isMuted) {
                playerRef.current.unMute()
                setIsMuted(false)
            }
        }
    }

    const toggleMute = () => {
        if (!playerReady || !playerRef.current) return
        if (isMuted) {
            playerRef.current.unMute()
            setIsMuted(false)
        } else {
            playerRef.current.mute()
            setIsMuted(true)
        }
    }

    // ─── Helpers ──────────────────────────────────────────────
    const formatTime = (secs: number) => {
        if (isNaN(secs) || secs < 0) return "0:00"
        const m = Math.floor(secs / 60)
        const s = Math.floor(secs % 60)
        return `${m}:${s.toString().padStart(2, "0")}`
    }

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md pointer-events-none p-4">
            <div className="pointer-events-auto w-full max-w-[850px] aspect-video bg-zinc-950 border border-zinc-800/80 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col relative">
                
                {/* Header (Teacher can close) */}
                <div className="absolute top-0 inset-x-0 h-14 bg-gradient-to-b from-black/80 to-transparent z-20 flex items-center justify-between px-6 pointer-events-none">
                    <div className="flex items-center gap-2">
                        <Tv className="w-5 h-5 text-red-500 animate-pulse" />
                        <span className="text-sm font-bold tracking-wide text-zinc-100 drop-shadow-md">
                            YouTube Synced Lecture
                        </span>
                        {role === "student" && (
                            <span className="ml-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                                Synced with Teacher
                            </span>
                        )}
                    </div>
                    {role === "teacher" && (
                        <button
                            onClick={handleClose}
                            className="pointer-events-auto p-1.5 rounded-full bg-black/40 hover:bg-red-600/90 text-zinc-300 hover:text-white border border-white/5 transition-all duration-300 shadow-md backdrop-blur-md"
                            title="End Presentation"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Player Frame Wrapper */}
                <div className="flex-1 w-full h-full relative bg-zinc-950">
                    <div ref={containerRef} className="w-full h-full" />
                    
                    {/* CRITICAL INTERACTION BLOCKER — covers iframe to block YT overlays, cards, ad clicks */}
                    <div className="absolute inset-0 bg-transparent z-10" />
                </div>

                {/* Control Bar (Teacher: Full controls, Student: Status & Local Volume) */}
                <div className="bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-800/50 p-4 flex flex-col gap-3 z-20">
                    
                    {/* Seeker Progress Bar */}
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-zinc-400 font-mono select-none w-10">
                            {formatTime(currentTime)}
                        </span>
                        
                        <div className="flex-1 relative flex items-center h-4 group">
                            {role === "teacher" ? (
                                <input
                                    type="range"
                                    min={0}
                                    max={duration || 100}
                                    value={currentTime}
                                    onChange={(e) => {
                                        setIsDragging(true)
                                        setCurrentTime(parseFloat(e.target.value))
                                    }}
                                    onMouseUp={(e) => {
                                        setIsDragging(false)
                                        handleSeek(parseFloat((e.target as HTMLInputElement).value))
                                    }}
                                    onTouchEnd={(e) => {
                                        setIsDragging(false)
                                        handleSeek(parseFloat((e.target as HTMLInputElement).value))
                                    }}
                                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-red-600 focus:outline-none group-hover:h-1.5 transition-all duration-150"
                                />
                            ) : (
                                // Student gets a pure progress display that isn't interactive
                                <div className="w-full h-1 bg-zinc-800 rounded-lg overflow-hidden">
                                    <div 
                                        className="h-full bg-red-600 rounded-lg transition-all duration-300 ease-out" 
                                        style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                                    />
                                </div>
                            )}
                        </div>

                        <span className="text-xs text-zinc-400 font-mono select-none w-10 text-right">
                            {formatTime(duration)}
                        </span>
                    </div>

                    {/* Bottom Controls Row */}
                    <div className="flex items-center justify-between">
                        
                        {/* Playback Control (Teacher Only) */}
                        <div className="flex items-center gap-2">
                            {role === "teacher" ? (
                                <>
                                    <button
                                        onClick={handleRewind}
                                        className="p-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/30 transition-all"
                                        title="Rewind 10s"
                                    >
                                        <SkipBack className="w-4 h-4" />
                                    </button>

                                    <button
                                        onClick={handlePlayPause}
                                        className="p-2.5 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20 hover:scale-105 transition-all"
                                        title={isPlaying ? "Pause" : "Play"}
                                    >
                                        {isPlaying ? (
                                            <Pause className="w-4 h-4 fill-white" />
                                        ) : (
                                            <Play className="w-4 h-4 fill-white translate-x-[0.5px]" />
                                        )}
                                    </button>

                                    <button
                                        onClick={handleFastForward}
                                        className="p-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/30 transition-all"
                                        title="Fast Forward 10s"
                                    >
                                        <SkipForward className="w-4 h-4" />
                                    </button>
                                </>
                            ) : (
                                // Student Indicator
                                <div className="flex items-center gap-2 py-1 px-3 rounded-lg bg-zinc-800/40 border border-zinc-700/20">
                                    <div className={`w-2 h-2 rounded-full ${isPlaying ? "bg-red-500 animate-pulse" : "bg-zinc-500"}`} />
                                    <span className="text-xs font-semibold text-zinc-300">
                                        {isPlaying ? "Streaming Lecture" : "Lecture Paused"}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Local Volume Controls (Both Teacher & Student) */}
                        <div className="flex items-center gap-2 w-32 sm:w-40">
                            <button
                                onClick={toggleMute}
                                className="p-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all shrink-0"
                                title={isMuted ? "Unmute" : "Mute"}
                            >
                                {isMuted || volume === 0 ? (
                                    <VolumeX className="w-4 h-4" />
                                ) : (
                                    <Volume2 className="w-4 h-4" />
                                )}
                            </button>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                value={isMuted ? 0 : volume}
                                onChange={handleVolumeChange}
                                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-300"
                            />
                        </div>

                    </div>
                </div>

            </div>
        </div>
    )
}
