"use client"

import React, { useEffect, useRef, useCallback } from "react"
import { Canvas, PencilBrush, Path, FabricImage } from "fabric"
import { useSocket } from "../providers/socket-provider"

// ── Custom cursors (module-level constants) ──────────────────
const pencilCursorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>`
const PENCIL_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(pencilCursorSvg)}") 2 22, crosshair`

const eraserCursorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="none" stroke="white" stroke-width="2" opacity="0.8"/></svg>`
const ERASER_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(eraserCursorSvg)}") 14 14, crosshair`

interface WhiteboardProps {
    sessionId: string
    role: "teacher" | "student"
    tool: string
    color: string
    boardColor: string
    brushSize: number
    isLocked: boolean
}

interface StrokePayload {
    id: string
    type: "start" | "draw" | "end"
    point: { x: number; y: number }
    color?: string
    width?: number
}

/** Raw points + style for an in-progress remote stroke */
interface LiveStroke {
    points: Array<{ x: number; y: number }>
    color: string
    width: number
}

function Whiteboard({ sessionId, role, tool, color, boardColor, brushSize, isLocked }: WhiteboardProps) {
    const { socket } = useSocket()
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const wrapperRef = useRef<HTMLDivElement>(null)
    const fabricRef = useRef<Canvas | null>(null)

    // Tracking active strokes
    const localStrokeIdRef = useRef<string | null>(null)

    // For remote strokes we keep TWO structures:
    // 1. liveStrokes: raw point data (to rebuild the full SVG path from scratch)
    // 2. liveFabricObjs: the Fabric Path currently on the canvas (swapped each frame)
    const liveStrokesRef = useRef<Record<string, LiveStroke>>({})
    const liveFabricObjsRef = useRef<Record<string, Path>>({})

    // For board files (images added by teacher)
    const boardFileObjsRef = useRef<Record<string, FabricImage>>({})

    // ─────────────────────────────────────────────────────────────
    // Coordinate helpers – simple 0‑1 ratio normalisation
    // ─────────────────────────────────────────────────────────────
    const toNorm = useCallback((px: number, py: number, cw: number, ch: number) => ({
        x: cw > 0 ? px / cw : 0,
        y: ch > 0 ? py / ch : 0,
    }), [])

    const fromNorm = useCallback((nx: number, ny: number, cw: number, ch: number) => ({
        x: nx * cw,
        y: ny * ch,
    }), [])

    // ─────────────────────────────────────────────────────────────
    // Build a full SVG path string from an array of {x,y} points
    // ─────────────────────────────────────────────────────────────
    const buildPathStr = useCallback((pts: Array<{ x: number; y: number }>) => {
        if (pts.length === 0) return "M 0 0"
        let d = `M ${pts[0].x} ${pts[0].y}`
        for (let i = 1; i < pts.length; i++) {
            d += ` L ${pts[i].x} ${pts[i].y}`
        }
        return d
    }, [])

    // ─────────────────────────────────────────────────────────────
    // Canvas setup + socket wiring
    // ─────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!canvasRef.current || !wrapperRef.current || !socket) return

        const initW = wrapperRef.current.clientWidth
        const initH = wrapperRef.current.clientHeight

        const canvas = new Canvas(canvasRef.current, {
            width: initW,
            height: initH,
            backgroundColor: boardColor,
            isDrawingMode: true,
        })

        fabricRef.current = canvas
        canvas.freeDrawingBrush = new PencilBrush(canvas)
        if (canvas.freeDrawingBrush) {
            canvas.freeDrawingBrush.color = color
            canvas.freeDrawingBrush.width = brushSize
        }
        canvas.freeDrawingCursor = PENCIL_CURSOR

        // ── Local stroke emission ────────────────────────────────
        canvas.on("mouse:down", (opt) => {
            if (!canvas.isDrawingMode || (role === "student" && isLocked)) return

            localStrokeIdRef.current = crypto.randomUUID()
            const pt = canvas.getScenePoint(opt.e)
            const norm = toNorm(pt.x, pt.y, canvas.width, canvas.height)

            /**//*
            socket.emit("stroke_draw", {
                roomId: sessionId,
                payload: {
                    id: localStrokeIdRef.current,
                    type: "start",
                    point: norm,
                    color: canvas.freeDrawingBrush?.color,
                    width: canvas.freeDrawingBrush
                        ? canvas.freeDrawingBrush.width / canvas.width
                        : brushSize / canvas.width,
                },
            })
            */
            /* */
        })

        canvas.on("mouse:move", (opt) => {
            if (!localStrokeIdRef.current) return
            const pt = canvas.getScenePoint(opt.e)
            const norm = toNorm(pt.x, pt.y, canvas.width, canvas.height)

            /*
            */
            /*
             socket.emit("stroke_draw", {
                 roomId: sessionId,
                 payload: {
                     id: localStrokeIdRef.current,
                     type: "draw",
                     point: norm,
                 },
             })
                 */
            /*
            */
        })

        canvas.on("mouse:up", () => {
            if (!localStrokeIdRef.current) return
            /*
            */
            /*
             socket.emit("stroke_draw", {
                 roomId: sessionId,
                 payload: {
                     id: localStrokeIdRef.current,
                     type: "end",
                     point: { x: 0, y: 0 },
                 },
             })
                 */
            /*
            */
            localStrokeIdRef.current = null
        })

        // ── Incoming stroke rendering ────────────────────────────
        //
        // KEY FIX: Instead of mutating a Fabric Path's internal
        // coordinates (which Fabric silently transforms relative
        // to the path's bounding-box origin), we:
        //   1. Keep all raw denormalised points in liveStrokesRef
        //   2. On every new point, REMOVE the old Path and create
        //      a fresh one from the full point array
        //   3. On "end", the last Path stays as the final object
        //
        // This guarantees every coordinate is absolute canvas‐pixel
        // and never gets shifted by Fabric's internal transforms.
        // ─────────────────────────────────────────────────────────

        /* */
        /*
        const handleStrokeDraw = ({ payload }: { payload: StrokePayload }) => {
            const { id, type, point, color: sColor, width: sWidth } = payload

            // Denormalise
            const local = fromNorm(point.x, point.y, canvas.width, canvas.height)
            const localWidth = sWidth ? sWidth * canvas.width : brushSize

            if (type === "start") {
                // Store the first point
                liveStrokesRef.current[id] = {
                    points: [{ x: local.x, y: local.y }],
                    color: sColor || "#ffffff",
                    width: localWidth,
                }

                // Create the initial (single-dot) Path
                const p = new Path(`M ${local.x} ${local.y} L ${local.x} ${local.y}`, {
                    fill: "transparent",
                    stroke: sColor,
                    strokeWidth: localWidth,
                    strokeLineCap: "round",
                    strokeLineJoin: "round",
                    selectable: false,
                    evented: false,
                    objectCaching: false,
                })
                liveFabricObjsRef.current[id] = p
                canvas.add(p)

            } else if (type === "draw" && liveStrokesRef.current[id]) {
                const data = liveStrokesRef.current[id]
                data.points.push({ x: local.x, y: local.y })

                // Remove old path object
                const oldPath = liveFabricObjsRef.current[id]
                if (oldPath) canvas.remove(oldPath)

                // Build a brand-new Path from ALL points
                const pathStr = buildPathStr(data.points)
                const newP = new Path(pathStr, {
                    fill: "transparent",
                    stroke: data.color,
                    strokeWidth: data.width,
                    strokeLineCap: "round",
                    strokeLineJoin: "round",
                    selectable: false,
                    evented: false,
                    objectCaching: false,
                })
                liveFabricObjsRef.current[id] = newP
                canvas.add(newP)

            } else if (type === "end") {
                // Finalize — mark the path as selectable for teachers
                const finalPath = liveFabricObjsRef.current[id]
                if (finalPath) {
                    finalPath.set({
                        selectable: role === "teacher",
                        objectCaching: true,
                    })
                }
                delete liveStrokesRef.current[id]
                delete liveFabricObjsRef.current[id]
            }

            canvas.requestRenderAll()
        }

        socket.on("stroke_draw", handleStrokeDraw)

        // ── Clear canvas (from teacher) ──────────────────────────
        const handleClearCanvas = () => {
            canvas.clear()
            canvas.backgroundColor = boardColor
            canvas.renderAll()
            // Clean up any in-progress remote strokes and board files
            liveStrokesRef.current = {}
            liveFabricObjsRef.current = {}
            boardFileObjsRef.current = {}
        }
        socket.on("clear_canvas", handleClearCanvas)

        // Listen for trigger from Toolbar button (via DOM event)
        const handleClearEmit = () => {
            socket.emit("clear_canvas", { roomId: sessionId })
        }
        document.addEventListener("clear-canvas-emit", handleClearEmit)
        */
        /*
        */

        // ── Board file rendering helper ──────────────────────────
        const addImageToCanvas = (fileData: { id: string; url: string; name: string; position: { x: number; y: number }; scale: number }) => {
            const img = new Image()
            img.crossOrigin = "anonymous"
            img.onload = () => {
                const fabricImg = new FabricImage(img, {
                    left: fileData.position.x * canvas.width,
                    top: fileData.position.y * canvas.height,
                    scaleX: (fileData.scale * canvas.width) / img.width,
                    scaleY: (fileData.scale * canvas.width) / img.width, // uniform scale
                    selectable: role === "teacher",
                    evented: role === "teacher",
                    hasControls: role === "teacher",
                    hasBorders: role === "teacher",
                    lockMovementX: role !== "teacher",
                    lockMovementY: role !== "teacher",
                })
                // Store reference for later removal
                boardFileObjsRef.current[fileData.id] = fabricImg
                canvas.add(fabricImg)
                canvas.requestRenderAll()
            }
            img.src = fileData.url
        }

        // ── Board file: add ──────────────────────────────────────
        const handleBoardFileAdd = ({ payload }: { payload: { id: string; url: string; name: string; position: { x: number; y: number }; scale: number } }) => {
            addImageToCanvas(payload)
        }
        socket.on("board_file_add", handleBoardFileAdd)

        // ── Board file: remove ───────────────────────────────────
        const handleBoardFileRemove = ({ payload }: { payload: { id: string } }) => {
            const obj = boardFileObjsRef.current[payload.id]
            if (obj) {
                canvas.remove(obj)
                delete boardFileObjsRef.current[payload.id]
                canvas.requestRenderAll()
            }
        }
        socket.on("board_file_remove", handleBoardFileRemove)

        // ── Board files: initial state for newcomers ─────────────
        const handleBoardFilesState = ({ payload }: { payload: Array<{ id: string; url: string; name: string; position: { x: number; y: number }; scale: number }> }) => {
            for (const file of payload) {
                addImageToCanvas(file)
            }
        }
        socket.on("board_files_state", handleBoardFilesState)

        // ── Resize ───────────────────────────────────────────────
        const handleResize = () => {
            if (!wrapperRef.current) return
            canvas.setDimensions({
                width: wrapperRef.current.clientWidth,
                height: wrapperRef.current.clientHeight,
            })
            canvas.renderAll()
        }
        window.addEventListener("resize", handleResize)

        return () => {
            /**/
            /*
            socket.off("stroke_draw", handleStrokeDraw)
            socket.off("clear_canvas", handleClearCanvas)
            document.removeEventListener("clear-canvas-emit", handleClearEmit)
            socket.off("board_file_add", handleBoardFileAdd)
            socket.off("board_file_remove", handleBoardFileRemove)
            socket.off("board_files_state", handleBoardFilesState)
            */
            /**/
            canvas.dispose()
            window.removeEventListener("resize", handleResize)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId, role, socket, isLocked])

    // ─────────────────────────────────────────────────────────────
    // Sync board background
    // ─────────────────────────────────────────────────────────────
    useEffect(() => {
        if (fabricRef.current) {
            fabricRef.current.backgroundColor = boardColor
            fabricRef.current.renderAll()
        }
    }, [boardColor])

    // ─────────────────────────────────────────────────────────────
    // Tool / brush sync
    // ─────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!fabricRef.current) return
        const canvas = fabricRef.current

        switch (tool) {
            case "pencil":
                canvas.isDrawingMode = true
                canvas.freeDrawingCursor = PENCIL_CURSOR
                if (canvas.freeDrawingBrush) {
                    canvas.freeDrawingBrush.color = color
                    canvas.freeDrawingBrush.width = brushSize
                }
                break
            case "eraser":
                canvas.isDrawingMode = true
                canvas.freeDrawingCursor = ERASER_CURSOR
                if (canvas.freeDrawingBrush) {
                    canvas.freeDrawingBrush.color = boardColor
                    canvas.freeDrawingBrush.width = brushSize * 4
                }
                break
            default:
                canvas.isDrawingMode = false
                canvas.defaultCursor = "default"
                break
        }
    }, [tool, color, brushSize, boardColor])

    // ─────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────
    return (
        <div className="flex-1 h-full bg-background relative overflow-hidden flex items-center justify-center p-6">
            <div
                ref={wrapperRef}
                className="w-full h-full rounded-2xl overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)] dark:shadow-[0_0_20px_rgba(255,255,255,0.2)] border border-border transition-all duration-400"
                style={{ backgroundColor: boardColor }}
            >
                <canvas className="h-full w-full" ref={canvasRef} />
            </div>
        </div>
    )
}

export default React.memo(Whiteboard)