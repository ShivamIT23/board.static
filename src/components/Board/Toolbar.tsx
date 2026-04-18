// "use client"

// import React, { useCallback, useEffect, useRef, useState } from "react"
// import ReactDOM from "react-dom"
// import {
//     Pencil, Eraser, MousePointer2, Trash2, Palette,
//     Square, Circle, Minus, ArrowUpRight, Type, Triangle, Diamond, Star
// } from "lucide-react"
// import { cn } from "@/lib/utils"
// import ColorPicker from "./ColorPicker"

// const SHAPE_TOOLS = [
//     { id: "rectangle", label: "Rectangle", icon: Square },
//     { id: "circle", label: "Circle", icon: Circle },
//     { id: "triangle", label: "Triangle", icon: Triangle },
//     { id: "diamond", label: "Diamond", icon: Diamond },
//     { id: "star", label: "Star", icon: Star },
//     { id: "line", label: "Line", icon: Minus },
//     { id: "arrow", label: "Arrow", icon: ArrowUpRight },
// ] as const

// type ShapeToolId = typeof SHAPE_TOOLS[number]["id"]

// interface ToolbarProps {
//     tool: string
//     setTool: (tool: string) => void
//     role: "teacher" | "student"
//     color: string
//     setColor: (color: string) => void
//     brushSize: number
//     setBrushSize: (size: number) => void
//     shapeFillColor: string
//     setShapeFillColor: (color: string) => void
//     shapeBorderColor: string
//     setShapeBorderColor: (color: string) => void
//     onClearCanvas?: () => void
// }

// export default function Toolbar({
//     tool,
//     setTool,
//     role,
//     color,
//     setColor,
//     brushSize,
//     setBrushSize,
//     shapeFillColor,
//     setShapeFillColor,
//     shapeBorderColor,
//     setShapeBorderColor,
//     onClearCanvas
// }: ToolbarProps) {
//     const [showShapeDropdown, setShowShapeDropdown] = useState(false)
//     const [showColorPicker, setShowColorPicker] = useState(false)
//     const [showFillPicker, setShowFillPicker] = useState(false)
//     const [showBorderPicker, setShowBorderPicker] = useState(false)
//     const [shapeDropdownPos, setShapeDropdownPos] = useState<{ top: number; left: number } | null>(null)
//     const [colorPickerPos, setColorPickerPos] = useState<{ top: number; left: number } | null>(null)
//     const [fillPickerPos, setFillPickerPos] = useState<{ top: number; left: number } | null>(null)
//     const [borderPickerPos, setBorderPickerPos] = useState<{ top: number; left: number } | null>(null)

//     const penColors = ["#FFFFFF", "#FEF08A", "#86EFAC", "#93C5FD", "#FCA5A5", "#F0ABFC"]
//     const fillColors = ["transparent", "#FFFFFF", "#FEF08A", "#86EFAC", "#93C5FD", "#FCA5A5", "#F0ABFC"]
//     const borderColors = ["#FFFFFF", "#000000", "#FEF08A", "#86EFAC", "#93C5FD", "#FCA5A5", "#F0ABFC"]
//     const [selectedShape, setSelectedShape] = useState<ShapeToolId>("rectangle")
//     const brushSizes = [2, 4, 8, 12, 16, 20]
//     const scrollAreaRef = useRef<HTMLDivElement>(null)
//     const shapeButtonRef = useRef<HTMLDivElement>(null)
//     const colorButtonRef = useRef<HTMLButtonElement>(null)
//     const fillButtonRef = useRef<HTMLButtonElement>(null)
//     const borderButtonRef = useRef<HTMLButtonElement>(null)
//     const [canScrollDown, setCanScrollDown] = useState(false)
    

//     const checkScroll = useCallback(() => {
//         const el = scrollAreaRef.current
//         if (!el) return
//         setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 4)
//     }, [])

//     useEffect(() => {
//         checkScroll()
//     }, [checkScroll])

//     const isShapeTool = SHAPE_TOOLS.some(s => s.id === tool)
//     const ActiveShapeIcon = SHAPE_TOOLS.find(s => s.id === (isShapeTool ? tool : selectedShape))?.icon || Square

