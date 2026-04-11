"use client"

import React, { useState, useEffect, useRef, useMemo } from "react"
// Import new sub-components
import Toolbar from "./Toolbar"
import Whiteboard from "./Whiteboard"
import ChatRoom from "./ChatRoom"
import BoardTopBar from "./BoardTopBar"
import ThemeToggle from "../theme-toggle"
import { SocketProvider } from "../providers/socket-provider"
import { LogOut } from "lucide-react"
import { leaveSession } from "@/app/actions/auth"

interface RoomUser {
    user_id: string
    username: string
    socket_id: string
    isMuted?: boolean
    mediaState?: { audio: boolean; video: boolean }
}

interface MainBoardProps {
    duration: number
    sessionId: string
    role: "teacher" | "student"
    userName: string
    userId?: string
    visitorId?: number
}

export default function MainBoard({ duration, sessionId, role, userName, userId, visitorId }: MainBoardProps) {
    // Board State
    const [tool, setTool] = useState("pencil")
    const [color, setColor] = useState("#FFFFFF")
    const [boardColor, setBoardColor] = useState("#18181b")
    const [brushSize, setBrushSize] = useState(3)
    const [isLocked,] = useState(false)
    const [userCount, setUserCount] = useState(1)
    const [roomUsers, setRoomUsers] = useState<RoomUser[]>([])

    // Page & Zoom Management
    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [zoom, setZoom] = useState(100)

    // Socket server URL
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3005"



function formatMinutesToMMSS(minutes: number) {
    const totalSeconds = Math.floor(minutes * 60);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;

    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Optimized Timer Component to prevent full-board re-renders every second
const SessionTimer = React.memo(({ initialDuration, role, sessionId }: { initialDuration: number, role: string, sessionId: string }) => {
    const [timeLeft, setTimeLeft] = useState(initialDuration)
    const timeLeftRef = useRef(initialDuration)

    useEffect(() => {
        timeLeftRef.current = timeLeft
    }, [timeLeft])

    // 1. Countdown Logic
    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 0) return 0;
                return prev - (1 / 60);
            });
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // 2. Sync Logic
    useEffect(() => {
        if (role === "teacher") {
            const syncTimer = setInterval(async () => {
                try {
                    await fetch("/api/session/duration", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ sessionId, duration: timeLeftRef.current })
                    });
                } catch (error) { console.error("Sync error:", error); }
            }, 60000);
            return () => clearInterval(syncTimer);
        } else {
            const syncTimer = setInterval(async () => {
                try {
                    const res = await fetch(`/api/session/duration?sessionId=${sessionId}`);
                    const data = await res.json();
                    if (data.duration !== undefined) setTimeLeft(data.duration);
                } catch (error) { console.error("Fetch error:", error); }
            }, 4 * 60 * 1000);
            return () => clearInterval(syncTimer);
        }
    }, [role, sessionId]);

    return (
        <div className="flex items-center gap-1.5 px-1 py-0.5 bg-muted rounded-[5px] border border-border">
            <span className={`text-sm font-black uppercase tracking-widest ${timeLeft < 5 ? 'text-red-500 animate-pulse-scale' : 'text-green-600 dark:text-green-500'}`}>
                {formatMinutesToMMSS(timeLeft)}
            </span>
        </div>
    )
})
SessionTimer.displayName = "SessionTimer"


    const updateBoardBackground = (newColor: string) => {
        // Only update local state in static mode
        setBoardColor(newColor)
    }


    const user = useMemo(() => ({
        id: userId || "guest",
        name: userName,
        isTeacher: role === "teacher",
        visitorId
    }), [userId, userName, role, visitorId]);

    return (
        <SocketProvider
            url={socketUrl}
            roomId={sessionId}
            user={user}
        >
            <div className="flex flex-col w-screen h-screen bg-background text-foreground overflow-hidden font-sans">
                {/* Minimal Board Header */}
                <header className="h-14 border-b border-border bg-header flex items-center justify-between px-3 z-40 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            {/* <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-black text-lg ">B</span>
                        </div> */}
                            <span className="text-primary font-bold tracking-tighter text-xl">Board</span>
                        </div>
                        {role == "teacher" && <>
                            <div className="h-6 w-px bg-border mx-2" />
                            <div className="flex flex-col">
                                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest leading-none mb-1">Active Session</span>
                                <span className="text-xs text-foreground font-medium">{sessionId}</span>
                            </div>
                        </>
                        }
                    </div>

                    <div className="flex items-center gap-6">
                        <ThemeToggle />
                        <div className="flex items-center gap-2">
                             <SessionTimer initialDuration={duration} role={role} sessionId={sessionId} />
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <p className="text-sm text-foreground font-bold mb-1">{userName}</p>
                                <p className="text-[10px] text-muted-foreground font-bold capitalize tracking-widest leading-none">({role})</p>
                            </div>
                            <div className="w-10 h-10 bg-linear-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-black shadow-lg">
                                {userName.charAt(0).toUpperCase()}
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                if (confirm("Are you sure you want to leave this session?")) {
                                    leaveSession(sessionId);
                                }
                            }}
                            className="flex items-center gap-2 px-4 h-10 bg-red-500 dark:bg-red-500/60 hover:bg-red-500/80 dark:hover:bg-red-500 text-white rounded-lg transition-all duration-300 font-bold text-xs ring-1 ring-red-500/20 hover:ring-red-500 shadow-sm group"
                            title="Leave Session"
                        >
                            <LogOut size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                            <span>Leave</span>
                        </button>
                    </div>
                </header>

                <div className="flex flex-1 overflow-hidden">
                    {/* 1. Sidebar Tools */}
                    <Toolbar
                        tool={tool}
                        setTool={setTool}
                        role={role}
                        color={color}
                        setColor={setColor}
                        boardColor={boardColor}
                        setBoardColor={updateBoardBackground}
                        brushSize={brushSize}
                        setBrushSize={setBrushSize}
                        onClearCanvas={role === "teacher" ? () => {
                            // Will be handled by ClearCanvasEmitter below
                            document.dispatchEvent(new CustomEvent("clear-canvas-emit"))
                        } : undefined}
                    />

                    {/* 2. Main Drawing Canvas */}
                    <div className="flex-1 overflow-hidden relative flex flex-col">
                        {/* <BoardTopBar
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                            onAddPage={() => {
                                setTotalPages(prev => prev + 1)
                                setCurrentPage(totalPages + 1)
                            }}
                            zoom={zoom}
                            onZoomChange={setZoom}
                        /> */}
                        <div className="flex-1 relative">
                            <Whiteboard
                                sessionId={sessionId}
                                role={role}
                                tool={tool}
                                color={color}
                                boardColor={boardColor}
                                brushSize={brushSize}
                                isLocked={isLocked}
                            />
                        </div>
                    </div>

                    {/* 3. Real-time Chat Panel */}
                    <ChatRoom
                        userCount={userCount}
                        roomUsers={roomUsers}
                        setRoomUsers={setRoomUsers}
                        setUserCount={setUserCount}
                        role={role}
                        userName={userName}
                        sessionId={sessionId}
                    />
                </div>
            </div>
        </SocketProvider>
    )
}
