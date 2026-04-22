"use client"

import React, { useEffect, useRef, useCallback, useState } from "react"
import { Canvas, PencilBrush, Path, FabricImage, IText, Line, FabricObject, Rect, Ellipse, Polygon, Group } from "fabric"

export type BoardFabricObject = FabricObject & { id?: string; _synced?: boolean };
export type BoardIText = IText & { id?: string; _synced?: boolean };

import { useSocket } from "../providers/socket-provider"
import { cn } from "@/lib/utils"

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
    currentPage: number
    onToolChange?: (tool: string) => void
    shapeFillColor?: string
    shapeBorderColor?: string
    drawingEnabled?: boolean
    isViewLocked: boolean
    textColor?: string
}

interface ShapePayload {
    id: string;
    page?: number;
    shapeType: string;
    position: { x: number; y: number };
    widthRatio?: number;
    heightRatio?: number;
    fill?: string;
    stroke?: string;
    strokeWidthRatio?: number;
    timestamp?: number;
}

interface TextPayload {
    id: string;
    page?: number;
    text?: string;
    color?: string;
    fontSize?: number;
    fontSizeRatio?: number;
    position: { x: number; y: number };
    timestamp?: number;
}

interface ImagePayload {
    id: string;
    url: string;
    position: { x: number; y: number };
    widthRatio?: number;
    heightRatio?: number;
    scale?: number;
    addedBy?: string;
    page?: number;
}

interface StoredBoardObject {
    type: string;
    payload: FullStrokePayload | TextPayload | ShapePayload | ImagePayload;
    timestamp: number;
}

const SHAPE_TOOL_IDS = ["rectangle", "square", "circle", "triangle", "right-triangle", "diamond", "rhombus", "star", "line", "arrow", "ellipse", "pentagon", "parallelogram", "graph-axis", "large-grid", "graph-plain", "graph-labeled"] as const
function isShapeTool(t: string): boolean {
    return (SHAPE_TOOL_IDS as readonly string[]).includes(t) || t.startsWith("large-grid:") || t.startsWith("graph-plain:") || t.startsWith("graph-labeled:") || t.startsWith("symbol:") || t.startsWith("emoji:")
}

// Helper: build shape points for polygon-based shapes
function getTrianglePoints(w: number, h: number) {
    return [{ x: w / 2, y: 0 }, { x: w, y: h }, { x: 0, y: h }]
}
function getRightTrianglePoints(w: number, h: number) {
    return [{ x: 0, y: 0 }, { x: w, y: h }, { x: 0, y: h }]
}
function getDiamondPoints(w: number, h: number) {
    return [{ x: w / 2, y: 0 }, { x: w, y: h / 2 }, { x: w / 2, y: h }, { x: 0, y: h / 2 }]
}
function getPentagonPoints(w: number, h: number) {
    const cx = w / 2, cy = h / 2
    const r = Math.min(w, h) / 2
    const pts = []
    for (let i = 0; i < 5; i++) {
        const angle = (Math.PI / 2) * -1 + (Math.PI * 2 / 5) * i
        pts.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) })
    }
    return pts
}
function getParallelogramPoints(w: number, h: number) {
    const offset = w * 0.25
    return [{ x: offset, y: 0 }, { x: w, y: 0 }, { x: w - offset, y: h }, { x: 0, y: h }]
}
function getStarPoints(w: number, h: number) {
    const cx = w / 2, cy = h / 2
    const outerR = Math.min(w, h) / 2, innerR = outerR * 0.4
    const pts: { x: number; y: number }[] = []
    for (let i = 0; i < 10; i++) {
        const angle = (Math.PI / 2) * -1 + (Math.PI / 5) * i
        const r = i % 2 === 0 ? outerR : innerR
        pts.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) })
    }
    return pts
}

interface StrokePayload {
    id: string
    type: "start" | "draw" | "end"
    point: { x: number; y: number }
    color?: string
    width?: number
    page?: number
    strokeLineCap?: CanvasLineCap
}

interface LaserPayload {
    point: { x: number; y: number }
    prevPoint?: { x: number; y: number } | null
}

interface LiveStroke {
    points: Array<{ x: number; y: number }>
    color: string
    width: number
}

interface FullStrokePayload {
    id: string;
    points: { x: number; y: number }[];
    color: string;
    width: number;
    page?: number;
    timestamp?: number;
    strokeLineCap?: CanvasLineCap;
    // Saved position after user moved it
    movedPosition?: { x: number; y: number };
    movedWidthRatio?: number;
    movedHeightRatio?: number;
}

