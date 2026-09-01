"use client";

import React, { useState, useRef } from "react";
import {
    Pen,
    Highlighter,
    Eraser,
    Type,
    Minus,
    Palette,
    Trash2,
    MousePointer2,
    Square,
    Circle,
    Triangle,
    Diamond,
    Star,
    ArrowUpRight,
    Ellipse,
    Pentagon,
    TriangleRight,
    RectangleHorizontal,
    Activity,
    Grid3X3,
    Calculator,
    LayoutGrid,
    ImagePlus,
    FileUp,
    RotateCcw,
    RotateCw,
    LocateFixed,
    Locate,
    Shapes,
    Smile,
    Hash,
    PaintBucket,
    Sliders,
    X,
} from "lucide-react";
import { cn, getContrastColor } from "@/lib/utils";
import DemoColorPicker from "./DemoColorPicker";
import DemoBackgroundPicker from "./DemoBackgroundPicker";
import Swal from "sweetalert2";
import { toast } from "sonner";

interface DemoMobileToolProps {
    tool: string;
    setTool: (tool: string) => void;
    role?: "teacher" | "student";
    color: string;
    setColor: (color: string) => void;
    boardColor: string;
    setBoardColor: (color: string) => void;
    brushSize: number;
    setBrushSize: (size: number) => void;
    onClearCanvas?: () => void;
    isClassEnded?: boolean;
    isViewLocked?: boolean;
    onToggleViewLocked?: (enabled: boolean) => void;
    onPdfUpload?: (file: File) => void;
    onImageStamp?: (dataUrl: string) => void;
}

const SHAPE_TOOLS = [
    { id: "rectangle", label: "Rectangle", icon: RectangleHorizontal },
    { id: "square", label: "Square", icon: Square },
    { id: "circle", label: "Circle", icon: Circle },
    { id: "triangle", label: "Triangle", icon: Triangle },
    { id: "right-triangle", label: "Right Triangle", icon: TriangleRight },
    { id: "diamond", label: "Diamond", icon: Diamond },
    { id: "rhombus", label: "Rhombus", icon: Diamond },
    { id: "star", label: "Star", icon: Star },
    { id: "arrow", label: "Arrow", icon: ArrowUpRight },
    { id: "ellipse", label: "Ellipse", icon: Ellipse },
    { id: "pentagon", label: "Pentagon", icon: Pentagon },
    { id: "parallelogram", label: "Parallelogram", icon: RectangleHorizontal },
] as const;

const GRAPH_TOOLS = [
    { id: "graph-axis", label: "Axis", icon: Activity },
    { id: "graph-plain", label: "Plane", icon: Grid3X3 },
    { id: "graph-labeled", label: "Labeled", icon: Calculator },
    { id: "large-grid", label: "Grid", icon: LayoutGrid },
] as const;

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
] as const;

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
] as const;

const BRUSH_SIZES = [2, 4, 8, 12, 16, 20];

