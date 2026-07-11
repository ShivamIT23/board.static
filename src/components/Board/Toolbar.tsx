"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import ReactDOM from "react-dom"
import {
    Highlighter, Pen, Eraser, Trash2, Palette,
    Minus, Type
} from "lucide-react"

import { cn, getContrastColor } from "@/lib/utils"
import ColorPicker from "./ColorPicker"
import Swal from "sweetalert2"




interface ToolbarProps {
    tool: string
    setTool: (tool: string) => void
    role: "teacher" | "student"
    color: string
    setColor: (color: string) => void
    brushSize: number
    setBrushSize: (size: number) => void
    onClearCanvas?: () => void
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
    onClearCanvas,
    isClassEnded
}: ToolbarProps) {

    // const { socket } = useSocket()
    const [showColorPicker, setShowColorPicker] = useState(false)
    const [colorPickerPos, setColorPickerPos] = useState<{ top: number; left: number } | null>(null)




    const brushSizes = [2, 4, 8, 12, 16, 20]
    const scrollAreaRef = useRef<HTMLDivElement>(null)
    const colorButtonRef = useRef<HTMLButtonElement>(null)
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
                    <div className="flex flex-col items-center space-y-2 w-full h-fit">
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
                                        className="p-1.5 w-[30px] h-[30px] border rounded-[5px] border-primary/40 flex items-center justify-center transition-all duration-300 cursor-pointer shadow-sm"
                                        style={{
                                            backgroundColor: color,
                                            color: getContrastColor(color)
                                        }}
                                    >
                                        <Palette size={16} />
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
                                                    <ColorPicker color={color} onChange={(hex) => setColor(hex)} onSelect={() => setShowColorPicker(false)} />
                                                </div>
                                            </div>
                                        </>,
                                        document.body
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Pen Tool */}
                        <button
                            type="button"
                            onClick={() => setTool("pen:pen")}
                            className={cn(
                                "p-1.5 w-[30px] h-[30px] border rounded-[5px] border-primary/40 transition-all duration-300 shadow-sm flex items-center justify-center",
                                tool === "pen:pen" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                            )}
                            title="Pen"
                        >
                            <Pen size={16} />
                        </button>

                        {/* Highlighter Tool */}
                        <button
                            type="button"
                            onClick={() => setTool("pen:highlighter")}
                            className={cn(
                                "p-1.5 w-[30px] h-[30px] border rounded-[5px] border-primary/40 transition-all duration-300 shadow-sm flex items-center justify-center",
                                tool === "pen:highlighter" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                            )}
                            title="Highlighter"
                        >
                            <Highlighter size={16} />
                        </button>

                        {/* Line Tool */}
                        <button
                            type="button"
                            onClick={() => setTool("line")}
                            className={cn(
                                "p-1.5 w-[30px] h-[30px] border rounded-[5px] border-primary/40 transition-all duration-300 shadow-sm flex items-center justify-center",
                                tool === "line" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                            )}
                            title="Line"
                        >
                            <Minus size={16} />
                        </button>
                        
                        {/* Brush Size */}
                        <div className="flex flex-col w-full gap-2 items-center mb-3">
                            <span className="text-[6px] font-black uppercase tracking-widest text-muted-foreground text-center flex flex-wrap justify-center items-center gap-0.5 p-0.5">Size <span className="text-[8px] font-bold text-muted-foreground">({brushSize})</span></span>
                            <div className="flex flex-col w-full items-center bg-muted/50 rounded-[3px] gap-2">
                                {brushSizes.map((size) => (
                                    <button
                                        key={size}
                                        type="button"
                                        onClick={() => setBrushSize(size)}
                                        className={cn("flex items-center justify-center relative group border rounded-[5px] border-primary/40 transition-all duration-300 p-1.5 py-0.5 shadow-sm w-[30px] h-[20px]", brushSize === size ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground hover:text-foreground")}
                                        title={`Size ${size}`}
                                    >
                                        <div className="w-full rounded-[2px] bg-current transition-all" style={{ height: `${Math.max(1.5, size / 2.5)}px` }} />
                                    </button>
                                ))}
                            </div>
                        </div>
                        {/* Object Eraser */}
                        <button
                            type="button"
                            onClick={() => setTool("eraser")}
                            className={cn(
                                "p-1.5 w-[30px] h-[30px] border rounded-[5px] border-primary/40 transition-all duration-300 shadow-sm flex items-center justify-center",
                                tool === "eraser" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                            )}
                            title="Object Eraser"
                        >
                            <Eraser size={16} />
                        </button>

                        {/* Selective Eraser */}
                        <button
                            type="button"
                            onClick={() => setTool("partial-eraser")}
                            className={cn(
                                "p-1.5 w-[30px] h-[30px] border rounded-[5px] border-primary/40 transition-all duration-300 shadow-sm flex items-center justify-center",
                                tool === "partial-eraser" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                            )}
                            title="Selective Eraser"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
                                <path d="M22 21H7" />
                                <path d="m5 11 9 9" />
                            </svg>
                        </button>
                        <button type="button" onClick={() => setTool("text")} className={cn("p-1.5 w-[30px] h-[30px] border rounded-[5px] border-primary/40 transition-all duration-300 shadow-sm flex items-center justify-center", tool === "text" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-accent")} title="Text Tool">
                            <Type size={18} />
                        </button>

                        <button type="button" onClick={() => setTool("laser")} className={cn("p-1.5 w-[30px] h-[30px] border rounded-[5px] border-primary/40 transition-all duration-300 shadow-sm flex items-center justify-center", tool === "laser" ? "bg-red-500 text-white shadow-lg shadow-red-500/30" : "text-muted-foreground hover:text-foreground hover:bg-accent")} title="Laser Pointer">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.8" />
                                <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" opacity="0.5" />
                            </svg>
                        </button>
                    </div>

                    {/* Clear Canvas - Teacher or Post-Session */}
                    {(role === "teacher" || isClassEnded ) && onClearCanvas && (
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
                                className="p-1.5 w-[30px] h-[30px] border rounded-[5px] border-primary/40 transition-all duration-300 text-red-500 hover:text-red-400 hover:bg-red-500/10 shadow-sm flex items-center justify-center"
                                title="Clear Canvas (All Users)"
                            >
                                <Trash2 size={18} />
                            </button>
                        </>
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