//     const toggleShapeDropdown = useCallback(() => {
//         if (showShapeDropdown) {
//             setShowShapeDropdown(false)
//             return
//         }
//         if (shapeButtonRef.current) {
//             const rect = shapeButtonRef.current.getBoundingClientRect()
//             setShapeDropdownPos({
//                 top: rect.top + rect.height / 2 - 20,
//                 left: rect.right + 8,
//             })
//         }
//         setShowShapeDropdown(true)
//     }, [showShapeDropdown])

//     const toggleColorPicker = useCallback(() => {
//         if (showColorPicker) {
//             setShowColorPicker(false)
//             return
//         }
//         if (colorButtonRef.current) {
//             const rect = colorButtonRef.current.getBoundingClientRect()
//             const pickerHeight = 420
//             const top = Math.max(8, Math.min(window.innerHeight - pickerHeight - 8, rect.top - pickerHeight / 2 + rect.height / 2))
//             setColorPickerPos({ top, left: rect.right + 16 })
//         }
//         setShowColorPicker(true)
//     }, [showColorPicker])

//     const toggleFillPicker = useCallback(() => {
//         if (showFillPicker) {
//             setShowFillPicker(false)
//             return
//         }
//         if (fillButtonRef.current) {
//             const rect = fillButtonRef.current.getBoundingClientRect()
//             const pickerHeight = 420
//             const top = Math.max(8, Math.min(window.innerHeight - pickerHeight - 8, rect.top - pickerHeight / 2 + rect.height / 2))
//             setFillPickerPos({ top, left: rect.right + 16 })
//         }
//         setShowFillPicker(true)
//     }, [showFillPicker])

//     const toggleBorderPicker = useCallback(() => {
//         if (showBorderPicker) {
//             setShowBorderPicker(false)
//             return
//         }
//         if (borderButtonRef.current) {
//             const rect = borderButtonRef.current.getBoundingClientRect()
//             const pickerHeight = 420
//             const top = Math.max(8, Math.min(window.innerHeight - pickerHeight - 8, rect.top - pickerHeight / 2 + rect.height / 2))
//             setBorderPickerPos({ top, left: rect.right + 16 })
//         }
//         setShowBorderPicker(true)
//     }, [showBorderPicker])

//     return (
//         <nav className="w-12 flex no-scrollbar flex-col items-center bg-sidebar border-r border-border z-30 shrink-0 h-full max-h-screen">

//             {/* Scrollable content area with fade scroll indicator */}
//             <div className="relative flex-1 w-full min-h-0">
//                 <div
//                     ref={scrollAreaRef}
//                     onScroll={checkScroll}
//                     className="flex flex-col no-scrollbar overflow-y-auto h-full w-full items-center py-3 gap-2"
//                 >
//                     {/* Tools Section */}
//                     <div className="flex flex-col gap-1.5">
//                         <span className="text-[7px] font-black uppercase tracking-widest text-muted-foreground mb-1 text-center">Tools</span>
//                         <button type="button" onClick={() => setTool("select")} className={cn("p-2 rounded-[5px] transition-all duration-300", tool === "select" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-accent")} title="Selection Tool">
//                             <MousePointer2 size={18} />
//                         </button>
//                         <button type="button" onClick={() => setTool("pencil")} className={cn("p-2 rounded-[5px] transition-all duration-300", tool === "pencil" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-accent")} title="Pencil Tool">
//                             <Pencil size={18} />
//                         </button>
//                         <button type="button" onClick={() => setTool("eraser")} className={cn("p-2 rounded-[5px] transition-all duration-300", tool === "eraser" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-accent")} title="Eraser Tool">
//                             <Eraser size={18} />
//                         </button>
//                         <div className="w-8 h-px bg-border my-1 mx-auto" />

