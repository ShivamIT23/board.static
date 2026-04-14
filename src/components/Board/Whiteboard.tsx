"use client"

import React, { useEffect, useRef, useCallback } from "react"
import { Canvas, PencilBrush, Path, FabricImage, IText } from "fabric"
import { useSocket } from "../providers/socket-provider"

// ── Custom cursors (High Contrast Native) ──────────────────

// Added a black outline behind the white pencil paths
const pencilCursorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <g stroke="black" stroke-width="4">
    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>
    <path d="m15 5 4 4"/>
  </g>
  <g stroke="white" stroke-width="2">
    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>
    <path d="m15 5 4 4"/>
  </g>
</svg>`
export const PENCIL_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(pencilCursorSvg)}") 2 22, crosshair`

// Added a black outline behind the white eraser circle
const eraserCursorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
  <circle cx="14" cy="14" r="12" fill="none" stroke="black" stroke-width="4" opacity="0.8"/>
  <circle cx="14" cy="14" r="12" fill="none" stroke="white" stroke-width="2" opacity="0.8"/>
</svg>`
export const ERASER_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(eraserCursorSvg)}") 14 14, crosshair`
export const TEXT_CURSOR = "text"

interface WhiteboardProps {
    sessionId: string
    role: "teacher" | "student"
    tool: string
    color: string
    boardColor: string
    bgImages?: string[]       // NEW: array of data URLs for stacked PDF pages
    brushSize: number
    isLocked: boolean
    currentPage: number
    onToolChange?: (tool: string) => void
}

interface StrokePayload {
    id: string
    type: "start" | "draw" | "end"
    point: { x: number; y: number }
    color?: string
    width?: number
    page?: number
}

interface LiveStroke {
    points: Array<{ x: number; y: number }>
    color: string
    width: number
}

// Extended IText with custom properties for board sync
interface BoardIText extends IText {
    id: string
    _synced?: boolean
}

