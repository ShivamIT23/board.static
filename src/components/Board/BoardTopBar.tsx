"use client"

import React from "react"
import {
    ChevronLeft,
    ChevronRight,
    Plus,
    Minus,
    RotateCcw,
    RotateCw
} from "lucide-react"
import { cn } from "@/lib/utils"

interface BoardTopBarProps {
    currentPage: number
    totalPages: number
    onPageChange: (page: number) => void
    onAddPage: () => void
    zoom: number
    onZoomChange: (zoom: number) => void
}

export default function BoardTopBar({
    currentPage,
    totalPages,
    onPageChange,
    onAddPage,
    zoom,
    onZoomChange
}: BoardTopBarProps) {
    return (
        <div className="relative flex items-center gap-2 px-3 py-1.5 h-10 bg-sidebar backdrop-blur-xl border-b border-t-0 border-l-0 border-border/50 rounded-[3px] shadow-[0_8px_32px_rgba(0,0,0,0.3)] animate-in fade-in slide-in-from-top-4 duration-500 w-full">
            {/* Page Controls */}
            <div className="flex items-center gap-1 pr-2 border-r border-border/50">
                <button
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage <= 1}
                    className={cn(
                        "p-1.5 rounded-full transition-all",
                        currentPage <= 1 ? "opacity-30 cursor-not-allowed" : "hover:bg-accent text-foreground"
                    )}
                >
                    <ChevronLeft size={16} />
                </button>
                <div className="flex flex-col items-center min-w-[70px]">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground leading-none mb-0.5">Title</span>
                    <span className="text-[10px] font-bold text-foreground tabular-nums">
                        {currentPage} / {totalPages}
                    </span>
                </div>
                <button
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage >= totalPages}
                    className={cn(
                        "p-1.5 rounded-full transition-all",
                        currentPage >= totalPages ? "opacity-30 cursor-not-allowed" : "hover:bg-accent text-foreground"
                    )}
                >
                    <ChevronRight size={16} />
                </button>
                <button
                    onClick={onAddPage}
                    className="p-1.5 ml-1 rounded-full hover:bg-accent text-primary transition-colors"
                    title="Add Page"
                >
                    <Plus size={16} />
                </button>
            </div>

            {/* Undo/Redo */}
            <div className="flex items-center gap-1 px-2 border-r border-border/50">
                <button className="p-1.5 rounded-full hover:bg-accent text-muted-foreground/60 transition-colors" title="Undo (Coming Soon)">
                    <RotateCcw size={15} />
                </button>
                <button className="p-1.5 rounded-full hover:bg-accent text-muted-foreground/60 transition-colors" title="Redo (Coming Soon)">
                    <RotateCw size={15} />
                </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 pl-1">
                <button
                    onClick={() => onZoomChange(Math.max(10, zoom - 10))}
                    className="p-1.5 rounded-full hover:bg-accent text-foreground transition-all active:scale-95"
                >
                    <Minus size={15} />
                </button>
                <div className="flex items-center gap-1 px-2 min-w-[55px] justify-center">
                    <span className="text-[10px] font-black tracking-tight tabular-nums">{zoom}%</span>
                </div>
                <button
                    onClick={() => onZoomChange(Math.min(500, zoom + 10))}
                    className="p-1.5 rounded-full hover:bg-accent text-foreground transition-all active:scale-95"
                >
                    <Plus size={15} />
                </button>
            </div>
        </div>
    )
}
