"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { Check } from "lucide-react"
import { getContrastColor } from "@/lib/utils"

// ── HSV ↔ Hex helpers ────────────────────────────────────────

function hsvToHex(h: number, s: number, v: number): string {
    const f = (n: number) => {
        const k = (n + h / 60) % 6
        return v - v * s * Math.max(Math.min(k, 4 - k, 1), 0)
    }
    const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0")
    return `#${toHex(f(5))}${toHex(f(3))}${toHex(f(1))}`
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
    const r = parseInt(hex.slice(1, 3), 16) / 255
    const g = parseInt(hex.slice(3, 5), 16) / 255
    const b = parseInt(hex.slice(5, 7), 16) / 255

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const d = max - min

    let h = 0
    if (d !== 0) {
        if (max === r) h = ((g - b) / d + 6) % 6
        else if (max === g) h = (b - r) / d + 2
        else h = (r - g) / d + 4
        h *= 60
    }

    const s = max === 0 ? 0 : d / max
    return { h, s, v: max }
}

// ── Preset grid — 8 cols × 4 rows = 32 colors ───────────────

const PRESET_COLORS = [
    // Row 1 — Bold saturated
    "#FF0000", "#FF8800", "#FFDD00", "#00CC44", "#0088FF", "#8844FF", "#FF44AA", "#FFFFFF",
    // Row 2 — Medium tones
    "#FF4D4D", "#FFB347", "#FFE766", "#66DD88", "#4DB8FF", "#AA77FF", "#FF88CC", "#BBBBBB",
    // Row 3 — Pastels
    "#FF9999", "#FFD699", "#FFF099", "#99EEBB", "#99D6FF", "#CCAAFF", "#FFAADD", "#666666",
    // Row 4 — Lights + B&W
    "#FFCCCC", "#FFEBCC", "#FFF8CC", "#CCFFDD", "#CCE9FF", "#E5D4FF", "#FFDDEE", "#000000",
]

interface ColorPickerProps {
    color: string
    onChange: (hex: string) => void
}

export default function ColorPicker({ color, onChange }: ColorPickerProps) {
    const { h: initH, s: initS, v: initV } = hexToHsv(color || "#ffffff")

    // Track previous prop to manually derive state changes
    const [prevColorProp, setPrevColorProp] = useState(color)

    const [hue, setHue] = useState(initH)
    const [sat, setSat] = useState(initS)
    const [val, setVal] = useState(initV)
    const [hexInput, setHexInput] = useState(color || "#ffffff")

    const svCanvasRef = useRef<HTMLDivElement>(null)
    const hueBarRef = useRef<HTMLDivElement>(null)
    const draggingSV = useRef(false)
    const draggingHue = useRef(false)

    const currentHex = hsvToHex(hue, sat, val)

    if (color !== prevColorProp) {
        setPrevColorProp(color)

        // Only override local state if the incoming color is genuinely different 
        // from our current state. This prevents the hue slider from snapping back 
        // to red (0) if the user drags saturation to 0.
        if (color.toUpperCase() !== currentHex.toUpperCase()) {
            const { h, s, v } = hexToHsv(color)
            setHue(h)
            setSat(s)
            setVal(v)
            setHexInput(color)
        }
    }

    // Emit color on HSV change
    const emitColor = useCallback((h: number, s: number, v: number) => {
        const hex = hsvToHex(h, s, v)
        setHexInput(hex)
        onChange(hex)
    }, [onChange])

    // ── Saturation / Value panel drag ────────────────────────────

    const handleSVInteraction = useCallback((clientX: number, clientY: number) => {
        const rect = svCanvasRef.current?.getBoundingClientRect()
        if (!rect) return
        const s = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
        const v = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height))
        setSat(s)
        setVal(v)
        emitColor(hue, s, v)
    }, [hue, emitColor])

    const onSVMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        draggingSV.current = true
        handleSVInteraction(e.clientX, e.clientY)
    }, [handleSVInteraction])

    // ── Hue slider drag ──────────────────────────────────────────

    const handleHueInteraction = useCallback((clientX: number) => {
        const rect = hueBarRef.current?.getBoundingClientRect()
        if (!rect) return
        const h = Math.max(0, Math.min(360, (clientX - rect.left) / rect.width * 360))
        setHue(h)
        emitColor(h, sat, val)
    }, [sat, val, emitColor])

    const onHueMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        draggingHue.current = true
        handleHueInteraction(e.clientX)
    }, [handleHueInteraction])

    // Global mouse handlers
    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (draggingSV.current) handleSVInteraction(e.clientX, e.clientY)
            if (draggingHue.current) handleHueInteraction(e.clientX)
        }
        const onMouseUp = () => {
            draggingSV.current = false
            draggingHue.current = false
        }
        window.addEventListener("mousemove", onMouseMove)
        window.addEventListener("mouseup", onMouseUp)
        return () => {
            window.removeEventListener("mousemove", onMouseMove)
            window.removeEventListener("mouseup", onMouseUp)
        }
    }, [handleSVInteraction, handleHueInteraction])

    // Hex input handling
    const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value
        setHexInput(v)
        if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
            const { h, s, v: bri } = hexToHsv(v)
            setHue(h)
            setSat(s)
            setVal(bri)
            onChange(v)
        }
    }

    const hueColor = hsvToHex(hue, 1, 1)

    return (
        <div className="color-picker-safari">
            {/* Saturation / Value panel */}
            <div
                ref={svCanvasRef}
                className="cp-sv-panel"
                style={{ backgroundColor: hueColor }}
                onMouseDown={onSVMouseDown}
            >
                {/* White → transparent horizontal gradient */}
                <div className="cp-sv-white" />
                {/* Transparent → black vertical gradient */}
                <div className="cp-sv-black" />
                {/* Thumb */}
                <div
                    className="cp-sv-thumb"
                    style={{
                        left: `${sat * 100}%`,
                        top: `${(1 - val) * 100}%`,
                        backgroundColor: currentHex,
                    }}
                />
            </div>

            {/* Hue bar */}
            <div
                ref={hueBarRef}
                className="cp-hue-bar"
                onMouseDown={onHueMouseDown}
            >
                <div
                    className="cp-hue-thumb"
                    style={{
                        left: `${(hue / 360) * 100}%`,
                        backgroundColor: hueColor,
                    }}
                />
            </div>

            {/* Current preview + hex input */}
            <div className="cp-preview-row">
                <div
                    className="cp-preview-swatch"
                    style={{ backgroundColor: currentHex }}
                />
                <input
                    className="cp-hex-input"
                    value={hexInput}
                    onChange={handleHexChange}
                    spellCheck={false}
                    maxLength={7}
                />
            </div>

            {/* Preset grid */}
            <div className="cp-presets">
                {PRESET_COLORS.map((c) => {
                    const isActive = color.toUpperCase() === c.toUpperCase()
                    const contrastColor = getContrastColor(c)
                    return (
                        <button
                            key={c}
                            className={`cp-preset-btn flex items-center justify-center ${isActive ? "cp-preset-active" : ""}`}
                            style={{ backgroundColor: c }}
                            onClick={() => {
                                const { h, s, v } = hexToHsv(c)
                                setHue(h)
                                setSat(s)
                                setVal(v)
                                setHexInput(c)
                                onChange(c)
                            }}
                        >
                            {isActive && <Check size={10} style={{ color: contrastColor }} strokeWidth={4} />}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
