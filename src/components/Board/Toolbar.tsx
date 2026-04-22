"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import ReactDOM from "react-dom"
import {
    Highlighter, Pen, Eraser, Trash2, Palette,
    Square, Circle, Minus, ArrowUpRight, Type, Triangle, Diamond, Star, Ellipse, Pentagon, TriangleRight, RectangleHorizontal, FileUp, ImagePlus
} from "lucide-react"
import { cn, getContrastColor } from "@/lib/utils"
import ColorPicker from "./ColorPicker"
import Swal from "sweetalert2"
import { toast } from "sonner"
import { useSocket } from "../providers/socket-provider"

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



const ERASER_TOOLS = [
    { id: "eraser", label: "Object Eraser", icon: Eraser },
    { id: "partial-eraser", label: "Selective Eraser", icon: Eraser },
] as const


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
    onClearCanvas?: () => void
    onPdfUpload?: (file: File) => void
    isClassEnded?: boolean
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
    onClearCanvas,
    onPdfUpload,
    isClassEnded
}: ToolbarProps) {

    const { socket } = useSocket()
    const [showColorPicker, setShowColorPicker] = useState(false)
    const [showFillPicker, setShowFillPicker] = useState(false)
    const [showPenDropdown, setShowPenDropdown] = useState(false)
    const [showEraserDropdown, setShowEraserDropdown] = useState(false)

    const [colorPickerPos, setColorPickerPos] = useState<{ top: number; left: number } | null>(null)
    const [fillPickerPos, setFillPickerPos] = useState<{ top: number; left: number } | null>(null)
    const [penDropdownPos, setPenDropdownPos] = useState<{ top: number; left: number } | null>(null)
    const [eraserDropdownPos, setEraserDropdownPos] = useState<{ top: number; left: number } | null>(null)

    const [selectedPen, setSelectedPen] = useState<typeof PEN_TOOLS[number]["id"]>("pen")


    const boardFileInputRef = useRef<HTMLInputElement>(null)
    const pdfFileInputRef = useRef<HTMLInputElement>(null)


    const brushSizes = [2, 4, 8, 12, 16, 20]
    const scrollAreaRef = useRef<HTMLDivElement>(null)
    const colorButtonRef = useRef<HTMLButtonElement>(null)
    const fillButtonRef = useRef<HTMLButtonElement>(null)
    const eraserButtonRef = useRef<HTMLDivElement>(null)

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
    const isPenTool = tool.startsWith("pen:")

    const ActivePenIcon = PEN_TOOLS.find(p => p.id === selectedPen)?.icon || Pen
    const ActiveEraserIcon = ERASER_TOOLS.find(e => e.id === tool || (e.id === "eraser" && tool === "partial-eraser"))?.icon || Eraser



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
                    className="flex flex-col no-scrollbar overflow-y-auto h-full w-full items-center py-3 gap-2 px-1"
                >
                    {/* Tools Section */}
                    <div className="flex flex-col space-y-2 w-full h-fit">
                        <span className="text-[7px] font-black uppercase tracking-widest text-muted-foreground mb-1 text-center">Tools</span>

                        {/* Color Section */}
                        <div className="flex flex-col gap-1 items-center">
                            <div className="flex flex-col gap-2">

                                {/* Custom Color Picker Popover */}
                                <div className="relative mt-1 flex justify-center">
                                    <button
                                        ref={colorButtonRef}
                                        type="button"
                                        onClick={() => toggleColorPicker()}
                                        className="w-10 h-11 border rounded-[5px] border-primary/40 flex items-center justify-center transition-colors cursor-pointer shadow-sm"
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

                        {/* Pen tools - pen, highlighter */}
                        <div className="relative group border rounded-[5px] border-primary/40" ref={penButtonRef}>
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
                        {/* Brush Size */}
                        <div className="flex flex-col w-full gap-2 items-center mb-2">
                            <span className="text-[6px] font-black uppercase tracking-widest text-muted-foreground text-center flex flex-wrap justify-center items-center gap-0.5 p-0.5">Size <span className="text-[8px] font-bold text-muted-foreground">({brushSize})</span></span>
                            <div className="flex flex-col w-full items-center bg-muted/50 rounded-[3px] gap-2">
                                {brushSizes.map((size) => (
                                    <button
                                        key={size}
                                        type="button"
                                        onClick={() => setBrushSize(size)}
                                        className={cn("w-full flex items-center justify-center relative group border rounded-[2px] border-primary/40 transition-all py-1.5", brushSize === size ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-accent text-muted-foreground hover:text-foreground")}
                                        title={`Size ${size}`}
                                    >
                                        <div className="w-7 rounded-[2px] bg-current transition-all" style={{ height: `${Math.max(1.5, size / 2.5)}px` }} />
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="relative group border rounded-[5px] border-primary/40" ref={eraserButtonRef}>
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
                        <button type="button" onClick={() => setTool("text")} className={cn("p-2 border rounded-[5px] border-primary/40 transition-all duration-300", tool === "text" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-accent")} title="Text Tool">
                            <Type size={20} className="mx-auto" />
                        </button>

                        <button type="button" onClick={() => setTool("laser")} className={cn("p-2 border rounded-[5px] border-primary/40 w-full  transition-all duration-300", tool === "laser" ? "bg-red-500 text-white shadow-lg shadow-red-500/30" : "text-muted-foreground hover:text-foreground hover:bg-accent")} title="Laser Pointer">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="mx-auto" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.8" />
                                <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" opacity="0.5" />
                            </svg>
                        </button>
                    </div>

                    {/* Clear Canvas - Teacher or Post-Session */}
                    {(role === "teacher" /* || isClassEnded */) && onClearCanvas && (
                        <>
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
                                className="p-2  border rounded-[5px] border-primary/40 w-full transition-all duration-300 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                                title="Clear Canvas (All Users)"
                            >
                                <Trash2 size={20} className="mx-auto" />
                            </button>
                        </>
                    )}

                    {/* Shape Fill & Border Colors — only when a shape tool is active */}
                    {(isShapeTool) && (
                        <div className="flex flex-col gap-2 py-2 border-t border-border w-full items-center mb-2 animate-in slide-in-from-bottom-2 duration-300">
                            {/* Fill Color */}
                            <div className="flex flex-col gap-2 items-center">
                                <span className="text-[7px] font-black uppercase tracking-widest text-muted-foreground text-center">Fill</span>
                                <div className="grid grid-cols-2 gap-1">
                                    <button
                                        onClick={() => setShapeFillColor("transparent")}
                                        className={cn(
                                            "w-3.5 h-3.5 rounded-sm border transition-all duration-200",
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
                                            "w-3.5 h-3.5 rounded-sm border border-border flex items-center justify-center transition-colors shadow-sm",
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
            {/* Upload Buttons */}
            {role === "teacher" && (
                <div className="flex flex-col items-center w-full gap-2 shrink-0 py-2 border-t border-border mt-auto">
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
        </nav>
    )
}
