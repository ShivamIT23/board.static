"use client"

import React, { useEffect, useRef, useCallback, useState } from "react"
import { Canvas, PencilBrush, Path, FabricImage, IText, Line, FabricObject, Rect, Ellipse, Polygon, Group } from "fabric"
import type { BoardFabricObject, BoardIText, WhiteboardProps, ShapePayload, TextPayload, ImagePayload, StoredBoardObject, StrokePayload, LaserPayload, LiveStroke, FullStrokePayload } from "@/types/board"

import { useSocket } from "@/hooks/use-socket"
import { cn } from "@/lib/utils"
import { PENCIL_CURSOR, ERASER_CURSOR, TEXT_CURSOR } from "@/lib/cursors"
import { isShapeTool, getTrianglePoints, getRightTrianglePoints, getDiamondPoints, getPentagonPoints, getParallelogramPoints, getStarPoints } from "@/lib/shapes"
import { ChevronDown } from "lucide-react"
import ReactDOM from "react-dom"

const FONT_SIZES = [12, 16, 20, 24, 32, 40, 48, 64, 80, 96] as const

const FONT_FAMILIES = [
    { id: "Inter, sans-serif", label: "Inter" },
    { id: "Arial, sans-serif", label: "Arial" },
    { id: "Georgia, serif", label: "Georgia" },
    { id: "'Times New Roman', serif", label: "Times" },
    { id: "'Courier New', monospace", label: "Courier" },
    { id: "'Comic Sans MS', cursive", label: "Comic" },
    { id: "Verdana, sans-serif", label: "Verdana" },
    { id: "Impact, sans-serif", label: "Impact" },
] as const