//                         {/* Shapes — single button with horizontal dropdown */}
//                         <div className="relative group" ref={shapeButtonRef}>
//                             <div className={cn(
//                                 "flex flex-col items-stretch rounded-[5px] overflow-hidden transition-all duration-300 border border-transparent",
//                                 isShapeTool ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-muted/30 hover:bg-accent hover:border-border/50"
//                             )}>
//                                 <button
//                                     type="button"
//                                     onClick={() => {
//                                         setTool(selectedShape)
//                                         if (!isShapeTool) setShowShapeDropdown(false)
//                                     }}
//                                     onContextMenu={(e) => { e.preventDefault(); toggleShapeDropdown() }}
//                                     className="p-1.5 flex-1 flex items-center justify-center transition-colors hover:bg-white/10"
//                                     title={`Use ${selectedShape}`}
//                                 >
//                                     <ActiveShapeIcon size={18} />
//                                 </button>
//                                 <button
//                                     type="button"
//                                     onClick={(e) => {
//                                         e.stopPropagation()
//                                         toggleShapeDropdown()
//                                     }}
//                                     className={cn(
//                                         "py-0.5 flex items-center justify-center transition-colors hover:bg-white/20 border-t border-white/10",
//                                         isShapeTool ? "text-primary-foreground" : "text-muted-foreground"
//                                     )}
//                                     title="Choose shape"
//                                 >
//                                     <svg className="w-2 h-2 opacity-80" viewBox="0 0 10 10" fill="currentColor">
//                                         <path d="M2 4 L8 4 L5 8 Z" />
//                                     </svg>
//                                 </button>
//                             </div>

//                             {showShapeDropdown && shapeDropdownPos && ReactDOM.createPortal(
//                                 <>
//                                     <div className="fixed inset-0 z-9998" onClick={() => setShowShapeDropdown(false)} />
//                                     <div
//                                         className="fixed z-9999 flex flex-wrap items-center gap-1 bg-sidebar border border-border rounded-lg p-1.5 shadow-xl animate-in fade-in slide-in-from-left-2 duration-200 min-w-[120px]"
//                                         style={{ top: shapeDropdownPos.top, left: shapeDropdownPos.left }}
//                                     >
//                                         {SHAPE_TOOLS.map((shape) => {
//                                             const Icon = shape.icon
//                                             return (
//                                                 <button
//                                                     key={shape.id}
//                                                     type="button"
//                                                     onClick={() => {
//                                                         setSelectedShape(shape.id)
//                                                         setTool(shape.id)
//                                                         setShowShapeDropdown(false)
//                                                     }}
//                                                     className={cn(
//                                                         "p-2 rounded-[5px] transition-all duration-200",
//                                                         tool === shape.id
//                                                             ? "bg-primary text-primary-foreground shadow-md"
//                                                             : "text-muted-foreground hover:text-foreground hover:bg-accent"
//                                                     )}
//                                                     title={shape.label}
//                                                 >
//                                                     <Icon size={16} />
//                                                 </button>
//                                             )
//                                         })}
//                                     </div>
//                                 </>,
//                                 document.body
//                             )}
//                         </div>

//                         <button type="button" onClick={() => setTool("text")} className={cn("p-2 rounded-[5px] transition-all duration-300", tool === "text" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-accent")} title="Text Tool">
//                             <Type size={18} />
//                         </button>
//                         <button type="button" onClick={() => setTool("laser")} className={cn("p-2 rounded-[5px] transition-all duration-300", tool === "laser" ? "bg-red-500 text-white shadow-lg shadow-red-500/30" : "text-muted-foreground hover:text-foreground hover:bg-accent")} title="Laser Pointer">
//                             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//                                 <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.8" />
//                                 <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" opacity="0.5" />
//                             </svg>
//                         </button>
//                     </div>

//                     {/* Clear Canvas - Teacher Only */}
//                     {role === "teacher" && onClearCanvas && (
//                         <>
//                             <div className="w-10 h-px bg-border -mt-1" />
//                             <button
//                                 type="button"
//                                 onClick={() => { if (confirm("Clear the canvas for all users?")) onClearCanvas() }}
//                                 className="p-2 rounded-[5px] transition-all duration-300 text-red-500 hover:text-red-400 hover:bg-red-500/10"
//                                 title="Clear Canvas (All Users)"
//                             >
//                                 <Trash2 size={18} />
//                             </button>
//                         </>
//                     )}

