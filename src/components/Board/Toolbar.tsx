"use client"

import React, { useRef } from "react"
import {
    Pencil, Eraser, MousePointer2, Trash2, Palette, ImagePlus
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
    boardColor: string
    setBoardColor: (color: string) => void
    brushSize: number
    setBrushSize: (size: number) => void
    onClearCanvas?: () => void
}

export default function Toolbar({
    tool,
    setTool,
    role,
    // color,
    // setColor,
    // boardColor,
    // setBoardColor,
    brushSize,
    setBrushSize,
    onClearCanvas
}: ToolbarProps) {
    const { socket } = useSocket()
    const boardFileInputRef = useRef<HTMLInputElement>(null)
    // const penColors = ["#FFFFFF", "#FEF08A", "#86EFAC", "#93C5FD", "#FCA5A5", "#F0ABFC"]
    // const backgroundColors = ["#18181b", "#000000", "#1e1b4b", "#064e3b", "#450a0a"]

    // Compact array of brush sizes
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
                    position: { x: 0.3, y: 0.3 }, // place near center-left
                    scale: 0.25,
                }
            })
        }
        reader.readAsDataURL(file)

        if (boardFileInputRef.current) boardFileInputRef.current.value = ""
    }

    return (
        <nav className="w-12 flex flex-col items-center py-3 bg-sidebar border-r border-border gap-2 z-30 shrink-0 h-full max-h-screen overflow-y-auto custom-scrollbar">
            {/* Tools Section */}
            <div className="flex flex-col gap-1.5">
                <span className="text-[7px] font-black uppercase tracking-widest text-muted-foreground mb-1 text-center">Tools</span>
                <button
                    onClick={() => setTool("select")}
                    className={cn("p-2 rounded-lg transition-all duration-300", tool === "select" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-accent")}
                    title="Selection Tool"
                >
                    <MousePointer2 size={18} />
                </button>
                <button
                    onClick={() => setTool("pencil")}
                    className={cn("p-2 rounded-lg transition-all duration-300", tool === "pencil" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-accent")}
                    title="Pencil Tool"
                >
                    <Pencil size={18} />
                </button>
                <button
                    onClick={() => setTool("eraser")}
                    className={cn("p-2 rounded-lg transition-all duration-300", tool === "eraser" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-accent")}
                    title="Eraser Tool"
                >
                    <Eraser size={18} />
                </button>
            </div>

            {/* Clear Canvas - Teacher Only */}
            {role === "teacher" && onClearCanvas && (
                <>
                    {/* <div className="w-10 h-px bg-border -mt-1" />
                    <button
                        onClick={() => {
                            if (confirm("Clear the canvas for all users?")) {
                                onClearCanvas()
                            }
                        }}
                        className="p-2 rounded-lg transition-all duration-300 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                        title="Clear Canvas (All Users)"
                    >
                        <Trash2 size={18} />
                    </button> */}
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
                            className={cn(
                                "w-6 h-6 rounded-full border-2 transition-all duration-200",
                                color === c ? "border-white scale-110" : "border-transparent hover:scale-105"
                            )}
                            style={{ backgroundColor: c }}
                        />
                    ))}
                    <div className="relative mt-1">
                        <input
                            type="color"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            className="w-6 h-6 rounded-full overflow-hidden cursor-pointer opacity-0 absolute inset-0"
                        />
                        <div className="w-6 h-6 rounded-full border-2 border-dashed border-muted-foreground flex items-center justify-center text-muted-foreground">
                            <Palette size={12} />
                        </div>
                    </div>
                </div>
            </div> */}

            {/* {role === "teacher" && ( */}
            <>
                {/* <div className="w-10 h-px bg-zinc-800" /> */}
                {/* Board Background */}
                {/* <div className="flex flex-col gap-3 items-center">
                        <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600 text-center">Desk</span>
                        <div className="flex flex-col gap-2">
                            {backgroundColors.map((c) => (
                                <button
                                    key={c}
                                    onClick={() => setBoardColor(c)}
                                    className={cn(
                                        "w-6 h-6 rounded-md border-2 transition-all duration-200",
                                        boardColor === c ? "border-blue-500 scale-110" : "border-zinc-700 hover:border-zinc-500"
                                    )}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                        </div>
                    </div> */}
            </>
            {/* )} */}

            <div className="w-10 h-px bg-border" />

            {/* Brush Size */}
            <div className="flex flex-col gap-2 items-center mb-4">
                <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground text-center">Size <span className="text-[10px] font-bold text-muted-foreground mt-1">({brushSize})</span></span>

                {/* Compact wrapper for the horizontal line buttons */}
                <div className="flex flex-col items-center bg-muted/50 p-1 rounded-[3px] gap-0.5">
                    {brushSizes.map((size) => (
                        <button
                            key={size}
                            onClick={() => setBrushSize(size)}
                            className={cn(
                                "w-8 flex items-center justify-center rounded-[2px] transition-all py-2",
                                brushSize === size
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "hover:bg-accent text-muted-foreground hover:text-foreground"
                            )}
                            title={`Size ${size}`}
                        >
                            <div
                                className="w-5 rounded-[2px] bg-current transition-all"
                                style={{ height: `${Math.max(1.5, size / 2.5)}px` }}
                            />
                        </button>
                    ))}
                </div>
            </div>

            {/* Add Image to Board - Teacher Only */}
            {role === "teacher" && (
                <>
                    {/* <div className="w-10 h-px bg-border" />
                    <input
                        type="file"
                        ref={boardFileInputRef}
                        onChange={handleBoardFileSelect}
                        className="hidden"
                        accept="image/*"
                    />
                    <button
                        onClick={() => boardFileInputRef.current?.click()}
                        className="p-2 rounded-lg transition-all duration-300 text-muted-foreground hover:text-foreground hover:bg-accent"
                        title="Add Image to Board"
                    >
                        <ImagePlus size={18} />
                    </button> */}
                </>
            )}
        </nav>
    )
}