function Whiteboard({ sessionId, role, tool, color, boardColor, bgImages, brushSize, isLocked, currentPage, onToolChange }: WhiteboardProps) {
    const { socket } = useSocket()
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const wrapperRef = useRef<HTMLDivElement>(null)
    const fabricRef = useRef<Canvas | null>(null)

    const localStrokeIdRef = useRef<string | null>(null)
    const currentPageRef = useRef(currentPage)

    const pagesDataRef = useRef<Record<number, Record<string, unknown>[]>>({})
    const liveStrokesRef = useRef<Record<string, LiveStroke>>({})
    const liveFabricObjsRef = useRef<Record<string, Path>>({})
    const boardFileObjsRef = useRef<Record<string, FabricImage>>({})
    const textObjsRef = useRef<Record<string, IText>>({})
    const toolRef = useRef(tool)
    const onToolChangeRef = useRef(onToolChange)
    const activeTextRef = useRef<IText | null>(null)

    useEffect(() => {
        currentPageRef.current = currentPage
    }, [currentPage])

    useEffect(() => {
        toolRef.current = tool
    }, [tool])

    useEffect(() => {
        onToolChangeRef.current = onToolChange
    }, [onToolChange])

    // Utility: Width-based normalization
    const toNorm = useCallback((px: number, py: number, cw: number) => ({
        x: cw > 0 ? px / cw : 0,
        y: cw > 0 ? py / cw : 0,
    }), [])

    const fromNorm = useCallback((nx: number, ny: number, cw: number) => ({
        x: nx * cw,
        y: ny * cw,
    }), [])

    const buildPathStr = useCallback((pts: Array<{ x: number; y: number }>) => {
        if (pts.length === 0) return "M 0 0"
        let d = `M ${pts[0].x} ${pts[0].y}`
        for (let i = 1; i < pts.length; i++) {
            d += ` L ${pts[i].x} ${pts[i].y}`
        }
        return d
    }, [])

    // ── Helper: Set stacked background images on canvas ───────
    const setBgImagesOnCanvas = useCallback(async (canvas: Canvas, imageUrls: string[]) => {
        if (!imageUrls || imageUrls.length === 0) {
            canvas.backgroundImage = undefined
            canvas.requestRenderAll()
            return
        }

        // Load all images and calculate total height
        const images: HTMLImageElement[] = await Promise.all(
            imageUrls.map(url => new Promise<HTMLImageElement>((resolve) => {
                const img = new Image()
                img.crossOrigin = "anonymous"
                img.onload = () => resolve(img)
                img.src = url
            }))
        )

        let totalHeight = 0
        const drawCommands: { img: HTMLImageElement, top: number, scale: number }[] = []

        images.forEach(img => {
            const scale = containerWidth / img.width
            drawCommands.push({ img, top: totalHeight, scale })
            totalHeight += img.height * scale
        })

        // Ensure canvas has a fixed 1:3 aspect ratio (Height = 3 * Width)
        const containerWidth = wrapperRef.current?.clientWidth || canvas.width
        const targetHeight = containerWidth * 3
        const finalHeight = Math.max(targetHeight, totalHeight)
        canvas.setDimensions({ width: containerWidth, height: finalHeight })

        // Fabric doesn't support multiple background images natively.
        // We'll create a single large "background" by rendering all images to an offscreen canvas
        const offscreen = document.createElement("canvas")
        offscreen.width = containerWidth
        offscreen.height = finalHeight
        const ctx = offscreen.getContext("2d")!

        // Draw background color if needed
        ctx.fillStyle = boardColor
        ctx.fillRect(0, 0, offscreen.width, offscreen.height)

        drawCommands.forEach(cmd => {
            ctx.drawImage(cmd.img, 0, cmd.top, containerWidth, cmd.img.height * cmd.scale)
        })

        const combinedDataUrl = offscreen.toDataURL("image/jpeg", 0.85)

        const finalBgImg = await FabricImage.fromURL(combinedDataUrl)
        finalBgImg.set({
            selectable: false,
            evented: false,
            originX: "left",
            originY: "top",
        })

        canvas.backgroundImage = finalBgImg
        canvas.requestRenderAll()
    }, [boardColor])

    useEffect(() => {
        if (!canvasRef.current || !wrapperRef.current || !socket) return

        const initialWidth = wrapperRef.current?.clientWidth || 800
        const initialHeight = initialWidth * 3
        const canvas = new Canvas(canvasRef.current, {
            width: initialWidth,
            height: initialHeight,
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

        // ── Local Stroke Events ───────────────────────────────────
        canvas.on("mouse:down", (opt) => {
            // Text tool: place an empty IText on click (Excalidraw-style)
            if (toolRef.current === "text") {
                if (role === "student" && isLocked) return

                // If there's already an active text being edited, finalize it first
                if (activeTextRef.current) {
                    activeTextRef.current.exitEditing()
                    activeTextRef.current = null
                }

                const pt = canvas.getScenePoint(opt.e)
                const id = crypto.randomUUID()
                // fontSize proportional to canvas width, minimum 12px
                const proportionalFontSize = Math.max(12, Math.round(canvas.width * 0.025))
                console.log(`[TEXT] Creating text. canvas.width=${canvas.width}, fontSize=${proportionalFontSize}`)
                const textObj = new IText("", {
                    left: pt.x,
                    top: pt.y,
                    fontSize: proportionalFontSize,
                    fill: color,
                    fontFamily: "Inter, sans-serif",
                    selectable: true,
                    editable: true,
                    cursorColor: color,
                    cursorWidth: 2,
                    editingBorderColor: "rgba(100, 100, 255, 0.4)",
                }) as unknown as BoardIText
                textObj.id = id
                textObjsRef.current[id] = textObj
                canvas.add(textObj)
                canvas.setActiveObject(textObj)
                textObj.enterEditing()
                activeTextRef.current = textObj
                canvas.requestRenderAll()

                // Switch toolbar to select immediately
                onToolChangeRef.current?.("select")

                // Emit to peers when editing finishes
                textObj.on("editing:exited", () => {
                    activeTextRef.current = null
                    if (!textObj.text?.trim()) {
                        canvas.remove(textObj)
                        delete textObjsRef.current[id]
                        canvas.requestRenderAll()
                        return
                    }
                    // Compute effective visual fontSize (Fabric uses scaleX/scaleY when you drag container handles)
                    const effectiveFontSize = textObj.fontSize * (textObj.scaleX || 1)
                    const payload = {
                        id,
                        text: textObj.text,
                        color: textObj.fill,
                        fontSizeRatio: effectiveFontSize / canvas.width,
                        position: toNorm(textObj.left, textObj.top, canvas.width),
                        page: currentPageRef.current,
                    }
                    // First time → text_add, subsequent edits → text_update
                    if (textObj._synced) {
                        console.log(`[TEXT] Emitting text_update (re-edit):`, payload)
                        socket.emit("text_update", { roomId: sessionId, payload })
                    } else {
                        textObj._synced = true
                        console.log(`[TEXT] Emitting text_add:`, payload)
                        socket.emit("text_add", { roomId: sessionId, payload })
                    }
                })
                return
            }

            if (!canvas.isDrawingMode || (role === "student" && isLocked)) return
            localStrokeIdRef.current = crypto.randomUUID()
            const pt = canvas.getScenePoint(opt.e)
            socket.emit("stroke_draw", {
                roomId: sessionId,
                payload: {
                    id: localStrokeIdRef.current,
                    type: "start",
                    point: toNorm(pt.x, pt.y, canvas.width),
                    color: canvas.freeDrawingBrush?.color,
                    width: (canvas.freeDrawingBrush?.width || brushSize) / canvas.width,
                    page: currentPageRef.current,
                },
            })
        })

        canvas.on("mouse:move", (opt) => {
            if (!localStrokeIdRef.current) return
            const pt = canvas.getScenePoint(opt.e)
            socket.emit("stroke_draw", {
                roomId: sessionId,
                payload: {
                    id: localStrokeIdRef.current,
                    type: "draw",
                    point: toNorm(pt.x, pt.y, canvas.width),
                    page: currentPageRef.current,
                },
            })
        })

        canvas.on("mouse:up", () => {
            if (!localStrokeIdRef.current) return
            socket.emit("stroke_draw", {
                roomId: sessionId,
                payload: {
                    id: localStrokeIdRef.current,
                    type: "end",
                    point: { x: 0, y: 0 },
                    page: currentPageRef.current,
                },
            })
            localStrokeIdRef.current = null
        })

        // ── Object Modification Sync ──────────────────────────────
        canvas.on("object:modified", (opt) => {
            const obj = opt.target
            if (!obj) return
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const id = (obj as any).id
            if (!id) return

            // Text object modified (moved, resized, edited)
            if (obj instanceof IText) {
                // Compute effective visual fontSize (dragging handles changes scaleX, not fontSize)
                const effectiveFontSize = obj.fontSize * (obj.scaleX || 1)
                console.log(`[TEXT] object:modified id=${id}, fontSize=${obj.fontSize}, scaleX=${obj.scaleX}, effectiveFontSize=${effectiveFontSize}`)
                socket.emit("text_update", {
                    roomId: sessionId,
                    payload: {
                        id,
                        text: obj.text,
                        color: obj.fill,
                        fontSizeRatio: effectiveFontSize / canvas.width,
                        position: toNorm(obj.left, obj.top, canvas.width),
                        page: currentPageRef.current,
                    }
                })
                return
            }

            // Board file (image) modified
            if (role !== "teacher") return
            const widthRatio = obj.getScaledWidth() / canvas.width
            const heightRatio = obj.getScaledHeight() / canvas.width // Use width as ref for Y too

            socket.emit("board_file_update", {
                roomId: sessionId,
                payload: {
                    id,
                    position: toNorm(obj.left, obj.top, canvas.width),
                    widthRatio,
                    heightRatio,
                }
            })
        })

        // ── Socket Event Listeners ────────────────────────────────
        const handleStrokeDraw = ({ payload }: { payload: StrokePayload }) => {
            const { id, type, point, color: sColor, width: sWidth, page: sPage } = payload
            if (sPage !== undefined && sPage !== currentPageRef.current) return

            const local = fromNorm(point.x, point.y, canvas.width)
            const localWidth = sWidth ? sWidth * canvas.width : brushSize

            if (type === "start") {
                liveStrokesRef.current[id] = { points: [local], color: sColor || "#fff", width: localWidth }
                const p = new Path(`M ${local.x} ${local.y} L ${local.x} ${local.y}`, {
                    fill: "transparent", stroke: sColor, strokeWidth: localWidth,
                    selectable: false, evented: false, objectCaching: false,
                })
                liveFabricObjsRef.current[id] = p
                canvas.add(p)
            } else if (type === "draw" && liveStrokesRef.current[id]) {
                const data = liveStrokesRef.current[id]
                data.points.push(local)
                const existingPath = liveFabricObjsRef.current[id]
                if (existingPath) {
                    const currentIndex = canvas.getObjects().indexOf(existingPath)
                    const newPath = new Path(buildPathStr(data.points), {
                        fill: "transparent", stroke: data.color, strokeWidth: data.width,
                        selectable: false, evented: false, objectCaching: false,
                    })
                    // Add and move to original index to maintain Z-order
                    canvas.add(newPath)
                    newPath.setCoords()
                    if (currentIndex !== -1) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (newPath as any).moveTo(currentIndex)
                    }
                    canvas.remove(existingPath)
                    liveFabricObjsRef.current[id] = newPath
                }
            } else if (type === "end") {
                if (liveFabricObjsRef.current[id]) {
                    liveFabricObjsRef.current[id].set({ selectable: role === "teacher", objectCaching: true })
                }
                delete liveStrokesRef.current[id]
                delete liveFabricObjsRef.current[id]
            }
            canvas.requestRenderAll()
        }

        const handleClearCanvas = () => {
            canvas.clear()
            canvas.backgroundColor = boardColor
            boardFileObjsRef.current = {}
            pagesDataRef.current[currentPageRef.current] = []
            canvas.renderAll()
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const addImageToCanvas = (data: any) => {
            const img = new Image()
            img.crossOrigin = "anonymous"
            img.onload = () => {
                let sx: number, sy: number

                if (data.widthRatio !== undefined && data.heightRatio !== undefined) {
                    sx = (data.widthRatio * canvas.width) / img.width
                    sy = (data.heightRatio * canvas.width) / img.height
                } else {
                    const s = data.scale || 0.25
                    sx = (s * canvas.width) / img.width
                    sy = sx
                }

                const fImg = new FabricImage(img, {
                    left: data.position.x * canvas.width,
                    top: data.position.y * canvas.width,
                    scaleX: sx,
                    scaleY: sy,
                    selectable: role === "teacher",
                    lockMovementX: role !== "teacher",
                    lockMovementY: role !== "teacher",
                });
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (fImg as any).id = data.id
                boardFileObjsRef.current[data.id] = fImg
                canvas.add(fImg)
                canvas.requestRenderAll()
            }
            img.src = data.url
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handleBoardFileUpdate = ({ payload }: { payload: any }) => {
            const obj = boardFileObjsRef.current[payload.id]
            if (obj) {
                if (payload.position) {
                    obj.set({
                        left: payload.position.x * canvas.width,
                        top: payload.position.y * canvas.width,
                    })
                }
                if (payload.widthRatio !== undefined && payload.heightRatio !== undefined) {
                    obj.set({
                        scaleX: (payload.widthRatio * canvas.width) / obj.width,
                        scaleY: (payload.heightRatio * canvas.width) / obj.height,
                    })
                }
                obj.setCoords()
                canvas.requestRenderAll()
            }
        }

        // ── Text Add (from peers) ─────────────────────────────────
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handleTextAdd = ({ payload }: { payload: any }) => {
            if (payload.page !== undefined && payload.page !== currentPageRef.current) return
            // If text with this ID already exists, update instead of creating duplicate
            if (textObjsRef.current[payload.id]) {
                handleTextUpdate({ payload })
                return
            }
            const pos = fromNorm(payload.position.x, payload.position.y, canvas.width)
            // Reconstruct fontSize from normalized ratio
            const fontSize = payload.fontSizeRatio
                ? Math.max(12, payload.fontSizeRatio * canvas.width)
                : (payload.fontSize || 12)
            console.log(`[TEXT] Received text_add: fontSizeRatio=${payload.fontSizeRatio}, canvas.width=${canvas.width}, fontSize=${fontSize}`)
            const textObj = new IText(payload.text || "", {
                left: pos.x,
                top: pos.y,
                fontSize,
                scaleX: 1,
                scaleY: 1,
                fill: payload.color || "#fff",
                fontFamily: "Inter, sans-serif",
                selectable: role === "teacher",
                editable: role === "teacher",
            }) as unknown as BoardIText
            textObj.id = payload.id
            textObjsRef.current[payload.id] = textObj
            canvas.add(textObj)
            canvas.requestRenderAll()
        }

        // ── Text Update (from peers — content/position/size change) ──
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handleTextUpdate = ({ payload }: { payload: any }) => {
            if (payload.page !== undefined && payload.page !== currentPageRef.current) return
            const existing = textObjsRef.current[payload.id]
            if (existing) {
                // Update text content and position
                if (payload.text !== undefined) existing.set({ text: payload.text })
                if (payload.color) existing.set({ fill: payload.color })
                if (payload.position) {
                    const pos = fromNorm(payload.position.x, payload.position.y, canvas.width)
                    existing.set({ left: pos.x, top: pos.y })
                }
                if (payload.fontSizeRatio) {
                    // Apply effective fontSize and reset scale (sender already baked scaleX into the ratio)
                    existing.set({
                        fontSize: Math.max(12, payload.fontSizeRatio * canvas.width),
                        scaleX: 1,
                        scaleY: 1,
                    })
                }
                existing.setCoords()
                canvas.requestRenderAll()
            } else {
                // Object not found locally — treat as new text
                handleTextAdd({ payload })
            }
        }

        socket.on("stroke_draw", handleStrokeDraw)
        socket.on("clear_canvas", handleClearCanvas)
        socket.on("board_file_add", ({ payload }) => addImageToCanvas(payload))
        socket.on("text_add", handleTextAdd)
        socket.on("text_update", handleTextUpdate)
        socket.on("board_file_remove", ({ payload }) => {
            const o = boardFileObjsRef.current[payload.id]
            if (o) { canvas.remove(o); delete boardFileObjsRef.current[payload.id]; canvas.renderAll() }
        })
        socket.on("board_file_update", handleBoardFileUpdate)
        socket.on("board_files_state", ({ payload }) => payload.forEach(addImageToCanvas))
        
        socket.on("board_objects_state", ({ payload }: { payload: { type: "stroke" | "text", payload: Record<string, unknown> }[] }) => {
            console.log("[board_objects_state] Restoring objects:", payload.length)
            payload.forEach(obj => {
                if (obj.type === "stroke") handleStrokeDraw({ payload: obj.payload as unknown as StrokePayload })
                else if (obj.type === "text") handleTextAdd({ payload: obj.payload })
            })
        })

        const handleClearEmit = () => socket.emit("clear_canvas", { roomId: sessionId })
        document.addEventListener("clear-canvas-emit", handleClearEmit)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handleDeleteLocal = (e: any) => {
            const pageToDelete = e.detail?.page
            if (!pageToDelete) return

            const newData: Record<number, Record<string, unknown>[]> = {}
            const maxPage = Math.max(...Object.keys(pagesDataRef.current).map(Number), 0)

            for (let i = 1; i <= maxPage; i++) {
                if (i < pageToDelete) {
                    newData[i] = pagesDataRef.current[i] || []
                } else if (i > pageToDelete) {
                    newData[i - 1] = pagesDataRef.current[i] || []
                }
            }
            pagesDataRef.current = newData
        }
        document.addEventListener("delete-page-local", handleDeleteLocal)

        const resizeObserver = new ResizeObserver(() => {
            if (!wrapperRef.current || !fabricRef.current) return
            const containerWidth = wrapperRef.current.clientWidth
            const canvas = fabricRef.current

            const bg = canvas.backgroundImage
            if (bg instanceof FabricImage) {
                // For stacked images, we scale differently.
                // Since our current implementation bakes them into a single image, resizing is tricky.
                // We'll re-run the layout if the width changed significantly.
                if (bgImages && bgImages.length > 0) {
                    setBgImagesOnCanvas(canvas, bgImages)
                } else {
                    canvas.setDimensions({ width: containerWidth, height: containerWidth * 3 })
                }
            } else {
                canvas.setDimensions({ width: containerWidth, height: containerWidth * 3 })
            }
            canvas.renderAll()
        })
        resizeObserver.observe(wrapperRef.current)

        return () => {
            socket.off("stroke_draw", handleStrokeDraw)
            socket.off("clear_canvas", handleClearCanvas)
            socket.off("board_file_add")
            socket.off("text_add", handleTextAdd)
            socket.off("text_update", handleTextUpdate)
            socket.off("board_file_remove")
            socket.off("board_file_update", handleBoardFileUpdate)
            socket.off("board_files_state")
            document.removeEventListener("clear-canvas-emit", handleClearEmit)
            document.removeEventListener("delete-page-local", handleDeleteLocal)
            canvas.dispose()
            resizeObserver.disconnect()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId, role, socket, isLocked])

    // ── Page State Management ────────────────────────────────────
    const lastPageRef = useRef(currentPage)
    useEffect(() => {
        const canvas = fabricRef.current
        if (!canvas) return

        // 1. Save old page objects
        const oldPage = lastPageRef.current
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const objects = canvas.getObjects().map((o: any) => o.toObject(['id']))
        pagesDataRef.current[oldPage] = objects

        // 2. Clear canvas for new page
        canvas.clear()
        canvas.backgroundColor = boardColor
        boardFileObjsRef.current = {}

        // 3. If this page has PDF background images, set them
        if (bgImages && bgImages.length > 0) {
            setBgImagesOnCanvas(canvas, bgImages)
        }

        // 4. Load saved objects for new page
        const newPageData = pagesDataRef.current[currentPage]
        if (newPageData?.length) {
            import("fabric").then(({ util, FabricObject, FabricImage: FImg }) => {
                util.enlivenObjects(newPageData).then(objs => {
                    objs.forEach(o => {
                        if (o instanceof FabricObject) {
                            o.set({ selectable: role === "teacher", evented: role === "teacher" })
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const oid = (o as any).id
                            if (oid && o instanceof FImg) boardFileObjsRef.current[oid] = o
                            canvas.add(o)
                        }
                    })
                    canvas.renderAll()
                })
            })
        } else {
            canvas.renderAll()
        }

        lastPageRef.current = currentPage
    }, [currentPage, boardColor, bgImages, role, setBgImagesOnCanvas])

    // ── Background image change (e.g. PDF page received via socket) ──
    useEffect(() => {
        const canvas = fabricRef.current
        if (!canvas) return
        setBgImagesOnCanvas(canvas, bgImages || [])
    }, [bgImages, setBgImagesOnCanvas])

    useEffect(() => {
        if (fabricRef.current) { fabricRef.current.backgroundColor = boardColor; fabricRef.current.renderAll() }
    }, [boardColor])

    useEffect(() => {
        const canvas = fabricRef.current; if (!canvas) return
        canvas.isDrawingMode = (tool === "pencil" || tool === "eraser")
        canvas.freeDrawingCursor = tool === "pencil" ? PENCIL_CURSOR : ERASER_CURSOR
        if (canvas.freeDrawingBrush) {
            canvas.freeDrawingBrush.color = tool === "eraser" ? boardColor : color
            canvas.freeDrawingBrush.width = tool === "eraser" ? brushSize * 4 : brushSize
        }
        canvas.defaultCursor = (tool === "rectangle" || tool === "circle" || tool === "line" || tool === "arrow") ? "crosshair" : tool === "text" ? TEXT_CURSOR : "default"
    }, [tool, color, brushSize, boardColor])

    return (
        <div className="flex-1 min-h-0 bg-background relative flex flex-col p-3">
            <div
                ref={wrapperRef}
                className="w-full flex-1 rounded-2xl overflow-auto shadow-[0_0_20px_rgba(0,0,0,0.5)] dark:shadow-[0_0_20px_rgba(255,255,255,0.2)] border border-border transition-all duration-400 bg-zinc-900/50"
                style={{ backgroundColor: boardColor }}
            >
                <canvas ref={canvasRef} />
            </div>
        </div>
    )
}

export default React.memo(Whiteboard)