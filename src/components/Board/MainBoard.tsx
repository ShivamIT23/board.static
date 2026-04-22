"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import Toolbar from "./Toolbar"
import Whiteboard from "./Whiteboard"
import ChatRoom from "../Chat/ChatRoom"
import BoardTopBar from "./BoardTopBar"
import { SocketProvider, useSocket } from "../providers/socket-provider"
import { RoomUser } from "../Chat/ChatRoom"
import { toast } from "sonner"
import Swal from "sweetalert2"

interface MainBoardProps {
    duration: number
    sessionId: string
    role: "teacher" | "student"
    userName: string
    userId?: string
    visitorId?: number
}



function MainBoardInner({ duration, sessionId, role, userName }: MainBoardProps) {
    // Board State
    const [tool, setTool] = useState("pencil")
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

    // Page & Zoom Management
    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [zoom, setZoom] = useState(100)

    // Shape colors
    const [shapeFillColor, setShapeFillColor] = useState("transparent")
    const [shapeBorderColor, setShapeBorderColor] = useState("#FFFFFF")
    const [textColor, setTextColor] = useState("#FFFFFF")

    const { socket } = useSocket()

    // Derived current color
    const currentBoardColor = pageBgColors[currentPage] || "#18181b"
    const currentBgImages = pageBgImages[currentPage] || []

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
                if (me) setDrawingEnabled(me.drawingEnabled ?? false)
            }
        }
        socket.on("room_users", handleRoomUsersDrawing)



        // Global view lock state
        const handleViewLockedState = ({ payload }: { payload: { isLocked: boolean } }) => {
            console.log("Received view locked state:", payload.isLocked)
            setIsViewLocked(payload.isLocked)
        }
        socket.on("view_locked_state", handleViewLockedState)

        return () => {
            socket.off("board_color_sync", handleBoardColorSync)
            socket.off("page_update", handlePageUpdate)
            socket.off("page_state", handlePageState)
            socket.off("drawing_permission", handleDrawingPermission)
            socket.off("room_users", handleRoomUsersDrawing)
            socket.off("view_locked_state", handleViewLockedState)
        }
    }, [socket, role])

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



    const toggleViewLocked = (enabled: boolean) => {
        if (role === "teacher" && socket) {
            socket.emit("board_toggle_view_lock", {
                roomId: sessionId,
                payload: { enabled }
            })
        }
    }

    return (
        <div className="flex flex-col w-screen h-screen bg-background text-foreground overflow-hidden font-sans">
            <div className="flex flex-1 overflow-hidden">
                <div className="flex flex-col flex-1 overflow-hidden">
                    <BoardTopBar
                        zoom={zoom}
                        tool={tool}
                        setTool={setTool}
                        onZoomChange={setZoom}
                        isOpen={isChatOpen}
                        duration={duration}
                        userName={userName}
                        boardColor={currentBoardColor}
                        setBoardColor={updateBoardBackground}
                        role={role}
                        sessionId={sessionId}
                        isViewLocked={isViewLocked}
                        onToggleViewLocked={toggleViewLocked}
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
                            shapeFillColor={shapeFillColor}
                            setShapeFillColor={setShapeFillColor}
                            shapeBorderColor={shapeBorderColor}
                            setShapeBorderColor={setShapeBorderColor}
                            textColor={textColor}
                            setTextColor={setTextColor}
                            onPdfUpload={role === "teacher" ? handlePdfUpload : undefined}
                            onClearCanvas={role === "teacher" ? () => {
                                document.dispatchEvent(new CustomEvent("clear-canvas-emit"))
                            } : undefined}
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
                                shapeFillColor={shapeFillColor}
                                shapeBorderColor={shapeBorderColor}
                                textColor={textColor}
                            />
                        </div>
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
                        />
                    </div>

                </div>

            </div>
        </div>
    )
}

export default function MainBoard({ duration, sessionId, role, userName, userId, visitorId }: MainBoardProps) {
    // Socket server URL
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3005"

    const user = useMemo(() => ({
        id: userId || "guest",
        name: userName,
        isTeacher: role === "teacher",
        visitorId
    }), [userId, userName, role, visitorId]);

    return (
        <SocketProvider url={socketUrl} roomId={sessionId} user={user}>
            <MainBoardInner
                duration={duration}
                sessionId={sessionId}
                role={role}
                userName={userName}
                userId={userId}
                visitorId={visitorId}
            />
        </SocketProvider>
    )
}
