"use client"
import React, { useEffect, useRef, useState, useCallback } from "react"
import {
    RotateCcw,
    RotateCw,
    LogOut,
    ImagePlus,
    FileUp,
    LocateFixed,
    Locate,
    Palette
} from "lucide-react"
import ReactDOM from "react-dom"
import BackgroundPicker from "./BackgroundPicker"
import { leaveSession } from "@/app/actions/auth"
import ThemeToggle from "../theme-toggle"
import { cn, getContrastColor } from "@/lib/utils"
import { useSocket } from "../providers/socket-provider"
import { toast } from "sonner"
import { SessionTimer } from "./SessionTimer"
import Swal from "sweetalert2"



interface BoardTopBarProps {
    zoom: number
    onZoomChange: (zoom: number) => void
    isOpen: boolean
    duration: number
    boardColor: string
    setBoardColor: (color: string) => void
    role: "teacher" | "student"
    sessionId: string
    onPdfUpload?: (file: File) => void
    isViewLocked?: boolean
    userName: string;
    onToggleViewLocked?: (enabled: boolean) => void
}

export default function BoardTopBar({
    zoom,
    onZoomChange,
    isOpen,
    duration,
    boardColor,
    setBoardColor,
    role,
    sessionId,
    onPdfUpload,
    isViewLocked = true,
    userName,
    onToggleViewLocked
}: BoardTopBarProps) {
    const { socket } = useSocket()
    const boardFileInputRef = useRef<HTMLInputElement>(null)
    const pdfFileInputRef = useRef<HTMLInputElement>(null)
    const scrollBarRef = useRef<HTMLDivElement>(null)
    const bgButtonRef = useRef<HTMLDivElement>(null)

    const [showBgPicker, setShowBgPicker] = useState(false)
    const [bgPickerPos, setBgPickerPos] = useState<{ top: number; left: number } | null>(null)
    const [canScrollRight, setCanScrollRight] = useState(false)

    const checkScroll = useCallback(() => {
        const el = scrollBarRef.current
        if (!el) return
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10)
    }, [])

    useEffect(() => {
        checkScroll()
        window.addEventListener('resize', checkScroll)
        return () => window.removeEventListener('resize', checkScroll)
    }, [checkScroll, isOpen])

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

    const toggleBgPicker = useCallback(() => {
        if (showBgPicker) {
            setShowBgPicker(false)
            return
        }
        if (bgButtonRef.current) {
            const rect = bgButtonRef.current.getBoundingClientRect()
            setBgPickerPos({
                top: rect.bottom + 8,
                left: Math.max(8, Math.min(window.innerWidth - 270, rect.left - 130 + rect.width / 2)),
            })
        }
        setShowBgPicker(true)
    }, [showBgPicker])

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (showBgPicker && bgButtonRef.current && !bgButtonRef.current.contains(e.target as Node)) {
                // If the click is on the picker itself (rendered in portal), don't close
                const picker = document.querySelector('.color-picker-safari')
                if (picker && picker.contains(e.target as Node)) return
                setShowBgPicker(false)
            }
        }
        window.addEventListener('mousedown', handleClickOutside)
        return () => window.removeEventListener('mousedown', handleClickOutside)
    }, [showBgPicker])
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                if (e.shiftKey) {
                    document.dispatchEvent(new CustomEvent("redo-trigger"))
                } else {
                    document.dispatchEvent(new CustomEvent("undo-trigger"))
                }
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])



    return (
        <div className="relative flex w-full items-center min-h-[48px] bg-sidebar backdrop-blur-xl border-b border-border/50 shadow-md animate-in fade-in slide-in-from-top-4 duration-500 overflow-hidden">
            {/* Fixed Left Section */}
            <div className="flex items-center px-3 sm:px-4 py-2 border-r border-border/50 bg-sidebar shrink-0 z-40">
                <span className="text-primary font-bold tracking-tighter text-lg">Board</span>
            </div>

            {/* Scrollable Area */}
            <div className="relative flex-1 min-w-0 h-full overflow-hidden group/topbar">
                <nav
                    ref={scrollBarRef}
                    onScroll={checkScroll}
                    className="flex items-center h-full gap-2 sm:gap-3 px-3 sm:px-4 py-2 w-full overflow-x-auto no-scrollbar scroll-smooth"
                >
                    {/* Upload Buttons (Inside scrollable, but to the right of timer) */}
                    {role === "teacher" && (
                        <div className="flex items-center gap-2 shrink-0 pl-1">
                            <input type="file" ref={boardFileInputRef} onChange={handleBoardFileSelect} className="hidden" accept="image/*" />
                            <button
                                type="button"
                                onClick={() => boardFileInputRef.current?.click()}
                                className="p-1.5 rounded-[5px] transition-all duration-300 text-muted-foreground hover:text-foreground hover:bg-accent border border-border/50 shadow-sm"
                                title="Add Image to Board"
                            >
                                <ImagePlus size={16} />
                            </button>

                            <input type="file" ref={pdfFileInputRef} onChange={handlePdfFileSelect} className="hidden" accept="application/pdf" />
                            <button
                                type="button"
                                onClick={() => pdfFileInputRef.current?.click()}
                                className="p-1.5 rounded-[5px] transition-all duration-300 text-muted-foreground hover:text-foreground hover:bg-accent border border-border/50 shadow-sm"
                                title="Upload PDF to Board"
                            >
                                <FileUp size={16} />
                            </button>
                        </div>
                    )}

                    {/* Undo/Redo */}
                    {role == 'teacher' && (
                        <div className="flex items-center gap-0.5 sm:gap-1 px-1 sm:px-2 border-r border-border/50 h-7 shrink-0">
                            <button
                                type="button"
                                onClick={() => document.dispatchEvent(new CustomEvent("undo-trigger"))}
                                className="p-1 sm:p-1.5 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                title="Undo (Ctrl+Z)"
                            >
                                <RotateCcw size={13} className="sm:w-[15px] sm:h-[15px]" />
                            </button>
                            <button
                                type="button"
                                onClick={() => document.dispatchEvent(new CustomEvent("redo-trigger"))}
                                className="p-1 sm:p-1.5 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                title="Redo (Ctrl+Shift+Z)"
                            >
                                <RotateCw size={13} className="sm:w-[15px] sm:h-[15px]" />
                            </button>
                        </div>
                    )}

                    {role === 'teacher' && (
                        <div className="flex items-center gap-1 shrink-0 sm:gap-2 px-1 border-r border-border/50 h-7">
                            <span className="hidden lg:block text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Desk</span>
                            <span className="block lg:hidden text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">D</span>
                            <div className="flex gap-1 sm:gap-1.5 items-center">
                                <div ref={bgButtonRef}>
                                    <button
                                        type="button"
                                        onClick={toggleBgPicker}
                                        className={cn(
                                            "flex items-center gap-1.5 px-2 py-1 rounded-[5px] border transition-all duration-300 shadow-sm",
                                            showBgPicker ? "ring-2 ring-primary ring-offset-1 border-primary" : "border-border/50"
                                        )}
                                        style={{
                                            backgroundColor: boardColor,
                                            color: getContrastColor(boardColor)
                                        }}
                                        title="Custom Board Color"
                                    >
                                        <Palette size={14} />
                                        <span className="text-[10px] font-bold">Desk Color</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {showBgPicker && bgPickerPos && typeof document !== 'undefined' && ReactDOM.createPortal(
                        <div
                            className="fixed z-9999 animate-in fade-in zoom-in-95 duration-200"
                            style={{ top: bgPickerPos.top, left: bgPickerPos.left }}
                        >
                            <div className="p-1.5 bg-sidebar border border-border rounded-[5px] shadow-2xl">
                                <BackgroundPicker
                                    color={boardColor}
                                    onChange={setBoardColor}
                                />
                            </div>
                        </div>,
                        document.body
                    )}

                    {/* Board Controls Toggles */}
                    {role === "teacher" && (
                        <div className="flex items-center gap-1.5 shrink-0 px-2 border-r border-border/50 h-8">

                            <button
                                type="button"
                                onClick={() => onToggleViewLocked?.(!isViewLocked)}
                                className={cn(
                                    "flex items-center gap-1.5 px-2 py-1 rounded-[5px] border transition-all duration-300",
                                    isViewLocked
                                        ? "bg-blue-500/10 border-blue-500/30 text-blue-500 hover:bg-blue-500/20"
                                        : "bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20"
                                )}
                                title={isViewLocked ? "Students' view is frozen to yours" : "Students can scroll independently"}
                            >
                                {isViewLocked ? <LocateFixed size={14} /> : <Locate size={14} />}
                                <span className="hidden xl:block text-[10px] font-black uppercase tracking-wider">{isViewLocked ? "Synced" : "Free"} View</span>
                            </button>
                        </div>
                    )}



                </nav>

                {/* Scroll Indicator (Inside the scrollable area's wrapper) */}
                {canScrollRight && (
                    <div
                        className="pointer-events-none absolute right-0 top-0 bottom-0 w-16 flex items-center justify-end pr-1 z-30 transition-opacity duration-300"
                        style={{ background: "linear-gradient(to right, transparent, var(--sidebar))" }}
                    >
                        <div className="animate-bounce-horizontal mr-1">
                            <svg className="w-3.5 h-3.5 text-primary opacity-60" viewBox="0 0 10 10" fill="currentColor">
                                <path d="M3 2 L8 5 L3 8 Z" />
                            </svg>
                        </div>
                    </div>
                )}
            </div>

            {/* Fixed Action Cluster (Very Right, Always Visible) */}
            <div className="flex items-center  px-1 py-0.5 h-full border-r border-border/50 bg-sidebar shrink-0 z-40 ">
                <SessionTimer initialDuration={duration} role={role} sessionId={sessionId} />
            </div>
            <div className="flex items-center gap-2 px-3 py-2 border-l border-border/50 bg-sidebar shrink-0 z-40 shadow-[-8px_0_12px_rgba(0,0,0,0.05)]">
                {/* <div className="h-[41px] flex items-center justify-between px-3 sm:px-6 border-b border-border shrink-0"> */}
                {/* </div> */}
                <div className="h-8 flex items-center">
                    <ThemeToggle cn="w-8 h-8 rounded-[5px]" iconSize={14} />
                </div>

                <button
                    type="button"
                    onClick={async () => {
                        const { isConfirmed } = await Swal.fire({
                            title: "Leave Session?",
                            text: "Are you sure you want to leave this session?",
                            icon: "question",
                            showCancelButton: true,
                            confirmButtonColor: "#ef4444",
                            cancelButtonColor: "#6b7280",
                            confirmButtonText: "Yes, leave"
                        })
                        if (isConfirmed) leaveSession(sessionId)
                    }}
                    className="flex items-center justify-center p-2 h-8 w-8 bg-red-500 dark:bg-red-500/80 hover:bg-red-600 dark:hover:bg-red-500 text-white rounded-[5px] transition-all duration-300 shadow-lg shadow-red-500/20 active:scale-95 group"
                    title="Leave Session"
                >
                    <LogOut size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                </button>
                <span className="text-[10px] sm:text-xs font-black tracking-widest text-muted-background">{userName} <span className=" text-muted-foreground">{role == "teacher" ? "(T)" : "(S)"}</span></span>
            </div>
        </div>
    )
}
