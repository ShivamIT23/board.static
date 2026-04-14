"use client"

import React, { useRef } from "react"
import {
    Pencil, Eraser, MousePointer2, Trash2, Palette, ImagePlus,
    Square, Circle, Minus, ArrowUpRight, FileUp, Type
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useSocket } from "../providers/socket-provider"
import { toast } from "sonner"

interface ToolbarProps {
    tool: string
    setTool: (tool: string) => void
    role: "teacher" | "student"
    color: string
    setColor: (color: string) => void
    brushSize: number
    setBrushSize: (size: number) => void
    onClearCanvas?: () => void
    onPdfUpload?: (file: File) => void
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
    onPdfUpload
}: ToolbarProps) {
    const { socket } = useSocket()
    const boardFileInputRef = useRef<HTMLInputElement>(null)
    const pdfFileInputRef = useRef<HTMLInputElement>(null)
    const penColors = ["#FFFFFF", "#FEF08A", "#86EFAC", "#93C5FD", "#FCA5A5", "#F0ABFC"]
    const brushSizes = [2, 4, 8, 12, 16, 20]

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
        <nav className="w-12 flex flex-col items-center py-3 bg-sidebar border-r border-border gap-2 z-30 shrink-0 h-full max-h-screen overflow-y-auto no-scrollbar">
            {/* Tools Section */}
            <div className="flex flex-col gap-1.5">
                <span className="text-[7px] font-black uppercase tracking-widest text-muted-foreground mb-1 text-center">Tools</span>
                <button type="button" onClick={() => setTool("select")} className={cn("p-2 rounded-[5px] transition-all duration-300", tool === "select" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-accent")} title="Selection Tool">
                    <MousePointer2 size={18} />
                </button>
                <button type="button" onClick={() => setTool("pencil")} className={cn("p-2 rounded-[5px] transition-all duration-300", tool === "pencil" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-accent")} title="Pencil Tool">
                    <Pencil size={18} />
                </button>
                <button type="button" onClick={() => setTool("eraser")} className={cn("p-2 rounded-[5px] transition-all duration-300", tool === "eraser" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-accent")} title="Eraser Tool">
                    <Eraser size={18} />
                </button>
                <div className="w-8 h-px bg-border my-1 mx-auto" />
                <button onClick={() => setTool("rectangle")} className={cn("p-2 rounded-[5px] transition-all duration-300", tool === "rectangle" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-accent")} title="Rectangle Tool">
                    <Square size={18} />
                </button>
                <button onClick={() => setTool("circle")} className={cn("p-2 rounded-[5px] transition-all duration-300", tool === "circle" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-accent")} title="Circle Tool">
                    <Circle size={18} />
                </button>
                <button onClick={() => setTool("line")} className={cn("p-2 rounded-[5px] transition-all duration-300", tool === "line" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-accent")} title="Line Tool">
                    <Minus size={18} />
                </button>
                <button onClick={() => setTool("arrow")} className={cn("p-2 rounded-[5px] transition-all duration-300", tool === "arrow" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-accent")} title="Arrow Tool">
                    <ArrowUpRight size={18} />
                </button>
                <button type="button" onClick={() => setTool("text")} className={cn("p-2 rounded-[5px] transition-all duration-300", tool === "text" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-accent")} title="Text Tool">
                    <Type size={18} />
                </button>
            </div>

            {/* Clear Canvas - Teacher Only */}
            {role === "teacher" && onClearCanvas && (
                <>
                    <div className="w-10 h-px bg-border -mt-1" />
                    <button
                        type="button"
                        onClick={() => { if (confirm("Clear the canvas for all users?")) onClearCanvas() }}
                        className="p-2 rounded-[5px] transition-all duration-300 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                        title="Clear Canvas (All Users)"
                    >
                        <Trash2 size={18} />
                    </button>
                </>
            )}

            {/* <div className="w-10 h-px bg-border" /> */}

            {/* Color Section */}
            {/* <div className="flex flex-col gap-3 items-center">
                <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground text-center">Ink</span>
                <div className="flex flex-col gap-2">
                    {penColors.map((c) => (
                        <button
                            key={c}
                            onClick={() => setColor(c)}
                            className={cn("w-6 h-3 rounded-full border transition-all duration-200", color === c ? "border-white scale-110" : "border-transparent hover:scale-105")}
                            style={{ backgroundColor: c }}
                        />
                    ))}
                    <div className="relative mt-1">
                        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-6 h-6 rounded-full overflow-hidden cursor-pointer opacity-0 absolute inset-0" />
                        <div className="w-6 h-6 rounded-[2px] border-2 border-dashed border-muted-foreground flex items-center justify-center text-muted-foreground">
                            <Palette size={12} />
                        </div>
                    </div>
                </div>
            </div> */}

            <div className="w-10 h-px bg-border" />

            {/* Brush Size */}
            <div className="flex flex-col gap-2 items-center mb-4">
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

            {/* Add Image / PDF to Board - Teacher Only */}
            {role === "teacher" && (
                <>
                    <div className="w-10 h-px bg-border" />
                    <input type="file" ref={boardFileInputRef} onChange={handleBoardFileSelect} className="hidden" accept="image/*" />
                    <button
                        type="button"
                        onClick={() => boardFileInputRef.current?.click()}
                        className="p-2 rounded-[4px] transition-all duration-300 text-muted-foreground hover:text-foreground hover:bg-accent"
                        title="Add Image to Board"
                    >
                        <ImagePlus size={18} />
                    </button>
                    <input type="file" ref={pdfFileInputRef} onChange={handlePdfFileSelect} className="hidden" accept="application/pdf" />
                    <button
                        type="button"
                        onClick={() => pdfFileInputRef.current?.click()}
                        className="p-2 rounded-[4px] transition-all duration-300 text-muted-foreground hover:text-foreground hover:bg-accent"
                        title="Upload PDF to Board"
                    >
                        <FileUp size={18} />
                    </button>
                </>
            )}
        </nav>
    )
}