//                     <div className="w-10 h-px bg-border" />

//                     {/* Color Section */}
//                     <div className="flex flex-col gap-3 items-center">
//                         <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground text-center">Ink</span>
//                         <div className="flex flex-col gap-2">
//                             {/* Pre-defined swatches */}
//                             {penColors.map((c) => (
//                                 <button
//                                     key={c}
//                                     onClick={() => setColor(c)}
//                                     className={cn("w-6 h-3 rounded-full border transition-all duration-200", color === c ? "border-white scale-110" : "border-transparent hover:scale-105")}
//                                     style={{ backgroundColor: c }}
//                                 />
//                             ))}

//                             {/* Custom Color Picker Popover */}
//                             <div className="relative mt-1 flex justify-center">
//                                 <button
//                                     ref={colorButtonRef}
//                                     type="button"
//                                     onClick={() => toggleColorPicker()}
//                                     className="w-6 h-6 rounded-[2px] border-2 border-dashed border-muted-foreground flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
//                                 >
//                                     <Palette size={12} />
//                                 </button>

//                                 {showColorPicker && colorPickerPos && ReactDOM.createPortal(
//                                     <>
//                                         {/* Invisible backdrop to close picker when clicking outside */}
//                                         <div className="fixed inset-0 z-9998" onClick={() => setShowColorPicker(false)} />

//                                         {/* The Popover Card */}
//                                         <div
//                                             className="fixed z-9999 animate-in fade-in slide-in-from-left-2 duration-200"
//                                             style={{ top: colorPickerPos.top, left: colorPickerPos.left }}
//                                         >
//                                             <div className="p-1.5 bg-sidebar border border-border rounded-[5px] shadow-2xl">
//                                                 <ColorPicker
//                                                     color={color}
//                                                     onChange={(hex) => setColor(hex)}
//                                                 />
//                                             </div>
//                                         </div>
//                                     </>,
//                                     document.body
//                                 )}
//                             </div>
//                         </div>
//                     </div>

//                     <div className="w-10 h-px bg-border my-1" />

//                     {/* Brush Size */}
//                     <div className="flex flex-col gap-2 items-center mb-2">
//                         <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground text-center flex flex-wrap justify-center items-center gap-0.5 p-0.5">Size <span className="text-[10px] font-bold text-muted-foreground">({brushSize})</span></span>
//                         <div className="flex flex-col items-center bg-muted/50 p-1 rounded-[3px] gap-0.5">
//                             {brushSizes.map((size) => (
//                                 <button
//                                     key={size}
//                                     type="button"
//                                     onClick={() => setBrushSize(size)}
//                                     className={cn("w-8 flex items-center justify-center rounded-[2px] transition-all py-2", brushSize === size ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-accent text-muted-foreground hover:text-foreground")}
//                                     title={`Size ${size}`}
//                                 >
//                                     <div className="w-5 rounded-[2px] bg-current transition-all" style={{ height: `${Math.max(1.5, size / 2.5)}px` }} />
//                                 </button>
//                             ))}
//                         </div>
//                     </div>

