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
import Image from "next/image"
import logo from "../../../public/logo.png"



interface BoardTopBarProps {
    tool: string
    setTool: (tool: string) => void
    isOpen: boolean
    duration: number
    boardColor: string
    setBoardColor: (color: string) => void
    role: "teacher" | "student"
    sessionId: string
    isViewLocked?: boolean
    userName: string;
    onToggleViewLocked?: (enabled: boolean) => void
    drawingEnabled?: boolean
    onPdfUpload?: (file: File) => void
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

type ShapeToolId = typeof SHAPE_TOOLS[number]["id"]
type GraphToolId = typeof GRAPH_TOOLS[number]["id"]

export default function BoardTopBar({
    tool,
    setTool,
    isOpen,
    duration,
    boardColor,
    setBoardColor,
    role,
    sessionId,
    isViewLocked = true,
    userName,
    onToggleViewLocked,
    drawingEnabled,
    onPdfUpload,
}: BoardTopBarProps) {

    const { socket } = useSocket()
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
    const [showMathDropdown, setShowMathDropdown] = useState(false)
    const [showEmojiDropdown, setShowEmojiDropdown] = useState(false)
    const [showShapeDropdown, setShowShapeDropdown] = useState(false)
    const [showGraphDropdown, setShowGraphDropdown] = useState(false)

    const [shapeDropdownPos, setShapeDropdownPos] = useState<{ top: number; left: number } | null>(null)
    const [graphDropdownPos, setGraphDropdownPos] = useState<{ top: number; left: number } | null>(null)
    const [mathDropdownPos, setMathDropdownPos] = useState<{ top: number; left: number } | null>(null)
    const [emojiDropdownPos, setEmojiDropdownPos] = useState<{ top: number; left: number } | null>(null)

    const ActiveShapeIcon = SHAPE_TOOLS.find(s => s.id === selectedShape)?.icon || Square
    const ActiveGraphIcon = GRAPH_TOOLS.find(g => g.id === selectedGraph)?.icon || Activity


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
                top: rect.bottom + 8,
                left: rect.left + rect.width / 2,
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
        if (!file || !socket) return

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
            socket.emit("board_file_add", {
                payload: {
                    id: crypto.randomUUID(),
                    url: reader.result as string,
                    name: file.name,
                    position: { x: 0.3, y: 0.3 },
                    scale: 0.25,
                }
            })
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



    return (
        <div className="relative flex w-full items-center min-h-[48px] bg-sidebar backdrop-blur-xl border-b border-border/50 shadow-md animate-in fade-in slide-in-from-top-4 duration-500 overflow-hidden">
            {/* Fixed Left Section */}
            <div className="flex items-center px-1 sm:px-2 h-8 border-r border-border/50 bg-sidebar shrink-0 z-40">
                <Image alt="Board" src={logo} height={20} width={50} />
            </div>

            {/* Scrollable Area */}
            <div className="relative flex-1 min-w-0 h-full overflow-hidden group/topbar">
                <nav
                    ref={scrollBarRef}
                    onScroll={checkScroll}
                    className="flex items-center h-full gap-2 sm:gap-3 px-3 sm:px-4 py-2 w-full overflow-x-auto no-scrollbar scroll-smooth"
                >


                    <button type="button" onClick={() => setTool("select")} className={cn("p-1.5 w-8 h-8 border rounded-[5px] border-primary/40 transition-all duration-300 shadow-sm flex items-center justify-center", tool === "select" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-accent")} title="Selection Tool">
                        <MousePointer2 size={18} />
                    </button>

                    {/* Shapes — single button with horizontal dropdown */}
                    <div className="relative group border rounded-[5px] border-primary/40 h-8 w-8" ref={shapeButtonRef}>
                        <button
                            type="button"
                            onClick={() => toggleShapeDropdown()}
                            className={cn(
                                "w-full h-full flex items-center justify-center rounded-[5px] transition-all duration-300 border border-transparent",
                                isShapeTool ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-muted/30 hover:bg-accent hover:border-border/50"
                            )}
                            title={`Choose shape (Current: ${selectedShape})`}
                        >
                            <ActiveShapeIcon size={18} />
                        </button>

                        {showShapeDropdown && shapeDropdownPos && ReactDOM.createPortal(
                            <>
                                <div className="fixed inset-0 z-9998" onClick={() => setShowShapeDropdown(false)} />
                                <div
                                    className="fixed z-9999 flex flex-col flex-wrap items-center gap-1 bg-sidebar border border-border rounded-[3px] shadow-xl animate-in fade-in slide-in-from-top-2 duration-200 h-[73px]"
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
                                                    "p-1.5 rounded-[5px] transition-all duration-200",
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
                    <div className="relative group border rounded-[5px] border-primary/40 h-8 w-8" ref={graphButtonRef}>
                        <button
                            type="button"
                            onClick={() => toggleGraphDropdown()}
                            className={cn(
                                "w-full h-full flex items-center justify-center rounded-[5px] transition-all duration-300 border border-transparent",
                                isGraphTool ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-muted/30 hover:bg-accent hover:border-border/50"
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
                                                    "p-1.5 rounded-[5px] flex items-center gap-2 transition-all duration-200",
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
                    <div className="relative group border rounded-[5px] border-primary/40 h-8 w-8" ref={mathButtonRef}>
                        <button
                            type="button"
                            onClick={() => toggleMathDropdown()}
                            className={cn(
                                "w-full h-full flex items-center justify-center rounded-[5px] transition-all duration-300 border border-transparent",
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
                                                "p-1.5 flex items-center justify-center text-sm font-thin rounded-[5px] transition-all duration-200",
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


                    <div className="relative group border rounded-[5px] border-primary/40 h-8 w-8" ref={emojiButtonRef}>
                        <button
                            type="button"
                            onClick={() => toggleEmojiDropdown()}
                            className={cn(
                                "w-full h-full flex items-center justify-center rounded-[5px] transition-all duration-300 border border-transparent",
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
                                                "p-1.5 flex items-center justify-center text-lg rounded-[5px] transition-all duration-200",
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
                    {(role === 'teacher') && (
                        <div className="flex items-center gap-0.5 h-8 sm:gap-1 px-1 sm:px-2 border-r border-border/50 shrink-0">
                            <button
                                type="button"
                                onClick={() => document.dispatchEvent(new CustomEvent("undo-trigger"))}
                                className="p-1.5 aspect-square h-8 border rounded-[5px] border-primary/40 hover:bg-accent text-muted-foreground hover:text-foreground transition-all duration-300 shadow-sm shrink-0"
                                title="Undo (Ctrl+Z)"
                            >
                                <RotateCcw size={18} className="mx-auto" />
                            </button>
                            <button
                                type="button"
                                onClick={() => document.dispatchEvent(new CustomEvent("redo-trigger"))}
                                className="p-1.5 aspect-square h-8 border rounded-[5px] border-primary/40 hover:bg-accent text-muted-foreground hover:text-foreground transition-all duration-300 shadow-sm shrink-0"
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
                                onClick={() => boardFileInputRef.current?.click()}
                                className="p-1.5 transition-all duration-300 text-muted-foreground hover:text-foreground hover:bg-accent border rounded-[5px] border-primary/40 shadow-sm"
                                title="Add Image to Board"
                            >
                                <ImagePlus size={18} />
                            </button>

                            <input type="file" ref={pdfFileInputRef} onChange={handlePdfFileSelect} className="hidden" accept="application/pdf" />
                            <button
                                type="button"
                                onClick={() => pdfFileInputRef.current?.click()}
                                className="p-1.5 border rounded-[5px] border-primary/40 transition-all duration-300 text-muted-foreground hover:text-foreground hover:bg-accent shadow-sm"
                                title="Upload PDF to Board"
                            >
                                <FileUp size={18} />
                            </button>
                        </div>
                    )}

                    {(role === 'teacher') && (
                        <div className="flex items-center gap-2 px-2 border-r border-border/50 h-8">
                            <span className="block lg:hidden text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 leading-none">D</span>
                            <div ref={bgButtonRef} className="h-8">
                                <button
                                    type="button"
                                    onClick={toggleBgPicker}
                                    className={cn(
                                        "flex items-center gap-1.5 p-1.5 rounded-[5px] border h-8 transition-all duration-300 shadow-sm",
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
                                <BackgroundPicker
                                    color={boardColor}
                                    onChange={setBoardColor}
                                />
                            </div>
                        </div>,
                        document.body
                    )}

                    {/* Board Controls Toggles */}
                    {(role === "teacher") && (
                        <div className="flex items-center gap-1.5 shrink-0 px-2 border-r border-border/50 h-8">
                            <button
                                type="button"
                                onClick={() => onToggleViewLocked?.(!isViewLocked)}
                                className={cn(
                                    "flex items-center gap-1.5 p-1.5 h-8 rounded-[5px] border transition-all duration-300 shadow-sm",
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
            <div className="flex items-center px-1 h-8 border-r border-border/50 bg-sidebar shrink-0 z-40 gap-2">
                {role === "student" && drawingEnabled === false && (
                    <div className="text-[10px] font-bold whitespace-nowrap px-2 py-1 bg-red-500/10 text-red-500 rounded-[5px] border border-red-500/20 shadow-sm">
                        No Canvas Access
                    </div>
                )}
                {/* {role === "teacher" && (
                    <button
                        type="button"
                        onClick={async () => {
                            const { isConfirmed } = await Swal.fire({
                                title: "End Session?",
                                text: "Are you sure you want to end this session for everyone?",
                                icon: "warning",
                                showCancelButton: true,
                                confirmButtonColor: "#f97316",
                                cancelButtonColor: "#6b7280",
                                confirmButtonText: "Yes, end session"
                            })
                            if (isConfirmed && onEndSession) onEndSession(sessionId)
                        }}
                        className="flex items-center justify-center py-1 px-2 h-8 w-fit text-[12px] font-medium bg-orange-500 hover:bg-orange-600 text-white rounded-[5px] transition-all duration-300 shadow-lg shadow-orange-500/20 active:scale-95 group"
                        title="End Session for everyone"
                    >
                        End Class
                    </button>
                )} */}
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
                    className="flex items-center justify-center py-1 px-2 h-8 w-fit text-[12px] font-medium bg-red-500 dark:bg-red-500/80 hover:bg-red-600 dark:hover:bg-red-500 text-white rounded-[5px] transition-all duration-300 shadow-lg shadow-red-500/20 active:scale-95 group"
                    title="Leave Session"
                >
                    Leave Class
                </button>
            </div>
            <div className="flex items-center px-1 h-8 border-r border-border/50 bg-sidebar shrink-0 z-40">
                <SessionTimer initialDuration={duration} role={role} sessionId={sessionId} />
            </div>
            <div className="flex items-center gap-2 px-3 h-8 border-l border-border/50 bg-sidebar shrink-0 z-40 shadow-[-8px_0_12px_rgba(0,0,0,0.05)]">
                {/* <div className="h-[41px] flex items-center justify-between px-3 sm:px-6 border-b border-border shrink-0"> */}
                {/* </div> */}
                <span className="text-[10px] sm:text-xs font-black flex flex-col tracking-widest text-muted-background">{userName} <span className=" text-muted-foreground text-[0.7em]">{role == "teacher" ? "(Teacher)" : "(Student)"}</span></span>
                <div className="h-8 flex items-center">
                    <ThemeToggle cn="w-8 h-8 rounded-[5px]" iconSize={14} />
                </div>
            </div>
        </div>
    )
}
