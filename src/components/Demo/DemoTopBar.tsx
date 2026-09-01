"use client"
import React, { useEffect, useRef, useState, useCallback } from "react"
import {
    RotateCcw,
    RotateCw,
    ImagePlus,
    FileUp,
    LocateFixed,
    Locate,
    Palette,
    MousePointer2,
    Square, Circle, ArrowUpRight, Triangle, Diamond, Star, Ellipse, Pentagon, TriangleRight, RectangleHorizontal,
    Activity, Calculator, Grid3X3, LayoutGrid,
    Maximize, Minimize, Video
} from "lucide-react"
import ReactDOM from "react-dom"
import DemoBackgroundPicker from "./DemoBackgroundPicker"
import ThemeToggle from "../theme-toggle"
import { cn, getContrastColor } from "@/lib/utils"
import { toast } from "sonner"
import Swal from "sweetalert2"
import Image from "next/image"
import logo from "../../../public/logo.png"

interface DemoTopBarProps {
    tool: string
    setTool: (tool: string) => void
    isOpen?: boolean
    isVideoExpanded?: boolean
    duration?: number
    boardColor: string
    setBoardColor: (color: string) => void
    role?: "teacher" | "student"
    sessionId?: string
    isViewLocked?: boolean
    userName?: string
    onToggleViewLocked?: (enabled: boolean) => void
    drawingEnabled?: boolean
    onPdfUpload?: (file: File) => void
    onEndSession?: (sid?: string) => void
    isClassEnded?: boolean
    isFullscreen?: boolean
    onToggleFullscreen?: () => void
    durationAdded?: number
    startTime?: number
    onImageStamp?: (dataUrl: string) => void
    allowRecording?: boolean
    allowScreenSharing?: boolean
    isMobile?: boolean
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
    { id: "sigma", label: "Σ", value: "Σ" },
    { id: "pi", label: "π", value: "π" },
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
    { id: "matrix", label: "[ ]", value: "[ ]" },
    { id: "determinant", label: "| |", value: "| |" },
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

type GraphToolId = typeof GRAPH_TOOLS[number]["id"]

export default function DemoTopBar({
    tool,
    setTool,
    isOpen = true,
    isVideoExpanded = false,
    duration = 3600,
    boardColor,
    setBoardColor,
    role = "teacher",
    sessionId = "demo",
    isViewLocked = true,
    userName = "Teacher",
    onToggleViewLocked,
    drawingEnabled = true,
    onPdfUpload,
    onEndSession,
    isClassEnded = false,
    isFullscreen = false,
    onToggleFullscreen,
    onImageStamp,
    allowRecording = true,
    isMobile = false,
}: DemoTopBarProps) {
    const scrollBarRef = useRef<HTMLDivElement>(null)
    const bgButtonRef = useRef<HTMLDivElement>(null)

    const [showBgPicker, setShowBgPicker] = useState(false)
    const [bgPickerPos, setBgPickerPos] = useState<{ top: number; left: number } | null>(null)
    const [canScrollRight, setCanScrollRight] = useState(false)
    const isMathSymbolTool = tool.startsWith("symbol:") || tool.startsWith("math:")
    const isEmojiTool = tool.startsWith("emoji:")
    const shapeButtonRef = useRef<HTMLDivElement>(null)
    const filledShapeButtonRef = useRef<HTMLDivElement>(null)
    const graphButtonRef = useRef<HTMLDivElement>(null)
    const mathButtonRef = useRef<HTMLDivElement>(null)
    const emojiButtonRef = useRef<HTMLDivElement>(null)

    const [showShapeDropdown, setShowShapeDropdown] = useState(false)
    const [showFilledShapeDropdown, setShowFilledShapeDropdown] = useState(false)
    const [showGraphDropdown, setShowGraphDropdown] = useState(false)
    const [showMathDropdown, setShowMathDropdown] = useState(false)
    const [showEmojiDropdown, setShowEmojiDropdown] = useState(false)

    const [shapeDropdownPos, setShapeDropdownPos] = useState<{ top: number; left: number } | null>(null)
    const [filledShapeDropdownPos, setFilledShapeDropdownPos] = useState<{ top: number; left: number } | null>(null)
    const [graphDropdownPos, setGraphDropdownPos] = useState<{ top: number; left: number } | null>(null)
    const [mathDropdownPos, setMathDropdownPos] = useState<{ top: number; left: number } | null>(null)
    const [emojiDropdownPos, setEmojiDropdownPos] = useState<{ top: number; left: number } | null>(null)

    const [selectedShape, setSelectedShape] = useState<string>("rectangle")
    const [selectedFilledShape, setSelectedFilledShape] = useState<string>("rectangle")
    const [selectedGraph, setSelectedGraph] = useState<string>("graph-axis")
    const [selectedSymbol, setSelectedSymbol] = useState<string>("Σ")
    const [selectedEmoji, setSelectedEmoji] = useState<string>("😊")

    // Infinite Session Timer (Count Up based on session start time)
    const [secondsElapsed, setSecondsElapsed] = useState<number>(0)
    useEffect(() => {
        const key = `demo_start_time_${sessionId}`
        let startTimeStr = typeof window !== "undefined" ? localStorage.getItem(key) : null
        if (!startTimeStr) {
            startTimeStr = Date.now().toString()
            if (typeof window !== "undefined") {
                localStorage.setItem(key, startTimeStr)
            }
        }
        const startMs = parseInt(startTimeStr, 10) || Date.now()

        const updateTimer = () => {
            const now = Date.now()
            const diffSecs = Math.max(0, Math.floor((now - startMs) / 1000))
            setSecondsElapsed(diffSecs)
        }

        updateTimer()
        const timer = setInterval(updateTimer, 1000)
        return () => clearInterval(timer)
    }, [sessionId])

    const formatTimer = (secs: number) => {
        const h = Math.floor(secs / 3600)
        const m = Math.floor((secs % 3600) / 60)
        const s = secs % 60
        if (h > 0) {
            return `∞ ${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
        }
        return `∞ ${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
    }

    const ActiveShapeIcon = SHAPE_TOOLS.find(s => s.id === selectedShape)?.icon || Square
    const ActiveFilledShapeIcon = SHAPE_TOOLS.find(s => s.id === selectedFilledShape)?.icon || Square
    const ActiveGraphIcon = GRAPH_TOOLS.find(g => g.id === selectedGraph)?.icon || Activity

    const isShapeTool = SHAPE_TOOLS.some(s => s.id === tool || tool === `shape:${s.id}`)
    const isFilledShapeTool = SHAPE_TOOLS.some(s => `f-${s.id}` === tool)
    const isGraphTool = (t: string) => GRAPH_TOOLS.some(g => g.id === t) || t.startsWith("large-grid") || t.startsWith("graph-plain") || t.startsWith("graph-labeled") || t.startsWith("graph:")

    const boardFileInputRef = useRef<HTMLInputElement>(null)
    const pdfFileInputRef = useRef<HTMLInputElement>(null)

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
        setShowFilledShapeDropdown(false)
        setShowGraphDropdown(false)
        setShowMathDropdown(false)
        setShowEmojiDropdown(false)
        if (shapeButtonRef.current) {
            const rect = shapeButtonRef.current.getBoundingClientRect()
            setShapeDropdownPos({
                top: rect.bottom + 8,
                left: rect.left + rect.width / 2,
            })
            setShowShapeDropdown(true)
        }
    }, [showShapeDropdown])

    const toggleFilledShapeDropdown = useCallback(() => {
        if (showFilledShapeDropdown) {
            setShowFilledShapeDropdown(false)
            return
        }
        setShowShapeDropdown(false)
        setShowGraphDropdown(false)
        setShowMathDropdown(false)
        setShowEmojiDropdown(false)
        if (filledShapeButtonRef.current) {
            const rect = filledShapeButtonRef.current.getBoundingClientRect()
            setFilledShapeDropdownPos({
                top: rect.bottom + 8,
                left: rect.left + rect.width / 2,
            })
            setShowFilledShapeDropdown(true)
        }
    }, [showFilledShapeDropdown])

    const toggleGraphDropdown = useCallback(() => {
        if (showGraphDropdown) {
            setShowGraphDropdown(false)
            return
        }
        if (graphButtonRef.current) {
            const rect = graphButtonRef.current.getBoundingClientRect()
            setGraphDropdownPos({
                top: rect.bottom + 8,
                left: rect.left + rect.width / 2,
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
                top: rect.bottom + 8,
                left: rect.left + rect.width / 2,
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
                top: rect.bottom + 8,
                left: rect.left + rect.width / 2,
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

    const handleBoardFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

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
            const dataUrl = reader.result as string
            if (onImageStamp) {
                onImageStamp(dataUrl)
                setTool("image-stamp")
            }
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

    const handleRecorderClick = () => {
        Swal.fire({
            icon: "info",
            title: "Demo Mode",
            text: "Screen recording is enabled in live classroom packages with cloud auto-stitching.",
            showCloseButton: true,
            confirmButtonColor: "#f97316",
            confirmButtonText: "Understood",
        })
    }

    // ─── MOBILE COMPACT TOP BAR ──────────────────────────────
    if (isMobile) {
        return (
            <div className="relative z-50 flex w-full items-center h-10 bg-sidebar backdrop-blur-xl border-b border-border/50 shadow-md shrink-0 overflow-hidden">
                {/* Logo */}
                <div className="flex items-center px-2 h-full border-r border-border/50 shrink-0">
                    <Image alt="Board" src={logo} height={18} width={44} priority />
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Timer */}
                <div className="flex items-center px-2 h-full shrink-0">
                    <span className="font-mono text-[11px] font-bold text-emerald-500 tracking-wider">
                        {formatTimer(secondsElapsed)}
                    </span>
                </div>

                {/* Theme Toggle */}
                <div className="h-full flex items-center shrink-0">
                    <ThemeToggle cn="w-7 h-7 rounded-lg" iconSize={14} />
                </div>

                {/* End Class */}
                {role === "teacher" && (
                    <button
                        type="button"
                        onClick={async () => {
                            const { isConfirmed } = await Swal.fire({
                                title: "Exit Demo Session?",
                                text: "You will be redirected back to the TutorArc website.",
                                icon: "question",
                                showCancelButton: true,
                                confirmButtonColor: "#f97316",
                                cancelButtonColor: "#6b7280",
                                confirmButtonText: "Exit Demo",
                                cancelButtonText: "Stay",
                            })
                            if (isConfirmed && onEndSession) onEndSession(sessionId)
                        }}
                        className="flex items-center justify-center mx-1 px-2 h-7 text-[10px] font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
                        title="Exit Demo Class"
                    >
                        End
                    </button>
                )}
            </div>
        )
    }

    // ─── DESKTOP TOP BAR (unchanged) ──────────────────────────
    return (
        <div className="relative z-50 flex w-full items-center min-h-12 bg-sidebar backdrop-blur-xl border-b border-border/50 shadow-md animate-in fade-in slide-in-from-top-4 duration-500 overflow-hidden">
            {/* Fixed Left Section — Logo */}
            <div className="flex items-center px-1 sm:px-2 h-8 border-r border-border/50 bg-sidebar shrink-0 z-40">
                <Image alt="Board" src={logo} height={20} width={50} priority />
            </div>

            {/* Scrollable Area */}
            <div className="relative flex-1 min-w-0 h-full overflow-hidden group/topbar">
                <nav
                    ref={scrollBarRef}
                    onScroll={checkScroll}
                    className="flex items-center h-full gap-2 sm:gap-3 px-3 sm:px-4 py-2 w-full overflow-x-auto no-scrollbar scroll-smooth"
                >
                    {isVideoExpanded ? (
                        <div className="flex items-center shrink-0 px-1 h-8 ml-auto">
                            <button
                                type="button"
                                onClick={onToggleFullscreen}
                                className={cn(
                                    "flex items-center gap-1.5 p-1.5 h-8 rounded-[5px] border transition-all duration-300 shadow-sm",
                                    isFullscreen
                                        ? "bg-violet-500/10 border-violet-500/30 text-violet-500 hover:bg-violet-500/20"
                                        : "border-primary/40 text-muted-foreground hover:text-foreground hover:bg-accent"
                                )}
                                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Mode"}
                            >
                                {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Selection Tool */}
                            <button
                                type="button"
                                onClick={() => setTool("select")}
                                className={cn(
                                    "p-1.5 w-8 h-8 border rounded-[5px] border-primary/40 transition-all duration-300 shadow-sm flex items-center justify-center cursor-pointer",
                                    tool === "select" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                                )}
                                title="Selection Tool"
                            >
                                <MousePointer2 size={18} />
                            </button>

                            {/* Outline Shapes */}
                            <div className="relative group border rounded-[5px] p-0.5 border-primary/40 h-8 w-9" ref={shapeButtonRef}>
                                <button
                                    type="button"
                                    onClick={() => toggleShapeDropdown()}
                                    className={cn(
                                        "w-full h-full flex items-center justify-center rounded-[5px] transition-all duration-300 border border-transparent cursor-pointer",
                                        isShapeTool ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-muted/30 hover:bg-accent hover:border-border/50"
                                    )}
                                    title={`Outline Shape (Current: ${selectedShape})`}
                                >
                                    <ActiveShapeIcon size={18} />
                                </button>

                                {showShapeDropdown && shapeDropdownPos && ReactDOM.createPortal(
                                    <>
                                        <div className="fixed inset-0 z-9998" onClick={() => setShowShapeDropdown(false)} />
                                        <div
                                            className="fixed z-9999 grid grid-cols-4 gap-1 p-1.5 bg-sidebar border border-border rounded-[8px] shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200 w-[150px]"
                                            style={{ top: shapeDropdownPos.top, left: shapeDropdownPos.left, transform: "translateX(-50%)" }}
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
                                                            "p-1.5 rounded-[5px] transition-all duration-200 cursor-pointer",
                                                            tool === shape.id
                                                                ? "bg-primary text-primary-foreground shadow-md"
                                                                : "text-muted-foreground hover:text-foreground hover:bg-accent"
                                                        )}
                                                        title={`Outline ${shape.label}`}
                                                    >
                                                        <Icon size={16} className={`${shape.id === "parallelogram" && "-skew-x-24"}`} />
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </>,
                                    document.body
                                )}
                            </div>

                            {/* Filled Shapes */}
                            <div className="relative group border rounded-[5px] p-0.5 border-primary/40 h-8 w-9" ref={filledShapeButtonRef}>
                                <button
                                    type="button"
                                    onClick={() => toggleFilledShapeDropdown()}
                                    className={cn(
                                        "w-full h-full flex items-center justify-center rounded-[5px] transition-all duration-300 border border-transparent cursor-pointer",
                                        isFilledShapeTool ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-muted/30 hover:bg-accent hover:border-border/50"
                                    )}
                                    title={`Filled Shape (Current: ${selectedFilledShape})`}
                                >
                                    <div className="relative">
                                        <ActiveFilledShapeIcon size={18} />
                                        <div className="absolute inset-0 flex items-center justify-center opacity-40">
                                            <ActiveFilledShapeIcon size={10} fill="currentColor" />
                                        </div>
                                    </div>
                                </button>

                                {showFilledShapeDropdown && filledShapeDropdownPos && ReactDOM.createPortal(
                                    <>
                                        <div className="fixed inset-0 z-9998" onClick={() => setShowFilledShapeDropdown(false)} />
                                        <div
                                            className="fixed z-9999 grid grid-cols-4 gap-1 p-1.5 bg-sidebar border border-border rounded-[8px] shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200 w-[150px]"
                                            style={{ top: filledShapeDropdownPos.top, left: filledShapeDropdownPos.left, transform: "translateX(-50%)" }}
                                        >
                                            {SHAPE_TOOLS.map((shape) => {
                                                const Icon = shape.icon
                                                return (
                                                    <button
                                                        key={`f-${shape.id}`}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedFilledShape(shape.id)
                                                            setTool(`f-${shape.id}`)
                                                            setShowFilledShapeDropdown(false)
                                                        }}
                                                        className={cn(
                                                            "p-1.5 rounded-[5px] transition-all duration-200 cursor-pointer",
                                                            tool === `f-${shape.id}`
                                                                ? "bg-primary text-primary-foreground shadow-md"
                                                                : "text-muted-foreground hover:text-foreground hover:bg-accent"
                                                        )}
                                                        title={`Filled ${shape.label}`}
                                                    >
                                                        <div className="relative">
                                                            <Icon size={16} className={`${shape.id === "parallelogram" && "-skew-x-24"}`} />
                                                            <div className="absolute inset-0 flex items-center justify-center opacity-40">
                                                                <Icon size={8} fill="currentColor" className={`${shape.id === "parallelogram" && "-skew-x-24"}`} />
                                                            </div>
                                                        </div>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </>,
                                    document.body
                                )}
                            </div>

                            {/* Graph Tools */}
                            <div className="relative group border rounded-[5px] border-primary/40 h-8 w-9 p-0.5" ref={graphButtonRef}>
                                <button
                                    type="button"
                                    onClick={() => toggleGraphDropdown()}
                                    className={cn(
                                        "w-full h-full flex items-center justify-center rounded-[5px] transition-all duration-300 border border-transparent cursor-pointer",
                                        isGraphTool(tool) ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-muted/30 hover:bg-accent hover:border-border/50"
                                    )}
                                    title={`Choose graph tool (Current: ${selectedGraph})`}
                                >
                                    <ActiveGraphIcon size={18} />
                                </button>

                                {showGraphDropdown && graphDropdownPos && ReactDOM.createPortal(
                                    <>
                                        <div className="fixed inset-0 z-9998" onClick={() => setShowGraphDropdown(false)} />
                                        <div
                                            className="fixed z-9999 flex flex-col gap-1 p-1 bg-sidebar border border-border rounded-[3px] shadow-xl animate-in fade-in slide-in-from-top-2 duration-200"
                                            style={{ top: graphDropdownPos.top, left: graphDropdownPos.left, transform: "translateX(-50%)" }}
                                        >
                                            {GRAPH_TOOLS.map((g) => {
                                                const Icon = g.icon
                                                return (
                                                    <button
                                                        key={g.id}
                                                        type="button"
                                                        onClick={() => handleGraphItemClick(g.id)}
                                                        className={cn(
                                                            "p-1.5 rounded-[5px] flex items-center gap-2 transition-all duration-200 cursor-pointer",
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

                            {/* Math Symbols */}
                            <div className="relative group border rounded-[5px] border-primary/40 h-8 w-9 p-0.5" ref={mathButtonRef}>
                                <button
                                    type="button"
                                    onClick={() => toggleMathDropdown()}
                                    className={cn(
                                        "w-full h-full flex items-center justify-center rounded-[5px] transition-all duration-300 border border-transparent cursor-pointer",
                                        isMathSymbolTool ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-muted/30 hover:bg-accent hover:border-border/50"
                                    )}
                                    title={`Choose math symbol (Current: ${selectedSymbol})`}
                                >
                                    <span className="text-lg font-bold leading-none">{selectedSymbol}</span>
                                </button>

                                {showMathDropdown && mathDropdownPos && ReactDOM.createPortal(
                                    <>
                                        <div className="fixed inset-0 z-9998" onClick={() => setShowMathDropdown(false)} />
                                        <div
                                            className="fixed z-9999 grid grid-cols-4 gap-1 p-2 bg-sidebar border border-border rounded-[8px] shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200 w-[160px]"
                                            style={{ top: mathDropdownPos.top, left: mathDropdownPos.left, transform: "translateX(-50%)" }}
                                        >
                                            {MATH_SYMBOLS.map((s) => (
                                                <button
                                                    key={s.id}
                                                    type="button"
                                                    onClick={() => handleSymbolClick(s.value)}
                                                    className={cn(
                                                        "p-1.5 flex items-center justify-center text-sm font-thin rounded-[5px] transition-all duration-200 cursor-pointer",
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

                            {/* Emoji Dropdown */}
                            <div className="relative group border rounded-[5px] border-primary/40 h-8 w-9 p-0.5" ref={emojiButtonRef}>
                                <button
                                    type="button"
                                    onClick={() => toggleEmojiDropdown()}
                                    className={cn(
                                        "w-full h-full flex items-center justify-center rounded-[5px] transition-all duration-300 border border-transparent cursor-pointer",
                                        isEmojiTool ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-muted/30 hover:bg-accent hover:border-border/50"
                                    )}
                                    title={`Choose emoji (Current: ${selectedEmoji})`}
                                >
                                    <span className="text-xl leading-none">{selectedEmoji}</span>
                                </button>

                                {showEmojiDropdown && emojiDropdownPos && ReactDOM.createPortal(
                                    <>
                                        <div className="fixed inset-0 z-9998" onClick={() => setShowEmojiDropdown(false)} />
                                        <div
                                            className="fixed z-9999 grid grid-cols-4 gap-1 p-2 bg-sidebar border border-border rounded-[8px] shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200 w-[160px]"
                                            style={{ top: emojiDropdownPos.top, left: emojiDropdownPos.left, transform: "translateX(-50%)" }}
                                        >
                                            {EMOJIS.map((e) => (
                                                <button
                                                    key={e.id}
                                                    type="button"
                                                    onClick={() => handleEmojiClick(e.value)}
                                                    className={cn(
                                                        "p-1.5 flex items-center justify-center text-lg rounded-[5px] transition-all duration-200 cursor-pointer",
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
                            </div>

                            {/* Undo/Redo */}
                            {role === 'teacher' && (
                                <div className="flex items-center gap-0.5 h-8 sm:gap-1 px-1 sm:px-2 border-r border-border/50 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => document.dispatchEvent(new CustomEvent("undo-trigger"))}
                                        className="p-1.5 aspect-square h-8 border rounded-[5px] border-primary/40 hover:bg-accent text-muted-foreground hover:text-foreground transition-all duration-300 shadow-sm shrink-0 cursor-pointer"
                                        title="Undo (Ctrl+Z)"
                                    >
                                        <RotateCcw size={18} className="mx-auto" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => document.dispatchEvent(new CustomEvent("redo-trigger"))}
                                        className="p-1.5 aspect-square h-8 border rounded-[5px] border-primary/40 hover:bg-accent text-muted-foreground hover:text-foreground transition-all duration-300 shadow-sm shrink-0 cursor-pointer"
                                        title="Redo (Ctrl+Shift+Z)"
                                    >
                                        <RotateCw size={18} className="mx-auto" />
                                    </button>
                                </div>
                            )}

                            {/* Upload Buttons */}
                            {role === "teacher" && (
                                <div className="flex justify-center items-center w-fit h-8 gap-2 shrink-0 px-2 border-r border-border">
                                    <input type="file" ref={boardFileInputRef} onChange={handleBoardFileSelect} className="hidden" accept="image/*" />
                                    <button
                                        type="button"
                                        onClick={() => tool === "image-stamp" ? setTool("pen:pen") : boardFileInputRef.current?.click()}
                                        className={cn(
                                            "p-1.5 transition-all duration-300 border rounded-[5px] border-primary/40 shadow-sm cursor-pointer",
                                            tool === "image-stamp"
                                                ? "bg-primary text-primary-foreground shadow-lg"
                                                : "text-muted-foreground hover:text-foreground hover:bg-accent"
                                        )}
                                        title={tool === "image-stamp" ? "Exit Image Stamp" : "Add Image to Board"}
                                    >
                                        <ImagePlus size={18} />
                                    </button>

                                    <input type="file" ref={pdfFileInputRef} onChange={handlePdfFileSelect} className="hidden" accept="application/pdf" />
                                    <button
                                        type="button"
                                        onClick={() => pdfFileInputRef.current?.click()}
                                        className="p-1.5 border rounded-[5px] border-primary/40 transition-all duration-300 text-muted-foreground hover:text-foreground hover:bg-accent shadow-sm cursor-pointer"
                                        title="Upload PDF to Board"
                                    >
                                        <FileUp size={18} />
                                    </button>
                                </div>
                            )}

                            {/* Canvas Color Picker */}
                            {role === 'teacher' && (
                                <div className="flex items-center gap-2 px-2 border-r border-border/50 h-8">
                                    <div ref={bgButtonRef} className="h-8">
                                        <button
                                            type="button"
                                            onClick={toggleBgPicker}
                                            className={cn(
                                                "flex items-center gap-1.5 p-1.5 rounded-[5px] border h-8 transition-all duration-300 shadow-sm cursor-pointer",
                                                showBgPicker ? "ring-2 ring-primary ring-offset-1 border-primary" : "border-primary/40"
                                            )}
                                            style={{
                                                backgroundColor: boardColor,
                                                color: getContrastColor(boardColor)
                                            }}
                                            title="Custom Board Color"
                                        >
                                            <Palette size={18} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {showBgPicker && bgPickerPos && typeof document !== 'undefined' && ReactDOM.createPortal(
                                <div
                                    className="fixed z-9999 animate-in fade-in zoom-in-95 duration-200"
                                    style={{ top: bgPickerPos.top, left: bgPickerPos.left }}
                                >
                                    <div className="p-1.5 bg-sidebar border border-border rounded-[5px] shadow-2xl">
                                        <DemoBackgroundPicker
                                            color={boardColor}
                                            onChange={setBoardColor}
                                        />
                                    </div>
                                </div>,
                                document.body
                            )}

                            {/* Synced / Free View Toggle */}
                            {role === "teacher" && (
                                <div className="flex items-center gap-1.5 shrink-0 px-2 border-r border-border/50 h-8">
                                    <button
                                        type="button"
                                        onClick={() => onToggleViewLocked?.(!isViewLocked)}
                                        className={cn(
                                            "flex items-center gap-1.5 p-1.5 h-8 rounded-[5px] border transition-all duration-300 shadow-sm cursor-pointer",
                                            isViewLocked
                                                ? "bg-blue-500/10 border-blue-500/30 text-blue-500 hover:bg-blue-500/20"
                                                : "bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20"
                                        )}
                                        title={isViewLocked ? "Students' view is frozen to yours" : "Students can scroll independently"}
                                    >
                                        {isViewLocked ? <LocateFixed size={18} /> : <Locate size={18} />}
                                        <span className="hidden xl:block text-[10px] font-black uppercase tracking-wider">{isViewLocked ? "Synced" : "Free"} View</span>
                                    </button>
                                </div>
                            )}

                            {/* Screen Recorder Button */}
                            {allowRecording !== false && (
                                <button
                                    type="button"
                                    onClick={handleRecorderClick}
                                    className="flex items-center gap-1.5 px-2.5 h-8 rounded-[5px] border border-primary/40 text-muted-foreground hover:text-red-400 hover:bg-accent transition-all duration-300 shadow-sm shrink-0 cursor-pointer"
                                    title="Screen Recording (Demo Mode)"
                                >
                                    <Video size={16} className="text-red-500" />
                                    <span className="text-[11px] font-semibold">Record</span>
                                </button>
                            )}

                            {/* Fullscreen Toggle */}
                            <div className="flex items-center shrink-0 px-1 h-8">
                                <button
                                    type="button"
                                    onClick={onToggleFullscreen}
                                    className={cn(
                                        "flex items-center gap-1.5 p-1.5 h-8 rounded-[5px] border transition-all duration-300 shadow-sm cursor-pointer",
                                        isFullscreen
                                            ? "bg-violet-500/10 border-violet-500/30 text-violet-500 hover:bg-violet-500/20"
                                            : "border-primary/40 text-muted-foreground hover:text-foreground hover:bg-accent"
                                    )}
                                    title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Mode"}
                                >
                                    {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                                </button>
                            </div>
                        </>
                    )}
                </nav>

                {/* Scroll Indicator */}
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

            {/* Fixed Action Cluster (Right) */}
            <div className="flex items-center px-1 h-8 border-r border-border/50 bg-sidebar shrink-0 z-40 gap-1 sm:gap-2">
                {role === "student" && drawingEnabled === false && (
                    <div className="text-[9px] sm:text-[10px] font-bold whitespace-nowrap px-1.5 sm:px-2 py-0.5 sm:py-1 bg-red-500/10 text-red-500 rounded-[5px] border border-red-500/20 shadow-sm">
                        No Canvas Access
                    </div>
                )}
                {role === "teacher" && (
                    <button
                        type="button"
                        onClick={async () => {
                            const { isConfirmed } = await Swal.fire({
                                title: "Exit Demo Session?",
                                text: "You will be redirected back to the TutorArc website.",
                                icon: "question",
                                showCancelButton: true,
                                confirmButtonColor: "#f97316",
                                cancelButtonColor: "#6b7280",
                                confirmButtonText: "Exit Demo",
                                cancelButtonText: "Stay in Demo",
                            })
                            if (isConfirmed && onEndSession) onEndSession(sessionId)
                        }}
                        className="flex items-center justify-center py-1 px-1.5 sm:px-2 h-7 sm:h-8 text-[10px] sm:text-[12px] font-medium bg-orange-500 hover:bg-orange-600 text-white rounded-[5px] transition-all duration-300 shadow-md sm:shadow-lg shadow-orange-500/20 active:scale-95 group cursor-pointer shrink-0"
                        title="Exit Demo Class"
                    >
                        End Class
                    </button>
                )}
            </div>

            {/* Session Timer */}
            <div className="flex items-center px-1.5 sm:px-2 h-8 border-r border-border/50 bg-sidebar shrink-0 z-40">
                <span className="font-mono text-[11px] sm:text-xs font-bold text-emerald-500 tracking-wider">
                    {formatTimer(secondsElapsed)}
                </span>
            </div>

            {/* User Identity & Theme Toggle */}
            <div className="flex items-center gap-1 sm:gap-2 px-1.5 sm:px-3 h-8 border-l border-border/50 bg-sidebar shrink-0 z-40 shadow-[-8px_0_12px_rgba(0,0,0,0.05)]">
                <span className="hidden md:flex text-[10px] sm:text-xs font-black flex-col tracking-widest text-muted-background">
                    {userName} <span className="text-muted-foreground text-[0.7em]">{role === "teacher" ? "(Teacher)" : "(Student)"}</span>
                </span>
                <div className="h-8 flex items-center">
                    <ThemeToggle cn="w-7 h-7 sm:w-8 sm:h-8 rounded-[5px]" iconSize={14} />
                </div>
            </div>
        </div>
    )
}
