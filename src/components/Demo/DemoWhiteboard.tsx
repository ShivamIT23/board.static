"use client"

import React, { useEffect, useRef, useCallback, useState } from "react"
import { Canvas, PencilBrush, Path, FabricImage, IText, Line, FabricObject, Rect, Ellipse, Polygon, Group } from "fabric"
import type { BoardFabricObject, BoardIText, WhiteboardProps, ShapePayload, TextPayload, ImagePayload, StoredBoardObject, StrokePayload, LaserPayload, LiveStroke, FullStrokePayload } from "@/types/board"

import { cn } from "@/lib/utils"
import { PENCIL_CURSOR, ERASER_CURSOR, TEXT_CURSOR } from "@/lib/cursors"
import { isShapeTool, getTrianglePoints, getRightTrianglePoints, getDiamondPoints, getPentagonPoints, getParallelogramPoints, getStarPoints } from "@/lib/shapes"
import { ChevronDown } from "lucide-react"
import ReactDOM from "react-dom"
import { toast } from "sonner"

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

function DemoWhiteboard({ sessionId, role, tool, color, boardColor, bgImages, brushSize, isViewLocked, currentPage, drawingEnabled, shapeBorderColor, textColor, fontSize, setFontSize, fontFamily, setFontFamily, onToolChange, imageStampData }: WhiteboardProps) {
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
    const [fontSizeDropdownPos, setFontSizeDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
    const [fontFamilyDropdownPos, setFontFamilyDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
    const fontSizeButtonRef = useRef<HTMLButtonElement>(null)
    const fontFamilyButtonRef = useRef<HTMLButtonElement>(null)
    const overlayRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (showFontSizeDropdown && fontSizeButtonRef.current) {
            const rect = fontSizeButtonRef.current.getBoundingClientRect()
            setFontSizeDropdownPos({ top: rect.bottom + 4, left: rect.left })
        }
    }, [showFontSizeDropdown])

    useEffect(() => {
        if (showFontFamilyDropdown && fontFamilyButtonRef.current) {
            const rect = fontFamilyButtonRef.current.getBoundingClientRect()
            setFontFamilyDropdownPos({ top: rect.bottom + 4, left: rect.left })
        }
    }, [showFontFamilyDropdown])

    const fontSizeDropdownRef = useRef<HTMLDivElement>(null)
    const fontFamilyDropdownRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (fontSizeDropdownRef.current && !fontSizeDropdownRef.current.contains(e.target as Node)) {
                setShowFontSizeDropdown(false)
            }
            if (fontFamilyDropdownRef.current && !fontFamilyDropdownRef.current.contains(e.target as Node)) {
                setShowFontFamilyDropdown(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const isSelectingFontRef = useRef(false)
    const [editingFontSize, setEditingFontSize] = useState(fontSize || 24)
    const [editingFontFamily, setEditingFontFamily] = useState(fontFamily || "Inter, sans-serif")

    const localStrokePointsRef = useRef<{ x: number; y: number }[]>([])
    const liveStrokesNormRef = useRef<Record<string, { x: number; y: number }[]>>({})

    const undoStackRef = useRef<string[]>([])
    const redoStackRef = useRef<string[]>([])
    const isRestoringRef = useRef<boolean>(false)

    const saveStacksToStorage = useCallback(() => {
        try {
            localStorage.setItem(`demo_undo_stack_${sessionId}`, JSON.stringify(undoStackRef.current))
            localStorage.setItem(`demo_redo_stack_${sessionId}`, JSON.stringify(redoStackRef.current))
        } catch (e) {
            console.error("Error saving undo/redo stacks:", e)
        }
    }, [sessionId])

    const saveToLocalStorage = useCallback((newObj?: StoredBoardObject) => {
        if (newObj) {
            boardHistoryRef.current.push(newObj);
            if (newObj.timestamp > lastSyncTimeRef.current) {
                lastSyncTimeRef.current = newObj.timestamp;
            }
        }
        localStorage.setItem(`board_data_${sessionId}`, JSON.stringify(boardHistoryRef.current));

        const canvas = fabricRef.current
        if (canvas && !isRestoringRef.current) {
            try {
                const jsonState = JSON.stringify(canvas.toJSON())
                if (undoStackRef.current.length === 0 || undoStackRef.current[undoStackRef.current.length - 1] !== jsonState) {
                    undoStackRef.current.push(jsonState)
                    if (undoStackRef.current.length > 20) {
                        undoStackRef.current.shift()
                    }
                    redoStackRef.current = []
                    saveStacksToStorage()
                }
            } catch (e) {
                console.error("Error saving canvas JSON state:", e)
            }
        }
    }, [sessionId, saveStacksToStorage]);

    useEffect(() => {
        const cached = localStorage.getItem(`board_data_${sessionId}`);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed)) {
                    boardHistoryRef.current = parsed;
                    if (parsed.length > 0) {
                        lastSyncTimeRef.current = Math.max(...parsed.map(o => o.timestamp || 0));
                    }
                }
            } catch (e) {
                console.error("Error parsing localStorage cache:", e);
            }
        }

        const cachedUndo = localStorage.getItem(`demo_undo_stack_${sessionId}`)
        const cachedRedo = localStorage.getItem(`demo_redo_stack_${sessionId}`)
        if (cachedUndo) {
            try {
                const parsedUndo = JSON.parse(cachedUndo)
                if (Array.isArray(parsedUndo) && parsedUndo.length > 0) {
                    undoStackRef.current = parsedUndo.slice(-20)
                }
            } catch (e) {
                console.error("Error loading undo stack:", e)
            }
        }
        if (cachedRedo) {
            try {
                const parsedRedo = JSON.parse(cachedRedo)
                if (Array.isArray(parsedRedo)) {
                    redoStackRef.current = parsedRedo.slice(-20)
                }
            } catch (e) {
                console.error("Error loading redo stack:", e)
            }
        }
    }, [sessionId]);

    useEffect(() => {
        const handleUndo = async () => {
            const canvas = fabricRef.current
            if (!canvas) return
            if (undoStackRef.current.length === 0) return

            try {
                const current = undoStackRef.current.pop()
                if (current) {
                    redoStackRef.current.push(current)
                    if (redoStackRef.current.length > 20) {
                        redoStackRef.current.shift()
                    }
                }

                if (undoStackRef.current.length > 0) {
                    const prev = undoStackRef.current[undoStackRef.current.length - 1]
                    isRestoringRef.current = true
                    await canvas.loadFromJSON(JSON.parse(prev))
                    canvas.requestRenderAll()
                    isRestoringRef.current = false
                } else {
                    canvas.clear()
                    canvas.backgroundColor = boardColor
                    canvas.requestRenderAll()
                }
                saveStacksToStorage()
                toast.info("Undo")
            } catch (err) {
                console.error("Undo error:", err)
                isRestoringRef.current = false
            }
        }

        const handleRedo = async () => {
            const canvas = fabricRef.current
            if (!canvas || redoStackRef.current.length === 0) return

            try {
                const next = redoStackRef.current.pop()
                if (next) {
                    undoStackRef.current.push(next)
                    if (undoStackRef.current.length > 20) {
                        undoStackRef.current.shift()
                    }
                    isRestoringRef.current = true
                    await canvas.loadFromJSON(JSON.parse(next))
                    canvas.requestRenderAll()
                    isRestoringRef.current = false
                }
                saveStacksToStorage()
                toast.info("Redo")
            } catch (err) {
                console.error("Redo error:", err)
                isRestoringRef.current = false
            }
        }

        document.addEventListener("undo-trigger", handleUndo)
        document.addEventListener("redo-trigger", handleRedo)

        return () => {
            document.removeEventListener("undo-trigger", handleUndo)
            document.removeEventListener("redo-trigger", handleRedo)
        }
    }, [sessionId, boardColor, saveStacksToStorage]);

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

    const toNorm = useCallback((px: number, py: number, cw: number) => ({
        x: cw > 0 ? px / cw : 0,
        y: cw > 0 ? py / cw : 0,
    }), [])

    const fromNorm = useCallback((nx: number, ny: number, cw: number) => ({
        x: nx * cw,
        y: ny * cw,
    }), [])

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as HTMLElement
            const matched = target?.closest?.('[data-font-control]')
            if (matched) {
                e.preventDefault()
                isSelectingFontRef.current = true
            }
        }
        document.addEventListener('mousedown', handler, { capture: true })
        return () => document.removeEventListener('mousedown', handler, { capture: true })
    }, [])

    const applyFontToActiveText = useCallback((newFontSize?: number, newFontFamily?: string) => {
        const canvas = fabricRef.current
        const textObj = activeTextObjRef.current
        if (!canvas || !textObj) return false

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

        textObj.initDimensions()
        textObj.setCoords()

        textObj.selectionStart = cursorPos
        textObj.selectionEnd = cursorPos
        const ta = (textObj as unknown as { hiddenTextarea?: HTMLTextAreaElement }).hiddenTextarea
        if (ta) {
            ta.selectionStart = cursorPos
            ta.selectionEnd = cursorPos
        }
        canvas.requestRenderAll()

        const bound = textObj.getBoundingRect()
        const canvasEl = canvas.getElement()
        const rect = canvasEl.getBoundingClientRect()
        setEditingTextPos({
            x: rect.left + bound.left + (bound.width / 2),
            y: rect.top + bound.top
        })

        if (newFontSize !== undefined) setEditingFontSize(newFontSize)
        if (newFontFamily !== undefined) setEditingFontFamily(newFontFamily)

        return true
    }, [])

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

        const laserColor = "#A855F7"
        const duration = 800

        if (prevX !== undefined && prevY !== undefined) {
            const line = new Line([prevX, prevY, x, y], {
                stroke: laserColor,
                strokeWidth: 4,
                strokeLineCap: "round",
                selectable: false,
                evented: false,
                globalCompositeOperation: "difference",
            })
            canvas.add(line)
            line.animate({ opacity: 0 }, {
                duration,
                onChange: () => canvas.requestRenderAll(),
                onComplete: () => canvas.remove(line)
            })
        }
    }, [])

    const setBgImagesOnCanvas = useCallback(async (canvas: Canvas, imageUrls: string[]) => {
        if (!imageUrls || imageUrls.length === 0) {
            canvas.backgroundImage = undefined
            canvas.requestRenderAll()
            return
        }

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

        const targetHeight = containerWidth * 3
        const finalHeight = Math.max(targetHeight, totalHeight)
        canvas.setDimensions({ width: containerWidth, height: finalHeight })
        lastScaledWidthRef.current = containerWidth

        const offscreen = document.createElement("canvas")
        offscreen.width = containerWidth
        offscreen.height = finalHeight
        const ctx = offscreen.getContext("2d")!

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
        queueMicrotask(() => setCanvasReady(true))
        canvas.freeDrawingBrush = new PencilBrush(canvas)
        if (canvas.freeDrawingBrush) {
            canvas.freeDrawingBrush.color = color
            canvas.freeDrawingBrush.width = brushSize
        }
        canvas.freeDrawingCursor = PENCIL_CURSOR

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
                case "line": {
                    const dirX = (data as ShapePayload & { dragDirX?: number }).dragDirX ?? 1
                    const dirY = (data as ShapePayload & { dragDirY?: number }).dragDirY ?? 1
                    const p1X = dirX >= 0 ? left : left + w
                    const p1Y = dirY >= 0 ? top : top + h
                    const p2X = dirX >= 0 ? left + w : left
                    const p2Y = dirY >= 0 ? top + h : top
                    return new Line([p1X, p1Y, p2X, p2Y], {
                        stroke,
                        strokeWidth,
                        strokeLineCap: "round",
                        strokeLineJoin: "round",
                        selectable: true,
                        evented: true,
                    })
                }
                case "arrow": {
                    const dirX = (data as ShapePayload & { dragDirX?: number }).dragDirX ?? 1
                    const dirY = (data as ShapePayload & { dragDirY?: number }).dragDirY ?? 1
                    const p1X = dirX >= 0 ? left : left + w
                    const p1Y = dirY >= 0 ? top : top + h
                    const p2X = dirX >= 0 ? left + w : left
                    const p2Y = dirY >= 0 ? top + h : top

                    const angle = Math.atan2(p2Y - p1Y, p2X - p1X)
                    const headLen = Math.max(14, strokeWidth * 2.5)
                    const xTip1 = p2X - headLen * Math.cos(angle - Math.PI / 7)
                    const yTip1 = p2Y - headLen * Math.sin(angle - Math.PI / 7)
                    const xTip2 = p2X - headLen * Math.cos(angle + Math.PI / 7)
                    const yTip2 = p2Y - headLen * Math.sin(angle + Math.PI / 7)

                    const d = `M ${p1X} ${p1Y} L ${p2X} ${p2Y} M ${p2X} ${p2Y} L ${xTip1} ${yTip1} L ${xTip2} ${yTip2} Z`
                    return new Path(d, {
                        stroke,
                        strokeWidth,
                        fill: stroke,
                        strokeLineCap: "round",
                        strokeLineJoin: "round",
                        selectable: true,
                        evented: true,
                    })
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
                        axesD += `M ${-axisExt} ${midY} L ${-axisExt + arrowSize} ${midY - arrowSize / 3} L ${-axisExt + arrowSize} ${midY + arrowSize / 3} Z `
                        axesD += `M ${w + axisExt} ${midY} L ${w + axisExt - arrowSize} ${midY - arrowSize / 3} L ${w + axisExt - arrowSize} ${midY + arrowSize / 3} Z `
                        axesD += `M ${midX} ${-axisExt} L ${midX - arrowSize / 3} ${-axisExt + arrowSize} L ${midX + arrowSize / 3} ${-axisExt + arrowSize} Z `
                        axesD += `M ${midX} ${h + axisExt} L ${midX - arrowSize / 3} ${h + axisExt - arrowSize} L ${midX + arrowSize / 3} ${h + axisExt - arrowSize} Z `
                        const axesPath = new Path(axesD, { ...common, fill: stroke, left: 0, top: 0 })

                        const objs: FabricObject[] = [gridPath, axesPath]

                        if (isLabeled) {
                            for (let i = -range; i <= range; i++) {
                                if (i === 0) continue
                                const normPos = (i + range) / intervals
                                const posX = normPos * w
                                const posY = (range - i) / intervals * h

                                const textX = new IText(String(i), {
                                    left: posX - 4,
                                    top: midY + 4,
                                    fontSize: Math.max(9, Math.min(14, stepX * 0.35)),
                                    fill: stroke,
                                    fontFamily: "Inter, sans-serif",
                                    selectable: false,
                                    evented: false,
                                })
                                const textY = new IText(String(i), {
                                    left: midX + 6,
                                    top: posY - 6,
                                    fontSize: Math.max(9, Math.min(14, stepY * 0.35)),
                                    fill: stroke,
                                    fontFamily: "Inter, sans-serif",
                                    selectable: false,
                                    evented: false,
                                })
                                objs.push(textX, textY)
                            }
                        }

                        return new Group(objs, { ...common, left, top, width: w, height: h })
                    }
                    if (data.shapeType.startsWith("graph-axis")) {
                        const arrowSize = Math.max(12, strokeWidth * 0.3)
                        const axisExt = arrowSize + 5
                        const midX = w / 2
                        const midY = h / 2
                        let d = `M ${-axisExt} ${midY} L ${w + axisExt} ${midY} M ${midX} ${-axisExt} L ${midX} ${h + axisExt} `
                        d += `M ${-axisExt} ${midY} L ${-axisExt + arrowSize} ${midY - arrowSize / 3} L ${-axisExt + arrowSize} ${midY + arrowSize / 3} Z `
                        d += `M ${w + axisExt} ${midY} L ${w + axisExt - arrowSize} ${midY - arrowSize / 3} L ${w + axisExt - arrowSize} ${midY + arrowSize / 3} Z `
                        d += `M ${midX} ${-axisExt} L ${midX - arrowSize / 3} ${-axisExt + arrowSize} L ${midX + arrowSize / 3} ${-axisExt + arrowSize} Z `
                        d += `M ${midX} ${h + axisExt} L ${midX - arrowSize / 3} ${h + axisExt - arrowSize} L ${midX + arrowSize / 3} ${h + axisExt - arrowSize} Z `
                        return new Path(d, { ...common, fill: stroke })
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
                fImg.setCoords();
                (fImg as BoardFabricObject).id = data.id
                boardFileObjsRef.current[data.id] = fImg
                canvas.add(fImg)
                canvas.requestRenderAll()
            }
            img.src = data.url
        }

        canvas.on("mouse:down", (opt) => {
            if (toolRef.current === "text") {
                if (role === "student" && (!drawingEnabledRef.current)) return

                if (activeTextObjRef.current) {
                    activeTextObjRef.current.exitEditing()
                    activeTextObjRef.current = null
                    setEditingTextPos(null)
                    setShowFontSizeDropdown(false)
                    setShowFontFamilyDropdown(false)
                    if (onToolChangeRef.current) onToolChangeRef.current("select")
                    return
                }

                canvas.selection = true
                canvas.skipTargetFind = false

                const pt = canvas.getScenePoint(opt.e)
                const id = generateId()

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
                    hasControls: false,
                }) as unknown as BoardIText
                textObj.id = id
                textObjsRef.current[id] = textObj
                canvas.add(textObj)
                canvas.setActiveObject(textObj)
                textObj.enterEditing()

                activeTextObjRef.current = textObj
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

                updateOverlayPos(textObj)
                textObj.on("changed", () => updateOverlayPos(textObj))
                textObj.on("moving", () => updateOverlayPos(textObj))
                textObj.on("scaling", () => updateOverlayPos(textObj))

                const textarea = (textObj as unknown as { hiddenTextarea?: HTMLTextAreaElement }).hiddenTextarea
                if (textarea) textarea.focus()

                textObj.on("editing:exited", () => {
                    if (isSelectingFontRef.current) {
                        setTimeout(() => {
                            if (!textObj || !fabricRef.current) return
                            fabricRef.current.setActiveObject(textObj)
                            textObj.enterEditing()
                            textObj.setSelectionStart(textObj.text?.length || 0)
                            textObj.setSelectionEnd(textObj.text?.length || 0)
                            const ta = (textObj as unknown as { hiddenTextarea?: HTMLTextAreaElement }).hiddenTextarea
                            if (ta) ta.focus()
                            textObj.initDimensions()
                            textObj.setCoords()
                            fabricRef.current.requestRenderAll()
                            isSelectingFontRef.current = false
                        }, 0)
                        return
                    }
                    setEditingTextPos(null)
                    activeTextObjRef.current = null

                    if (!textObj.text?.trim()) {
                        canvas.remove(textObj)
                        delete textObjsRef.current[id]
                        canvas.requestRenderAll()
                        return
                    }
                })
                return
            }

            if (toolRef.current === "image-stamp" && imageStampDataRef.current) {
                if (role === "student" && (!drawingEnabledRef.current)) return
                const pt = canvas.getScenePoint(opt.e)
                shapeStartRef.current = { x: pt.x, y: pt.y }
                return
            }

            if (toolRef.current === "eraser") {
                const target = opt.target as BoardFabricObject
                if (target && target.id) {
                    const id = target.id;
                    canvas.remove(target);
                    boardHistoryRef.current = boardHistoryRef.current.filter(obj => (obj.payload as { id: string }).id !== id);
                    saveToLocalStorage();
                    canvas.requestRenderAll();
                }
                return;
            }

            if (toolRef.current === "laser") {
                isLaserActiveRef.current = true
                const pt = canvas.getScenePoint(opt.e)
                showLaserPoint(pt.x, pt.y)
                lastLaserPointRef.current = { x: pt.x, y: pt.y }
                return
            }

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
        })

        canvas.on("mouse:move", (opt) => {
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

                canvas.getObjects().forEach(obj => {
                    if ((obj as FabricObject & { _isPreview?: boolean })._isPreview) canvas.remove(obj)
                })
                shapePreviewRef.current = null

                const shapeType = toolRef.current
                const stroke = colorRef.current
                const fill = shapeType.startsWith("f-") ? stroke : "transparent"

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
                if (shapeType === "line" || shapeType === "arrow") {
                    previewData.dragDirX = w >= 0 ? 1 : -1
                    previewData.dragDirY = h >= 0 ? 1 : -1
                }

                const preview = createShapeFromPayload(previewData)
                if (preview) {
                    ; (preview as FabricObject & { _isPreview?: boolean })._isPreview = true
                    preview.set({ selectable: false, evented: false, opacity: 1.0 })
                    shapePreviewRef.current = preview
                    canvas.add(preview)
                    canvas.requestRenderAll()
                }
                return
            }

            if (toolRef.current === "laser") {
                if (!isLaserActiveRef.current) return
                const pt = canvas.getScenePoint(opt.e)
                showLaserPoint(pt.x, pt.y, lastLaserPointRef.current?.x, lastLaserPointRef.current?.y)
                lastLaserPointRef.current = { x: pt.x, y: pt.y }
                return
            }
        })

        canvas.on("mouse:up", (opt) => {
            lastLaserPointRef.current = null
            isLaserActiveRef.current = false

            if (shapeStartRef.current && toolRef.current === "image-stamp" && imageStampDataRef.current) {
                const pt = canvas.getScenePoint(opt.e)
                const start = shapeStartRef.current
                shapeStartRef.current = null

                canvas.getObjects().forEach(obj => {
                    if ((obj as FabricObject & { _isPreview?: boolean })._isPreview) canvas.remove(obj)
                })
                shapePreviewRef.current = null
                canvas.requestRenderAll()

                const w = pt.x - start.x
                const h = pt.y - start.y
                const absW = Math.abs(w)
                const absH = Math.abs(h)
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
                localAddedImageIdsRef.current.add(id)
                addImageToCanvas(payload)
                saveToLocalStorage({
                    type: "image",
                    payload,
                    timestamp: Date.now(),
                })
                return
            }

            if (shapeStartRef.current && isShapeTool(toolRef.current)) {
                const pt = canvas.getScenePoint(opt.e)
                const start = shapeStartRef.current
                shapeStartRef.current = null

                canvas.getObjects().forEach(obj => {
                    if ((obj as FabricObject & { _isPreview?: boolean })._isPreview) canvas.remove(obj)
                })
                shapePreviewRef.current = null
                canvas.requestRenderAll()

                let w = pt.x - start.x
                let h = pt.y - start.y

                if (toolRef.current === "square" || toolRef.current === "circle" || toolRef.current.startsWith("symbol:") || toolRef.current.startsWith("emoji:")) {
                    const size = Math.max(Math.abs(w), Math.abs(h))
                    w = w >= 0 ? size : -size
                    h = h >= 0 ? size : -size
                }

                let left = w >= 0 ? start.x : start.x + w
                let top = h >= 0 ? start.y : start.y + h

                if (toolRef.current.startsWith("symbol:") || toolRef.current.startsWith("emoji:")) {
                    if (Math.abs(w) < 10 && Math.abs(h) < 10) {
                        const defaultSize = Math.max(32, Math.round(canvas.width * 0.04))
                        w = defaultSize
                        h = defaultSize
                        left = pt.x - defaultSize / 2
                        top = pt.y - defaultSize / 2
                    }
                } else {
                    if (Math.abs(w) < 5 && Math.abs(h) < 5) return
                }

                const absW = Math.abs(w)
                const absH = Math.abs(h)
                const id = generateId()

                const shapeType = toolRef.current
                const stroke = colorRef.current
                const fill = shapeType.startsWith("f-") ? stroke : "transparent"

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
                if (shapeType === "line" || shapeType === "arrow") {
                    shapePayload.dragDirX = w >= 0 ? 1 : -1
                    shapePayload.dragDirY = h >= 0 ? 1 : -1
                }

                const shape = createShapeFromPayload(shapePayload)
                if (shape) {
                    (shape as FabricObject & { id: string }).id = id
                    shapeObjsRef.current[id] = shape
                    canvas.add(shape)
                    canvas.requestRenderAll()
                    saveToLocalStorage({
                        type: "shape",
                        payload: shapePayload,
                        timestamp: shapePayload.timestamp || Date.now(),
                    })
                }
                return
            }

            if (!localStrokeIdRef.current) return

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

        const handleClearEmit = () => {
            canvas.clear()
            canvas.backgroundColor = boardColor
            boardFileObjsRef.current = {}
            pagesDataRef.current[currentPageRef.current] = []
            canvas.renderAll()
        }
        document.addEventListener("clear-canvas-emit", handleClearEmit)

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
            const oldWidth = lastScaledWidthRef.current
            if (Math.abs(containerWidth - oldWidth) < 1) return

            const scaleFactor = containerWidth / oldWidth
            canvas.getObjects().forEach(obj => {
                obj.set({
                    left: obj.left * scaleFactor,
                    top: obj.top * scaleFactor,
                    scaleX: (obj.scaleX || 1) * scaleFactor,
                    scaleY: (obj.scaleY || 1) * scaleFactor,
                })
                obj.setCoords()
            })

            canvas.setDimensions({ width: containerWidth, height: containerWidth * 3 })
            lastScaledWidthRef.current = containerWidth
            canvas.requestRenderAll()
        })
        resizeObserver.observe(wrapperRef.current)

        return () => {
            document.removeEventListener("clear-canvas-emit", handleClearEmit)
            document.removeEventListener("delete-page-local", handleDeleteLocal)
            setCanvasReady(false)
            canvas.dispose()
            resizeObserver.disconnect()
        }
    }, [sessionId, role])

    // ── Page State Management ────────────────────────────────────
    const lastPageRef = useRef(currentPage)
    useEffect(() => {
        currentPageRef.current = currentPage
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

        lastPageRef.current = currentPage
    }, [currentPage, boardColor, bgImages, role, setBgImagesOnCanvas])

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

        if (tool !== "text" && tool !== "select" && activeTextObjRef.current) {
            if (activeTextObjRef.current.isEditing) {
                activeTextObjRef.current.exitEditing()
            }
            activeTextObjRef.current = null
            queueMicrotask(() => {
                setEditingTextPos(null)
                setShowFontSizeDropdown(false)
                setShowFontFamilyDropdown(false)
            })
        }

        const canDraw = role === "teacher" || (drawingEnabled ?? false);
        const isPenTool = tool.startsWith("pen:")
        canvas.isDrawingMode = (isPenTool || tool === "partial-eraser") && canDraw;
        canvas.freeDrawingCursor = isPenTool ? PENCIL_CURSOR : ERASER_CURSOR
        if (canvas.freeDrawingBrush) {
            const brush = canvas.freeDrawingBrush as PencilBrush
            if (tool === "partial-eraser" || tool === "eraser") {
                brush.color = boardColor
                brush.width = brushSize * 4
                brush.strokeLineCap = "round"
            } else {
                brush.color = color
                brush.width = brushSize
                brush.strokeLineCap = "round"
                brush.strokeLineJoin = "round"
            }
        }
        const isShapeCursor = isShapeTool(tool) || tool === "line" || tool === "arrow" || tool === "image-stamp"
        canvas.defaultCursor = activeTextObjRef.current ? TEXT_CURSOR : (tool === "laser" || isShapeCursor ? "crosshair" : tool === "text" ? TEXT_CURSOR : "default")
        if (activeTextObjRef.current) {
            canvas.selection = true
            canvas.skipTargetFind = false
        } else {
            canvas.selection = tool === "select"
            canvas.skipTargetFind = tool !== "select" && tool !== "eraser" && tool !== "text"
        }
    }, [tool, color, brushSize, boardColor, drawingEnabled, role, canvasReady])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (role === "student" && !drawingEnabled) return
            const activeEl = document.activeElement
            if (activeEl?.tagName === "INPUT" || activeEl?.tagName === "TEXTAREA" || (activeEl as HTMLElement)?.isContentEditable) return
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
    }, [sessionId, role, drawingEnabled, saveToLocalStorage])

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

            {editingTextPos && (
                <div
                    ref={overlayRef}
                    data-font-control
                    className="fixed z-9999 pointer-events-auto flex flex-col items-center -translate-x-1/2"
                    style={{ left: editingTextPos.x, top: editingTextPos.y - 48 }}
                >
                    <div className="flex items-center gap-1 px-1.5 py-1 bg-zinc-900/95 backdrop-blur-md border border-white/15 rounded-md shadow-2xl shadow-black/60">
                        <div className="relative">
                            <button
                                ref={fontSizeButtonRef}
                                type="button"
                                data-font-control
                                onClick={(e) => {
                                    e.stopPropagation()
                                    if (!showFontSizeDropdown && fontSizeButtonRef.current) {
                                        const rect = fontSizeButtonRef.current.getBoundingClientRect()
                                        setFontSizeDropdownPos({ top: rect.bottom + 4, left: rect.left })
                                    }
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
                                            top: fontSizeDropdownPos.top,
                                            left: fontSizeDropdownPos.left
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

                        <div className="w-px h-4 bg-white/15" />

                        <div className="relative">
                            <button
                                ref={fontFamilyButtonRef}
                                type="button"
                                data-font-control
                                onClick={(e) => {
                                    e.stopPropagation()
                                    if (!showFontFamilyDropdown && fontFamilyButtonRef.current) {
                                        const rect = fontFamilyButtonRef.current.getBoundingClientRect()
                                        setFontFamilyDropdownPos({ top: rect.bottom + 4, left: rect.left })
                                    }
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
                                            top: fontFamilyDropdownPos.top,
                                            left: fontFamilyDropdownPos.left
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

                        <div className="w-px h-4 bg-white/15" />

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

export default React.memo(DemoWhiteboard)