function Whiteboard({ sessionId, role, tool, color, boardColor, bgImages, brushSize, isViewLocked, currentPage, drawingEnabled, shapeFillColor, shapeBorderColor, textColor, onToolChange }: WhiteboardProps) {
    const { socket } = useSocket()
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const wrapperRef = useRef<HTMLDivElement>(null)
    const fabricRef = useRef<Canvas | null>(null)
    const [canvasReady, setCanvasReady] = useState(false)

    const localStrokeIdRef = useRef<string | null>(null)
    const currentPageRef = useRef(currentPage)

    const pagesDataRef = useRef<Record<number, Record<string, unknown>[]>>({})
    const liveStrokesRef = useRef<Record<string, LiveStroke>>({})
    
    // Track active text editing for UI overlay
    const [editingTextPos, setEditingTextPos] = useState<{ x: number, y: number } | null>(null)
    const activeTextObjRef = useRef<IText | null>(null)
    const liveFabricObjsRef = useRef<Record<string, Path>>({})
    const boardFileObjsRef = useRef<Record<string, FabricImage>>({})
    const textObjsRef = useRef<Record<string, IText>>({})
    const shapeObjsRef = useRef<Record<string, FabricObject>>({})

    // Persistence refs
    const boardHistoryRef = useRef<StoredBoardObject[]>([]);
    const lastSyncTimeRef = useRef<number>(0);

    const saveToLocalStorage = useCallback((newObj?: StoredBoardObject) => {
        if (newObj) {
            boardHistoryRef.current.push(newObj);
            if (newObj.timestamp > lastSyncTimeRef.current) {
                lastSyncTimeRef.current = newObj.timestamp;
                localStorage.setItem(`board_sync_${sessionId}`, newObj.timestamp.toString());
            }
        }
        localStorage.setItem(`board_data_${sessionId}`, JSON.stringify(boardHistoryRef.current));
    }, [sessionId]);
    // Safer unique ID generation (fallback for non-secure contexts/older browsers)
    const generateId = useCallback(() => {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return Math.random().toString(36).substring(2, 11);
    }, []);

    const toolRef = useRef(tool)
    const onToolChangeRef = useRef(onToolChange)
    const activeTextRef = useRef<IText | null>(null)

    // Load from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem(`board_data_${sessionId}`);
        if (saved) {
            try {
                boardHistoryRef.current = JSON.parse(saved);
                const sync = localStorage.getItem(`board_sync_${sessionId}`);
                if (sync) lastSyncTimeRef.current = parseInt(sync);
            } catch (e) {
                console.error("Failed to parse board history", e);
            }
        }
    }, [sessionId]);
    const bgImagesRef = useRef(bgImages)
    const setBgImagesOnCanvasRef = useRef<(canvas: Canvas, imageUrls: string[]) => Promise<void>>(() => Promise.resolve())
    const drawingEnabledRef = useRef(drawingEnabled)
    const lastLaserPointRef = useRef<{ x: number, y: number } | null>(null)
    const isLaserActiveRef = useRef(false)

    // Shape drawing state
    const shapeStartRef = useRef<{ x: number; y: number } | null>(null)
    const shapePreviewRef = useRef<FabricObject | null>(null)
    const shapeFillRef = useRef(shapeFillColor)
    const shapeBorderRef = useRef(shapeBorderColor)
    const brushSizeRef = useRef(brushSize)
    const colorRef = useRef(color)
    const textColorRef = useRef(textColor || "#FFFFFF")

    useEffect(() => {
        currentPageRef.current = currentPage
    }, [currentPage])

    useEffect(() => {
        toolRef.current = tool
    }, [tool])

    useEffect(() => {
        brushSizeRef.current = brushSize
    }, [brushSize])

    useEffect(() => {
        colorRef.current = color
    }, [color])

    useEffect(() => {
        textColorRef.current = textColor || "#FFFFFF"
    }, [textColor])

    useEffect(() => {
        onToolChangeRef.current = onToolChange
    }, [onToolChange])

    useEffect(() => {
        bgImagesRef.current = bgImages
    }, [bgImages])



    useEffect(() => {
        drawingEnabledRef.current = drawingEnabled
    }, [drawingEnabled])

    useEffect(() => {
        shapeFillRef.current = shapeFillColor
    }, [shapeFillColor])

    useEffect(() => {
        shapeBorderRef.current = shapeBorderColor
    }, [shapeBorderColor])

    useEffect(() => {
        brushSizeRef.current = brushSize
    }, [brushSize])

    useEffect(() => {
        colorRef.current = color
    }, [color])

    useEffect(() => {
        textColorRef.current = textColor || "#FFFFFF"
    }, [textColor])


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

    const showLaserPoint = useCallback((x: number, y: number, prevX?: number, prevY?: number) => {
        const canvas = fabricRef.current
        if (!canvas) return

        const laserColor = "#A855F7" // Purple
        const duration = 800

        if (prevX !== undefined && prevY !== undefined) {
            const line = new Line([prevX, prevY, x, y], {
                stroke: laserColor,
                strokeWidth: 4,
                strokeLineCap: "round",
                selectable: false,
                evented: false,
                globalCompositeOperation: "difference", // mix-blend-difference
            })
            canvas.add(line)
            line.animate({ opacity: 0 }, {
                duration,
                onChange: () => canvas.requestRenderAll(),
                onComplete: () => canvas.remove(line)
            })
        }
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

        const containerWidth = wrapperRef.current?.clientWidth || canvas.width

        let totalHeight = 0
        const drawCommands: { img: HTMLImageElement, top: number, scale: number }[] = []

        images.forEach(img => {
            const scale = containerWidth / img.width
            drawCommands.push({ img, top: totalHeight, scale })
            totalHeight += img.height * scale
        })

        // Ensure canvas has a fixed 1:3 aspect ratio (Height = 3 * Width)
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
        setBgImagesOnCanvasRef.current = setBgImagesOnCanvas
    }, [setBgImagesOnCanvas])

    useEffect(() => {
        if (!canvasRef.current || !wrapperRef.current) return

        const initialWidth = wrapperRef.current?.clientWidth || 800
        const initialHeight = initialWidth * 3
        const canvas = new Canvas(canvasRef.current, {
            width: initialWidth,
            height: initialHeight,
            backgroundColor: boardColor,
            isDrawingMode: true,
        })

        fabricRef.current = canvas
        setCanvasReady(true)
        canvas.freeDrawingBrush = new PencilBrush(canvas)
        if (canvas.freeDrawingBrush) {
            canvas.freeDrawingBrush.color = color
            canvas.freeDrawingBrush.width = brushSize
        }
        canvas.freeDrawingCursor = PENCIL_CURSOR

        // ── Helper: create a Fabric shape from normalized payload ──

        //for shape
        const createShapeFromPayload = (data: ShapePayload): FabricObject | null => {
            const cw = canvas.width
            const left = data.position.x * cw
            const top = data.position.y * cw
            const w = (data.widthRatio || 0) * cw
            const h = (data.heightRatio || 0) * cw
            const fill = data.fill || "transparent"
            const stroke = data.stroke || "#FFFFFF"
            const strokeWidth = (data.strokeWidthRatio || 0.003) * cw
            const common = { left, top, fill, stroke, strokeWidth, originX: "left" as const, originY: "top" as const, selectable: true, evented: true }

            switch (data.shapeType as string) {
                case "rectangle":
                case "square":
                    return new Rect({ ...common, width: w, height: h })
                case "circle":
                case "ellipse":
                    return new Ellipse({ ...common, rx: w / 2, ry: h / 2 })
                case "triangle":
                    return new Polygon(getTrianglePoints(w, h), { ...common, left, top })
                case "right-triangle":
                    return new Polygon(getRightTrianglePoints(w, h), { ...common, left, top })
                case "diamond":
                case "rhombus":
                    return new Polygon(getDiamondPoints(w, h), { ...common, left, top })
                case "pentagon":
                    return new Polygon(getPentagonPoints(w, h), { ...common, left, top })
                case "parallelogram":
                    return new Polygon(getParallelogramPoints(w, h), { ...common, left, top })
                case "star":
                    return new Polygon(getStarPoints(w, h), { ...common, left, top })
                case "graph-axis": {
                    const d = `M 0 ${h / 2} L ${w} ${h / 2} M ${w / 2} 0 L ${w / 2} ${h}`
                    return new Path(d, { ...common, fill: "transparent" })
                }
                case "line":
                    return new Line([0, 0, w, h], { ...common, fill: undefined })
                case "arrow": {
                    // Arrow = line with arrowhead via Path
                    const angle = Math.atan2(h, w)
                    const headLen = Math.min(20, Math.max(8, strokeWidth * 4))
                    const x2 = w, y2 = h
                    const d = `M 0 0 L ${x2} ${y2} M ${x2 - headLen * Math.cos(angle - Math.PI / 6)} ${y2 - headLen * Math.sin(angle - Math.PI / 6)} L ${x2} ${y2} L ${x2 - headLen * Math.cos(angle + Math.PI / 6)} ${y2 - headLen * Math.sin(angle + Math.PI / 6)}`
                    return new Path(d, { ...common, fill: "transparent" })
                }
                default:
                    if (data.shapeType.startsWith("graph-plain") || data.shapeType.startsWith("graph-labeled")) {
                        const isLabeled = data.shapeType.startsWith("graph-labeled")
                        const range = parseInt(data.shapeType.split(":")[1]) || 8
                        const intervals = range * 2

                        const stepX = w / intervals
                        const stepY = h / intervals
                        const midX = w / 2
                        const midY = h / 2

                        let gridD = ""
                        for (let i = 0; i <= intervals; i++) {
                            gridD += `M 0 ${i * stepY} L ${w} ${i * stepY} `
                            gridD += `M ${i * stepX} 0 L ${i * stepX} ${h} `
                        }
                        const gridPath = new Path(gridD, { ...common, stroke: "#888888", strokeWidth: 1, opacity: 0.3, fill: "transparent", left: 0, top: 0 })

                        const arrowSize = Math.max(4, Math.min(w, h) / 40)
                        let axesD = `M 0 ${midY} L ${w} ${midY} M ${midX} 0 L ${midX} ${h} `
                        axesD += `M 0 ${midY} L ${arrowSize} ${midY - arrowSize / 2} M 0 ${midY} L ${arrowSize} ${midY + arrowSize / 2} `
                        axesD += `M ${w} ${midY} L ${w - arrowSize} ${midY - arrowSize / 2} M ${w} ${midY} L ${w - arrowSize} ${midY + arrowSize / 2} `
                        axesD += `M ${midX} 0 L ${midX - arrowSize / 2} ${arrowSize} M ${midX} 0 L ${midX + arrowSize / 2} ${arrowSize} `
                        axesD += `M ${midX} ${h} L ${midX - arrowSize / 2} ${h - arrowSize} M ${midX} ${h} L ${midX + arrowSize / 2} ${h - arrowSize} `

                        const axesPath = new Path(axesD, { ...common, left: 0, top: 0, fill: "transparent" })

                        const objs: FabricObject[] = [gridPath, axesPath]

                        if (isLabeled) {
                            const fontSize = Math.max(6, Math.min(w, h) / (range * 5))
                            const textCommon = { fontSize, fill: stroke, fontFamily: "Inter, sans-serif", originX: "center" as const, originY: "center" as const, selectable: false, evented: false }

                            const step = range > 15 ? 2 : 1
                            for (let i = -range + 1; i <= range - 1; i++) {
                                if (i === 0) continue
                                if (i % step !== 0) continue
                                objs.push(new IText(i.toString(), { ...textCommon, left: midX + i * stepX, top: midY + fontSize }))
                                objs.push(new IText((-i).toString(), { ...textCommon, left: midX - fontSize, top: midY + i * stepY }))
                            }

                            objs.push(new IText("x", { ...textCommon, fontSize: fontSize * 1.5, fontStyle: "italic", fontWeight: "bold", left: w - fontSize, top: midY + fontSize }))
                            objs.push(new IText("y", { ...textCommon, fontSize: fontSize * 1.5, fontStyle: "italic", fontWeight: "bold", left: midX + fontSize, top: fontSize }))

                            const qDist = w / 4
                            const qDistY = h / 4
                            objs.push(new IText("I", { ...textCommon, fontSize: fontSize * 2, opacity: 0.2, left: midX + qDist, top: midY - qDistY }))
                            objs.push(new IText("II", { ...textCommon, fontSize: fontSize * 2, opacity: 0.2, left: midX - qDist, top: midY - qDistY }))
                            objs.push(new IText("III", { ...textCommon, fontSize: fontSize * 2, opacity: 0.2, left: midX - qDist, top: midY + qDistY }))
                            objs.push(new IText("IV", { ...textCommon, fontSize: fontSize * 2, opacity: 0.2, left: midX + qDist, top: midY + qDistY }))
                        }

                        return new Group(objs, { ...common, left, top, width: w, height: h })
                    }
                    if (data.shapeType.startsWith("large-grid")) {
                        const boxes = parseInt(data.shapeType.split(":")[1]) || 3
                        const stepX = w / boxes
                        const stepY = h / boxes
                        let d = ""
                        for (let i = 0; i <= boxes; i++) {
                            d += `M 0 ${i * stepY} L ${w} ${i * stepY} `
                            d += `M ${i * stepX} 0 L ${i * stepX} ${h} `
                        }
                        return new Path(d, { ...common, strokeWidth: strokeWidth * 0.5, fill: "transparent" })
                    }
                    if (data.shapeType.startsWith("symbol:") || data.shapeType.startsWith("emoji:")) {
                        const val = data.shapeType.split(":")[1]
                        const fontSize = Math.max(12, h)
                        const isEmoji = data.shapeType.startsWith("emoji:")
                        return new IText(val, {
                            ...common,
                            fontSize,
                            fill: isEmoji ? "black" : stroke,
                            fontFamily: "Inter, sans-serif",
                            stroke: isEmoji ? undefined : stroke,
                            strokeWidth: isEmoji ? 0 : strokeWidth * 0.1,
                            originX: "left",
                            originY: "top"
                        })
                    }
                    return null
            }
        }

        // ── Local Stroke Events ───────────────────────────────────
        canvas.on("mouse:down", (opt) => {
            // Text tool: place an empty IText on click (Excalidraw-style)
            if (toolRef.current === "text") {
                if (role === "student" && (!drawingEnabledRef.current)) return

                // If there's already an active text being edited, finalize it first
                if (activeTextRef.current) {
                    activeTextRef.current.exitEditing()
                    activeTextRef.current = null
                }

                // Fabric.js v7 requires selection=true for IText editing cursor to render
                canvas.selection = true
                canvas.skipTargetFind = false

                const pt = canvas.getScenePoint(opt.e)
                const id = generateId()
                // fontSize proportional to canvas width, minimum 12px
                // const baseSize = Math.max(12, Math.round(canvas.width * 0.025))
                
                // /* ── START OF BRUSH-DEPENDENT TEXT SIZE (COMMENTABLE) ──── */
                // // Adjust text size based on brush size (default is 4, so we scale relative to that)
                // const proportionalFontSize = baseSize * (brushSizeRef.current / 4)
                // /* ── END OF BRUSH-DEPENDENT TEXT SIZE ──────────────────── */
                // // const proportionalFontSize = baseSize

                // console.log(`[TEXT] Creating text at (${pt.x}, ${pt.y}). canvas.width=${canvas.width}, fontSize=${proportionalFontSize}, brushSize=${brushSizeRef.current}`)
                const proportionalFontSize = Math.max(12, Math.round(canvas.width * 0.025))
                console.log(`[TEXT] Creating text at (${pt.x}, ${pt.y}). canvas.width=${canvas.width}, fontSize=${proportionalFontSize}`)
                const textObj = new IText("", {
                    left: pt.x,
                    top: pt.y,
                    fontSize: proportionalFontSize,
                    fill: textColorRef.current,
                    fontFamily: "Inter, sans-serif",
                    selectable: true,
                    editable: true,
                    cursorColor: textColorRef.current,
                    cursorWidth: 2,
                    editingBorderColor: "rgba(100, 100, 255, 0.4)",
                    hasControls: false, // Hide Fabric controls, we'll use HTML
                }) as unknown as BoardIText
                textObj.id = id
                textObjsRef.current[id] = textObj
                canvas.add(textObj)
                canvas.setActiveObject(textObj)
                textObj.enterEditing()

                activeTextObjRef.current = textObj
                
                const updateDoneButtonPos = () => {
                    if (!textObj || !fabricRef.current) return
                    const bound = textObj.getBoundingRect()
                    // Transform canvas coords to viewport coords
                    const canvasEl = fabricRef.current.getElement()
                    const rect = canvasEl.getBoundingClientRect()
                    setEditingTextPos({
                        x: rect.left + bound.left + bound.width,
                        y: rect.top + bound.top + bound.height
                    })
                }

                updateDoneButtonPos()
                textObj.on("changed", updateDoneButtonPos)
                textObj.on("moving", updateDoneButtonPos)
                textObj.on("scaling", updateDoneButtonPos)

                // Fabric.js uses a hidden textarea for keyboard input — must be explicitly focused
                const textarea = (textObj as unknown as { hiddenTextarea?: HTMLTextAreaElement }).hiddenTextarea
                if (textarea) textarea.focus()
                activeTextRef.current = textObj
                canvas.requestRenderAll()

                // Emit to peers when editing finishes
                textObj.on("editing:exited", () => {
                    setEditingTextPos(null)
                    activeTextObjRef.current = null
                    textObj.off("changed", updateDoneButtonPos)
                    textObj.off("moving", updateDoneButtonPos)
                    textObj.off("scaling", updateDoneButtonPos)

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
                        socket?.emit("text_update", { roomId: sessionId, payload })
                    } else {
                        textObj._synced = true
                        console.log(`[TEXT] Emitting text_add:`, payload)
                        socket?.emit("text_add", { roomId: sessionId, payload })
                    }
                })
                return
            }

            // Object Eraser: Delete clicked object
            if (toolRef.current === "eraser") {
                const target = opt.target as BoardFabricObject
                if (target && target.id) {
                    const id = target.id;
                    canvas.remove(target);
                if (socket) {
                    socket.emit("object_remove", { roomId: sessionId, payload: { id } });
                }
                    boardHistoryRef.current = boardHistoryRef.current.filter(obj => (obj.payload as { id: string }).id !== id);
                    saveToLocalStorage();
                    canvas.requestRenderAll();
                }
                return;
            }
            if (toolRef.current === "laser") {
                isLaserActiveRef.current = true
                const pt = canvas.getScenePoint(opt.e)
                const point = toNorm(pt.x, pt.y, canvas.width)
                socket?.emit("laser_pointer", {
                    roomId: sessionId,
                    payload: { point }
                })
                showLaserPoint(pt.x, pt.y)
                lastLaserPointRef.current = { x: pt.x, y: pt.y }
                return
            }

            // Shape tool: start drawing a shape
            if (isShapeTool(toolRef.current)) {
                if (role === "student" && (!drawingEnabledRef.current)) return
                const pt = canvas.getScenePoint(opt.e)
                shapeStartRef.current = { x: pt.x, y: pt.y }
                return
            }

            if (!canvas.isDrawingMode || (role === "student" && (!drawingEnabledRef.current))) return
            localStrokeIdRef.current = generateId()
            const pt = canvas.getScenePoint(opt.e)

            // Re-configure brush based on current tool if it's a pen tool
            if (toolRef.current.startsWith("pen:")) {
                const penType = toolRef.current.startsWith("pen:") ? toolRef.current.split(":")[1] : "pen"
                const brush = canvas.freeDrawingBrush as PencilBrush
                if (brush) {
                    brush.color = colorRef.current
                    brush.width = brushSizeRef.current

                    if (penType === "highlighter") {
                        // Highlighter style: semi-transparent, square caps
                        brush.color = colorRef.current.startsWith("#")
                            ? `${colorRef.current}80` // Add 50% alpha hex
                            : colorRef.current
                        brush.strokeLineCap = "square"
                        brush.width = brushSizeRef.current * 2.5 // Highlighters are usually thicker
                    } else if (penType === "crayon") {
                        brush.strokeLineCap = "round"
                        brush.strokeLineJoin = "round"
                        brush.width = brushSizeRef.current * 1.5
                    } else if (penType === "pen") {
                        brush.strokeLineCap = "round"
                        brush.width = Math.max(1, brushSizeRef.current * 0.8)
                    } else {
                        brush.strokeLineCap = "round"
                    }
                }
            }

            socket?.emit("stroke_draw", {
                roomId: sessionId,
                payload: {
                    id: localStrokeIdRef.current,
                    type: "start",
                    point: toNorm(pt.x, pt.y, canvas.width),
                    color: canvas.freeDrawingBrush?.color,
                    width: (canvas.freeDrawingBrush?.width || brushSize) / canvas.width,
                    strokeLineCap: (canvas.freeDrawingBrush as PencilBrush)?.strokeLineCap,
                    page: currentPageRef.current,
                },
            })
        })

        canvas.on("mouse:move", (opt) => {
            // Shape preview while dragging
            if (shapeStartRef.current && isShapeTool(toolRef.current)) {
                const pt = canvas.getScenePoint(opt.e)
                const start = shapeStartRef.current
                let w = pt.x - start.x
                let h = pt.y - start.y

                if (toolRef.current === "square" || toolRef.current === "circle" || toolRef.current.startsWith("symbol:") || toolRef.current.startsWith("emoji:")) {
                    const size = Math.max(Math.abs(w), Math.abs(h))
                    w = w >= 0 ? size : -size
                    h = h >= 0 ? size : -size
                }

                let left = w >= 0 ? start.x : start.x + w
                let top = h >= 0 ? start.y : start.y + h

                // Fallback for click-without-drag: place default sized character
                if (toolRef.current.startsWith("symbol:") || toolRef.current.startsWith("emoji:")) {
                    if (Math.abs(w) < 10 && Math.abs(h) < 10) {
                        const defaultSize = Math.max(32, Math.round(canvas.width * 0.04))
                        w = defaultSize
                        h = defaultSize
                        left = pt.x - defaultSize / 2
                        top = pt.y - defaultSize / 2
                    }
                }
                const absW = Math.abs(w)
                const absH = Math.abs(h)

                // Remove previous preview
                if (shapePreviewRef.current) {
                    canvas.remove(shapePreviewRef.current)
                }

                const previewData = {
                    id: "preview",
                    shapeType: toolRef.current,
                    position: toNorm(left, top, canvas.width),
                    widthRatio: absW / canvas.width,
                    heightRatio: absH / canvas.width,
                    fill: shapeFillRef.current,
                    stroke: shapeBorderRef.current,
                    strokeWidthRatio: brushSizeRef.current / canvas.width,
                }

                const preview = createShapeFromPayload(previewData)
                if (preview) {
                    preview.set({ selectable: false, evented: false, opacity: 0.6 })
                    shapePreviewRef.current = preview
                    canvas.add(preview)
                    canvas.requestRenderAll()
                }
                return
            }

            if (toolRef.current === "laser") {
                if (!isLaserActiveRef.current) return
                const pt = canvas.getScenePoint(opt.e)
                const point = toNorm(pt.x, pt.y, canvas.width)
                socket?.emit("laser_pointer", {
                    roomId: sessionId,
                    payload: {
                        point,
                        prevPoint: lastLaserPointRef.current ? toNorm(lastLaserPointRef.current.x, lastLaserPointRef.current.y, canvas.width) : null
                    }
                })
                showLaserPoint(pt.x, pt.y, lastLaserPointRef.current?.x, lastLaserPointRef.current?.y)
                lastLaserPointRef.current = { x: pt.x, y: pt.y }
                return
            } else {
                lastLaserPointRef.current = null
            }

            if (!localStrokeIdRef.current) return
            const pt = canvas.getScenePoint(opt.e)
            socket?.emit("stroke_draw", {
                roomId: sessionId,
                payload: {
                    id: localStrokeIdRef.current,
                    type: "draw",
                    point: toNorm(pt.x, pt.y, canvas.width),
                    page: currentPageRef.current,
                },
            })
        })

        canvas.on("mouse:over", () => {
            lastLaserPointRef.current = null
        })

        canvas.on("mouse:out", () => {
            lastLaserPointRef.current = null
            isLaserActiveRef.current = false
        })

        canvas.on("mouse:up", (opt) => {
            lastLaserPointRef.current = null
            isLaserActiveRef.current = false
            // Finalize shape
            if (shapeStartRef.current && isShapeTool(toolRef.current)) {
                const pt = canvas.getScenePoint(opt.e)
                const start = shapeStartRef.current
                shapeStartRef.current = null

                // Remove preview
                if (shapePreviewRef.current) {
                    canvas.remove(shapePreviewRef.current)
                    shapePreviewRef.current = null
                }

                let w = pt.x - start.x
                let h = pt.y - start.y

                if (toolRef.current === "square" || toolRef.current === "circle") {
                    const size = Math.max(Math.abs(w), Math.abs(h))
                    w = w >= 0 ? size : -size
                    h = h >= 0 ? size : -size
                }

                // Skip tiny clicks (less than 5px)
                if (Math.abs(w) < 5 && Math.abs(h) < 5) return

                const left = w >= 0 ? start.x : start.x + w
                const top = h >= 0 ? start.y : start.y + h
                const absW = Math.abs(w)
                const absH = Math.abs(h)
                const id = generateId()

                const shapePayload = {
                    id,
                    shapeType: toolRef.current,
                    position: toNorm(left, top, canvas.width),
                    widthRatio: absW / canvas.width,
                    heightRatio: absH / canvas.width,
                    fill: shapeFillRef.current,
                    stroke: shapeBorderRef.current,
                    strokeWidthRatio: brushSizeRef.current / canvas.width,
                    page: currentPageRef.current,
                    timestamp: Date.now(),
                }

                const shape = createShapeFromPayload(shapePayload)
                if (shape) {
                    (shape as FabricObject & { id: string }).id = id
                    shapeObjsRef.current[id] = shape
                    canvas.add(shape)
                    canvas.requestRenderAll()

                    socket?.emit("shape_add", { roomId: sessionId, payload: shapePayload })
                    if (onToolChangeRef.current) onToolChangeRef.current("select")
                }
                return
            }

            if (!localStrokeIdRef.current) return
            socket?.emit("stroke_draw", {
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

        canvas.on("path:created", (opt) => {
            if (localStrokeIdRef.current) {
                (opt.path as BoardFabricObject).id = localStrokeIdRef.current
                // Local user's own stroke — always selectable so they can move it
                opt.path.set({ selectable: true, evented: true })
            }
        })


        // ── Object Modification Sync ──────────────────────────────
        canvas.on("object:modified", (opt) => {
            const obj = opt.target
            if (!obj) return
            const id = (obj as BoardFabricObject).id
            if (!id) return

            // Shape modified (moved, resized) — includes symbols & emojis stored in shapeObjsRef
            if (shapeObjsRef.current[id]) {
                socket?.emit("shape_update", {
                    roomId: sessionId,
                    payload: {
                        id,
                        position: toNorm(obj.left, obj.top, canvas.width),
                        widthRatio: obj.getScaledWidth() / canvas.width,
                        heightRatio: obj.getScaledHeight() / canvas.width,
                        page: currentPageRef.current,
                    }
                })
                return
            }

            // Text object modified (moved, resized, edited)
            if (textObjsRef.current[id]) {
                const textObj = obj as unknown as BoardIText
                const effectiveFontSize = textObj.fontSize * (textObj.scaleX || 1)
                console.log(`[TEXT] object:modified id=${id}, effectiveFontSize=${effectiveFontSize}`)
                socket?.emit("text_update", {
                    roomId: sessionId,
                    payload: {
                        id,
                        text: textObj.text,
                        color: textObj.fill,
                        fontSizeRatio: effectiveFontSize / canvas.width,
                        position: toNorm(obj.left, obj.top, canvas.width),
                        page: currentPageRef.current,
                    }
                })
                return
            }

            // Stroke (Path) modified (moved, resized)
            if (obj instanceof Path) {
                socket?.emit("stroke_update", {
                    roomId: sessionId,
                    payload: {
                        id,
                        position: toNorm(obj.left, obj.top, canvas.width),
                        widthRatio: obj.getScaledWidth() / canvas.width,
                        heightRatio: obj.getScaledHeight() / canvas.width,
                        page: currentPageRef.current,
                    }
                })
                return
            }

            // Board file (image) modified
            if (role !== "teacher") return
            const widthRatio = obj.getScaledWidth() / canvas.width
            const heightRatio = obj.getScaledHeight() / canvas.width

            socket?.emit("board_file_update", {
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
            // Only skip if WE are the one drawing this stroke (it's already on our canvas via Fabric)
            if (id === localStrokeIdRef.current) return
            const local = fromNorm(point.x, point.y, canvas.width)
            const localWidth = sWidth ? sWidth * canvas.width : brushSize

            if (type === "start") {
                liveStrokesRef.current[id] = { points: [local], color: sColor || "#fff", width: localWidth }
                const p = new Path(`M ${local.x} ${local.y} L ${local.x} ${local.y}`, {
                    fill: "transparent", stroke: sColor, strokeWidth: localWidth,
                    strokeLineCap: payload.strokeLineCap || "round",
                    selectable: false, evented: false, objectCaching: false,
                })
                    ; (p as BoardFabricObject).id = id
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
                        strokeLineCap: payload.strokeLineCap || "round",
                        selectable: false, evented: false, objectCaching: false,
                    })
                        ; (newPath as BoardFabricObject).id = id
                    // Add and move to original index to maintain Z-order
                    canvas.add(newPath)
                    newPath.setCoords()
                    if (currentIndex !== -1) {
                        canvas.moveObjectTo(newPath, currentIndex)
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

        const handleStrokeAdd = ({ payload }: { payload: FullStrokePayload }) => {
            if (payload.page !== undefined && payload.page !== currentPageRef.current) return

            if (canvas.getObjects().some((o) => (o as BoardFabricObject).id === payload.id)) return

            import("fabric").then(({ Path }) => {
                const points = payload.points.map(p => fromNorm(p.x, p.y, canvas.width))
                const pathStr = buildPathStr(points)
                const p = new Path(pathStr, {
                    fill: "transparent",
                    stroke: payload.color,
                    strokeWidth: payload.width * canvas.width,
                    strokeLineCap: payload.strokeLineCap || "round",
                    selectable: role === "teacher",
                    evented: role === "teacher",
                    objectCaching: true
                })
                    ; (p as BoardFabricObject).id = payload.id
                canvas.add(p)

                // If the stroke was moved after initial drawing, apply saved position
                if (payload.movedPosition) {
                    p.set({
                        left: payload.movedPosition.x * canvas.width,
                        top: payload.movedPosition.y * canvas.width,
                    })
                    if (payload.movedWidthRatio !== undefined && payload.movedHeightRatio !== undefined) {
                        p.set({
                            scaleX: (payload.movedWidthRatio * canvas.width) / (p.width || 1),
                            scaleY: (payload.movedHeightRatio * canvas.width) / (p.height || 1),
                        })
                    }
                    p.setCoords()
                }

                canvas.requestRenderAll()
            })
        }

        const handleClearCanvas = () => {
            canvas.clear()
            canvas.backgroundColor = boardColor
            boardFileObjsRef.current = {}
            pagesDataRef.current[currentPageRef.current] = []
            canvas.renderAll()
        }

        const addImageToCanvas = (data: ImagePayload) => {
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
                (fImg as BoardFabricObject).id = data.id
                boardFileObjsRef.current[data.id] = fImg
                canvas.add(fImg)
                canvas.requestRenderAll()
            }
            img.src = data.url
        }

        const handleBoardFileUpdate = ({ payload }: { payload: Partial<ImagePayload> & { id: string } }) => {
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
        const handleTextAdd = ({ payload }: { payload: TextPayload }) => {
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
                hasControls: true,
                hasBorders: true,
            }) as unknown as BoardIText
            textObj.id = payload.id
            textObjsRef.current[payload.id] = textObj
            
            // For teachers, ensure the 'done' button is visible
            if (role === "teacher") {
                textObj.setControlsVisibility({ 
                    bl: false, br: false, tl: false, tr: false, 
                    mb: false, ml: false, mr: false, mt: false, mtr: false,
                    done: true 
                });
            }

            canvas.add(textObj)
            canvas.requestRenderAll()
        }

        // ── Text Update (from peers — content/position/size change) ──
        const handleTextUpdate = ({ payload }: { payload: TextPayload }) => {
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

        const handleLaserPointer = ({ payload }: { payload: LaserPayload }) => {
            const { point, prevPoint } = payload
            const pos = fromNorm(point.x, point.y, canvas.width)
            const prevPos = prevPoint ? fromNorm(prevPoint.x, prevPoint.y, canvas.width) : undefined
            showLaserPoint(pos.x, pos.y, prevPos?.x, prevPos?.y)
        }

        const onBoardColorSync = (data: { color: string, page: number }) => {
            if (data.page === currentPageRef.current) {
                canvas.backgroundColor = data.color
                canvas.renderAll()
            }
        }

        const onViewSync = (data: { payload: { ratio: number; senderId?: string } }) => {
            // Everyone receives view_sync, but ignore our own broadcasts
            if (socket && data.payload.senderId === socket.id) return
            if (wrapperRef.current) {
                const wrapper = wrapperRef.current
                wrapper.scrollTop = data.payload.ratio * wrapper.scrollHeight
            }
        }

        if (socket) {
            socket.on("stroke_draw", handleStrokeDraw)
            socket.on("stroke_add", handleStrokeAdd)
            socket.on("laser_pointer", handleLaserPointer)
            socket.on("clear_canvas", handleClearCanvas)
            socket.on("board_color_sync", onBoardColorSync)
            socket.on("view_sync", onViewSync)
            socket.on("board_file_add", ({ payload }: { payload: ImagePayload }) => addImageToCanvas(payload))
        }

        // ── Shape Add (from peers) ────────────────────────────────
        const handleShapeAdd = ({ payload }: { payload: ShapePayload }) => {
            console.log("[SHAPE] Received shape_add:", payload)
            if (payload.page !== undefined && payload.page !== currentPageRef.current) return
            if (shapeObjsRef.current[payload.id]) return // Already exists
            const shape = createShapeFromPayload(payload)
            if (shape) {
                (shape as BoardFabricObject).id = payload.id
                // Peer shapes: only teacher can move others' objects
                shape.set({ selectable: role === "teacher", evented: role === "teacher" })
                shapeObjsRef.current[payload.id] = shape
                canvas.add(shape)
                canvas.requestRenderAll()
                console.log("[SHAPE] Shape added to canvas:", payload.id, payload.shapeType)

                // Persist to history
                if (payload.timestamp && !boardHistoryRef.current.some(obj => obj.payload.id === payload.id)) {
                    saveToLocalStorage({ type: "shape", payload, timestamp: payload.timestamp });
                }
            } else {
                console.warn("[SHAPE] Failed to create shape from payload:", payload)
            }
        }

        const handleShapeUpdate = ({ payload }: { payload: Partial<ShapePayload> & { id: string } }) => {
            const obj = shapeObjsRef.current[payload.id]
            if (!obj) return
            if (payload.position) {
                obj.set({
                    left: payload.position.x * canvas.width,
                    top: payload.position.y * canvas.width,
                })
            }
            if (payload.widthRatio !== undefined && payload.heightRatio !== undefined) {
                obj.set({
                    scaleX: (payload.widthRatio * canvas.width) / (obj.width || 1),
                    scaleY: (payload.heightRatio * canvas.width) / (obj.height || 1),
                })
            }
            obj.setCoords()
            canvas.requestRenderAll()
        }

        // ── Stroke Update (from peers — position/size change) ─────
        const handleStrokeUpdate = ({ payload }: { payload: { id: string; position?: { x: number; y: number }; widthRatio?: number; heightRatio?: number } }) => {
            // Find the stroke Path on the canvas by id
            const obj = canvas.getObjects().find((o) => (o as BoardFabricObject).id === payload.id) as FabricObject | undefined
            if (!obj) return
            if (payload.position) {
                obj.set({
                    left: payload.position.x * canvas.width,
                    top: payload.position.y * canvas.width,
                })
            }
            if (payload.widthRatio !== undefined && payload.heightRatio !== undefined) {
                obj.set({
                    scaleX: (payload.widthRatio * canvas.width) / (obj.width || 1),
                    scaleY: (payload.heightRatio * canvas.width) / (obj.height || 1),
                })
            }
            obj.setCoords()
            canvas.requestRenderAll()
        }

        if (socket) {
            socket.on("text_add", handleTextAdd)
            socket.on("text_update", handleTextUpdate)
            socket.on("shape_add", handleShapeAdd)
            socket.on("shape_update", handleShapeUpdate)
            socket.on("stroke_update", handleStrokeUpdate)
        }
        if (socket) {
            socket.on("board_file_remove", ({ payload }: { payload: { id: string } }) => {
                const o = boardFileObjsRef.current[payload.id]
                if (o) { canvas.remove(o); delete boardFileObjsRef.current[payload.id]; canvas.renderAll() }
            })
            socket.on("board_file_update", handleBoardFileUpdate)
            socket.on("board_files_state", ({ payload }: { payload: ImagePayload[] }) => payload.forEach(addImageToCanvas))
        }

        const handleObjectRemove = ({ payload }: { payload: { id: string } }) => {
            // Find and remove the object with that ID
            const obj = canvas.getObjects().find((o) => (o as BoardFabricObject).id === payload.id);
            if (obj) {
                canvas.remove(obj);
                // Clean up any potential refs
                if (boardFileObjsRef.current[payload.id]) delete boardFileObjsRef.current[payload.id];
                if (textObjsRef.current[payload.id]) delete textObjsRef.current[payload.id];
                if (shapeObjsRef.current[payload.id]) delete shapeObjsRef.current[payload.id];
                canvas.renderAll();
            }
        }
        if (socket) {
            socket.on("object_remove", handleObjectRemove);
        }

        interface BoardObjectPayload {
            type: "stroke" | "text" | "shape";
            payload: FullStrokePayload | TextPayload | ShapePayload;
            timestamp: number;
        }

        if (socket) {
            socket.on("board_objects_state", ({ payload }: { payload: BoardObjectPayload[] }) => {
                console.log("[board_objects_state] Restoring objects:", payload.length)
                payload.forEach(obj => {
                    // handleStrokeAdd/handleTextAdd handle the current-page-only rendering AND storage
                    const fullPayload = { ...obj.payload, timestamp: obj.timestamp };
                    if (obj.type === "stroke") handleStrokeAdd({ payload: fullPayload as unknown as FullStrokePayload })
                    else if (obj.type === "text") handleTextAdd({ payload: fullPayload as unknown as TextPayload })
                    else if (obj.type === "shape") handleShapeAdd({ payload: fullPayload as unknown as ShapePayload })
                })
            })
        }

        const handleClearEmit = () => socket && socket.emit("clear_canvas", { roomId: sessionId })
        document.addEventListener("clear-canvas-emit", handleClearEmit)

        const handleUndoTrigger = () => socket && socket.emit("board_undo", { roomId: sessionId })
        const handleRedoTrigger = () => socket && socket.emit("board_redo", { roomId: sessionId })
        document.addEventListener("undo-trigger", handleUndoTrigger)
        document.addEventListener("redo-trigger", handleRedoTrigger)

        const handleDeleteLocal = (e: Event) => {
            const customEvent = e as CustomEvent<{ page: number }>
            const pageToDelete = customEvent.detail?.page
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

            const oldWidth = canvas.width
            if (Math.abs(containerWidth - oldWidth) < 1) return // Skip trivial resizes

            const scaleFactor = containerWidth / oldWidth

            // Rescale all existing objects proportionally
            canvas.getObjects().forEach(obj => {
                obj.set({
                    left: obj.left * scaleFactor,
                    top: obj.top * scaleFactor,
                    scaleX: (obj.scaleX || 1) * scaleFactor,
                    scaleY: (obj.scaleY || 1) * scaleFactor,
                })
                obj.setCoords()
            })

            // Update canvas dimensions
            const currentBgImages = bgImagesRef.current
            if (currentBgImages && currentBgImages.length > 0) {
                // For PDF pages, set dimensions synchronously first, then re-render background
                canvas.setDimensions({ width: containerWidth, height: containerWidth * 3 })
                setBgImagesOnCanvasRef.current(canvas, currentBgImages)
            } else {
                canvas.setDimensions({ width: containerWidth, height: containerWidth * 3 })
            }

            canvas.requestRenderAll()
        })
        resizeObserver.observe(wrapperRef.current)

        return () => {
            if (socket) {
                socket.off("stroke_draw", handleStrokeDraw)
                socket.off("stroke_add", handleStrokeAdd)
                socket.off("laser_pointer", handleLaserPointer)
                socket.off("clear_canvas", handleClearCanvas)
                socket.off("board_file_add")
                socket.off("text_add", handleTextAdd)
                socket.off("text_update", handleTextUpdate)
                socket.off("shape_add", handleShapeAdd)
                socket.off("shape_update", handleShapeUpdate)
                socket.off("stroke_update", handleStrokeUpdate)
                socket.off("board_file_remove")
                socket.off("board_file_update", handleBoardFileUpdate)
                socket.off("board_files_state")
                socket.off("object_remove", handleObjectRemove)
                socket.off("board_color_sync", onBoardColorSync)
                socket.off("view_sync", onViewSync)
            }
            document.removeEventListener("clear-canvas-emit", handleClearEmit)
            document.removeEventListener("undo-trigger", handleUndoTrigger)
            document.removeEventListener("redo-trigger", handleRedoTrigger)
            document.removeEventListener("delete-page-local", handleDeleteLocal)
            setCanvasReady(false)
            canvas.dispose()
            resizeObserver.disconnect()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId, role, socket])

    // ── Page State Management ────────────────────────────────────
    const lastPageRef = useRef(currentPage)
    useEffect(() => {
        const canvas = fabricRef.current
        if (!canvas) return

        // 1. Save old page objects
        const oldPage = lastPageRef.current
        const objects = canvas.getObjects().map((o) => (o as FabricObject & { toObject: (props: string[]) => Record<string, unknown> }).toObject(['id']))
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
                            const oid = (o as BoardFabricObject).id
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

        // 5. Request dynamic objects for this page if it's a new join/view
        if (!boardHistoryRef.current.some(obj => obj.payload.page === currentPage)) {
            socket?.emit("board_request_objects", { payload: { page: currentPage } });
        }

        lastPageRef.current = currentPage
    }, [currentPage, boardColor, bgImages, role, setBgImagesOnCanvas, socket])

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
        const canDraw = role === "teacher" || (drawingEnabled ?? false);
        const isPenTool = tool.startsWith("pen:")
        // Selective eraser uses drawing mode with background color
        canvas.isDrawingMode = (isPenTool || tool === "partial-eraser") && canDraw;
        canvas.freeDrawingCursor = isPenTool ? PENCIL_CURSOR : ERASER_CURSOR
        if (canvas.freeDrawingBrush) {
            const brush = canvas.freeDrawingBrush as PencilBrush
            if (tool === "partial-eraser" || tool === "eraser") {
                brush.color = boardColor
                brush.width = brushSize * 4
                brush.strokeLineCap = "round"
            } else {
                const penType = tool.startsWith("pen:") ? tool.split(":")[1] : "pen"
                brush.color = color
                brush.width = brushSize
                brush.strokeLineCap = "round"
                brush.strokeLineJoin = "round"

                if (penType === "highlighter") {
                    brush.color = color.startsWith("#") ? `${color}80` : color
                    brush.strokeLineCap = "square"
                    brush.width = brushSize * 2.5
                } else if (penType === "pen") {
                    brush.width = Math.max(1, brushSize * 0.8)
                }
            }
        }
        canvas.defaultCursor = activeTextRef.current ? TEXT_CURSOR : (tool === "laser" ? "crosshair" : tool === "text" ? TEXT_CURSOR : "default")
        // Disable selection when using drawing/laser tools
        // Text and laser tools need pointer events (getScenePoint) so skipTargetFind must be false for them
        // IMPORTANT: If there's an active text being edited, keep selection=true so the cursor stays alive
        if (activeTextRef.current) {
            canvas.selection = true
            canvas.skipTargetFind = false
        } else {
            canvas.selection = (tool === "select" || tool === "text")
            canvas.skipTargetFind = (isPenTool || tool === "partial-eraser" || tool === "laser") && tool !== "eraser"
        }
        // canvasReady ensures this effect re-runs after the canvas is initialized
        // (which happens asynchronously when socket connects)
    }, [tool, color, brushSize, boardColor, drawingEnabled, role, canvasReady])

    // ── View Sync: Scroll Broadcasting (teacher always, students when drawing enabled) ──
    useEffect(() => {
        if (!socket) return
        // Teacher always broadcasts; students only when drawing is enabled
        const shouldBroadcast = role === "teacher" || (role === "student" && drawingEnabled)
        if (!shouldBroadcast) return

        const wrapper = wrapperRef.current
        if (!wrapper) return

        let lastEmitTime = 0
        const handleScroll = () => {
            const now = Date.now()
            if (now - lastEmitTime < 100) return // Throttle to 10fps
            lastEmitTime = now

            // Calculate ratio based on scroll position relative to total height
            const ratio = wrapper.scrollTop / wrapper.scrollHeight
            socket?.emit("view_sync", {
                roomId: sessionId,
                payload: { ratio, senderId: socket.id }
            })
        }

        wrapper.addEventListener("scroll", handleScroll)
        return () => wrapper.removeEventListener("scroll", handleScroll)
    }, [role, sessionId, socket, drawingEnabled])

    return (
        <div className="flex-1 min-h-0 bg-background relative flex flex-col p-3">
            <div
                ref={wrapperRef}
                className={cn(
                    "w-full flex-1 rounded-2xl shadow-[0_0_20px_rgba(0,0,0,0.5)] dark:shadow-[0_0_20px_rgba(255,255,255,0.2)] border border-border transition-all duration-400 bg-zinc-900/50",
                    (role === "student" && isViewLocked) ? "overflow-hidden" : "overflow-auto"
                )}
                style={{ backgroundColor: boardColor }}
            >
                <canvas ref={canvasRef} />
            </div>

            {/* Done Button Overlay for Text Tool */}
            {editingTextPos && (
                <div 
                    className="fixed z-9999 pointer-events-auto animate-in fade-in zoom-in duration-200"
                    style={{ 
                        left: editingTextPos.x + 10, 
                        top: editingTextPos.y + 10 
                    }}
                >
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            if (activeTextObjRef.current) {
                                activeTextObjRef.current.exitEditing()
                                if (onToolChangeRef.current) onToolChangeRef.current("select")
                            }
                        }}
                        className="flex items-center justify-center w-10 h-10 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-lg transition-all active:scale-90 group border-2 border-white/20"
                        title="Finish typing"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    </button>
                </div>
            )}
        </div>
    )
}

export default React.memo(Whiteboard)