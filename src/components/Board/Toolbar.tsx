"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import ReactDOM from "react-dom"
import {
    Highlighter, Pen, Eraser, MousePointer2, Trash2, Palette,
    Square, Circle, Minus, ArrowUpRight, Type, Triangle, Diamond, Star, Ellipse, Pentagon, TriangleRight, RectangleHorizontal,
    Activity, Calculator, Grid3X3, LayoutGrid
} from "lucide-react"
import { cn, getContrastColor } from "@/lib/utils"
import ColorPicker from "./ColorPicker"
import TextColorPicker from "./TextColorPicker"
import Swal from "sweetalert2"

const PEN_TOOLS = [
    { id: "pen", label: "Pen", icon: Pen },
    { id: "highlighter", label: "Highlighter", icon: Highlighter },
] as const

const SHAPE_TOOLS = [
    { id: "rectangle", label: "Rectangle", icon: RectangleHorizontal },
    { id: "square", label: "Square", icon: Square },
    { id: "circle", label: "Circle", icon: Circle },
    { id: "triangle", label: "Triangle", icon: Triangle },
    { id: "right-triangle", label: "RightTriangle", icon: TriangleRight },
    { id: "diamond", label: "Diamond", icon: Diamond },
    { id: "rhombus", label: "Rhombus", icon: Diamond },
    { id: "star", label: "Star", icon: Star },
    { id: "line", label: "Line", icon: Minus },
    { id: "arrow", label: "Arrow", icon: ArrowUpRight },
    { id: "ellipse", label: "Ellipse", icon: Ellipse },
    { id: "pentagon", label: "Pentagon", icon: Pentagon },
    { id: "parallelogram", label: "Parallelogram", icon: RectangleHorizontal },
] as const

const GRAPH_TOOLS = [
    { id: "graph-axis", label: "Graph Axis", icon: Activity },
    { id: "graph-plain", label: "Coordinate Plane", icon: Grid3X3 },
    { id: "graph-labeled", label: "Labeled Plane", icon: Calculator },
    { id: "large-grid", label: "Grid", icon: LayoutGrid },
] as const

const ERASER_TOOLS = [
    { id: "eraser", label: "Object Eraser", icon: Eraser },
    { id: "partial-eraser", label: "Selective Eraser", icon: Eraser },
] as const

const MATH_SYMBOLS = [
    { id: "pi", label: "π", value: "π" },
    { id: "sigma", label: "Σ", value: "Σ" },
    { id: "infinity", label: "∞", value: "∞" },
    { id: "integral", label: "∫", value: "∫" },
    { id: "sqrt", label: "√", value: "√" },
    { id: "theta", label: "θ", value: "θ" },
    { id: "alpha", label: "α", value: "α" },
    { id: "beta", label: "β", value: "β" },
    { id: "delta", label: "Δ", value: "Δ" },
    { id: "plusminus", label: "±", value: "±" },
    { id: "notequal", label: "≠", value: "≠" },
    { id: "approx", label: "≈", value: "≈" },
    { id: "ge", label: "≥", value: "≥" },
    { id: "le", label: "≤", value: "≤" },
] as const

const EMOJIS = [
    { id: "smile", label: "Smile", value: "😊" },
    { id: "heart", label: "Heart", value: "❤️" },
    { id: "thumb", label: "Thumbs Up", value: "👍" },
    { id: "clap", label: "Clap", value: "👏" },
    { id: "star-eye", label: "Star Eye", value: "🤩" },
    { id: "fire", label: "Fire", value: "🔥" },
    { id: "rocket", label: "Rocket", value: "🚀" },
    { id: "check", label: "Check", value: "✅" },
    { id: "warn", label: "Warning", value: "⚠️" },
    { id: "idea", label: "Idea", value: "💡" },
    { id: "party", label: "Party", value: "🎉" },
    { id: "cry", label: "Cry", value: "😭" },
] as const

type ShapeToolId = typeof SHAPE_TOOLS[number]["id"]
type GraphToolId = typeof GRAPH_TOOLS[number]["id"]

interface ToolbarProps {
    tool: string
    setTool: (tool: string) => void
    role: "teacher" | "student"
    color: string
    setColor: (color: string) => void
    brushSize: number
    setBrushSize: (size: number) => void
    shapeFillColor: string
    setShapeFillColor: (color: string) => void
    shapeBorderColor: string
    setShapeBorderColor: (color: string) => void
    textColor: string
    setTextColor: (color: string) => void
    onClearCanvas?: () => void
}

