"use client"
import React, { useEffect, useRef, useState } from "react"
import {
    Minus,
    Plus,
    RotateCcw,
    RotateCw,
    LogOut,
    ImagePlus,
    FileUp
} from "lucide-react"
import { leaveSession } from "@/app/actions/auth"
import ThemeToggle from "../theme-toggle"
import { cn } from "@/lib/utils"
import { useSocket } from "../providers/socket-provider"
import { toast } from "sonner"

// Optimized Timer Component
export const SessionTimer = React.memo(({ initialDuration, role, sessionId }: { initialDuration: number, role: string, sessionId: string }) => {
    function formatMinutesToMMSS(minutes: number) {
        const totalSeconds = Math.floor(minutes * 60);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    const [timeLeft, setTimeLeft] = useState(initialDuration)
    const timeLeftRef = useRef(initialDuration)
    useEffect(() => { timeLeftRef.current = timeLeft }, [timeLeft])
    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft((prev) => (prev <= 0 ? 0 : prev - 1 / 60));
        }, 1000);
        return () => clearInterval(timer);
    }, []);
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

interface BoardTopBarProps {
    zoom: number
    onZoomChange: (zoom: number) => void
    boardColor: string
    setBoardColor: (color: string) => void
    role: "teacher" | "student"
    sessionId: string
    duration: number
    onPdfUpload?: (file: File) => void
}

