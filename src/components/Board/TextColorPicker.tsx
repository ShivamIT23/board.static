"use client"
import React, { useCallback, useRef, useState } from "react"
import ReactDOM from "react-dom"
import { Palette } from "lucide-react"
import { cn } from "@/lib/utils"
import ColorPicker from "./ColorPicker"

interface TextColorPickerProps {
    color: string
    onChange: (color: string) => void
}

export default function TextColorPicker({ color, onChange }: TextColorPickerProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)

    const toggle = useCallback(() => {
        if (isOpen) {
            setIsOpen(false)
            return
        }
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect()
            const pickerHeight = 420
            const top = Math.max(8, Math.min(window.innerHeight - pickerHeight - 8, rect.top - pickerHeight / 2 + rect.height / 2))
            setPos({ top, left: rect.right + 16 })
        }
        setIsOpen(true)
    }, [isOpen])

    const handleColorChange = (hex: string) => {
        onChange(hex)
        setIsOpen(false) // Close after selecting
    }

    return (
        <div className="flex flex-col gap-2 items-center mb-2 w-fit animate-in slide-in-from-bottom-2 duration-300">
            <span className="text-[7px] font-black uppercase tracking-widest text-muted-foreground text-center">Text</span>
            <div className="grid grid-cols-2 gap-1">
                <button
                    type="button"
                    onClick={() => handleColorChange("#FFFFFF")}
                    className={cn(
                        "w-3.5 h-3.5 rounded-sm border transition-all duration-200",
                        color === "#FFFFFF" ? "border-foreground scale-110 z-10 shadow-sm" : "border-muted-foreground/30 hover:scale-110"
                    )}
                    style={{ backgroundColor: "#FFFFFF" }}
                    title="Default (White)"
                />
                <button
                    ref={buttonRef}
                    type="button"
                    onClick={toggle}
                    className={cn(
                        "w-3.5 h-3.5 rounded-sm border border-dashed border-muted-foreground flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors",
                        isOpen && "bg-accent text-foreground border-foreground"
                    )}
                    title="Custom Color"
                >
                    <Palette size={8} />
                </button>
            </div>

            {isOpen && pos && ReactDOM.createPortal(
                <>
                    <div className="fixed inset-0 z-9998" onClick={() => setIsOpen(false)} />
                    <div
                        className="fixed z-9999 animate-in fade-in slide-in-from-left-2 duration-200"
                        style={{ top: pos.top, left: pos.left }}
                    >
                        <div className="p-1.5 bg-sidebar border border-border rounded-[5px] shadow-2xl">
                            <ColorPicker
                                color={color}
                                onChange={handleColorChange}
                            />
                        </div>
                    </div>
                </>,
                document.body
            )}
        </div>
    )
}
