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
    Palette,
    MousePointer2,
    Square, Circle, Minus, ArrowUpRight, Triangle, Diamond, Star, Ellipse, Pentagon, TriangleRight, RectangleHorizontal,
    Activity, Calculator, Grid3X3, LayoutGrid
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
    tool: string
    setTool: (tool: string) => void
    onZoomChange: (zoom: number) => void
    isOpen: boolean
    duration: number
    boardColor: string
    setBoardColor: (color: string) => void
    role: "teacher" | "student"
    sessionId: string
    isViewLocked?: boolean
    userName: string;
    onToggleViewLocked?: (enabled: boolean) => void
}

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

export default function BoardTopBar({
    zoom,
    tool,
    setTool,
    onZoomChange,
    isOpen,
    duration,
    boardColor,
    setBoardColor,
    role,
    sessionId,
    isViewLocked = true,
    userName,
    onToggleViewLocked
}: BoardTopBarProps) {
    const scrollBarRef = useRef<HTMLDivElement>(null)
    const bgButtonRef = useRef<HTMLDivElement>(null)

    const [showBgPicker, setShowBgPicker] = useState(false)
    const [bgPickerPos, setBgPickerPos] = useState<{ top: number; left: number } | null>(null)
    const [canScrollRight, setCanScrollRight] = useState(false)
    const isMathSymbolTool = tool.startsWith("symbol:")
    const isEmojiTool = tool.startsWith("emoji:")
    const mathButtonRef = useRef<HTMLDivElement>(null)
    const emojiButtonRef = useRef<HTMLDivElement>(null)
    const shapeButtonRef = useRef<HTMLDivElement>(null)
    const graphButtonRef = useRef<HTMLDivElement>(null)
    const [selectedSymbol, setSelectedSymbol] = useState<string>("π")
    const [selectedEmoji, setSelectedEmoji] = useState<string>("😊")
    const [selectedShape, setSelectedShape] = useState<ShapeToolId>("rectangle")
    const [selectedGraph, setSelectedGraph] = useState<GraphToolId>("graph-axis")
    const [shapeDropdownPos, setShapeDropdownPos] = useState<{ bottom: number; left: number } | null>(null)
    const [graphDropdownPos, setGraphDropdownPos] = useState<{ bottom: number; left: number } | null>(null)
    const [showMathDropdown, setShowMathDropdown] = useState(false)
    const [showEmojiDropdown, setShowEmojiDropdown] = useState(false)
    const [showShapeDropdown, setShowShapeDropdown] = useState(false)
    const [showGraphDropdown, setShowGraphDropdown] = useState(false)

    const [mathDropdownPos, setMathDropdownPos] = useState<{ top: number; left: number } | null>(null)
    const [emojiDropdownPos, setEmojiDropdownPos] = useState<{ top: number; left: number } | null>(null)

    const ActiveShapeIcon = SHAPE_TOOLS.find(s => s.id === selectedShape)?.icon || Square
    const ActiveGraphIcon = GRAPH_TOOLS.find(g => g.id === selectedGraph)?.icon || Activity

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

    const toggleShapeDropdown = useCallback(() => {
        if (showShapeDropdown) {
            setShowShapeDropdown(false)
            return
        }
        if (shapeButtonRef.current) {
            const rect = shapeButtonRef.current.getBoundingClientRect()
            setShapeDropdownPos({
                bottom: rect.bottom + rect.height / 2 - 20,
                left: rect.left + 8,
            })
        }
        setShowShapeDropdown(true)
    }, [showShapeDropdown])

    const isShapeToolCount = (t: string) => SHAPE_TOOLS.some(s => s.id === t)
    const isShapeTool = isShapeToolCount(tool)
    const isGraphToolCount = (t: string) => GRAPH_TOOLS.some(g => g.id === t) || t.startsWith("large-grid") || t.startsWith("graph-plain") || t.startsWith("graph-labeled")
    const isGraphTool = isGraphToolCount(tool)

    const toggleGraphDropdown = useCallback(() => {
        if (showGraphDropdown) {
            setShowGraphDropdown(false)
            return
        }
        if (graphButtonRef.current) {
            const rect = graphButtonRef.current.getBoundingClientRect()
            setGraphDropdownPos({
                bottom: rect.bottom + rect.height / 2 - 20,
                left: rect.right + 8,
            })
        }
        setShowGraphDropdown(true)
    }, [showGraphDropdown])

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


                    <button type="button" onClick={() => setTool("select")} className={cn("p-2 border rounded-[5px] border-primary/40 transition-all duration-300", tool === "select" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-accent")} title="Selection Tool">
                        <MousePointer2 size={18} />
                    </button>

                    {/* Shapes — single button with horizontal dropdown */}
                    <div className="relative group border rounded-[5px] border-primary/40" ref={shapeButtonRef}>
                        <div className={cn(
                            "focus-within:ring-2 focus-within:ring-primary flex items-stretch rounded-[5px] overflow-hidden transition-all duration-300 border border-transparent h-full",
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
                                    className="fixed z-9999 flex flex-col flex-wrap items-center gap-1 bg-sidebar border border-border rounded-[3px] shadow-xl animate-in fade-in slide-in-from-left-2 duration-200 h-[73px]"
                                    style={{ top: shapeDropdownPos.bottom, left: shapeDropdownPos.left }}
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
                    <div className="relative group border rounded-[5px] border-primary/40" ref={graphButtonRef}>
                        <div className={cn(
                            "flex items-stretch rounded-[5px] overflow-hidden transition-all duration-300 border border-transparent",
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
                                    style={{ top: graphDropdownPos.bottom, left: graphDropdownPos.left }}
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
                    {/* Math Symbols — Simplified Section */}
                    <div className="relative group border rounded-[5px] border-primary/40" ref={mathButtonRef}>
                        <div className={cn(
                            "flex items-stretch rounded-[5px] overflow-hidden transition-all duration-300 border border-transparent",
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
                    {/* <div className="relative group border rounded-[5px] border-primary/40" ref={emojiButtonRef}>
                        <div className={cn(
                            "flex items-stretch rounded-[5px] overflow-hidden transition-all duration-300 border border-transparent",
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

                    {/* Undo/Redo */}
                    {role == 'teacher' && (
                        <div className="flex items-center gap-0.5 sm:gap-1 px-1 sm:px-2 border-r border-border/50 h-7 shrink-0">
                            <button
                                type="button"
                                onClick={() => document.dispatchEvent(new CustomEvent("undo-trigger"))}
                                className="p-1 sm:p-1.5 border rounded-[5px] border-primary/40 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                title="Undo (Ctrl+Z)"
                            >
                                <RotateCcw size={13} className="sm:w-[15px] sm:h-[15px]" />
                            </button>
                            <button
                                type="button"
                                onClick={() => document.dispatchEvent(new CustomEvent("redo-trigger"))}
                                className="p-1 sm:p-1.5 border rounded-[5px] border-primary/40 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0"
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
                            <div className="flex gap-1 sm:gap-1.5 items-center border rounded-[5px] border-primary/40">
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