//                     {/* Shape Fill & Border Colors — only when a shape tool is active */}
//                     {isShapeTool && (
//                         <div className="flex flex-col gap-4 py-2 border-t border-border w-full items-center mb-6 animate-in slide-in-from-bottom-2 duration-300">
//                              {/* Fill Color */}
//                              <div className="flex flex-col gap-2 items-center">
//                                 <span className="text-[7px] font-black uppercase tracking-widest text-muted-foreground text-center">Fill</span>
//                                 <div className="grid grid-cols-2 gap-1 px-1">
//                                     {fillColors.map((c) => (
//                                         <button
//                                             key={c}
//                                             onClick={() => setShapeFillColor(c)}
//                                             className={cn(
//                                                 "w-4 h-4 rounded-sm border transition-all duration-200",
//                                                 shapeFillColor === c ? "border-white scale-110 z-10 shadow-sm" : "border-transparent hover:scale-110"
//                                             )}
//                                             style={c === "transparent" ? {
//                                                 backgroundImage: "linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)",
//                                                 backgroundPosition: "0 0, 2px 2px",
//                                                 backgroundSize: "4px 4px",
//                                                 backgroundColor: "white"
//                                             } : { backgroundColor: c }}
//                                             title={c === "transparent" ? "No Fill" : c}
//                                         >
//                                             {c === "transparent" && <div className="w-full h-full flex items-center justify-center"><div className="w-[1px] h-[120%] bg-red-500 rotate-45 shadow-sm" /></div>}
//                                         </button>
//                                     ))}
//                                     <button
//                                         ref={fillButtonRef}
//                                         onClick={() => toggleFillPicker()}
//                                         className="w-4 h-4 rounded-sm border border-dashed border-muted-foreground flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors"
//                                     >
//                                         <Palette size={8} />
//                                     </button>
//                                 </div>
//                                 {showFillPicker && fillPickerPos && ReactDOM.createPortal(
//                                     <>
//                                         <div className="fixed inset-0 z-9998" onClick={() => setShowFillPicker(false)} />
//                                         <div className="fixed z-9999 animate-in fade-in slide-in-from-left-2 duration-200" style={{ top: fillPickerPos.top, left: fillPickerPos.left }}>
//                                             <div className="p-1.5 bg-sidebar border border-border rounded-[5px] shadow-2xl">
//                                                 <ColorPicker color={shapeFillColor} onChange={(hex) => setShapeFillColor(hex)} />
//                                             </div>
//                                         </div>
//                                     </>,
//                                     document.body
//                                 )}
//                             </div>

//                              {/* Border Color */}
//                              <div className="flex flex-col gap-2 items-center">
//                                 <span className="text-[7px] font-black uppercase tracking-widest text-muted-foreground text-center">Border</span>
//                                 <div className="grid grid-cols-2 gap-1 px-1">
//                                     {borderColors.map((c) => (
//                                         <button
//                                             key={c}
//                                             onClick={() => setShapeBorderColor(c)}
//                                             className={cn(
//                                                 "w-4 h-4 rounded-full border-2 transition-all duration-200",
//                                                 shapeBorderColor === c ? "border-white scale-110 z-10 shadow-sm" : "border-transparent hover:scale-110"
//                                             )}
//                                             style={{ backgroundColor: c }}
//                                             title={c}
//                                         />
//                                     ))}
//                                     <button
//                                         ref={borderButtonRef}
//                                         onClick={() => toggleBorderPicker()}
//                                         className="w-4 h-4 rounded-full border-2 border-dashed border-muted-foreground flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors"
//                                     >
//                                         <Palette size={8} />
//                                     </button>
//                                 </div>
//                                 {showBorderPicker && borderPickerPos && ReactDOM.createPortal(
//                                     <>
//                                         <div className="fixed inset-0 z-9998" onClick={() => setShowBorderPicker(false)} />
//                                         <div className="fixed z-9999 animate-in fade-in slide-in-from-left-2 duration-200" style={{ top: borderPickerPos.top, left: borderPickerPos.left }}>
//                                             <div className="p-1.5 bg-sidebar border border-border rounded-[5px] shadow-2xl">
//                                                 <ColorPicker color={shapeBorderColor} onChange={(hex) => setShapeBorderColor(hex)} />
//                                             </div>
//                                         </div>
//                                     </>,
//                                     document.body
//                                 )}
//                             </div>
//                         </div>
//                     )}
//                     {isShapeTool && (
//                         <>
//                         </>
//                     )}
//                 </div>

//                 {/* Bottom fade scroll affordance — visible only when more content is below */}
//                 {canScrollDown && (
//                     <div
//                         className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 flex items-end justify-center pb-1"
//                         style={{ background: "linear-gradient(to bottom, transparent, var(--sidebar))" }}
//                     >
//                         <svg className="w-3 h-3 text-muted-foreground opacity-60 animate-bounce" viewBox="0 0 10 10" fill="currentColor">
//                             <path d="M2 3 L8 3 L5 8 Z" />
//                         </svg>
//                     </div>
//                 )}
//             </div>
//         </nav>
//     )
// }