export default function DemoMobileTool({
    tool,
    setTool,
    role = "teacher",
    color,
    setColor,
    boardColor,
    setBoardColor,
    brushSize,
    setBrushSize,
    onClearCanvas,
    isClassEnded = false,
    isViewLocked = true,
    onToggleViewLocked,
    onPdfUpload,
    onImageStamp,
}: DemoMobileToolProps) {
    // Popovers
    const [activeModal, setActiveModal] = useState<"color" | "size" | "shapes" | "graphs" | "math" | "emojis" | "bg" | null>(null);
    const [shapeFillMode, setShapeFillMode] = useState<"outline" | "filled">("outline");

    const boardFileInputRef = useRef<HTMLInputElement>(null);
    const pdfFileInputRef = useRef<HTMLInputElement>(null);

    const isShapeTool = SHAPE_TOOLS.some((s) => tool === s.id || tool === `filled-${s.id}`);
    const isGraphTool = GRAPH_TOOLS.some((g) => tool.startsWith(g.id));
    const isMathTool = tool.startsWith("symbol:") || tool.startsWith("math:");
    const isEmojiTool = tool.startsWith("emoji:");

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            toast.error("Only image files can be added");
            if (boardFileInputRef.current) boardFileInputRef.current.value = "";
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error("Image must be less than 5MB");
            if (boardFileInputRef.current) boardFileInputRef.current.value = "";
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUrl = reader.result as string;
            if (onImageStamp) {
                onImageStamp(dataUrl);
                setTool("image-stamp");
            }
        };
        reader.readAsDataURL(file);
        if (boardFileInputRef.current) boardFileInputRef.current.value = "";
    };

    const handlePdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== "application/pdf") {
            toast.error("Only PDF files are supported");
            if (pdfFileInputRef.current) pdfFileInputRef.current.value = "";
            return;
        }

        if (file.size > 25 * 1024 * 1024) {
            toast.error("PDF must be less than 25MB");
            if (pdfFileInputRef.current) pdfFileInputRef.current.value = "";
            return;
        }

        onPdfUpload?.(file);
        if (pdfFileInputRef.current) pdfFileInputRef.current.value = "";
    };

    const handleGraphSelect = async (gId: string) => {
        if (gId === "large-grid" || gId === "graph-plain" || gId === "graph-labeled") {
            let title = "Grid Size";
            let label = "Enter number of boxes";
            let defVal = "3";

            if (gId !== "large-grid") {
                title = "Coordinate Range";
                label = "Enter coordinate limit (e.g. 10 for -9 to 9)";
                defVal = "8";
            }

            const { value: count } = await Swal.fire({
                title,
                input: "number",
                inputLabel: label,
                inputValue: defVal,
                showCancelButton: true,
                inputAttributes: { min: "1", max: "50", step: "1" },
            });

            if (count) {
                setTool(`${gId}:${parseInt(count)}`);
            } else {
                setTool(`${gId}:${defVal}`);
            }
        } else {
            setTool(gId);
        }
        setActiveModal(null);
    };

    return (
        <>
            {/* Hidden File Inputs */}
            <input type="file" ref={boardFileInputRef} onChange={handleImageSelect} className="hidden" accept="image/*" />
            <input type="file" ref={pdfFileInputRef} onChange={handlePdfSelect} className="hidden" accept="application/pdf" />

            {/* Bottom Dock Container - 2 Balanced Rows */}
            <div className="fixed bottom-2 left-1/2 z-40 max-w-[96vw] bg-sidebar/95 backdrop-blur-xl border border-border/70 rounded-2xl shadow-2xl p-1.5 flex flex-col gap-1 items-center animate-dock-up">
                {/* ── ROW 1: Drawing & Annotation Tools ────────────── */}
                <div className="flex items-center gap-1">
                    {/* 1. Color Picker */}
                    <button
                        type="button"
                        onClick={() => setActiveModal(activeModal === "color" ? null : "color")}
                        className={cn(
                            "w-7.5 h-7.5 rounded-lg border flex items-center justify-center transition-all shrink-0 cursor-pointer shadow-sm",
                            activeModal === "color" ? "ring-2 ring-primary ring-offset-1" : "border-primary/30"
                        )}
                        style={{ backgroundColor: color, color: getContrastColor(color) }}
                        title="Drawing Color"
                    >
                        <Palette size={14} />
                    </button>

                    {/* 2. Brush Size */}
                    <button
                        type="button"
                        onClick={() => setActiveModal(activeModal === "size" ? null : "size")}
                        className={cn(
                            "w-7.5 h-7.5 rounded-lg border transition-all flex items-center justify-center shrink-0 cursor-pointer",
                            activeModal === "size" ? "bg-primary text-primary-foreground border-primary" : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                        title="Brush Size"
                    >
                        <Sliders size={14} />
                    </button>

                    <div className="w-px h-4 bg-border/50 shrink-0" />

                    {/* 3. Pen */}
                    <button
                        type="button"
                        onClick={() => setTool("pen:pen")}
                        className={cn(
                            "w-7.5 h-7.5 rounded-lg border transition-all flex items-center justify-center shrink-0 cursor-pointer",
                            tool === "pen:pen" ? "bg-primary text-primary-foreground border-primary shadow-md" : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                        title="Pen"
                    >
                        <Pen size={14} />
                    </button>

                    {/* 4. Highlighter */}
                    <button
                        type="button"
                        onClick={() => setTool("pen:highlighter")}
                        className={cn(
                            "w-7.5 h-7.5 rounded-lg border transition-all flex items-center justify-center shrink-0 cursor-pointer",
                            tool === "pen:highlighter" ? "bg-primary text-primary-foreground border-primary shadow-md" : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                        title="Highlighter"
                    >
                        <Highlighter size={14} />
                    </button>

                    {/* 5. Object Eraser */}
                    <button
                        type="button"
                        onClick={() => setTool("eraser")}
                        className={cn(
                            "w-7.5 h-7.5 rounded-lg border transition-all flex items-center justify-center shrink-0 cursor-pointer",
                            tool === "eraser" ? "bg-primary text-primary-foreground border-primary shadow-md" : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                        title="Object Eraser"
                    >
                        <Eraser size={14} />
                    </button>

                    {/* 6. Selective Eraser */}
                    <button
                        type="button"
                        onClick={() => setTool("partial-eraser")}
                        className={cn(
                            "w-7.5 h-7.5 rounded-lg border transition-all flex items-center justify-center shrink-0 cursor-pointer",
                            tool === "partial-eraser" ? "bg-primary text-primary-foreground border-primary shadow-md" : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                        title="Selective Eraser"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
                            <path d="M22 21H7" />
                            <path d="m5 11 9 9" />
                        </svg>
                    </button>

                    {/* 7. Selection Tool */}
                    <button
                        type="button"
                        onClick={() => setTool("select")}
                        className={cn(
                            "w-7.5 h-7.5 rounded-lg border transition-all flex items-center justify-center shrink-0 cursor-pointer",
                            tool === "select" ? "bg-primary text-primary-foreground border-primary shadow-md" : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                        title="Selection Tool"
                    >
                        <MousePointer2 size={14} />
                    </button>

                    {/* 8. Text */}
                    <button
                        type="button"
                        onClick={() => setTool("text")}
                        className={cn(
                            "w-7.5 h-7.5 rounded-lg border transition-all flex items-center justify-center shrink-0 cursor-pointer",
                            tool === "text" ? "bg-primary text-primary-foreground border-primary shadow-md" : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                        title="Text"
                    >
                        <Type size={14} />
                    </button>

                    {/* 9. Line */}
                    <button
                        type="button"
                        onClick={() => setTool("line")}
                        className={cn(
                            "w-7.5 h-7.5 rounded-lg border transition-all flex items-center justify-center shrink-0 cursor-pointer",
                            tool === "line" ? "bg-primary text-primary-foreground border-primary shadow-md" : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                        title="Line"
                    >
                        <Minus size={14} />
                    </button>

                    {/* 10. Laser Pointer */}
                    <button
                        type="button"
                        onClick={() => setTool("laser")}
                        className={cn(
                            "w-7.5 h-7.5 rounded-lg border transition-all flex items-center justify-center shrink-0 cursor-pointer",
                            tool === "laser" ? "bg-red-500 text-white border-red-500 shadow-md shadow-red-500/30" : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                        title="Laser Pointer"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.8" />
                            <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" opacity="0.5" />
                        </svg>
                    </button>
                </div>

                {/* ── ROW 2: Shapes, Math, Media & Canvas Controls ── */}
                <div className="flex items-center gap-1">
                    {/* 11. Shapes Popover */}
                    <button
                        type="button"
                        onClick={() => setActiveModal(activeModal === "shapes" ? null : "shapes")}
                        className={cn(
                            "w-7.5 h-7.5 rounded-lg border transition-all flex items-center justify-center shrink-0 cursor-pointer",
                            isShapeTool || activeModal === "shapes" ? "bg-primary text-primary-foreground border-primary shadow-md" : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                        title="Shapes"
                    >
                        <Shapes size={14} />
                    </button>

                    {/* 12. Graphs & Grids */}
                    <button
                        type="button"
                        onClick={() => setActiveModal(activeModal === "graphs" ? null : "graphs")}
                        className={cn(
                            "w-7.5 h-7.5 rounded-lg border transition-all flex items-center justify-center shrink-0 cursor-pointer",
                            isGraphTool || activeModal === "graphs" ? "bg-primary text-primary-foreground border-primary shadow-md" : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                        title="Coordinate Graphs"
                    >
                        <Activity size={14} />
                    </button>

                    {/* 13. Math Symbols */}
                    <button
                        type="button"
                        onClick={() => setActiveModal(activeModal === "math" ? null : "math")}
                        className={cn(
                            "w-7.5 h-7.5 rounded-lg border transition-all flex items-center justify-center shrink-0 cursor-pointer font-bold text-[11px]",
                            isMathTool || activeModal === "math" ? "bg-primary text-primary-foreground border-primary shadow-md" : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                        title="Math Symbols"
                    >
                        <Hash size={14} />
                    </button>

                    {/* 14. Emojis */}
                    <button
                        type="button"
                        onClick={() => setActiveModal(activeModal === "emojis" ? null : "emojis")}
                        className={cn(
                            "w-7.5 h-7.5 rounded-lg border transition-all flex items-center justify-center shrink-0 cursor-pointer",
                            isEmojiTool || activeModal === "emojis" ? "bg-primary text-primary-foreground border-primary shadow-md" : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                        title="Emojis"
                    >
                        <Smile size={14} />
                    </button>

                    <div className="w-px h-4 bg-border/50 shrink-0" />

                    {/* 15. Image Upload */}
                    {role === "teacher" && (
                        <button
                            type="button"
                            onClick={() => (tool === "image-stamp" ? setTool("pen:pen") : boardFileInputRef.current?.click())}
                            className={cn(
                                "w-7.5 h-7.5 rounded-lg border transition-all flex items-center justify-center shrink-0 cursor-pointer",
                                tool === "image-stamp" ? "bg-primary text-primary-foreground border-primary shadow-md" : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                            )}
                            title="Add Image"
                        >
                            <ImagePlus size={14} />
                        </button>
                    )}

                    {/* 16. PDF Upload */}
                    {role === "teacher" && (
                        <button
                            type="button"
                            onClick={() => pdfFileInputRef.current?.click()}
                            className="w-7.5 h-7.5 rounded-lg border border-transparent text-muted-foreground hover:bg-accent hover:text-foreground transition-all flex items-center justify-center shrink-0 cursor-pointer"
                            title="Upload PDF"
                        >
                            <FileUp size={14} />
                        </button>
                    )}

                    {/* 17. Background Color */}
                    {role === "teacher" && (
                        <button
                            type="button"
                            onClick={() => setActiveModal(activeModal === "bg" ? null : "bg")}
                            className={cn(
                                "w-7.5 h-7.5 rounded-lg border flex items-center justify-center transition-all shrink-0 cursor-pointer",
                                activeModal === "bg" ? "ring-2 ring-primary ring-offset-1 border-primary" : "border-border/60"
                            )}
                            style={{ backgroundColor: boardColor, color: getContrastColor(boardColor) }}
                            title="Board Background"
                        >
                            <PaintBucket size={14} />
                        </button>
                    )}

                    <div className="w-px h-4 bg-border/50 shrink-0" />

                    {/* 18. Undo */}
                    <button
                        type="button"
                        onClick={() => document.dispatchEvent(new CustomEvent("undo-trigger"))}
                        className="w-7.5 h-7.5 rounded-lg border border-transparent text-muted-foreground hover:bg-accent hover:text-foreground transition-all flex items-center justify-center shrink-0 cursor-pointer"
                        title="Undo"
                    >
                        <RotateCcw size={14} />
                    </button>

                    {/* 19. Redo */}
                    <button
                        type="button"
                        onClick={() => document.dispatchEvent(new CustomEvent("redo-trigger"))}
                        className="w-7.5 h-7.5 rounded-lg border border-transparent text-muted-foreground hover:bg-accent hover:text-foreground transition-all flex items-center justify-center shrink-0 cursor-pointer"
                        title="Redo"
                    >
                        <RotateCw size={14} />
                    </button>

                    {/* 20. View Lock */}
                    {role === "teacher" && onToggleViewLocked && (
                        <button
                            type="button"
                            onClick={() => onToggleViewLocked(!isViewLocked)}
                            className={cn(
                                "w-7.5 h-7.5 rounded-lg border transition-all flex items-center justify-center shrink-0 cursor-pointer",
                                isViewLocked ? "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground" : "bg-amber-500/20 text-amber-500 border-amber-500/40"
                            )}
                            title={isViewLocked ? "Lock Canvas (Students Follow)" : "Unlock Canvas"}
                        >
                            {isViewLocked ? <LocateFixed size={14} /> : <Locate size={14} />}
                        </button>
                    )}

                    {/* 21. Clear Canvas */}
                    {(role === "teacher" || isClassEnded) && onClearCanvas && (
                        <button
                            type="button"
                            onClick={async () => {
                                const { isConfirmed } = await Swal.fire({
                                    title: "Clear Canvas?",
                                    text: "This will clear all drawings on this page. Are you sure?",
                                    icon: "warning",
                                    showCancelButton: true,
                                    confirmButtonColor: "#ef4444",
                                    cancelButtonColor: "#6b7280",
                                    confirmButtonText: "Yes, clear it!",
                                });
                                if (isConfirmed) onClearCanvas();
                            }}
                            className="w-7.5 h-7.5 rounded-lg border border-transparent text-red-500 hover:bg-red-500/10 hover:text-red-400 transition-all flex items-center justify-center shrink-0 cursor-pointer"
                            title="Clear Canvas"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* ─── POPOVER MODALS ─────────────────────────────────── */}

            {/* Backdrop for closing modals */}
            {activeModal && (
                <div
                    className="fixed inset-0 z-40 bg-black/30 backdrop-blur-xs animate-in fade-in duration-200"
                    onClick={() => setActiveModal(null)}
                />
            )}

            {/* 1. Color Picker Modal */}
            {activeModal === "color" && (
                <div className="fixed bottom-22 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="p-2 bg-sidebar border border-border rounded-2xl shadow-2xl">
                        <div className="flex items-center justify-between px-2 pb-1 border-b border-border mb-2">
                            <span className="text-[11px] font-bold">Pen Color</span>
                            <button type="button" onClick={() => setActiveModal(null)} className="p-1 text-muted-foreground hover:text-foreground">
                                <X size={14} />
                            </button>
                        </div>
                        <DemoColorPicker
                            color={color}
                            onChange={(hex: string) => setColor(hex)}
                            onSelect={() => setActiveModal(null)}
                        />
                    </div>
                </div>
            )}

            {/* 2. Brush Size Modal */}
            {activeModal === "size" && (
                <div className="fixed bottom-22 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="p-3 bg-sidebar border border-border rounded-2xl shadow-2xl w-60">
                        <div className="flex items-center justify-between pb-2 border-b border-border mb-2">
                            <span className="text-[11px] font-bold">Brush Size: {brushSize}px</span>
                            <button type="button" onClick={() => setActiveModal(null)} className="p-1 text-muted-foreground hover:text-foreground">
                                <X size={14} />
                            </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {BRUSH_SIZES.map((size) => (
                                <button
                                    key={size}
                                    type="button"
                                    onClick={() => {
                                        setBrushSize(size);
                                        setActiveModal(null);
                                    }}
                                    className={cn(
                                        "flex flex-col items-center justify-center p-2 rounded-xl border gap-1 transition-all cursor-pointer",
                                        brushSize === size
                                            ? "bg-primary text-primary-foreground border-primary shadow-md"
                                            : "border-border/60 hover:bg-accent text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <div
                                        className="w-8 rounded-full bg-current"
                                        style={{ height: `${Math.max(2, size / 2)}px` }}
                                    />
                                    <span className="text-[10px] font-bold">{size}px</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 3. Shapes Modal */}
            {activeModal === "shapes" && (
                <div className="fixed bottom-22 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="p-3 bg-sidebar border border-border rounded-2xl shadow-2xl w-72 max-w-[94vw]">
                        <div className="flex items-center justify-between pb-2 border-b border-border mb-2">
                            <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg">
                                <button
                                    type="button"
                                    onClick={() => setShapeFillMode("outline")}
                                    className={cn(
                                        "px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer",
                                        shapeFillMode === "outline" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground"
                                    )}
                                >
                                    Outline
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShapeFillMode("filled")}
                                    className={cn(
                                        "px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer",
                                        shapeFillMode === "filled" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground"
                                    )}
                                >
                                    Filled
                                </button>
                            </div>
                            <button type="button" onClick={() => setActiveModal(null)} className="p-1 text-muted-foreground hover:text-foreground">
                                <X size={14} />
                            </button>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            {SHAPE_TOOLS.map((s) => {
                                const toolId = shapeFillMode === "filled" ? `filled-${s.id}` : s.id;
                                const Icon = s.icon;
                                return (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => {
                                            setTool(toolId);
                                            setActiveModal(null);
                                        }}
                                        className={cn(
                                            "flex flex-col items-center justify-center p-2 rounded-xl border gap-1 transition-all cursor-pointer",
                                            tool === toolId
                                                ? "bg-primary text-primary-foreground border-primary shadow-md"
                                                : "border-border/60 hover:bg-accent text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <Icon size={18} />
                                        <span className="text-[9px] truncate w-full text-center">{s.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* 4. Graphs Modal */}
            {activeModal === "graphs" && (
                <div className="fixed bottom-22 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="p-3 bg-sidebar border border-border rounded-2xl shadow-2xl w-64 max-w-[94vw]">
                        <div className="flex items-center justify-between pb-2 border-b border-border mb-2">
                            <span className="text-[11px] font-bold">Coordinate Graphs</span>
                            <button type="button" onClick={() => setActiveModal(null)} className="p-1 text-muted-foreground hover:text-foreground">
                                <X size={14} />
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {GRAPH_TOOLS.map((g) => {
                                const Icon = g.icon;
                                return (
                                    <button
                                        key={g.id}
                                        type="button"
                                        onClick={() => handleGraphSelect(g.id)}
                                        className={cn(
                                            "flex flex-col items-center justify-center p-2.5 rounded-xl border gap-1 transition-all cursor-pointer",
                                            tool.startsWith(g.id)
                                                ? "bg-primary text-primary-foreground border-primary shadow-md"
                                                : "border-border/60 hover:bg-accent text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <Icon size={20} />
                                        <span className="text-[10px] font-semibold">{g.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* 5. Math Symbols Modal */}
            {activeModal === "math" && (
                <div className="fixed bottom-22 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="p-3 bg-sidebar border border-border rounded-2xl shadow-2xl w-72 max-w-[94vw]">
                        <div className="flex items-center justify-between pb-2 border-b border-border mb-2">
                            <span className="text-[11px] font-bold">Math Symbols</span>
                            <button type="button" onClick={() => setActiveModal(null)} className="p-1 text-muted-foreground hover:text-foreground">
                                <X size={14} />
                            </button>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            {MATH_SYMBOLS.map((m) => (
                                <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => {
                                        setTool(`symbol:${m.value}`);
                                        setActiveModal(null);
                                    }}
                                    className={cn(
                                        "p-2 rounded-xl border flex items-center justify-center text-sm font-bold transition-all cursor-pointer",
                                        tool === `symbol:${m.value}`
                                            ? "bg-primary text-primary-foreground border-primary shadow-md"
                                            : "border-border/60 hover:bg-accent text-foreground"
                                    )}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 6. Emojis Modal */}
            {activeModal === "emojis" && (
                <div className="fixed bottom-22 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="p-3 bg-sidebar border border-border rounded-2xl shadow-2xl w-72 max-w-[94vw]">
                        <div className="flex items-center justify-between pb-2 border-b border-border mb-2">
                            <span className="text-[11px] font-bold">Stickers & Emojis</span>
                            <button type="button" onClick={() => setActiveModal(null)} className="p-1 text-muted-foreground hover:text-foreground">
                                <X size={14} />
                            </button>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            {EMOJIS.map((e) => (
                                <button
                                    key={e.id}
                                    type="button"
                                    onClick={() => {
                                        setTool(`emoji:${e.value}`);
                                        setActiveModal(null);
                                    }}
                                    className={cn(
                                        "p-2 rounded-xl border flex items-center justify-center text-xl transition-all cursor-pointer",
                                        tool === `emoji:${e.value}`
                                            ? "bg-primary/20 border-primary shadow-md scale-110"
                                            : "border-border/60 hover:bg-accent"
                                    )}
                                    title={e.label}
                                >
                                    {e.value}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 7. Background Color Modal */}
            {activeModal === "bg" && (
                <div className="fixed bottom-22 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="p-3 bg-sidebar border border-border rounded-2xl shadow-2xl">
                        <div className="flex items-center justify-between pb-2 border-b border-border mb-2">
                            <span className="text-[11px] font-bold">Board Background</span>
                            <button type="button" onClick={() => setActiveModal(null)} className="p-1 text-muted-foreground hover:text-foreground">
                                <X size={14} />
                            </button>
                        </div>
                        <DemoBackgroundPicker
                            color={boardColor}
                            onChange={(newCol: string) => {
                                setBoardColor(newCol);
                                setActiveModal(null);
                            }}
                        />
                    </div>
                </div>
            )}
        </>
    );
}