export default function BoardTopBar({
    zoom,
    onZoomChange,
    boardColor,
    setBoardColor,
    role,
    sessionId,
    duration,
    onPdfUpload
}: BoardTopBarProps) {
    const { socket } = useSocket()
    const boardFileInputRef = useRef<HTMLInputElement>(null)
    const pdfFileInputRef = useRef<HTMLInputElement>(null)

    const handleBoardFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !socket) return

        if (!file.type.startsWith("image/")) {
            toast.error("Only image files can be added to the board")
            if (boardFileInputRef.current) boardFileInputRef.current.value = ""
            return
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error("Image must be less than 5MB")
            if (boardFileInputRef.current) boardFileInputRef.current.value = ""
            return
        }

        const reader = new FileReader()
        reader.onloadend = () => {
            socket.emit("board_file_add", {
                payload: {
                    id: crypto.randomUUID(),
                    url: reader.result as string,
                    name: file.name,
                    position: { x: 0.3, y: 0.3 },
                    scale: 0.25,
                }
            })
        }
        reader.readAsDataURL(file)
        if (boardFileInputRef.current) boardFileInputRef.current.value = ""
    }

    const handlePdfFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.type !== "application/pdf") {
            toast.error("Only PDF files are supported")
            if (pdfFileInputRef.current) pdfFileInputRef.current.value = ""
            return
        }

        if (file.size > 25 * 1024 * 1024) {
            toast.error("PDF must be less than 25MB")
            if (pdfFileInputRef.current) pdfFileInputRef.current.value = ""
            return
        }

        onPdfUpload?.(file)
        if (pdfFileInputRef.current) pdfFileInputRef.current.value = ""
    }

    const backgroundColors = ["#1a1a2e", "#0f1923", "#1e1e1e", "#0d1117", "#14213d", "#1b2838"]

    return (
        <div className="relative flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 min-h-10 bg-sidebar backdrop-blur-xl border-b border-t-0 border-l-0 border-border/50 shadow-[0_8px_32px_rgba(0,0,0,0.3)] animate-in fade-in slide-in-from-top-4 duration-500 w-full overflow-x-auto no-scrollbar">
            <div className="flex items-center">
                <span className="text-primary font-bold tracking-tighter text-lg">Board</span>
            </div>


            {/* Undo/Redo */}
            {role == 'teacher' &&
                <div className="flex items-center gap-0.5 sm:gap-1 px-1 sm:px-2 border-r border-border/50 h-7 sm:h-full">
                    <button type="button" className="p-1 sm:p-1.5 rounded-full hover:bg-accent text-muted-foreground/60 transition-colors" title="Undo (Coming Soon)">
                        <RotateCcw size={13} className="sm:w-[15px] sm:h-[15px]" />
                    </button>
                    <button type="button" className="p-1 sm:p-1.5 rounded-full hover:bg-accent text-muted-foreground/60 transition-colors" title="Redo (Coming Soon)">
                        <RotateCw size={13} className="sm:w-[15px] sm:h-[15px]" />
                    </button>
                </div>}

            {/* Board Background (Desk) */}
            {role === "teacher" && (
                <div className="flex items-center gap-1.5 shrink-0 sm:gap-2 px-1 sm:px-3 border-r border-border/50 h-7 sm:h-full">
                    <span className="hidden md:block text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-zinc-500">Desk</span>
                    <div className="flex gap-1 sm:gap-1.5">
                        {backgroundColors.map((c) => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => setBoardColor(c)}
                                className={cn(
                                    "w-3 h-3 sm:w-4 sm:h-4 rounded-full border transition-all duration-200",
                                    boardColor === c ? "ring-1 sm:ring-2 ring-blue-500 ring-offset-1 ring-offset-sidebar scale-110" : "border-zinc-700 hover:border-zinc-500"
                                )}
                                style={{ backgroundColor: c }}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Zoom Controls */}
            {/* <div className="flex shrink-0 items-center gap-0.5 sm:gap-1 pl-1">
                <button
                    type="button"
                    onClick={() => onZoomChange(Math.max(10, zoom - 10))}
                    className="p-1 sm:p-1.5 rounded-full hover:bg-accent text-foreground transition-all active:scale-95"
                >
                    <Minus size={13} className="sm:w-[15px] sm:h-[15px]" />
                </button>
                <div className="flex items-center gap-0.5 sm:gap-1 px-1 sm:px-2 min-w-[35px] sm:min-w-[55px] justify-center">
                    <span className="text-[8px] sm:text-[10px] font-black tracking-tight tabular-nums">{zoom}%</span>
                </div>
                <button
                    type="button"
                    onClick={() => onZoomChange(Math.min(500, zoom + 10))}
                    className="p-1 sm:p-1.5 rounded-full hover:bg-accent text-foreground transition-all active:scale-95"
                >
                    <Plus size={13} className="sm:w-[15px] sm:h-[15px]" />
                </button>
            </div> */}
            <div className="flex mx-auto h-full items-center shrink-0 gap-1 sm:gap-2 pl-1">
                <SessionTimer initialDuration={duration} role={role} sessionId={sessionId} />
            </div>
            <div className="flex ml-auto h-full items-center shrink-0 gap-1 sm:gap-2 pl-1">
                <div className="max-h-full">
                    <ThemeToggle cn="w-6! h-6!" iconSize={12} />
                </div>

                {role === "teacher" && (
                    <div className="flex items-center gap-1 sm:gap-2 h-full">
                        <input type="file" ref={boardFileInputRef} onChange={handleBoardFileSelect} className="hidden" accept="image/*" />
                        <button
                            type="button"
                            onClick={() => boardFileInputRef.current?.click()}
                            className="p-1.5 rounded-[4px] transition-all duration-300 text-muted-foreground hover:text-foreground hover:bg-accent border border-border/50"
                            title="Add Image to Board"
                        >
                            <ImagePlus size={15} />
                        </button>
                        <input type="file" ref={pdfFileInputRef} onChange={handlePdfFileSelect} className="hidden" accept="application/pdf" />
                        <button
                            type="button"
                            onClick={() => pdfFileInputRef.current?.click()}
                            className="p-1.5 rounded-[4px] transition-all duration-300 text-muted-foreground hover:text-foreground hover:bg-accent border border-border/50"
                            title="Upload PDF to Board"
                        >
                            <FileUp size={15} />
                        </button>
                    </div>
                )}

                <button
                    type="button"
                    onClick={() => { if (confirm("Are you sure you want to leave this session?")) leaveSession(sessionId) }}
                    className="flex items-center p-2 h-full w-auto bg-red-500 dark:bg-red-500/60 hover:bg-red-500/80 dark:hover:bg-red-500 text-white rounded-[3px] transition-all duration-300 ring-1 ring-red-500/20 hover:ring-red-500 shadow-sm group"
                    title="Leave Session"
                >
                    <LogOut size={10} className="group-hover:-translate-x-0.5 transition-transform w-full h-full" />
                </button>
            </div>
        </div>
    )
}