function Whiteboard({ sessionId, role, tool, color, boardColor, bgImages, brushSize, isViewLocked, currentPage, drawingEnabled, shapeBorderColor, textColor, fontSize, setFontSize, fontFamily, setFontFamily, onToolChange, imageStampData }: WhiteboardProps) {
    const { socket } = useSocket()
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const wrapperRef = useRef<HTMLDivElement>(null)
    const fabricRef = useRef<Canvas | null>(null)
    const lastScaledWidthRef = useRef<number>(800)
    const [canvasReady, setCanvasReady] = useState(false)

    const localStrokeIdRef = useRef<string | null>(null)
    const currentPageRef = useRef(currentPage)

    const pagesDataRef = useRef<Record<number, Record<string, unknown>[]>>({})
    const liveStrokesRef = useRef<Record<string, LiveStroke>>({})

    // Track active text editing for UI overlay
    const [editingTextPos, setEditingTextPos] = useState<{ x: number, y: number } | null>(null)
    const activeTextObjRef = useRef<BoardIText | null>(null)
    const liveFabricObjsRef = useRef<Record<string, Path>>({})
    const boardFileObjsRef = useRef<Record<string, FabricImage>>({})
    const textObjsRef = useRef<Record<string, IText>>({})
    const shapeObjsRef = useRef<Record<string, FabricObject>>({})

    // Persistence refs
    const boardHistoryRef = useRef<StoredBoardObject[]>([]);
    const lastSyncTimeRef = useRef<number>(0);

    const [showFontSizeDropdown, setShowFontSizeDropdown] = useState(false)
    const [showFontFamilyDropdown, setShowFontFamilyDropdown] = useState(false)
    const fontSizeButtonRef = useRef<HTMLButtonElement>(null)
    const fontFamilyButtonRef = useRef<HTMLButtonElement>(null)
    const overlayRef = useRef<HTMLDivElement>(null)
    // Flag: user is clicking a font control — safety net for editing:exited
    const isSelectingFontRef = useRef(false)
    // Local font state during editing — decoupled from parent to avoid re-renders
    const [editingFontSize, setEditingFontSize] = useState(fontSize || 24)
    const [editingFontFamily, setEditingFontFamily] = useState(fontFamily || "Inter, sans-serif")

    const localStrokePointsRef = useRef<{ x: number; y: number }[]>([])
    const liveStrokesNormRef = useRef<Record<string, { x: number; y: number }[]>>({})

    const saveToLocalStorage = useCallback((newObj?: StoredBoardObject) => {
        if (newObj) {
            boardHistoryRef.current.push(newObj);
            if (newObj.timestamp > lastSyncTimeRef.current) {
                lastSyncTimeRef.current = newObj.timestamp;
            }
        }
        localStorage.setItem(`board_data_${sessionId}`, JSON.stringify(boardHistoryRef.current));
    }, [sessionId]);

    // ── DB Persistence: Load board state from DB on mount ──
    // (Saving is handled by socket-provider's sync.service.ts every 30s)
    useEffect(() => {
        // 1. First load from localStorage to populate immediately
        const cached = localStorage.getItem(`board_data_${sessionId}`);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed)) {
                    boardHistoryRef.current = parsed;
                    if (parsed.length > 0) {
                        lastSyncTimeRef.current = Math.max(...parsed.map(o => o.timestamp || 0));
                    }
                    console.log(`[Board] Loaded ${parsed.length} objects from localStorage`);
                }
            } catch (e) {
                console.error("Error parsing localStorage cache:", e);
            }
        }

        // 2. Fetch latest from DB to sync/hydrate
        (async () => {
            try {
                const res = await fetch(`/api/board-state?sessionId=${sessionId}`);
                const data = await res.json();
                if (data.status === "success" && data.boardState) {
                    const allObjects: StoredBoardObject[] = [];
                    for (const pageObjects of Object.values(data.boardState)) {
                        if (Array.isArray(pageObjects)) allObjects.push(...pageObjects);
                    }
                    if (allObjects.length > 0) {
                        // Merge by id (or timestamp) to avoid duplicates
                        const objMap = new Map<string, StoredBoardObject>();
                        boardHistoryRef.current.forEach(obj => {
                            const id = (obj.payload as { id?: string }).id || String(obj.timestamp);
                            objMap.set(id, obj);
                        });
                        allObjects.forEach(obj => {
                            const id = (obj.payload as { id?: string }).id || String(obj.timestamp);
                            const existing = objMap.get(id);
                            if (!existing || (obj.timestamp || 0) >= (existing.timestamp || 0)) {
                                objMap.set(id, obj);
                            }
                        });
                        boardHistoryRef.current = Array.from(objMap.values());
                        lastSyncTimeRef.current = Math.max(...boardHistoryRef.current.map(o => o.timestamp || 0));
                        localStorage.setItem(`board_data_${sessionId}`, JSON.stringify(boardHistoryRef.current));
                        console.log(`[Board] Synced/Merged with DB: total ${boardHistoryRef.current.length} objects`);
                    }
                }
            } catch (e) { console.error("Board state load error:", e); }
        })();
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

    const bgImagesRef = useRef(bgImages)
    const setBgImagesOnCanvasRef = useRef<(canvas: Canvas, imageUrls: string[]) => Promise<void>>(() => Promise.resolve())
    const drawingEnabledRef = useRef(drawingEnabled)
    const lastLaserPointRef = useRef<{ x: number, y: number } | null>(null);
    const isLaserActiveRef = useRef<boolean>(false);
    const imageStampDataRef = useRef<string | undefined>(imageStampData);
    const localAddedImageIdsRef = useRef<Set<string>>(new Set());

    const shapeStartRef = useRef<{ x: number; y: number } | null>(null)
    const shapePreviewRef = useRef<FabricObject | null>(null)

    const shapeBorderRef = useRef(shapeBorderColor)
    const brushSizeRef = useRef(brushSize)
    const colorRef = useRef(color)
    const textColorRef = useRef(textColor || "#FFFFFF")
    const fontSizeRef = useRef(fontSize || 24)
    const fontFamilyRef = useRef(fontFamily || "Inter, sans-serif")

    useEffect(() => {
        toolRef.current = tool
        brushSizeRef.current = brushSize
        colorRef.current = color
        textColorRef.current = textColor || "#FFFFFF"
        fontSizeRef.current = fontSize || 24
        fontFamilyRef.current = fontFamily || "Inter, sans-serif"
        onToolChangeRef.current = onToolChange
        imageStampDataRef.current = imageStampData
    }, [tool, brushSize, color, textColor, fontSize, fontFamily, onToolChange, imageStampData])

    useEffect(() => {
        bgImagesRef.current = bgImages
    }, [bgImages])

    useEffect(() => {
        drawingEnabledRef.current = drawingEnabled
    }, [drawingEnabled])

    useEffect(() => {
        shapeBorderRef.current = shapeBorderColor
    }, [shapeBorderColor])




    // Utility: Width-based normalization
    const toNorm = useCallback((px: number, py: number, cw: number) => ({
        x: cw > 0 ? px / cw : 0,
        y: cw > 0 ? py / cw : 0,
    }), [])

    const fromNorm = useCallback((nx: number, ny: number, cw: number) => ({
        x: nx * cw,
        y: ny * cw,
    }), [])

    // ── Native capture-phase mousedown for ALL font controls ──────────
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as HTMLElement
            const matched = target?.closest?.('[data-font-control]')
            if (matched) {
                console.log('%c[1⃣ CAPTURE mousedown] ✅ Hit data-font-control — calling preventDefault()', 'color: lime; font-weight: bold', {
                    tag: target.tagName,
                    text: target.textContent?.slice(0, 20),
                    isEditing: activeTextObjRef.current?.isEditing,
                })
                e.preventDefault()
                isSelectingFontRef.current = true
            } else {
                console.log('[1⃣ CAPTURE mousedown] ❌ No data-font-control found', {
                    tag: target?.tagName,
                    cls: target?.className?.toString?.()?.slice(0, 50),
                })
            }
        }
        document.addEventListener('mousedown', handler, { capture: true })
        return () => document.removeEventListener('mousedown', handler, { capture: true })
    }, [])

    // ── Direct font application helper ────────────────────────────────
    // Applies font changes DIRECTLY to the active text object. Updates local
    // state only (not parent). Parent state is synced on Done button click.
    const applyFontToActiveText = useCallback((newFontSize?: number, newFontFamily?: string) => {
        const canvas = fabricRef.current
        const textObj = activeTextObjRef.current
        if (!canvas || !textObj) return false

        // Save cursor position
        const cursorPos = textObj.selectionStart ?? (textObj.text?.length || 0)

        let changed = false
        if (newFontSize !== undefined && textObj.fontSize !== newFontSize) {
            textObj.set({ fontSize: newFontSize })
            changed = true
        }
        if (newFontFamily !== undefined && textObj.fontFamily !== newFontFamily) {
            textObj.set({ fontFamily: newFontFamily })
            changed = true
        }
        if (!changed) return false

        // Recalculate text dimensions with new font
        textObj.initDimensions()
        textObj.setCoords()

        // Restore cursor position
        textObj.selectionStart = cursorPos
        textObj.selectionEnd = cursorPos
        const ta = (textObj as unknown as { hiddenTextarea?: HTMLTextAreaElement }).hiddenTextarea
        if (ta) {
            ta.selectionStart = cursorPos
            ta.selectionEnd = cursorPos
        }
        canvas.requestRenderAll()

        // Update overlay position (text may have changed size)
        const bound = textObj.getBoundingRect()
        const canvasEl = canvas.getElement()
        const rect = canvasEl.getBoundingClientRect()
        setEditingTextPos({
            x: rect.left + bound.left + (bound.width / 2),
            y: rect.top + bound.top
        })

        // Update local display state (no parent re-render!)
        if (newFontSize !== undefined) setEditingFontSize(newFontSize)
        if (newFontFamily !== undefined) setEditingFontFamily(newFontFamily)

        // Sync to peers
        const id = textObj.id
        if (id) {
            const effectiveFontSize = textObj.fontSize * (textObj.scaleX || 1)
            socket?.emit("text_update", {
                roomId: sessionId,
                payload: {
                    id,
                    text: textObj.text,
                    color: textObj.fill,
                    fontSizeRatio: effectiveFontSize / canvas.width,
                    fontFamily: textObj.fontFamily,
                    position: toNorm(textObj.left, textObj.top, canvas.width),
                    page: currentPageRef.current,
                }
            })
        }
        return true
    }, [sessionId, socket, toNorm])

    // Update active text object when font settings change via props
    // (Only for non-editing text objects, e.g. selecting an existing text)
    useEffect(() => {
        const canvas = fabricRef.current
        if (!canvas) return
        const textObj = activeTextObjRef.current
        if (!textObj) return
        if (textObj.isEditing || isSelectingFontRef.current) return
        let changed = false
        if (fontSize && textObj.fontSize !== fontSize) {
            textObj.set({ fontSize })
            changed = true
        }
        if (fontFamily && textObj.fontFamily !== fontFamily) {
            textObj.set({ fontFamily })
            changed = true
        }
        if (changed) {
            textObj.initDimensions()
            textObj.setCoords()
            canvas.requestRenderAll()
        }
    }, [fontSize, fontFamily])

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
        lastScaledWidthRef.current = containerWidth

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
            isDrawingMode: role === "teacher" || drawingEnabledRef.current,
        })

        fabricRef.current = canvas
        lastScaledWidthRef.current = initialWidth
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
            const stroke = data.stroke || "#FFFFFF"
            const fill = data.fill || (data.shapeType.startsWith("f-") ? stroke : "transparent")
            const strokeWidth = (data.strokeWidthRatio || 0.003) * cw
            const common = {
                left, top, fill, stroke, strokeWidth,
                originX: "left" as const, originY: "top" as const,
                selectable: true,
                evented: true,
                strokeLineCap: "round" as const,
                strokeLineJoin: "round" as const
            }

            switch (data.shapeType as string) {
                case "rectangle":
                case "square":
                case "f-rectangle":
                case "f-square":
                    return new Rect({ ...common, width: w, height: h })
                case "circle":
                case "ellipse":
                case "f-circle":
                case "f-ellipse":
                    return new Ellipse({ ...common, rx: w / 2, ry: h / 2 })
                case "triangle":
                case "f-triangle":
                    return new Polygon(getTrianglePoints(w, h), { ...common, left, top })
                case "right-triangle":
                case "f-right-triangle":
                    return new Polygon(getRightTrianglePoints(w, h), { ...common, left, top })
                case "diamond":
                case "rhombus":
                case "f-diamond":
                case "f-rhombus":
                    return new Polygon(getDiamondPoints(w, h), { ...common, left, top })
                case "pentagon":
                case "f-pentagon":
                    return new Polygon(getPentagonPoints(w, h), { ...common, left, top })
                case "parallelogram":
                case "f-parallelogram":
                    return new Polygon(getParallelogramPoints(w, h), { ...common, left, top })
                case "star":
                case "f-star":
                    return new Polygon(getStarPoints(w, h), { ...common, left, top })
                case "graph-axis": {
                    const arrowSize = Math.max(12, strokeWidth * 0.3)
                    const axisExt = arrowSize + 5
                    const midX = w / 2
                    const midY = h / 2
                    // Extended axes
                    let d = `M ${-axisExt} ${midY} L ${w + axisExt} ${midY} M ${midX} ${-axisExt} L ${midX} ${h + axisExt} `
                    // Filled arrowheads at extensions
                    d += `M ${-axisExt} ${midY} L ${-axisExt + arrowSize} ${midY - arrowSize / 3} L ${-axisExt + arrowSize} ${midY + arrowSize / 3} Z `
                    d += `M ${w + axisExt} ${midY} L ${w + axisExt - arrowSize} ${midY - arrowSize / 3} L ${w + axisExt - arrowSize} ${midY + arrowSize / 3} Z `
                    d += `M ${midX} ${-axisExt} L ${midX - arrowSize / 3} ${-axisExt + arrowSize} L ${midX + arrowSize / 3} ${-axisExt + arrowSize} Z `
                    d += `M ${midX} ${h + axisExt} L ${midX - arrowSize / 3} ${h + axisExt - arrowSize} L ${midX + arrowSize / 3} ${h + axisExt - arrowSize} Z `
                    return new Path(d, { ...common, fill: stroke })
                }
                case "line": {
                    // Use Path instead of Line to avoid Fabric.js bounding-box issues with negative coords
                    const dirX = (data as ShapePayload & { dragDirX?: number }).dragDirX ?? 1
                    const dirY = (data as ShapePayload & { dragDirY?: number }).dragDirY ?? 1
                    const x1 = dirX >= 0 ? 0 : w
                    const y1 = dirY >= 0 ? 0 : h
                    const x2 = dirX >= 0 ? w : 0
                    const y2 = dirY >= 0 ? h : 0
                    return new Path(`M ${x1} ${y1} L ${x2} ${y2}`, { ...common, fill: "transparent" })
                }
                case "arrow": {
                    // Arrow = line with filled arrowhead for sharp tip
                    const angle = Math.atan2(h, w)
                    const headLen = Math.max(12, strokeWidth * 0.3)
                    const x2 = w, y2 = h
                    const xTip1 = x2 - headLen * Math.cos(angle - Math.PI / 8)
                    const yTip1 = y2 - headLen * Math.sin(angle - Math.PI / 8)
                    const xTip2 = x2 - headLen * Math.cos(angle + Math.PI / 8)
                    const yTip2 = y2 - headLen * Math.sin(angle + Math.PI / 8)

                    const d = `M 0 0 L ${x2} ${y2} M ${x2} ${y2} L ${xTip1} ${yTip1} L ${xTip2} ${yTip2} Z`
                    return new Path(d, { ...common, fill: stroke })
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

                        const arrowSize = Math.max(12, strokeWidth * 0.3)
                        const axisExt = arrowSize + 5
                        let axesD = `M ${-axisExt} ${midY} L ${w + axisExt} ${midY} M ${midX} ${-axisExt} L ${midX} ${h + axisExt} `
                        // Filled arrowheads at extensions (outside grid area)
                        axesD += `M ${-axisExt} ${midY} L ${-axisExt + arrowSize} ${midY - arrowSize / 3} L ${-axisExt + arrowSize} ${midY + arrowSize / 3} Z `
                        axesD += `M ${w + axisExt} ${midY} L ${w + axisExt - arrowSize} ${midY - arrowSize / 3} L ${w + axisExt - arrowSize} ${midY + arrowSize / 3} Z `
                        axesD += `M ${midX} ${-axisExt} L ${midX - arrowSize / 3} ${-axisExt + arrowSize} L ${midX + arrowSize / 3} ${-axisExt + arrowSize} Z `
                        axesD += `M ${midX} ${h + axisExt} L ${midX - arrowSize / 3} ${h + axisExt - arrowSize} L ${midX + arrowSize / 3} ${h + axisExt - arrowSize} Z `

                        const axesPath = new Path(axesD, { ...common, left: 0, top: 0, fill: stroke })

                        const objs: FabricObject[] = [gridPath, axesPath]

                        if (isLabeled) {
                            const fontSize = Math.max(6, Math.min(w, h) / (range * 5))
                            const textCommon = { fontSize, fill: stroke, fontFamily: "Inter, sans-serif", originX: "center" as const, originY: "center" as const, selectable: false, evented: false }

                            const step = range > 15 ? 2 : 1
                            const labelOffset = Math.max(fontSize * 1.2, strokeWidth / 2 + 4)
                            for (let i = -range + 1; i <= range - 1; i++) {
                                if (i === 0) continue
                                if (i % step !== 0) continue
                                objs.push(new IText(i.toString(), { ...textCommon, left: midX + i * stepX, top: midY + labelOffset }))
                                objs.push(new IText((-i).toString(), { ...textCommon, left: midX - labelOffset, top: midY + i * stepY }))
                            }

                            objs.push(new IText("x", { ...textCommon, fontSize: fontSize * 1.5, fontStyle: "italic", fontWeight: "bold", left: w + axisExt + fontSize, top: midY }))
                            objs.push(new IText("y", { ...textCommon, fontSize: fontSize * 1.5, fontStyle: "italic", fontWeight: "bold", left: midX, top: -axisExt - fontSize }))

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
                        // Matrix [ ] and determinant | | should be as thin as possible
                        const isThinSymbol = val === "[ ]" || val === "| |"
                        return new IText(val, {
                            ...common,
                            fontSize,
                            fill: isEmoji ? "black" : stroke,
                            fontFamily: isThinSymbol ? "'Courier New', monospace" : "Inter, sans-serif",
                            fontWeight: isThinSymbol ? 100 : "normal",
                            stroke: isEmoji ? undefined : (isThinSymbol ? undefined : stroke),
                            strokeWidth: isEmoji ? 0 : (isThinSymbol ? 0 : strokeWidth * 0.1),
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

                // If there's already an active text being edited, finalize it and switch to select tool
                // (one-shot behavior: clicking elsewhere dismisses the text and its font toolbar)
                if (activeTextObjRef.current) {
                    console.log('%c[CANVAS mouse:down] Text tool clicked canvas — exitEditing existing text & switching to select', 'color: red; font-weight: bold', {
                        isSelectingFont: isSelectingFontRef.current,
                    })
                    activeTextObjRef.current.exitEditing()
                    activeTextObjRef.current = null
                    setEditingTextPos(null)
                    setShowFontSizeDropdown(false)
                    setShowFontFamilyDropdown(false)
                    if (onToolChangeRef.current) onToolChangeRef.current("select")
                    return
                }

                // Fabric.js v7 requires selection=true for IText editing cursor to render
                canvas.selection = true
                canvas.skipTargetFind = false

                const pt = canvas.getScenePoint(opt.e)
                const id = generateId()

                console.log(`[TEXT] Creating text at (${pt.x}, ${pt.y}). fontSize=${fontSizeRef.current}, fontFamily=${fontFamilyRef.current}`)
                const textObj = new IText("", {
                    left: pt.x,
                    top: pt.y,
                    fontSize: fontSizeRef.current,
                    fill: textColorRef.current,
                    fontFamily: fontFamilyRef.current,
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
                // Initialize local font state for the overlay display
                setEditingFontSize(textObj.fontSize || 24)
                setEditingFontFamily(textObj.fontFamily || "Inter, sans-serif")

                const updateOverlayPos = (obj: BoardIText) => {
                    if (!fabricRef.current) return
                    const bound = obj.getBoundingRect()
                    const canvasEl = fabricRef.current.getElement()
                    const rect = canvasEl.getBoundingClientRect()
                    setEditingTextPos({
                        x: rect.left + bound.left + (bound.width / 2),
                        y: rect.top + bound.top
                    })
                }

                const updateDoneButtonPos = () => {
                    if (!textObj || !fabricRef.current) return
                    updateOverlayPos(textObj)
                }

                updateDoneButtonPos()
                textObj.on("changed", updateDoneButtonPos)
                textObj.on("moving", updateDoneButtonPos)
                textObj.on("scaling", updateDoneButtonPos)

                // Fabric.js uses a hidden textarea for keyboard input — must be explicitly focused
                const textarea = (textObj as unknown as { hiddenTextarea?: HTMLTextAreaElement }).hiddenTextarea
                if (textarea) {
                    textarea.focus()
                    // DEBUG: Monitor when the hidden textarea loses focus
                    const blurHandler = () => {
                        console.log('%c[2⃣ TEXTAREA blur]', 'color: yellow; font-weight: bold', {
                            isSelectingFont: isSelectingFontRef.current,
                            activeElement: document.activeElement?.tagName,
                            activeElementId: (document.activeElement as HTMLElement)?.id,
                            activeElementCls: (document.activeElement as HTMLElement)?.className?.toString?.()?.slice(0, 50),
                        })
                    }
                    textarea.addEventListener('blur', blurHandler)
                    // Clean up blur handler when text obj is removed
                    textObj.on('editing:exited', () => {
                        textarea.removeEventListener('blur', blurHandler)
                    })
                }
                canvas.requestRenderAll()

                // Emit to peers when editing finishes
                textObj.on("editing:exited", () => {
                    console.log('%c[3⃣ editing:exited]', 'color: #ff6b6b; font-weight: bold', {
                        isSelectingFont: isSelectingFontRef.current,
                        textContent: textObj.text?.slice(0, 20),
                        isEditing: textObj.isEditing,
                    })
                    // If user was clicking a font control, Fabric exited editing
                    // internally but we want to stay in editing mode.
                    if (isSelectingFontRef.current) {
                        console.log('%c[3⃣ editing:exited] ♻️ Re-entering editing (font control click)', 'color: lime; font-weight: bold')
                        setTimeout(() => {
                            if (!textObj || !fabricRef.current) return
                            fabricRef.current.setActiveObject(textObj)
                            textObj.enterEditing()
                            // Place cursor at end of existing text
                            textObj.setSelectionStart(textObj.text?.length || 0)
                            textObj.setSelectionEnd(textObj.text?.length || 0)
                            const ta = (textObj as unknown as { hiddenTextarea?: HTMLTextAreaElement }).hiddenTextarea
                            if (ta) ta.focus()
                            // Recalculate text dimensions after font change
                            textObj.initDimensions()
                            textObj.setCoords()
                            fabricRef.current.requestRenderAll()
                            // Reset the flag AFTER re-entering
                            isSelectingFontRef.current = false
                            console.log('%c[3⃣ editing:exited] ✅ Re-entered editing successfully', 'color: lime', { isEditing: textObj.isEditing })
                        }, 0)
                        return
                    }
                    setEditingTextPos(null)
                    activeTextObjRef.current = null
                    textObj.off("changed", updateDoneButtonPos)
                    textObj.off("moving", updateDoneButtonPos)
                    textObj.off("scaling", updateDoneButtonPos)

                    if (!textObj.text?.trim()) {
                        canvas.remove(textObj)
                        delete textObjsRef.current[id]
                        canvas.requestRenderAll()
                        return
                    }
                    // Compute effective visual fontSize
                    const effectiveFontSize = textObj.fontSize * (textObj.scaleX || 1)
                    const payload = {
                        id,
                        text: textObj.text,
                        color: textObj.fill,
                        fontSizeRatio: effectiveFontSize / canvas.width,
                        fontFamily: textObj.fontFamily,
                        position: toNorm(textObj.left, textObj.top, canvas.width),
                        page: currentPageRef.current,
                    }
                    if (textObj._synced) {
                        socket?.emit("text_update", { roomId: sessionId, payload })
                    } else {
                        textObj._synced = true
                        socket?.emit("text_add", { roomId: sessionId, payload })
                    }
                })
                return
            }

            // Image Stamp: record start point for drag-to-size (like shapes)
            if (toolRef.current === "image-stamp" && imageStampDataRef.current) {
                if (role === "student" && (!drawingEnabledRef.current)) return
                const pt = canvas.getScenePoint(opt.e)
                shapeStartRef.current = { x: pt.x, y: pt.y }
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
            localStrokePointsRef.current = [toNorm(pt.x, pt.y, canvas.width)]

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
            // Image Stamp preview while dragging
            if (shapeStartRef.current && toolRef.current === "image-stamp") {
                const pt = canvas.getScenePoint(opt.e)
                const start = shapeStartRef.current
                const w = pt.x - start.x
                const h = pt.y - start.y
                const left = w >= 0 ? start.x : start.x + w
                const top = h >= 0 ? start.y : start.y + h
                const absW = Math.abs(w)
                const absH = Math.abs(h)

                // Remove previous preview
                canvas.getObjects().forEach(obj => {
                    if ((obj as FabricObject & { _isPreview?: boolean })._isPreview) canvas.remove(obj)
                })
                shapePreviewRef.current = null

                if (absW > 5 || absH > 5) {
                    const preview = new Rect({
                        left, top, width: absW, height: absH,
                        fill: "transparent",
                        stroke: "#4488ff",
                        strokeWidth: 2,
                        strokeDashArray: [6, 4],
                        selectable: false,
                        evented: false,
                        opacity: 0.7,
                    });
                    (preview as FabricObject & { _isPreview?: boolean })._isPreview = true
                    shapePreviewRef.current = preview
                    canvas.add(preview)
                    canvas.requestRenderAll()
                }
                return
            }

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

                // For line tool: use standard bounding-box position (same as other shapes)
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

                // Remove ALL previous preview objects (robust cleanup)
                canvas.getObjects().forEach(obj => {
                    if ((obj as FabricObject & { _isPreview?: boolean })._isPreview) canvas.remove(obj)
                })
                shapePreviewRef.current = null

                const shapeType = toolRef.current
                const isFilled = shapeType.startsWith("f-")
                const stroke = colorRef.current
                const fill = isFilled ? stroke : "transparent"

                const previewData: ShapePayload & { dragDirX?: number; dragDirY?: number } = {
                    id: "preview",
                    shapeType,
                    position: toNorm(left, top, canvas.width),
                    widthRatio: absW / canvas.width,
                    heightRatio: absH / canvas.width,
                    fill,
                    stroke,
                    strokeWidthRatio: brushSizeRef.current / canvas.width,
                }
                // Pass drag direction for line tool so Path knows start/end corners
                if (shapeType === "line") {
                    previewData.dragDirX = w >= 0 ? 1 : -1
                    previewData.dragDirY = h >= 0 ? 1 : -1
                }

                const preview = createShapeFromPayload(previewData)
                if (preview) {
                    ; (preview as FabricObject & { _isPreview?: boolean })._isPreview = true
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
            const normPt = toNorm(pt.x, pt.y, canvas.width)
            localStrokePointsRef.current.push(normPt)
            socket?.emit("stroke_draw", {
                roomId: sessionId,
                payload: {
                    id: localStrokeIdRef.current,
                    type: "draw",
                    point: normPt,
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

            // Finalize image stamp
            if (shapeStartRef.current && toolRef.current === "image-stamp" && imageStampDataRef.current) {
                const pt = canvas.getScenePoint(opt.e)
                const start = shapeStartRef.current
                shapeStartRef.current = null

                // Remove preview
                canvas.getObjects().forEach(obj => {
                    if ((obj as FabricObject & { _isPreview?: boolean })._isPreview) canvas.remove(obj)
                })
                shapePreviewRef.current = null
                canvas.requestRenderAll()

                const w = pt.x - start.x
                const h = pt.y - start.y
                const absW = Math.abs(w)
                const absH = Math.abs(h)

                // Skip tiny clicks (less than 10px) — require a real drag
                if (absW < 10 && absH < 10) return

                const left = w >= 0 ? start.x : start.x + w
                const top = h >= 0 ? start.y : start.y + h
                const id = generateId()

                const payload: ImagePayload = {
                    id,
                    url: imageStampDataRef.current,
                    position: toNorm(left, top, canvas.width),
                    widthRatio: absW / canvas.width,
                    heightRatio: absH / canvas.width,
                }
                // Add locally for instant feedback
                localAddedImageIdsRef.current.add(id)
                addImageToCanvas(payload)
                // Emit to peers (server broadcasts to everyone; duplicate check in listener)
                socket?.emit("board_file_add", { payload })
                saveToLocalStorage({
                    type: "image",
                    payload,
                    timestamp: Date.now(),
                })
                return
            }

            // Finalize shape
            if (shapeStartRef.current && isShapeTool(toolRef.current)) {
                const pt = canvas.getScenePoint(opt.e)
                const start = shapeStartRef.current
                shapeStartRef.current = null

                // Remove ALL preview objects (robust cleanup)
                canvas.getObjects().forEach(obj => {
                    if ((obj as FabricObject & { _isPreview?: boolean })._isPreview) canvas.remove(obj)
                })
                shapePreviewRef.current = null
                canvas.requestRenderAll()

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

                const shapeType = toolRef.current
                const isFilled = shapeType.startsWith("f-")
                const stroke = colorRef.current
                const fill = isFilled ? stroke : "transparent"

                const shapePayload: ShapePayload & { dragDirX?: number; dragDirY?: number } = {
                    id,
                    shapeType,
                    position: toNorm(left, top, canvas.width),
                    widthRatio: absW / canvas.width,
                    heightRatio: absH / canvas.width,
                    fill,
                    stroke,
                    strokeWidthRatio: brushSizeRef.current / canvas.width,
                    page: currentPageRef.current,
                    timestamp: Date.now(),
                }
                if (shapeType === "line") {
                    shapePayload.dragDirX = w >= 0 ? 1 : -1
                    shapePayload.dragDirY = h >= 0 ? 1 : -1
                }

                const shape = createShapeFromPayload(shapePayload)
                if (shape) {
                    (shape as FabricObject & { id: string }).id = id
                    shapeObjsRef.current[id] = shape
                    canvas.add(shape)
                    canvas.requestRenderAll()

                    socket?.emit("shape_add", { roomId: sessionId, payload: shapePayload })
                    saveToLocalStorage({
                        type: "shape",
                        payload: shapePayload,
                        timestamp: shapePayload.timestamp || Date.now(),
                    })
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

            const fullStroke = {
                id: localStrokeIdRef.current,
                type: "full" as const,
                points: localStrokePointsRef.current,
                color: canvas.freeDrawingBrush?.color || "#fff",
                width: (canvas.freeDrawingBrush?.width || brushSize) / canvas.width,
                page: currentPageRef.current,
            }
            saveToLocalStorage({
                type: "stroke",
                payload: fullStroke,
                timestamp: Date.now(),
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

        // ── Show font overlay when a text object is selected ──────
        const handleTextSelection = (obj: FabricObject | null) => {
            if (!obj || (obj.type !== "i-text" && obj.type !== "text")) {
                if (!isSelectingFontRef.current) {
                    setEditingTextPos(null)
                    if (activeTextObjRef.current && !activeTextObjRef.current.isEditing) {
                        activeTextObjRef.current = null
                    }
                }
                return
            }
            const textObj = obj as BoardIText
            if (!fabricRef.current) return

            // Don't show font controls for emoji/symbol objects (they live in shapeObjsRef, not textObjsRef)
            const objId = (obj as BoardFabricObject).id
            if (objId && shapeObjsRef.current[objId]) return

            const bound = textObj.getBoundingRect()
            const canvasEl = fabricRef.current.getElement()
            const rect = canvasEl.getBoundingClientRect()
            activeTextObjRef.current = textObj
            // Initialize local font state for the overlay
            setEditingFontSize(textObj.fontSize || 24)
            setEditingFontFamily(textObj.fontFamily || "Inter, sans-serif")
            setEditingTextPos({
                x: rect.left + bound.left + (bound.width / 2),
                y: rect.top + bound.top
            })
            // If the text is already editing, no additional guard needed
            // (the native capture-phase listener on overlayRef handles it)
        }
        canvas.on("selection:created", (opt) => handleTextSelection(opt.selected?.[0] ?? null))
        canvas.on("selection:updated", (opt) => handleTextSelection(opt.selected?.[0] ?? null))
        canvas.on("selection:cleared", () => {
            console.log('[5⃣ selection:cleared]', {
                isSelectingFont: isSelectingFontRef.current,
                hasActiveText: !!activeTextObjRef.current,
            })
            if (!isSelectingFontRef.current) {
                setEditingTextPos(null)
                activeTextObjRef.current = null
            }
            // Always reset the flag — by the time selection:cleared fires on the canvas,
            // any font control interaction is already complete. This prevents the flag
            // from staying stale and blocking future cleanup.
            isSelectingFontRef.current = false
        })

        // Update floating toolbar position when text is dragged
        canvas.on("object:moving", (opt) => {
            const obj = opt.target as BoardIText
            if (!obj || !activeTextObjRef.current) return
            if ((obj as BoardFabricObject).id === (activeTextObjRef.current as BoardFabricObject).id) {
                const bound = obj.getBoundingRect()
                const canvasEl = canvas.getElement()
                const rect = canvasEl.getBoundingClientRect()
                setEditingTextPos({
                    x: rect.left + bound.left + (bound.width / 2),
                    y: rect.top + bound.top
                })
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
                const shapePayload = {
                    id,
                    position: toNorm(obj.left, obj.top, canvas.width),
                    widthRatio: obj.getScaledWidth() / canvas.width,
                    heightRatio: obj.getScaledHeight() / canvas.width,
                    page: currentPageRef.current,
                }
                socket?.emit("shape_update", {
                    roomId: sessionId,
                    payload: shapePayload
                })
                boardHistoryRef.current = boardHistoryRef.current.map(item => {
                    if (item.type === "shape" && (item.payload as { id: string }).id === id) {
                        return { ...item, payload: { ...item.payload, ...shapePayload } } as StoredBoardObject
                    }
                    return item
                })
                saveToLocalStorage()
                return
            }

            // Text object modified (moved, resized, edited)
            if (textObjsRef.current[id]) {
                const textObj = obj as unknown as BoardIText
                // Skip if we're in the middle of a font change —
                // the font-update useEffect already emits text_update
                if (isSelectingFontRef.current) return
                const effectiveFontSize = textObj.fontSize * (textObj.scaleX || 1)
                console.log(`[TEXT] object:modified id=${id}, effectiveFontSize=${effectiveFontSize}`)
                const textPayload = {
                    id,
                    text: textObj.text,
                    color: (textObj.fill as string) || undefined,
                    fontSizeRatio: effectiveFontSize / canvas.width,
                    fontFamily: textObj.fontFamily,
                    position: toNorm(obj.left, obj.top, canvas.width),
                    page: currentPageRef.current,
                }
                socket?.emit("text_update", {
                    roomId: sessionId,
                    payload: textPayload
                })
                boardHistoryRef.current = boardHistoryRef.current.map(item => {
                    if (item.type === "text" && (item.payload as { id: string }).id === id) {
                        return { ...item, payload: { ...item.payload, ...textPayload } } as StoredBoardObject
                    }
                    return item
                })
                saveToLocalStorage()
                return
            }

            // Stroke (Path) modified (moved, resized)
            if (obj instanceof Path) {
                const strokePayload = {
                    id,
                    position: toNorm(obj.left, obj.top, canvas.width),
                    widthRatio: obj.getScaledWidth() / canvas.width,
                    heightRatio: obj.getScaledHeight() / canvas.width,
                    page: currentPageRef.current,
                }
                socket?.emit("stroke_update", {
                    roomId: sessionId,
                    payload: strokePayload
                })
                boardHistoryRef.current = boardHistoryRef.current.map(item => {
                    if (item.type === "stroke" && (item.payload as { id: string }).id === id) {
                        return { ...item, payload: { ...item.payload, ...strokePayload } } as StoredBoardObject
                    }
                    return item
                })
                saveToLocalStorage()
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
                liveStrokesNormRef.current[id] = [point]
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
                if (liveStrokesNormRef.current[id]) {
                    liveStrokesNormRef.current[id].push(point)
                }
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
                const normPoints = liveStrokesNormRef.current[id]
                if (normPoints) {
                    const fullStroke = {
                        id,
                        type: "full" as const,
                        points: normPoints,
                        color: sColor || liveStrokesRef.current[id]?.color || "#fff",
                        width: sWidth || (liveStrokesRef.current[id]?.width || brushSize) / canvas.width,
                        page: sPage ?? currentPageRef.current,
                    }
                    saveToLocalStorage({
                        type: "stroke",
                        payload: fullStroke,
                        timestamp: Date.now(),
                    })
                    delete liveStrokesNormRef.current[id]
                }
                delete liveStrokesRef.current[id]
                delete liveFabricObjsRef.current[id]
            }
            canvas.requestRenderAll()
        }

        const handleStrokeAdd = ({ payload }: { payload: FullStrokePayload }) => {
            if (payload.page !== undefined && payload.page !== currentPageRef.current) return

            if (payload.id && !boardHistoryRef.current.some(obj => (obj.payload as { id: string }).id === payload.id)) {
                saveToLocalStorage({
                    type: "stroke",
                    payload,
                    timestamp: payload.timestamp || Date.now(),
                })
            }

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
                    originX: "left",
                    originY: "top",
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

            if (!boardHistoryRef.current.some(obj => (obj.payload as { id: string }).id === payload.id)) {
                saveToLocalStorage({
                    type: "text",
                    payload,
                    timestamp: payload.timestamp || Date.now(),
                })
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
                fontFamily: payload.fontFamily || "Inter, sans-serif",
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
            // Skip updates for the text we're currently editing locally —
            // our own emit gets echoed back by the server and would disrupt
            // Fabric's editing state (cursor, focus, hiddenTextarea).
            // Also skip during font selection — isEditing is temporarily false
            // between editing:exited and the setTimeout re-entry.
            const activeId = (activeTextObjRef.current as BoardFabricObject)?.id
            if (activeId && activeId === payload.id && (activeTextObjRef.current?.isEditing || isSelectingFontRef.current)) {
                return
            }
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
                if (payload.fontFamily) {
                    existing.set({ fontFamily: payload.fontFamily })
                }
                existing.setCoords()
                canvas.requestRenderAll()

                boardHistoryRef.current = boardHistoryRef.current.map(item => {
                    if (item.type === "text" && (item.payload as { id: string }).id === payload.id) {
                        return { ...item, payload: { ...item.payload, ...payload } } as StoredBoardObject
                    }
                    return item
                })
                saveToLocalStorage()
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
            socket.on("board_file_add", ({ payload }: { payload: ImagePayload }) => {
                // Skip if already added locally (e.g. by stamp tool)
                if (localAddedImageIdsRef.current.has(payload.id)) return
                if (boardFileObjsRef.current[payload.id]) return
                addImageToCanvas(payload)
            })
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
                if (!boardHistoryRef.current.some(obj => (obj.payload as { id: string }).id === payload.id)) {
                    saveToLocalStorage({ type: "shape", payload, timestamp: payload.timestamp || Date.now() });
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

            boardHistoryRef.current = boardHistoryRef.current.map(item => {
                if (item.type === "shape" && (item.payload as { id: string }).id === payload.id) {
                    return { ...item, payload: { ...item.payload, ...payload } } as StoredBoardObject
                }
                return item
            })
            saveToLocalStorage()
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

            boardHistoryRef.current = boardHistoryRef.current.map(item => {
                if (item.type === "stroke" && (item.payload as { id: string }).id === payload.id) {
                    return { ...item, payload: { ...item.payload, ...payload } } as StoredBoardObject
                }
                return item
            })
            saveToLocalStorage()
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
            boardHistoryRef.current = boardHistoryRef.current.filter(item => (item.payload as { id: string }).id !== payload.id);
            saveToLocalStorage();
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
            if (!wrapperRef.current || !fabricRef.current) {
                console.log("[ResizeObserver] Missing ref:", { wrapper: !!wrapperRef.current, fabric: !!fabricRef.current })
                return
            }
            const containerWidth = wrapperRef.current.clientWidth
            const canvas = fabricRef.current
            const oldWidth = lastScaledWidthRef.current

            console.log("[ResizeObserver] Executing:", { containerWidth, oldWidth, oldHeight: canvas.height })

            if (Math.abs(containerWidth - oldWidth) < 1) {
                console.log("[ResizeObserver] Skipping trivial resize")
                return
            }

            const scaleFactor = containerWidth / oldWidth
            console.log("[ResizeObserver] Scaling factor calculated:", scaleFactor)

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

            lastScaledWidthRef.current = containerWidth
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

        // Clean up active text editing when switching away from text/select tools
        // This ensures the floating font toolbar disappears when the user picks a different tool
        if (tool !== "text" && tool !== "select" && activeTextObjRef.current) {
            if (activeTextObjRef.current.isEditing) {
                activeTextObjRef.current.exitEditing()
            }
            activeTextObjRef.current = null
            setEditingTextPos(null)
            setShowFontSizeDropdown(false)
            setShowFontFamilyDropdown(false)
        }

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
        const isShapeCursor = isShapeTool(tool) || tool === "line" || tool === "arrow" || tool === "image-stamp"
        canvas.defaultCursor = activeTextObjRef.current ? TEXT_CURSOR : (tool === "laser" || isShapeCursor ? "crosshair" : tool === "text" ? TEXT_CURSOR : "default")
        // Only the arrow/select tool can select and move objects on the canvas.
        // All other tools should pass through objects (like laser does).
        // Exception: eraser needs target-find to identify clicked objects for deletion.
        // Exception: text tool needs target-find to select existing text for re-editing.
        if (activeTextObjRef.current) {
            canvas.selection = true
            canvas.skipTargetFind = false
        } else {
            canvas.selection = tool === "select"
            canvas.skipTargetFind = tool !== "select" && tool !== "eraser" && tool !== "text"
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

    // ── Keyboard Shortcuts: Delete/Backspace to remove objects ──
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check permissions
            if (role === "student" && !drawingEnabled) return

            // Check if user is typing in an input or textarea
            const activeEl = document.activeElement
            if (activeEl?.tagName === "INPUT" || activeEl?.tagName === "TEXTAREA" || (activeEl as HTMLElement)?.isContentEditable) {
                return
            }

            // Check if we are currently editing a Fabric text object
            if (activeTextObjRef.current) return

            if (e.key === "Delete" || e.key === "Backspace") {
                const canvas = fabricRef.current
                if (!canvas) return

                const activeObjects = canvas.getActiveObjects()
                if (activeObjects.length > 0) {
                    e.preventDefault()
                    activeObjects.forEach((obj) => {
                        const id = (obj as BoardFabricObject).id
                        canvas.remove(obj)
                        if (id) {
                            socket?.emit("object_remove", { roomId: sessionId, payload: { id } })
                            boardHistoryRef.current = boardHistoryRef.current.filter(
                                (item) => (item.payload as { id: string }).id !== id
                            )
                            if (boardFileObjsRef.current[id]) delete boardFileObjsRef.current[id]
                            if (textObjsRef.current[id]) delete textObjsRef.current[id]
                            if (shapeObjsRef.current[id]) delete shapeObjsRef.current[id]
                        }
                    })
                    canvas.discardActiveObject()
                    saveToLocalStorage()
                    canvas.requestRenderAll()
                }
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [sessionId, socket, role, drawingEnabled, saveToLocalStorage])


    return (
        <div className="flex-1 min-w-0 min-h-0 bg-background relative flex flex-col p-3">
            <div
                ref={wrapperRef}
                className={cn(
                    "w-full flex-1 min-w-0 rounded-none shadow-[0_0_20px_rgba(0,0,0,0.5)] dark:shadow-[0_0_20px_rgba(255,255,255,0.2)] border border-border transition-all duration-400 bg-zinc-900/50",
                    (role === "student" && isViewLocked) ? "overflow-hidden" : "overflow-y-auto overflow-x-hidden"
                )}
                style={{ backgroundColor: boardColor }}
            >
                <canvas ref={canvasRef} />
            </div>

            {/* Text Tool Floating Controls — shown when editing or selecting a text object */}
            {editingTextPos && (
                <div
                    ref={overlayRef}
                    data-font-control
                    className="fixed z-9999 pointer-events-auto flex flex-col items-center -translate-x-1/2"
                    style={{ left: editingTextPos.x, top: editingTextPos.y - 48 }}
                >
                    <div className="flex items-center gap-1 px-1.5 py-1 bg-zinc-900/95 backdrop-blur-md border border-white/15 rounded-md shadow-2xl shadow-black/60">

                        {/* Font Size */}
                        <div className="relative">
                            <button
                                ref={fontSizeButtonRef}
                                type="button"
                                data-font-control
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setShowFontSizeDropdown(v => !v)
                                    setShowFontFamilyDropdown(false)
                                }}
                                className={cn(
                                    "h-6 px-1.5 min-w-[30px] border rounded border-white/20 text-[11px] font-bold flex items-center justify-center transition-colors",
                                    showFontSizeDropdown ? "bg-indigo-600 text-white" : "bg-white/10 text-white hover:bg-white/20"
                                )}
                                title={`Font Size: ${editingFontSize}`}
                            >
                                {editingFontSize}
                            </button>

                            {showFontSizeDropdown && ReactDOM.createPortal(
                                <div data-font-control>
                                    <div className="fixed inset-0 z-9998" data-font-control onClick={() => setShowFontSizeDropdown(false)} />
                                    <div
                                        className="fixed z-9999 flex flex-col gap-px p-1 bg-zinc-900 border border-white/20 rounded shadow-2xl max-h-[180px] overflow-y-auto no-scrollbar"
                                        style={{
                                            top: (fontSizeButtonRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
                                            left: fontSizeButtonRef.current?.getBoundingClientRect().left ?? 0
                                        }}
                                    >
                                        {FONT_SIZES.map((size) => (
                                            <button
                                                key={size}
                                                type="button"
                                                data-font-control
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    applyFontToActiveText(size, undefined)
                                                    setShowFontSizeDropdown(false)
                                                }}
                                                className={cn(
                                                    "px-2.5 py-1 rounded-sm text-[10px] font-medium text-left whitespace-nowrap transition-colors",
                                                    editingFontSize === size ? "bg-indigo-600 text-white" : "text-zinc-300 hover:text-white hover:bg-white/10"
                                                )}
                                            >
                                                {size}px
                                            </button>
                                        ))}
                                    </div>
                                </div>,
                                document.body
                            )}
                        </div>

                        {/* Divider */}
                        <div className="w-px h-4 bg-white/15" />

                        {/* Font Family */}
                        <div className="relative">
                            <button
                                ref={fontFamilyButtonRef}
                                type="button"
                                data-font-control
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setShowFontFamilyDropdown(v => !v)
                                    setShowFontSizeDropdown(false)
                                }}
                                className={cn(
                                    "h-6 px-1.5 min-w-[56px] border rounded border-white/20 text-[11px] font-medium flex items-center gap-1 transition-colors",
                                    showFontFamilyDropdown ? "bg-indigo-600 text-white" : "bg-white/10 text-white hover:bg-white/20"
                                )}
                                title={`Font: ${FONT_FAMILIES.find(f => f.id === editingFontFamily)?.label ?? "Inter"}`}
                            >
                                <span className="truncate max-w-[44px]" style={{ fontFamily: editingFontFamily }}>
                                    {FONT_FAMILIES.find(f => f.id === editingFontFamily)?.label ?? "Inter"}
                                </span>
                                <ChevronDown size={10} className="opacity-50 shrink-0" />
                            </button>

                            {showFontFamilyDropdown && ReactDOM.createPortal(
                                <div data-font-control>
                                    <div className="fixed inset-0 z-9998" data-font-control onClick={() => setShowFontFamilyDropdown(false)} />
                                    <div
                                        className="fixed z-9999 flex flex-col gap-px p-1 bg-zinc-900 border border-white/20 rounded shadow-2xl"
                                        style={{
                                            top: (fontFamilyButtonRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
                                            left: fontFamilyButtonRef.current?.getBoundingClientRect().left ?? 0
                                        }}
                                    >
                                        {FONT_FAMILIES.map((f) => (
                                            <button
                                                key={f.id}
                                                type="button"
                                                data-font-control
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    applyFontToActiveText(undefined, f.id)
                                                    setShowFontFamilyDropdown(false)
                                                }}
                                                className={cn(
                                                    "px-2.5 py-1 rounded-sm text-[10px] font-medium text-left whitespace-nowrap transition-colors",
                                                    editingFontFamily === f.id ? "bg-indigo-600 text-white" : "text-zinc-300 hover:text-white hover:bg-white/10"
                                                )}
                                                style={{ fontFamily: f.id }}
                                            >
                                                {f.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>,
                                document.body
                            )}
                        </div>

                        {/* Divider */}
                        <div className="w-px h-4 bg-white/15" />

                        {/* Done \u2014 the ONLY button that closes the text input */}
                        {/* NO data-font-control here so the native listener does NOT prevent default */}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                isSelectingFontRef.current = false
                                setShowFontSizeDropdown(false)
                                setShowFontFamilyDropdown(false)
                                setEditingTextPos(null)
                                const obj = activeTextObjRef.current
                                if (obj) {
                                    obj.exitEditing()
                                    activeTextObjRef.current = null
                                }
                                // Sync final font values to parent state
                                setFontSize?.(editingFontSize)
                                setFontFamily?.(editingFontFamily)
                                if (onToolChangeRef.current) onToolChangeRef.current("select")
                            }}
                            className="w-6 h-6 flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors active:scale-90"
                            title="Done typing"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default React.memo(Whiteboard)