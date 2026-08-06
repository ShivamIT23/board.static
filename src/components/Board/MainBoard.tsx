"use client"

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import Toolbar from "./Toolbar"
import Whiteboard from "./Whiteboard"
import ChatRoom from "../Chat/ChatRoom"
import BoardTopBar from "./BoardTopBar"
// import YTVideoPlayer from "./YTVideoPlayer" // ── YT VIDEO FEATURE (COMMENTED OUT) ──
import { SocketProvider } from "../providers/socket-provider"
import { useSocket } from "@/hooks/use-socket"
import type { RoomUser, Poll, QuizState } from "@/types/chat"
import PollModal from "./PollModal"
import QuizModal from "./QuizModal"
import { endSessionAction } from "@/app/actions/auth"
import { toast } from "sonner"
import Swal from "sweetalert2"
import { cn } from "@/lib/utils"

interface MainBoardProps {
    duration: number
    sessionId: string
    role: "teacher" | "student"
    userName: string
    userId?: string
    visitorId?: number
    isClassEnded?: boolean
    endedAt?: number
    durationAdded?: number
    startTime?: number
    hasQuiz?: boolean
    classId?: number
}

function MainBoardInner({ duration, sessionId, role, userName, userId, visitorId, isClassEnded, setIsClassEnded, endedAt, setEndedAt, durationAdded, startTime, hasQuiz, classId }: MainBoardProps & {
    setIsClassEnded: React.Dispatch<React.SetStateAction<boolean | undefined>>,
    setEndedAt: React.Dispatch<React.SetStateAction<number | undefined>>
}) {
    // Board State
    const [tool, setTool] = useState("pen:pen")
    const [imageStampData, setImageStampData] = useState<string | null>(null)
    const [color, setColor] = useState("#FFFFFF")
    const [pageBgColors, setPageBgColors] = useState<Record<number, string>>({ 1: "#18181b" })
    const [pageBgImages, setPageBgImages] = useState<Record<number, string[]>>({})
    const [pageNames, setPageNames] = useState<Record<number, string>>({})
    const [brushSize, setBrushSize] = useState(3)
    const [drawingEnabled, setDrawingEnabled] = useState(role === "teacher")
    const [userCount, setUserCount] = useState(1)
    const [roomUsers, setRoomUsers] = useState<RoomUser[]>([])
    const [isChatOpen, setIsChatOpen] = useState(true)
    const [isViewLocked, setIsViewLocked] = useState(true)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [isFsChatOpen, setIsFsChatOpen] = useState(false)
    const [unreadCount, setUnreadCount] = useState(0)
    const [poll, setPoll] = useState<Poll | null>(null)
    const [pollsHistory, setPollsHistory] = useState<Poll[]>([])
    const [isPollOpen, setIsPollOpen] = useState(false)
    const [currentQuiz, setCurrentQuiz] = useState<QuizState | null>(null)
    const [isQuizOpen, setIsQuizOpen] = useState(false)
    /* ── YT VIDEO FEATURE (COMMENTED OUT) ──
    const [youtubeState, setYoutubeState] = useState<{
        videoId: string;
        playStatus: "playing" | "paused";
        currentTime: number;
        lastUpdated: number;
    } | null>(null)
    */
    const mainContainerRef = useRef<HTMLDivElement>(null)

    // Page & Zoom Management
    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)

    // Shape colors


    // Text font settings
    const [fontSize, setFontSize] = useState(24)
    const [fontFamily, setFontFamily] = useState("Inter, sans-serif")

    const { socket } = useSocket()

    // Derived current color
    const currentBoardColor = pageBgColors[currentPage] || "#18181b"
    const currentBgImages = pageBgImages[currentPage]

    // Clear image stamp data when switching away from image-stamp tool
    useEffect(() => {
        if (tool !== "image-stamp") setImageStampData(null)
    }, [tool])

    useEffect(() => {
        if (!socket) return
        const handleBoardColorSync = ({ color, page }: { color: string, page?: number }) => {
            console.log("Syncing board color:", color, "for page:", page)
            setPageBgColors(prev => ({ ...prev, [page || 1]: color }))
        }
        const handlePageUpdate = ({ payload }: { payload: { currentPage?: number, totalPages?: number, bgColors?: Record<number, string>, bgImages?: Record<number, string[]>, pageNames?: Record<number, string> } }) => {
            console.log("Received page update:", payload)
            if (payload.currentPage !== undefined) setCurrentPage(payload.currentPage)
            if (payload.totalPages !== undefined) setTotalPages(payload.totalPages)
            if (payload.bgColors !== undefined) setPageBgColors(prev => ({ ...prev, ...payload.bgColors }))
            if (payload.bgImages !== undefined) setPageBgImages(prev => ({ ...prev, ...payload.bgImages }))
            if (payload.pageNames !== undefined) setPageNames(prev => ({ ...prev, ...payload.pageNames }))
        }

        // Calculate labels for tabs (B-1, B-2 for board; P-1, P-2 for PDF)
        // Note: we can't easily put this in useMemo because pageBgImages might update separately from totalPages
        // But for rendering, it's fine.

        const handlePageState = ({ payload }: { payload: { pages?: Record<string, unknown>[], currentPageId?: string } }) => {
            console.log("Received initial page state:", payload)
            if (payload.pages) setTotalPages(payload.pages.length)
        }
        socket.on("board_color_sync", handleBoardColorSync)
        socket.on("page_update", handlePageUpdate)
        socket.on("page_state", handlePageState)

        // Per-student drawing permission
        const handleDrawingPermission = ({ payload }: { payload: { enabled: boolean } }) => {
            setDrawingEnabled(payload.enabled)
        }
        socket.on("drawing_permission", handleDrawingPermission)

        // Derive initial drawing state from room_users for students
        const handleRoomUsersDrawing = ({ payload }: { payload: { users: Array<{ user_id: string; socket_id: string; drawingEnabled?: boolean }> } }) => {
            if (role === "student") {
                const me = payload.users.find(u => u.socket_id === socket.id)
                if (me) {
                    const newVal = me.drawingEnabled ?? false
                    setDrawingEnabled(prev => prev === newVal ? prev : newVal)
                }
            }
        }
        socket.on("room_users", handleRoomUsersDrawing)



        // Global view lock state
        const handleViewLockedState = ({ payload }: { payload: { isLocked: boolean } }) => {
            console.log("Received view locked state:", payload.isLocked)
            setIsViewLocked(payload.isLocked)
            
            if (role === "student") {
                if (payload.isLocked) {
                    toast.info("Synced View Enabled", {
                        description: "You are now following the teacher's screen.",
                        duration: 5000,
                    });
                } else {
                    toast.success("Free View Enabled", {
                        description: "You can now scroll independently also.",
                        duration: 5000,
                    });
                }
            }
        }
        socket.on("view_locked_state", handleViewLockedState)

        const handlePollUpdate = ({ payload, pollsHistory: history }: { payload: Poll | null, pollsHistory?: Poll[] }) => {
            console.log("Received poll update:", payload, history)
            setPoll(payload)
            if (history) setPollsHistory(history)
            if (payload && payload.isActive) {
                const voterId = visitorId ? String(visitorId) : userId
                if (role === "student" && voterId) {
                    const hasVoted = payload.options.some(opt => opt.votes.includes(voterId))
                    if (hasVoted) {
                        setIsPollOpen(false)
                    } else {
                        setIsPollOpen(true)
                    }
                } else {
                    setIsPollOpen(true)
                }
            }
        }
        socket.on("poll_update", handlePollUpdate)

        const handleQuizUpdate = ({ payload }: { payload: QuizState | null }) => {
            console.log("Received quiz update:", payload)
            setCurrentQuiz(payload)
            if (payload && payload.isActive) {
                const voterId = visitorId ? String(visitorId) : userId
                if (role === "student" && voterId) {
                    const hasSubmitted = payload.submittedUsers.includes(voterId)
                    if (!hasSubmitted) {
                        // Only force-open for students who haven't submitted yet
                        setIsQuizOpen(true)
                    }
                    // If already submitted, keep modal in its current state so student can view results
                } else {
                    setIsQuizOpen(true)
                }
            }
        }
        socket.on("quiz_update", handleQuizUpdate)

        /* ─── START OF SESSION ENDED LISTENER (COMMENTABLE) ──── */
        const handleSessionEnded = ({ endedAt: serverEndedAt }: { endedAt?: number }) => {
            const now = serverEndedAt || Date.now();
            setEndedAt(now);
            setIsClassEnded(true);
            setIsViewLocked(false);
            socket.disconnect();

            Swal.fire({
                title: "Class Ended",
                text: "This session has been ended by the teacher. Redirecting...",
                icon: "info",
                timer: 2000,
                showConfirmButton: false,
                allowOutsideClick: false,
                allowEscapeKey: false,
            }).then(() => {
                const targetUrl = process.env.NEXT_PUBLIC_MAIN_APP_URL || "/class-ended";
                window.location.href = targetUrl;
            });

            setTimeout(() => {
                const targetUrl = process.env.NEXT_PUBLIC_MAIN_APP_URL || "/class-ended";
                window.location.href = targetUrl;
            }, 2000);
        }
        socket.on("session_ended", handleSessionEnded);
        /*─── END OF SESSION ENDED LISTENER ────────────────────── */

        /* ── YT VIDEO FEATURE (COMMENTED OUT) ──
        // YouTube sync handlers
        const handleYtSync = ({ payload }: { payload: any }) => {
            console.log("YouTube sync update:", payload)
            setYoutubeState(payload)
        }
        const handleYtClose = () => {
            console.log("YouTube closed")
            setYoutubeState(null)
        }
        socket.on("yt_sync", handleYtSync)
        socket.on("yt_close", handleYtClose)
        */

        return () => {
            socket.off("board_color_sync", handleBoardColorSync)
            socket.off("page_update", handlePageUpdate)
            socket.off("page_state", handlePageState)
            socket.off("drawing_permission", handleDrawingPermission)
            socket.off("room_users", handleRoomUsersDrawing)
            socket.off("view_locked_state", handleViewLockedState)
            socket.off("poll_update", handlePollUpdate)
            socket.off("quiz_update", handleQuizUpdate)
            socket.off("session_ended", handleSessionEnded)
            /* ── YT VIDEO FEATURE (COMMENTED OUT) ──
            socket.off("yt_sync", handleYtSync)
            socket.off("yt_close", handleYtClose)
            */
        }
    }, [socket, role, userId, visitorId, setIsClassEnded, setEndedAt])

    /* ─── PERSISTENT GRACE PERIOD REDIRECTION (COMMENTABLE) ──────── */
    useEffect(() => {
        if (isClassEnded && endedAt) {
            const updateRemaining = () => {
                const now = Date.now();
                const elapsed = now - endedAt;
                const gracePeriod = 10 * 60 * 1000;
                const remaining = Math.max(0, Math.floor((gracePeriod - elapsed) / 1000));
                if (remaining <= 0) {
                    window.location.href = "/class-ended";
                }
            };

            updateRemaining();
            const interval = setInterval(updateRemaining, 1000);
            return () => clearInterval(interval);
        }
    }, [isClassEnded, endedAt]);
    /*────────────────────────────────────────────────────────────── */

    /* ─── POST-SESSION ACCESS (COMMENTABLE) ────────────────────── */
    useEffect(() => {
        if (isClassEnded) {
            setDrawingEnabled(true);
            setIsViewLocked(false);
        }
    }, [isClassEnded]);
   /* ────────────────────────────────────────────────────────────── */

    const pageLabels = useMemo(() => {
        let bCount = 0;
        const labels: Record<number, string> = {};
        for (let i = 1; i <= totalPages; i++) {
            const isPdf = !!(pageBgImages[i] && pageBgImages[i].length > 0);
            if (isPdf) {
                const name = pageNames[i];
                if (name) {
                    // Show first 4 chars of filename (without extension) + "..."
                    const baseName = name.replace(/\.pdf$/i, "");
                    labels[i] = baseName.length > 8 ? `${baseName.slice(0, 8)}...` : baseName;
                } else {
                    labels[i] = "PDF";
                }
            } else {
                bCount++;
                labels[i] = `B-${bCount}`;
            }
        }
        return labels;
    }, [totalPages, pageBgImages, pageNames])

    const updateBoardBackground = (newColor: string) => {
        setPageBgColors(prev => ({ ...prev, [currentPage]: newColor }))
        if (role === "teacher" && socket) {
            socket.emit("board_color_change", {
                roomId: sessionId,
                color: newColor,
                page: currentPage
            })
        }
    }

    const handlePageChange = (page: number) => {
        console.log("Switching to page:", page)
        setCurrentPage(page)
        if (role === "teacher" && socket) {
            socket.emit("page_update", {
                roomId: sessionId,
                payload: {
                    currentPage: page,
                    totalPages: totalPages
                }
            })
        }
    }

    const handleAddPage = () => {
        const newTotal = totalPages + 1
        console.log("Adding page. New total:", newTotal)
        setTotalPages(newTotal)
        setCurrentPage(newTotal)

        // Ensure new page has a default color
        setPageBgColors(prev => ({ ...prev, [newTotal]: "#18181b" }))

        if (role === "teacher" && socket) {
            socket.emit("page_update", {
                roomId: sessionId,
                payload: {
                    currentPage: newTotal,
                    totalPages: newTotal,
                    bgColors: { ...pageBgColors, [newTotal]: "#18181b" }
                }
            })
        }
    }

    // ── PDF Upload Handler ────────────────────────────────────
    const handlePdfUpload = useCallback(async (file: File) => {
        if (role !== "teacher") return

        toast.info("Processing PDF... Please wait.")

        try {
            // Dynamic import of pdfjs-dist
            const pdfjsLib = await import("pdfjs-dist")

            // Set worker source locally
            pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
                "pdfjs-dist/build/pdf.worker.mjs",
                import.meta.url
            ).toString()

            const arrayBuffer = await file.arrayBuffer()
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
            const numPages = pdf.numPages

            console.log(`PDF loaded: ${numPages} pages`)

            const dataUrls: string[] = []
            for (let i = 1; i <= numPages; i++) {
                const page = await pdf.getPage(i)
                const viewport = page.getViewport({ scale: 2.0 })

                const offscreen = document.createElement("canvas")
                offscreen.width = viewport.width
                offscreen.height = viewport.height
                const ctx = offscreen.getContext("2d")!

                await page.render({ canvasContext: ctx, viewport, canvas: offscreen }).promise
                dataUrls.push(offscreen.toDataURL("image/jpeg", 0.85))
            }

            // Update local state: add one page with all PDF images stacked
            const pageIdx = totalPages + 1
            const newBgImages = { [pageIdx]: dataUrls }
            const newBgColors = { [pageIdx]: "#ffffff" }
            const newPageNames = { [pageIdx]: file.name }

            setTotalPages(pageIdx)
            setCurrentPage(pageIdx)
            setPageBgImages(prev => ({ ...prev, ...newBgImages }))
            setPageBgColors(prev => ({ ...prev, ...newBgColors }))
            setPageNames(prev => ({ ...prev, ...newPageNames }))

            // Broadcast to students
            if (socket) {
                socket.emit("page_update", {
                    roomId: sessionId,
                    payload: {
                        currentPage: pageIdx,
                        totalPages: pageIdx,
                        bgColors: { ...pageBgColors, ...newBgColors },
                        bgImages: newBgImages,
                        pageNames: newPageNames,
                    }
                })
            }

            toast.success(`PDF loaded: ${numPages} page${numPages > 1 ? 's' : ''} added`)
        } catch (err) {
            console.error("PDF processing error:", err)
            toast.error("Failed to process PDF. Please try again.")
        }
    }, [role, totalPages, socket, sessionId, pageBgColors])

    const handleDeletePage = async (pageToDelete: number) => {
        if (totalPages <= 1 || role !== "teacher") return

        // Confirmation dialog with full name
        const isPdf = !!(pageBgImages[pageToDelete] && pageBgImages[pageToDelete].length > 0)
        let fullLabel: string
        if (isPdf) {
            fullLabel = pageNames[pageToDelete] || "PDF"
        } else {
            // Count which board number this is (B-1 → Board-1)
            let bCount = 0
            for (let i = 1; i <= pageToDelete; i++) {
                if (!(pageBgImages[i] && pageBgImages[i].length > 0)) bCount++
            }
            fullLabel = `Board-${bCount}`
        }

        const { isConfirmed } = await Swal.fire({
            title: `Delete \"${fullLabel}\"?`,
            text: "This action cannot be undone. All drawings on this page will be lost.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#ef4444",
            cancelButtonColor: "#6b7280",
            confirmButtonText: "Yes, delete it!"
        })
        if (!isConfirmed) return

        console.log("Deleting page:", pageToDelete)

        // 1. Shift background data
        const newBgColors: Record<number, string> = {}
        const newBgImages: Record<number, string[]> = {}
        const newPageNames: Record<number, string> = {}

        for (let i = 1; i <= totalPages; i++) {
            if (i < pageToDelete) {
                newBgColors[i] = pageBgColors[i] || "#18181b"
                newBgImages[i] = pageBgImages[i] || []
                if (pageNames[i]) newPageNames[i] = pageNames[i]
            } else if (i > pageToDelete) {
                newBgColors[i - 1] = pageBgColors[i] || "#18181b"
                newBgImages[i - 1] = pageBgImages[i] || []
                if (pageNames[i]) newPageNames[i - 1] = pageNames[i]
            }
        }

        const newTotal = totalPages - 1
        // If deleting the current page or a page before it, adjust current
        let newCurrent = currentPage
        if (pageToDelete < currentPage) {
            newCurrent = currentPage - 1
        } else if (pageToDelete === currentPage) {
            newCurrent = Math.min(currentPage, newTotal)
        }

        // 2. Local State update
        setTotalPages(newTotal)
        setPageBgColors(newBgColors)
        setPageBgImages(newBgImages)
        setPageNames(newPageNames)
        setCurrentPage(newCurrent)

        // 3. Notify Whiteboard to shift its objects
        document.dispatchEvent(new CustomEvent("delete-page-local", {
            detail: { page: pageToDelete }
        }))

        // 4. Sync to students
        if (socket) {
            socket.emit("page_update", {
                roomId: sessionId,
                payload: {
                    currentPage: newCurrent,
                    totalPages: newTotal,
                    bgColors: newBgColors,
                    bgImages: newBgImages,
                    pageNames: newPageNames
                }
            })
        }
    }



    const handleEndSession = async (sid: string) => {
        try {
            if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("end-class-recording"));
            }
            /* ─── START OF END SESSION ACTION CALL (COMMENTABLE) ────*/
            const result = await endSessionAction(sid, userId || "unknown");

            if (result.status === 'success') {
                const now = Date.now();
                setEndedAt(now);
                setIsClassEnded(true);
                setIsViewLocked(false);

                Swal.fire({
                    title: "Class Ended",
                    text: "The class has been ended successfully. Redirecting...",
                    icon: "success",
                    timer: 2000,
                    showConfirmButton: false,
                    allowOutsideClick: false,
                    allowEscapeKey: false,
                }).then(() => {
                    const targetUrl = process.env.NEXT_PUBLIC_MAIN_APP_URL || "/class-ended";
                    window.location.href = targetUrl;
                });

                setTimeout(() => {
                    const targetUrl = process.env.NEXT_PUBLIC_MAIN_APP_URL || "/class-ended";
                    window.location.href = targetUrl;
                }, 2000);
            } else {
                toast.error("Failed to end session properly via server action.");
            }
            /*─── END OF END SESSION ACTION CALL ────────────────────── */
        } catch (err) {
            console.error("Failed to end session:", err);
            toast.error("An error occurred while ending the session.");
        }
    }

    const toggleViewLocked = (enabled: boolean) => {
        if (role === "teacher" && socket) {
            socket.emit("board_toggle_view_lock", {
                roomId: sessionId,
                payload: { enabled }
            })
        }
    }

    // ── Fullscreen Toggle ──────────────────────────────────────
    const toggleFullscreen = useCallback(async () => {
        try {
            if (!document.fullscreenElement) {
                await mainContainerRef.current?.requestFullscreen()
            } else {
                await document.exitFullscreen()
            }
        } catch (err) {
            console.error("Fullscreen error:", err)
        }
    }, [])

    // Listen for fullscreen change events (e.g. user presses Escape)
    useEffect(() => {
        const handleFsChange = () => {
            const isFull = !!document.fullscreenElement
            setIsFullscreen(isFull)
            if (!isFull) setIsFsChatOpen(false)
        }
        document.addEventListener("fullscreenchange", handleFsChange)
        return () => document.removeEventListener("fullscreenchange", handleFsChange)
    }, [])

    // Track unread messages when fullscreen chat is closed
    useEffect(() => {
        if (!socket) return
        const handleChatForUnread = () => {
            if (isFullscreen && !isFsChatOpen) {
                setUnreadCount(prev => prev + 1)
            }
        }
        socket.on("chat", handleChatForUnread)
        return () => { socket.off("chat", handleChatForUnread) }
    }, [socket, isFullscreen, isFsChatOpen])

    // Clear unread when fullscreen chat opens
    useEffect(() => {
        if (isFsChatOpen) setUnreadCount(0)
    }, [isFsChatOpen])

    return (
        <div ref={mainContainerRef} className="flex flex-col w-screen h-screen bg-background text-foreground overflow-hidden font-sans">
            <div className="flex flex-1 overflow-hidden">
                <div className="flex flex-col flex-1 overflow-hidden">
                    <BoardTopBar
                        tool={tool}
                        setTool={setTool}
                        isOpen={isChatOpen}
                        duration={duration}
                        durationAdded={durationAdded}
                        startTime={startTime}
                        userName={userName}
                        boardColor={currentBoardColor}
                        setBoardColor={updateBoardBackground}
                        role={role}
                        sessionId={sessionId}
                        isViewLocked={isViewLocked}
                        onToggleViewLocked={toggleViewLocked}
                        drawingEnabled={drawingEnabled}
                        onEndSession={handleEndSession}
                        onPdfUpload={role === "teacher" ? handlePdfUpload : undefined}
                        isClassEnded={isClassEnded}
                        isFullscreen={isFullscreen}
                        onToggleFullscreen={toggleFullscreen}
                        onImageStamp={(dataUrl) => setImageStampData(dataUrl)}
                        /* ── YT VIDEO FEATURE (COMMENTED OUT) ──
                        onYoutubeSync={(state) => setYoutubeState(state)}
                        */
                    />




                    <div className="flex-1 overflow-hidden relative flex">

                        <Toolbar
                            tool={tool}
                            setTool={setTool}
                            role={role}
                            color={color}
                            setColor={setColor}
                            brushSize={brushSize}
                            setBrushSize={setBrushSize}
                            onClearCanvas={role === "teacher" ? () => {
                                document.dispatchEvent(new CustomEvent("clear-canvas-emit"))
                            } : undefined}
                            isClassEnded={isClassEnded}
                        />
                        <div className="flex-1 relative flex flex-col overflow-hidden">
                            {/* Chrome Tabs Style Pagination */}
                            <div className="flex items-end px-3 pt-1.5 overflow-x-auto no-scrollbar gap-1 bg-muted/30 border-b border-border/50">
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                                    <div
                                        key={pageNum}
                                        onClick={() => handlePageChange(pageNum)}
                                        className={`
                                            relative flex items-center h-6 px-2 min-w-[50px] max-w-[150px] cursor-pointer 
                                            transition-all duration-200 rounded-t-lg group
                                            ${currentPage === pageNum
                                                ? "bg-background text-foreground shadow-[0_-4px_8px_rgba(0,0,0,0.1)] z-10"
                                                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                            }
                                        `}
                                    >
                                        <span className="text-[11px] font-bold truncate shrink-0 mr-1.5">
                                            {pageLabels[pageNum]}
                                        </span>
                                        {role === "teacher" && totalPages > 1 && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeletePage(pageNum) }}
                                                className={`ml-auto p-0.5 rounded-full transition-colors
                                                    ${currentPage === pageNum
                                                        ? "opacity-60 hover:opacity-100 hover:bg-destructive/20 hover:text-destructive"
                                                        : "opacity-0 group-hover:opacity-60 hover:opacity-100! hover:bg-destructive/20 hover:text-destructive"
                                                    }
                                                `}
                                                title={`Close ${pageLabels[pageNum]}`}
                                            >
                                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        )}
                                        {/* Tab curve mimics */}
                                        {currentPage === pageNum && (
                                            <>
                                                <div className="absolute -left-2.5 bottom-0 w-2.5 h-2.5 bg-background overflow-hidden">
                                                    <div className="w-full h-full bg-muted/30 rounded-br-lg" />
                                                </div>
                                                <div className="absolute -right-2.5 bottom-0 w-2.5 h-2.5 bg-background overflow-hidden">
                                                    <div className="w-full h-full bg-muted/30 rounded-bl-lg" />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                                {role === "teacher" && (
                                    <button
                                        onClick={handleAddPage}
                                        className="mb-1 ml-1.5 p-1 rounded-full hover:bg-muted/50 text-muted-foreground transition-all shrink-0"
                                        title="Add New Page"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                        </svg>
                                    </button>
                                )}
                            </div>

                            <Whiteboard
                                sessionId={sessionId}
                                role={role}
                                tool={tool}
                                color={color}
                                boardColor={currentBoardColor}
                                bgImages={currentBgImages}
                                brushSize={brushSize}
                                isViewLocked={isViewLocked}
                                drawingEnabled={drawingEnabled}
                                currentPage={currentPage}
                                onToolChange={setTool}
                                shapeBorderColor={color}
                                textColor={color}
                                fontSize={fontSize}
                                setFontSize={setFontSize}
                                fontFamily={fontFamily}
                                setFontFamily={setFontFamily}
                                imageStampData={imageStampData ?? undefined}
                            />
                            {/* ── YT VIDEO FEATURE (COMMENTED OUT) ──
                            {youtubeState && (
                                <YTVideoPlayer
                                    role={role}
                                    sessionId={sessionId}
                                    youtubeState={youtubeState}
                                    onClose={() => setYoutubeState(null)}
                                />
                            )}
                            */}
                        </div>
                        {/* Normal sidebar chat (hidden in fullscreen) */}
                        {!isFullscreen && (
                            <ChatRoom
                                userCount={userCount}
                                roomUsers={roomUsers}
                                setRoomUsers={setRoomUsers}
                                setUserCount={setUserCount}
                                role={role}
                                userName={userName}
                                sessionId={sessionId}
                                isOpen={isChatOpen}
                                setIsOpen={setIsChatOpen}
                                onOpenPoll={() => setIsPollOpen(true)}
                                hasActivePoll={!!(poll && poll.isActive)}
                                onOpenQuiz={() => setIsQuizOpen(true)}
                                hasActiveQuiz={!!(currentQuiz && currentQuiz.isActive)}
                                hasQuiz={!!hasQuiz}
                            />
                        )}

                        {/* Fullscreen floating chat bubble + panel */}
                        {isFullscreen && (
                            <>
                                {/* Floating Chat Panel */}
                                {isFsChatOpen && (
                                    <div className="fixed bottom-20 right-4 z-9999 w-80 sm:w-96 h-[70vh] max-h-[600px] rounded-2xl overflow-hidden shadow-2xl shadow-black/40 border border-border/60 animate-in slide-in-from-bottom-4 fade-in zoom-in-95 duration-300 flex flex-col bg-card backdrop-blur-xl">
                                        {/* Panel Header */}
                                        <div className="h-10 flex items-center justify-between px-4 bg-sidebar/90 backdrop-blur-md border-b border-border/50 shrink-0">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Live Chat</span>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-bold">{userCount}</span>
                                            </div>
                                            <button
                                                onClick={() => setIsFsChatOpen(false)}
                                                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                                                title="Minimize chat"
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="4 14 10 14 10 20" />
                                                    <polyline points="20 10 14 10 14 4" />
                                                    <line x1="14" y1="10" x2="21" y2="3" />
                                                    <line x1="3" y1="21" x2="10" y2="14" />
                                                </svg>
                                            </button>
                                        </div>
                                        {/* Embedded ChatRoom */}
                                        <div className="flex-1 min-h-0 flex flex-col">
                                            <ChatRoom
                                                userCount={userCount}
                                                roomUsers={roomUsers}
                                                setRoomUsers={setRoomUsers}
                                                setUserCount={setUserCount}
                                                role={role}
                                                userName={userName}
                                                sessionId={sessionId}
                                                isOpen={true}
                                                setIsOpen={() => setIsFsChatOpen(false)}
                                                compact={true}
                                                onOpenPoll={() => setIsPollOpen(true)}
                                                hasActivePoll={!!(poll && poll.isActive)}
                                                onOpenQuiz={() => setIsQuizOpen(true)}
                                                hasActiveQuiz={!!(currentQuiz && currentQuiz.isActive)}
                                                hasQuiz={!!hasQuiz}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Floating Chat Bubble */}
                                <button
                                    onClick={() => setIsFsChatOpen(prev => !prev)}
                                    className={cn(
                                        "fixed bottom-4 right-4 z-9999 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl shadow-black/40 transition-all duration-300 active:scale-90 group",
                                        isFsChatOpen
                                            ? "bg-primary/90 text-primary-foreground scale-90 rotate-0"
                                            : "bg-linear-to-br from-indigo-500 to-violet-600 text-white hover:scale-110 hover:shadow-indigo-500/40"
                                    )}
                                    title={isFsChatOpen ? "Close chat" : "Open chat"}
                                >
                                    {isFsChatOpen ? (
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="18" y1="6" x2="6" y2="18" />
                                            <line x1="6" y1="6" x2="18" y2="18" />
                                        </svg>
                                    ) : (
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                        </svg>
                                    )}
                                    {/* Unread Badge */}
                                    {!isFsChatOpen && unreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold shadow-lg animate-in zoom-in duration-200">
                                            {unreadCount > 99 ? "99+" : unreadCount}
                                        </span>
                                    )}
                                    {/* Pulse ring when unread */}
                                    {!isFsChatOpen && unreadCount > 0 && (
                                        <span className="absolute inset-0 rounded-full bg-indigo-500/30 animate-ping" />
                                    )}
                                </button>
                            </>
                        )}
                    </div>

                </div>

            </div>
            
            <PollModal
                isOpen={isPollOpen}
                onClose={() => setIsPollOpen(false)}
                role={role}
                poll={poll}
                pollsHistory={pollsHistory}
                socket={socket}
                sessionId={sessionId}
                userId={visitorId ? String(visitorId) : userId}
            />

            <QuizModal
                isOpen={isQuizOpen}
                onClose={() => setIsQuizOpen(false)}
                role={role}
                currentQuiz={currentQuiz}
                socket={socket}
                sessionId={sessionId}
                userId={visitorId ? String(visitorId) : userId}
                classId={classId}
                userName={userName}
            />
        </div>
    )
}