export default function Toolbar({
    tool,
    setTool,
    role,
    color,
    setColor,
    brushSize,
    setBrushSize,
    shapeFillColor,
    setShapeFillColor,
    shapeBorderColor,
    setShapeBorderColor,
    textColor,
    setTextColor,
    onClearCanvas
}: ToolbarProps) {
    const [showShapeDropdown, setShowShapeDropdown] = useState(false)
    const [showGraphDropdown, setShowGraphDropdown] = useState(false)
    const [showColorPicker, setShowColorPicker] = useState(false)
    const [showFillPicker, setShowFillPicker] = useState(false)
    const [showBorderPicker, setShowBorderPicker] = useState(false)
    const [showMathDropdown, setShowMathDropdown] = useState(false)
    const [showEmojiDropdown, setShowEmojiDropdown] = useState(false)
    const [showPenDropdown, setShowPenDropdown] = useState(false)
    const [showEraserDropdown, setShowEraserDropdown] = useState(false)

    const [shapeDropdownPos, setShapeDropdownPos] = useState<{ top: number; left: number } | null>(null)
    const [graphDropdownPos, setGraphDropdownPos] = useState<{ top: number; left: number } | null>(null)
    const [colorPickerPos, setColorPickerPos] = useState<{ top: number; left: number } | null>(null)
    const [fillPickerPos, setFillPickerPos] = useState<{ top: number; left: number } | null>(null)
    const [borderPickerPos, setBorderPickerPos] = useState<{ top: number; left: number } | null>(null)
    const [mathDropdownPos, setMathDropdownPos] = useState<{ top: number; left: number } | null>(null)
    const [emojiDropdownPos, setEmojiDropdownPos] = useState<{ top: number; left: number } | null>(null)
    const [penDropdownPos, setPenDropdownPos] = useState<{ top: number; left: number } | null>(null)
    const [eraserDropdownPos, setEraserDropdownPos] = useState<{ top: number; left: number } | null>(null)

    const [selectedShape, setSelectedShape] = useState<ShapeToolId>("rectangle")
    const [selectedGraph, setSelectedGraph] = useState<GraphToolId>("graph-axis")
    const [selectedPen, setSelectedPen] = useState<typeof PEN_TOOLS[number]["id"]>("pen")
    const [selectedSymbol, setSelectedSymbol] = useState<string>("π")
    const [selectedEmoji, setSelectedEmoji] = useState<string>("😊")

    const brushSizes = [2, 4, 8, 12, 16, 20]
    const scrollAreaRef = useRef<HTMLDivElement>(null)
    const shapeButtonRef = useRef<HTMLDivElement>(null)
    const graphButtonRef = useRef<HTMLDivElement>(null)
    const colorButtonRef = useRef<HTMLButtonElement>(null)
    const fillButtonRef = useRef<HTMLButtonElement>(null)
    const borderButtonRef = useRef<HTMLButtonElement>(null)
    const eraserButtonRef = useRef<HTMLDivElement>(null)
    const mathButtonRef = useRef<HTMLDivElement>(null)
    const emojiButtonRef = useRef<HTMLDivElement>(null)
    const penButtonRef = useRef<HTMLDivElement>(null)
    const [canScrollDown, setCanScrollDown] = useState(false)
    const [canScrollUp, setCanScrollUp] = useState(false)

    const checkScroll = useCallback(() => {
        const el = scrollAreaRef.current
        if (!el) return
        setCanScrollUp(el.scrollTop > 4)
        setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 4)
    }, [])

    useEffect(() => {
        checkScroll()
    }, [checkScroll])

    const isShapeToolCount = (t: string) => SHAPE_TOOLS.some(s => s.id === t)
    const isShapeTool = isShapeToolCount(tool)
    const isGraphToolCount = (t: string) => GRAPH_TOOLS.some(g => g.id === t) || t.startsWith("large-grid") || t.startsWith("graph-plain") || t.startsWith("graph-labeled")
    const isGraphTool = isGraphToolCount(tool)
    const isPenTool = tool.startsWith("pen:")
    const isMathSymbolTool = tool.startsWith("symbol:")
    const isEmojiTool = tool.startsWith("emoji:")

    const ActiveShapeIcon = SHAPE_TOOLS.find(s => s.id === selectedShape)?.icon || Square
    const ActiveGraphIcon = GRAPH_TOOLS.find(g => g.id === selectedGraph)?.icon || Activity
    const ActivePenIcon = PEN_TOOLS.find(p => p.id === selectedPen)?.icon || Pen
    const ActiveEraserIcon = ERASER_TOOLS.find(e => e.id === tool || (e.id === "eraser" && tool === "partial-eraser"))?.icon || Eraser

    const toggleShapeDropdown = useCallback(() => {
        if (showShapeDropdown) {
            setShowShapeDropdown(false)
            return
        }
        if (shapeButtonRef.current) {
            const rect = shapeButtonRef.current.getBoundingClientRect()
            setShapeDropdownPos({
                top: rect.top + rect.height / 2 - 20,
                left: rect.right + 8,
            })
        }
        setShowShapeDropdown(true)
    }, [showShapeDropdown])

    const toggleGraphDropdown = useCallback(() => {
        if (showGraphDropdown) {
            setShowGraphDropdown(false)
            return
        }
        if (graphButtonRef.current) {
            const rect = graphButtonRef.current.getBoundingClientRect()
            setGraphDropdownPos({
                top: rect.top + rect.height / 2 - 20,
                left: rect.right + 8,
            })
        }
        setShowGraphDropdown(true)
    }, [showGraphDropdown])

    const togglePenDropdown = useCallback(() => {
        if (showPenDropdown) {
            setShowPenDropdown(false)
            return
        }
        if (penButtonRef.current) {
            const rect = penButtonRef.current.getBoundingClientRect()
            setPenDropdownPos({
                top: rect.top + rect.height / 2 - 20,
                left: rect.right + 8,
            })
        }
        setShowPenDropdown(true)
    }, [showPenDropdown])

    const toggleColorPicker = useCallback(() => {
        if (showColorPicker) {
            setShowColorPicker(false)
            return
        }
        if (colorButtonRef.current) {
            const rect = colorButtonRef.current.getBoundingClientRect()
            const pickerHeight = 420
            const top = Math.max(8, Math.min(window.innerHeight - pickerHeight - 8, rect.top - pickerHeight / 2 + rect.height / 2))
            setColorPickerPos({ top, left: rect.right + 16 })
        }
        setShowColorPicker(true)
    }, [showColorPicker])

    const toggleFillPicker = useCallback(() => {
        if (showFillPicker) {
            setShowFillPicker(false)
            return
        }
        if (fillButtonRef.current) {
            const rect = fillButtonRef.current.getBoundingClientRect()
            const pickerHeight = 420
            const top = Math.max(8, Math.min(window.innerHeight - pickerHeight - 8, rect.top - pickerHeight / 2 + rect.height / 2))
            setFillPickerPos({ top, left: rect.right + 16 })
        }
        setShowFillPicker(true)
    }, [showFillPicker])

    const toggleBorderPicker = useCallback(() => {
        if (showBorderPicker) {
            setShowBorderPicker(false)
            return
        }
        if (borderButtonRef.current) {
            const rect = borderButtonRef.current.getBoundingClientRect()
            const pickerHeight = 420
            const top = Math.max(8, Math.min(window.innerHeight - pickerHeight - 8, rect.top - pickerHeight / 2 + rect.height / 2))
            setBorderPickerPos({ top, left: rect.right + 16 })
        }
        setShowBorderPicker(true)
    }, [showBorderPicker])

    const toggleMathDropdown = useCallback(() => {
        if (showMathDropdown) {
            setShowMathDropdown(false)
            return
        }
        if (mathButtonRef.current) {
            const rect = mathButtonRef.current.getBoundingClientRect()
            setMathDropdownPos({
                top: Math.max(10, Math.min(window.innerHeight - 300, rect.top - 100)),
                left: rect.right + 8,
            })
            setShowMathDropdown(true)
        }
    }, [showMathDropdown])

    const toggleEmojiDropdown = useCallback(() => {
        if (showEmojiDropdown) {
            setShowEmojiDropdown(false)
            return
        }
        if (emojiButtonRef.current) {
            const rect = emojiButtonRef.current.getBoundingClientRect()
            setEmojiDropdownPos({
                top: Math.max(10, Math.min(window.innerHeight - 300, rect.top - 150)),
                left: rect.right + 8,
            })
            setShowEmojiDropdown(true)
        }
    }, [showEmojiDropdown])

    const handleSymbolClick = (val: string) => {
        setSelectedSymbol(val)
        setTool(`symbol:${val}`)
        setShowMathDropdown(false)
    }

    const handleEmojiClick = (val: string) => {
        setSelectedEmoji(val)
        setTool(`emoji:${val}`)
        setShowEmojiDropdown(false)
    }

    const handleGraphItemClick = async (gId: GraphToolId) => {
        if (gId === "large-grid" || gId === "graph-plain" || gId === "graph-labeled") {
            let title = "Grid Size"
            let label = "Enter number of boxes"
            let defVal = "3"

            if (gId !== "large-grid") {
                title = "Coordinate Range"
                label = "Enter coordinate limit (e.g. 10 for -9 to 9)"
                defVal = "8"
            }

            const { value: count } = await Swal.fire({
                title,
                input: "number",
                inputLabel: label,
                inputValue: defVal,
                showCancelButton: true,
                inputAttributes: {
                    min: "1",
                    max: "50",
                    step: "1"
                }
            })

            if (count) {
                const n = parseInt(count)
                setTool(`${gId}:${n}`)
            } else {
                setTool(`${gId}:${defVal}`)
            }
        } else {
            setTool(gId)
        }
        setSelectedGraph(gId)
        setShowGraphDropdown(false)
    }

    return (
        <nav className="w-12 flex no-scrollbar flex-col items-center bg-sidebar border-r border-border z-30 shrink-0 h-full max-h-screen">

            {/* Scrollable content area with fade scroll indicator */}
            <div className="relative flex-1 w-full min-h-0">
                {/* Top fade scroll affordance — visible only when more content is above */}
                {canScrollUp && (
                    <div
                        className="pointer-events-none absolute top-0 left-0 right-0 h-10 z-10 flex items-start justify-center pt-1"
                        style={{ background: "linear-gradient(to top, transparent, var(--sidebar))" }}
                    >
                        <svg className="w-3 h-3 text-muted-foreground opacity-60 animate-bounce rotate-180" viewBox="0 0 10 10" fill="currentColor">
                            <path d="M2 3 L8 3 L5 8 Z" />
                        </svg>
                    </div>
                )}
                <div
                    ref={scrollAreaRef}
                    onScroll={checkScroll}
                    className="flex flex-col no-scrollbar overflow-y-auto h-full w-full items-center py-3 gap-2"
                >
                    {/* Tools Section */}
                    <div className="flex flex-col gap-1.5">
                        <span className="text-[7px] font-black uppercase tracking-widest text-muted-foreground mb-1 text-center">Tools</span>
                        <button type="button" onClick={() => setTool("select")} className={cn("p-2 rounded-[5px] transition-all duration-300", tool === "select" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-accent")} title="Selection Tool">
                            <MousePointer2 size={18} />
                        </button>

                        {/* Pen tools - pen, highlighter */}
                        <div className="relative group" ref={penButtonRef}>
                            <div className={cn(
                                "flex flex-col items-stretch rounded-[5px] overflow-hidden transition-all duration-300 border border-transparent",
                                isPenTool ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-muted/30 hover:bg-accent hover:border-border/50"
                            )}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTool(`pen:${selectedPen}`)
                                        if (!isPenTool) setShowPenDropdown(false)
                                    }}
                                    onContextMenu={(e) => { e.preventDefault(); togglePenDropdown() }}
                                    className="p-1.5 flex-1 flex items-center justify-center transition-colors hover:bg-white/10"
                                    title={`Use ${selectedPen}`}
                                >
                                    <ActivePenIcon size={18} />
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        togglePenDropdown()
                                    }}
                                    className={cn(
                                        "py-0.5 flex items-center justify-center transition-colors hover:bg-white/20 border-t border-white/10",
                                        isPenTool ? "text-primary-foreground" : "text-muted-foreground"
                                    )}
                                    title="Choose pen type"
                                >
                                    <svg className="w-2 h-2 opacity-80" viewBox="0 0 10 10" fill="currentColor">
                                        <path d="M2 4 L8 4 L5 8 Z" />
                                    </svg>
                                </button>
                            </div>

                            {showPenDropdown && penDropdownPos && ReactDOM.createPortal(
                                <>
                                    <div className="fixed inset-0 z-9998" onClick={() => setShowPenDropdown(false)} />
                                    <div
                                        className="fixed z-9999 flex flex-col gap-1 p-1 bg-sidebar border border-border rounded-[3px] shadow-xl animate-in fade-in slide-in-from-left-2 duration-200"
                                        style={{ top: penDropdownPos.top, left: penDropdownPos.left }}
                                    >
                                        {PEN_TOOLS.map((p) => {
                                            const Icon = p.icon
                                            return (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedPen(p.id)
                                                        setTool(`pen:${p.id}`)
                                                        setShowPenDropdown(false)
                                                    }}
                                                    className={cn(
                                                        "p-2 rounded-[5px] flex items-center gap-2 transition-all duration-200",
                                                        (tool === `pen:${p.id}`)
                                                            ? "bg-primary text-primary-foreground shadow-md"
                                                            : "text-muted-foreground hover:text-foreground hover:bg-accent"
                                                    )}
                                                    title={p.label}
                                                >
                                                    <Icon size={16} />
                                                    <span className="text-[10px] font-medium pr-1">{p.label}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </>,
                                document.body
                            )}
                        </div>
                        <div className="relative group" ref={eraserButtonRef}>
                            <div className={cn(
                                "flex flex-col items-stretch rounded-[5px] overflow-hidden transition-all duration-300 border border-transparent",
                                (tool === "eraser" || tool === "partial-eraser") ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-muted/30 hover:bg-accent hover:border-border/50"
                            )}>
                                <button
                                    type="button"
                                    onClick={() => setTool(tool === "partial-eraser" ? "partial-eraser" : "eraser")}
                                    onContextMenu={(e) => {
                                        e.preventDefault()
                                        if (eraserButtonRef.current) {
                                            const rect = eraserButtonRef.current.getBoundingClientRect()
                                            setEraserDropdownPos({ top: rect.top, left: rect.right + 10 })
                                            setShowEraserDropdown(true)
                                        }
                                    }}
                                    className="p-1.5 flex-1 flex items-center justify-center transition-colors hover:bg-white/10 min-h-[30px]"
                                    title="Eraser Tool (Right click for options)"
                                >
                                    <ActiveEraserIcon size={18} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (eraserButtonRef.current) {
                                            const rect = eraserButtonRef.current.getBoundingClientRect()
                                            setEraserDropdownPos({ top: rect.top, left: rect.right + 10 })
                                            setShowEraserDropdown(!showEraserDropdown)
                                        }
                                    }}
                                    className="h-2 flex items-center justify-center hover:bg-white/20 transition-colors border-t border-white/5"
                                    title="Choose eraser tool"
                                >
                                    <svg className="w-2 h-2 opacity-80" viewBox="0 0 10 10" fill="currentColor">
                                        <path d="M2 4 L8 4 L5 8 Z" />
                                    </svg>
                                </button>
                            </div>

                            {showEraserDropdown && eraserDropdownPos && ReactDOM.createPortal(
                                <>
                                    <div className="fixed inset-0 z-9998" onClick={() => setShowEraserDropdown(false)} />
                                    <div
                                        className="fixed z-9999 flex flex-col gap-1 p-1 bg-sidebar border border-border rounded-[3px] shadow-xl animate-in fade-in slide-in-from-left-2 duration-200"
                                        style={{ top: eraserDropdownPos.top, left: eraserDropdownPos.left }}
                                    >
                                        {ERASER_TOOLS.map((e) => {
                                            const Icon = e.icon
                                            return (
                                                <button
                                                    key={e.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setTool(e.id)
                                                        setShowEraserDropdown(false)
                                                    }}
                                                    className={cn(
                                                        "p-2 rounded-[5px] flex items-center gap-2 transition-all duration-200",
                                                        tool === e.id
                                                            ? "bg-primary text-primary-foreground shadow-md"
                                                            : "text-muted-foreground hover:text-foreground hover:bg-accent"
                                                    )}
                                                    title={e.label}
                                                >
                                                    <Icon size={16} />
                                                    <span className="text-[10px] font-medium pr-1">{e.label}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </>,
                                document.body
                            )}
                        </div>
                        <button type="button" onClick={() => setTool("text")} className={cn("p-2 rounded-[5px] transition-all duration-300", tool === "text" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-accent")} title="Text Tool">
                            <Type size={18} />
                        </button>
                        {/* Text Color — only when text tool is active */}
                        {tool === "text" && (
                            <>
                                {/* <div className="w-8 h-px bg-border my-1" /> */}
                                <TextColorPicker color={textColor} onChange={setTextColor} />
                            </>
                        )}
                        <div className="w-8 h-px bg-border my-1 mx-auto" />

                        {/* Shapes — single button with horizontal dropdown */}
                        <div className="relative group" ref={shapeButtonRef}>
                            <div className={cn(
                                "focus-within:ring-2 focus-within:ring-primary flex flex-col items-stretch rounded-[5px] overflow-hidden transition-all duration-300 border border-transparent",
                                isShapeTool ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-muted/30 hover:bg-accent hover:border-border/50"
                            )}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTool(selectedShape)
                                        if (!isShapeTool) setShowShapeDropdown(false)
                                    }}
                                    onContextMenu={(e) => { e.preventDefault(); toggleShapeDropdown() }}
                                    className="p-1.5 flex-1 flex items-center justify-center transition-colors hover:bg-white/10"
                                    title={`Use ${selectedShape}`}
                                >
                                    <ActiveShapeIcon size={18} />
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        toggleShapeDropdown()
                                    }}
                                    className={cn(
                                        "py-0.5 flex items-center justify-center transition-colors hover:bg-white/20 border-t border-white/10",
                                        isShapeTool ? "text-primary-foreground" : "text-muted-foreground"
                                    )}
                                    title="Choose shape"
                                >
                                    <svg className="w-2 h-2 opacity-80" viewBox="0 0 10 10" fill="currentColor">
                                        <path d="M2 4 L8 4 L5 8 Z" />
                                    </svg>
                                </button>
                            </div>

                            {showShapeDropdown && shapeDropdownPos && ReactDOM.createPortal(
                                <>
                                    <div className="fixed inset-0 z-9998" onClick={() => setShowShapeDropdown(false)} />
                                    <div
                                        className="fixed z-9999 flex flex-wrap items-center gap-1 bg-sidebar border border-border rounded-[3px] shadow-xl animate-in fade-in slide-in-from-left-2 duration-200 w-[73px]"
                                        style={{ top: shapeDropdownPos.top, left: shapeDropdownPos.left }}
                                    >
                                        {SHAPE_TOOLS.map((shape) => {
                                            const Icon = shape.icon
                                            return (
                                                <button
                                                    key={shape.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedShape(shape.id)
                                                        setTool(shape.id)
                                                        setShowShapeDropdown(false)
                                                    }}
                                                    className={cn(
                                                        "p-2 rounded-[5px] transition-all duration-200",
                                                        tool === shape.id
                                                            ? "bg-primary text-primary-foreground shadow-md"
                                                            : "text-muted-foreground hover:text-foreground hover:bg-accent"
                                                    )}
                                                    title={shape.label}
                                                >
                                                    <Icon size={16} className={`${shape.id == "parallelogram" && "-skew-x-24"}`} />
                                                </button>
                                            )
                                        })}
                                    </div>
                                </>,
                                document.body
                            )}
                        </div>

                        {/* Graph Tools — Simplified Section */}
                        <div className="relative group" ref={graphButtonRef}>
                            <div className={cn(
                                "flex flex-col items-stretch rounded-[5px] overflow-hidden transition-all duration-300 border border-transparent",
                                isGraphTool ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-muted/30 hover:bg-accent hover:border-border/50"
                            )}>
                                <button
                                    type="button"
                                    onClick={() => handleGraphItemClick(selectedGraph)}
                                    onContextMenu={(e) => { e.preventDefault(); toggleGraphDropdown() }}
                                    className="p-1.5 flex-1 flex items-center justify-center transition-colors hover:bg-white/10"
                                    title={`Use ${selectedGraph}`}
                                >
                                    <ActiveGraphIcon size={18} />
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        toggleGraphDropdown()
                                    }}
                                    className={cn(
                                        "py-0.5 flex items-center justify-center transition-colors hover:bg-white/20 border-t border-white/10",
                                        isGraphTool ? "text-primary-foreground" : "text-muted-foreground"
                                    )}
                                    title="Choose graph tool"
                                >
                                    <svg className="w-2 h-2 opacity-80" viewBox="0 0 10 10" fill="currentColor">
                                        <path d="M2 4 L8 4 L5 8 Z" />
                                    </svg>
                                </button>
                            </div>

                            {showGraphDropdown && graphDropdownPos && ReactDOM.createPortal(
                                <>
                                    <div className="fixed inset-0 z-9998" onClick={() => setShowGraphDropdown(false)} />
                                    <div
                                        className="fixed z-9999 flex flex-col gap-1 p-1 bg-sidebar border border-border rounded-[3px] shadow-xl animate-in fade-in slide-in-from-left-2 duration-200"
                                        style={{ top: graphDropdownPos.top, left: graphDropdownPos.left }}
                                    >
                                        {GRAPH_TOOLS.map((g) => {
                                            const Icon = g.icon
                                            return (
                                                <button
                                                    key={g.id}
                                                    type="button"
                                                    onClick={() => handleGraphItemClick(g.id)}
                                                    className={cn(
                                                        "p-2 rounded-[5px] flex items-center gap-2 transition-all duration-200",
                                                        tool === g.id
                                                            ? "bg-primary text-primary-foreground shadow-md"
                                                            : "text-muted-foreground hover:text-foreground hover:bg-accent"
                                                    )}
                                                    title={g.label}
                                                >
                                                    <Icon size={16} />
                                                    <span className="text-[10px] font-medium pr-1">{g.label}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </>,
                                document.body
                            )}
                        </div>

                        <div className="relative group" ref={mathButtonRef}>
                            <div className={cn(
                                "flex flex-col items-stretch rounded-[5px] overflow-hidden transition-all duration-300 border border-transparent",
                                isMathSymbolTool ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-muted/30 hover:bg-accent hover:border-border/50"
                            )}>
                                <button
                                    type="button"
                                    onClick={() => setTool(`symbol:${selectedSymbol}`)}
                                    onContextMenu={(e) => { e.preventDefault(); toggleMathDropdown() }}
                                    className="p-1.5 flex-1 flex items-center justify-center transition-colors hover:bg-white/10 min-h-[30px]"
                                    title={`Use ${selectedSymbol}`}
                                >
                                    <span className="text-lg font-bold leading-none">{selectedSymbol}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        toggleMathDropdown()
                                    }}
                                    className={cn(
                                        "py-0.5 flex items-center justify-center transition-colors hover:bg-white/20 border-t border-white/10",
                                        isMathSymbolTool ? "text-primary-foreground" : "text-muted-foreground"
                                    )}
                                    title="Choose symbol"
                                >
                                    <svg className="w-2 h-2 opacity-80" viewBox="0 0 10 10" fill="currentColor">
                                        <path d="M2 4 L8 4 L5 8 Z" />
                                    </svg>
                                </button>
                            </div>

                            {showMathDropdown && mathDropdownPos && ReactDOM.createPortal(
                                <>
                                    <div className="fixed inset-0 z-9998" onClick={() => setShowMathDropdown(false)} />
                                    <div
                                        className="fixed z-9999 grid grid-cols-4 gap-1 p-2 bg-sidebar border border-border rounded-[8px] shadow-2xl animate-in fade-in slide-in-from-left-2 duration-200 w-[160px]"
                                        style={{ top: mathDropdownPos.top, left: mathDropdownPos.left }}
                                    >
                                        {MATH_SYMBOLS.map((s) => (
                                            <button
                                                key={s.id}
                                                type="button"
                                                onClick={() => handleSymbolClick(s.value)}
                                                className={cn(
                                                    "h-8 w-8 flex items-center justify-center text-sm font-medium rounded-[4px] transition-colors",
                                                    selectedSymbol === s.value
                                                        ? "bg-primary text-primary-foreground"
                                                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                                                )}
                                                title={s.label}
                                            >
                                                {s.value}
                                            </button>
                                        ))}
                                    </div>
                                </>,
                                document.body
                            )}
                        </div>

                        {/* Commented out Emoji code preserved as requested */}
                        {/* <div className="relative group" ref={emojiButtonRef}>
                            <div className={cn(
                                "flex flex-col items-stretch rounded-[5px] overflow-hidden transition-all duration-300 border border-transparent",
                                isEmojiTool ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-muted/30 hover:bg-accent hover:border-border/50"
                            )}>
                                <button
                                    type="button"
                                    onClick={() => setTool(`emoji:${selectedEmoji}`)}
                                    onContextMenu={(e) => { e.preventDefault(); toggleEmojiDropdown() }}
                                    className="p-1.5 flex-1 flex items-center justify-center transition-colors hover:bg-white/10 min-h-[30px]"
                                    title={`Use ${selectedEmoji}`}
                                >
                                    <span className="text-xl leading-none">{selectedEmoji}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        toggleEmojiDropdown()
                                    }}
                                    className={cn(
                                        "py-0.5 flex items-center justify-center transition-colors hover:bg-white/20 border-t border-white/10",
                                        isEmojiTool ? "text-primary-foreground" : "text-muted-foreground"
                                    )}
                                    title="Choose emoji"
                                >
                                    <svg className="w-2 h-2 opacity-80" viewBox="0 0 10 10" fill="currentColor">
                                        <path d="M2 4 L8 4 L5 8 Z" />
                                    </svg>
                                </button>
                            </div>

                            {showEmojiDropdown && emojiDropdownPos && ReactDOM.createPortal(
                                <>
                                    <div className="fixed inset-0 z-9998" onClick={() => setShowEmojiDropdown(false)} />
                                    <div
                                        className="fixed z-9999 grid grid-cols-4 gap-1 p-2 bg-sidebar border border-border rounded-[8px] shadow-2xl animate-in fade-in slide-in-from-left-2 duration-200 w-[160px]"
                                        style={{ top: emojiDropdownPos.top, left: emojiDropdownPos.left }}
                                    >
                                        {EMOJIS.map((e) => (
                                            <button
                                                key={e.id}
                                                type="button"
                                                onClick={() => handleEmojiClick(e.value)}
                                                className={cn(
                                                    "h-8 w-8 flex items-center justify-center text-lg rounded-[4px] transition-colors",
                                                    selectedEmoji === e.value
                                                        ? "bg-primary text-primary-foreground"
                                                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                                                )}
                                                title={e.label}
                                            >
                                                {e.value}
                                            </button>
                                        ))}
                                    </div>
                                </>,
                                document.body
                            )}
                        </div> */}

                        <button type="button" onClick={() => setTool("laser")} className={cn("p-2 rounded-[5px] transition-all duration-300", tool === "laser" ? "bg-red-500 text-white shadow-lg shadow-red-500/30" : "text-muted-foreground hover:text-foreground hover:bg-accent")} title="Laser Pointer">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.8" />
                                <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" opacity="0.5" />
                            </svg>
                        </button>
                    </div>

                    {/* Clear Canvas - Teacher Only */}
                    {role === "teacher" && onClearCanvas && (
                        <>
                            <div className="w-10 h-px bg-border -mt-1" />
                            <button
                                type="button"
                                onClick={async () => {
                                    const { isConfirmed } = await Swal.fire({
                                        title: "Clear Canvas?",
                                        text: "This will clear the canvas for all users. Are you sure?",
                                        icon: "warning",
                                        showCancelButton: true,
                                        confirmButtonColor: "#ef4444",
                                        cancelButtonColor: "#6b7280",
                                        confirmButtonText: "Yes, clear it!"
                                    })
                                    if (isConfirmed) onClearCanvas()
                                }}
                                className="p-2 rounded-[5px] transition-all duration-300 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                                title="Clear Canvas (All Users)"
                            >
                                <Trash2 size={18} />
                            </button>
                        </>
                    )}

                    <div className="w-10 h-px bg-border" />

                    {/* Color Section */}
                    <div className="flex flex-col gap-1 items-center">
                        <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground text-center">Ink</span>
                        <div className="flex flex-col gap-2">

                            {/* Custom Color Picker Popover */}
                            <div className="relative mt-1 flex justify-center">
                                <button
                                    ref={colorButtonRef}
                                    type="button"
                                    onClick={() => toggleColorPicker()}
                                    className="w-6 h-6 rounded-[2px] border border-border flex items-center justify-center transition-colors cursor-pointer shadow-sm"
                                    style={{
                                        backgroundColor: color,
                                        color: getContrastColor(color)
                                    }}
                                >
                                    <Palette size={12} />
                                </button>

                                {showColorPicker && colorPickerPos && ReactDOM.createPortal(
                                    <>
                                        {/* Invisible backdrop to close picker when clicking outside */}
                                        <div className="fixed inset-0 z-9998" onClick={() => setShowColorPicker(false)} />

                                        {/* The Popover Card */}
                                        <div
                                            className="fixed z-9999 animate-in fade-in slide-in-from-left-2 duration-200"
                                            style={{ top: colorPickerPos.top, left: colorPickerPos.left }}
                                        >
                                            <div className="p-1.5 bg-sidebar border border-border rounded-[5px] shadow-2xl">
                                                <ColorPicker color={color} onChange={(hex) => setColor(hex)} />
                                            </div>
                                        </div>
                                    </>,
                                    document.body
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="w-10 h-px bg-border my-1" />

                    {/* Brush Size */}
                    <div className="flex flex-col gap-2 items-center mb-2">
                        <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground text-center flex flex-wrap justify-center items-center gap-0.5 p-0.5">Size <span className="text-[10px] font-bold text-muted-foreground">({brushSize})</span></span>
                        <div className="flex flex-col items-center bg-muted/50 p-1 rounded-[3px] gap-0.5">
                            {brushSizes.map((size) => (
                                <button
                                    key={size}
                                    type="button"
                                    onClick={() => setBrushSize(size)}
                                    className={cn("w-8 flex items-center justify-center rounded-[2px] transition-all py-2", brushSize === size ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-accent text-muted-foreground hover:text-foreground")}
                                    title={`Size ${size}`}
                                >
                                    <div className="w-5 rounded-[2px] bg-current transition-all" style={{ height: `${Math.max(1.5, size / 2.5)}px` }} />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Shape Fill & Border Colors — only when a shape tool is active */}
                    {(isShapeTool) && (
                        <div className="flex flex-col gap-4 py-2 border-t border-border w-full items-center mb-6 animate-in slide-in-from-bottom-2 duration-300">
                            {/* Fill Color */}
                            <div className="flex flex-col gap-2 items-center">
                                <span className="text-[7px] font-black uppercase tracking-widest text-muted-foreground text-center">Fill</span>
                                <div className="grid grid-cols-2 gap-1 px-1">
                                    <button
                                        onClick={() => setShapeFillColor("transparent")}
                                        className={cn(
                                            "w-4 h-4 rounded-sm border transition-all duration-200",
                                            shapeFillColor === "transparent" ? "border-white scale-110 z-10 shadow-sm" : "border-transparent hover:scale-110"
                                        )}
                                        style={{
                                            backgroundImage: "linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)",
                                            backgroundPosition: "0 0, 2px 2px",
                                            backgroundSize: "4px 4px",
                                            backgroundColor: "white"
                                        }}
                                        title="No Fill"
                                    >
                                        <div className="w-full h-full flex items-center justify-center"><div className="w-px h-[120%] bg-red-500 rotate-45 shadow-sm" /></div>
                                    </button>
                                    <button
                                        ref={fillButtonRef}
                                        onClick={() => toggleFillPicker()}
                                        className={cn(
                                            "w-4 h-4 rounded-sm border border-border flex items-center justify-center transition-colors shadow-sm",
                                            shapeFillColor === "transparent" ? "text-muted-foreground bg-accent" : ""
                                        )}
                                        style={shapeFillColor !== "transparent" ? {
                                            backgroundColor: shapeFillColor,
                                            color: getContrastColor(shapeFillColor)
                                        } : {}}
                                    >
                                        <Palette size={8} />
                                    </button>
                                </div>
                                {showFillPicker && fillPickerPos && ReactDOM.createPortal(
                                    <>
                                        <div className="fixed inset-0 z-9998" onClick={() => setShowFillPicker(false)} />
                                        <div className="fixed z-9999 animate-in fade-in slide-in-from-left-2 duration-200" style={{ top: fillPickerPos.top, left: fillPickerPos.left }}>
                                            <div className="p-1.5 bg-sidebar border border-border rounded-[5px] shadow-2xl">
                                                <ColorPicker color={shapeFillColor} onChange={(hex) => setShapeFillColor(hex)} />
                                            </div>
                                        </div>
                                    </>,
                                    document.body
                                )}
                            </div>

                            {/* Border Color */}
                            <div className="flex flex-col gap-2 items-center">
                                <span className="text-[7px] font-black uppercase tracking-widest text-muted-foreground text-center">Border</span>
                                <div className="grid grid-cols-2 gap-1 px-1">
                                    <button
                                        onClick={() => setShapeBorderColor("#FFFFFF")}
                                        className={cn(
                                            "w-4 h-4 rounded-full border-2 transition-all duration-200",
                                            shapeBorderColor === "#FFFFFF" ? "border-white scale-110 z-10 shadow-sm" : "border-transparent hover:scale-110"
                                        )}
                                        style={{ backgroundColor: "#FFFFFF" }}
                                        title="White"
                                    />
                                    <button
                                        ref={borderButtonRef}
                                        onClick={() => toggleBorderPicker()}
                                        className="w-4 h-4 rounded-full border border-border flex items-center justify-center transition-colors shadow-sm"
                                        style={{
                                            backgroundColor: shapeBorderColor,
                                            color: getContrastColor(shapeBorderColor)
                                        }}
                                    >
                                        <Palette size={8} />
                                    </button>
                                </div>
                                {showBorderPicker && borderPickerPos && ReactDOM.createPortal(
                                    <>
                                        <div className="fixed inset-0 z-9998" onClick={() => setShowBorderPicker(false)} />
                                        <div className="fixed z-9999 animate-in fade-in slide-in-from-left-2 duration-200" style={{ top: borderPickerPos.top, left: borderPickerPos.left }}>
                                            <div className="p-1.5 bg-sidebar border border-border rounded-[5px] shadow-2xl">
                                                <ColorPicker color={shapeBorderColor} onChange={(hex) => setShapeBorderColor(hex)} />
                                            </div>
                                        </div>
                                    </>,
                                    document.body
                                )}
                            </div>
                        </div>
                    )}
                    {(isGraphTool) && (
                        <div className="flex flex-col gap-4 py-2 border-t border-border w-full items-center mb-6 animate-in slide-in-from-bottom-2 duration-300">

                            {/* Border Color */}
                            <div className="flex flex-col gap-2 items-center">
                                <span className="text-[7px] font-black uppercase tracking-widest text-muted-foreground text-center">Highlight</span>
                                <div className="grid grid-cols-2 gap-1 px-1">
                                    <button
                                        onClick={() => setShapeBorderColor("#FFFFFF")}
                                        className={cn(
                                            "w-4 h-4 rounded-full border-2 transition-all duration-200",
                                            shapeBorderColor === "#FFFFFF" ? "border-white scale-110 z-10 shadow-sm" : "border-transparent hover:scale-110"
                                        )}
                                        style={{ backgroundColor: "#FFFFFF" }}
                                        title="White"
                                    />
                                    <button
                                        ref={borderButtonRef}
                                        onClick={() => toggleBorderPicker()}
                                        className="w-4 h-4 rounded-full border border-border flex items-center justify-center transition-colors shadow-sm"
                                        style={{
                                            backgroundColor: shapeBorderColor,
                                            color: getContrastColor(shapeBorderColor)
                                        }}
                                    >
                                        <Palette size={8} />
                                    </button>
                                </div>
                                {showBorderPicker && borderPickerPos && ReactDOM.createPortal(
                                    <>
                                        <div className="fixed inset-0 z-9998" onClick={() => setShowBorderPicker(false)} />
                                        <div className="fixed z-9999 animate-in fade-in slide-in-from-left-2 duration-200" style={{ top: borderPickerPos.top, left: borderPickerPos.left }}>
                                            <div className="p-1.5 bg-sidebar border border-border rounded-[5px] shadow-2xl">
                                                <ColorPicker color={shapeBorderColor} onChange={(hex) => setShapeBorderColor(hex)} />
                                            </div>
                                        </div>
                                    </>,
                                    document.body
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Bottom fade scroll affordance — visible only when more content is below */}
                {canScrollDown && (
                    <div
                        className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 flex items-end justify-center pb-1"
                        style={{ background: "linear-gradient(to bottom, transparent, var(--sidebar))" }}
                    >
                        <svg className="w-3 h-3 text-muted-foreground opacity-60 animate-bounce" viewBox="0 0 10 10" fill="currentColor">
                            <path d="M2 3 L8 3 L5 8 Z" />
                        </svg>
                    </div>
                )}
            </div>
        </nav>
    )
}