export default function MainBoard({ duration, sessionId, role, userName, userId, visitorId, isClassEnded: initialIsClassEnded, endedAt: initialEndedAt, durationAdded, startTime, hasQuiz, classId }: MainBoardProps) {
    const [isClassEnded, setIsClassEnded] = useState(initialIsClassEnded)
    const [endedAt, setEndedAt] = useState(initialEndedAt)

    // Clear stale localStorage from previous sessions
    useEffect(() => {
        if (typeof window === "undefined") return
        const keysToRemove: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (!key) continue
            if (
                (key.startsWith("board_sync_") || key.startsWith("board_data_")) &&
                !key.endsWith(sessionId)
            ) {
                keysToRemove.push(key)
            }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k))
    }, [sessionId])

    // Socket server URL
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3005"

    const user = useMemo(() => ({
        id: userId || "guest",
        name: userName,
        isTeacher: role === "teacher",
        visitorId
    }), [userId, userName, role, visitorId]);

    return (
        <SocketProvider url={socketUrl} roomId={sessionId} user={user} enabled={true}>
            <MainBoardInner
                duration={duration}
                sessionId={sessionId}
                role={role}
                userName={userName}
                userId={userId}
                visitorId={visitorId}
                isClassEnded={isClassEnded}
                setIsClassEnded={setIsClassEnded}
                endedAt={endedAt}
                setEndedAt={setEndedAt}
                durationAdded={durationAdded}
                startTime={startTime}
                hasQuiz={hasQuiz}
                classId={classId}
            />
        </SocketProvider>
    )
}
