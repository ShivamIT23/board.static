"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"

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
    // Row 1 — Deep Grays & Blacks
    "#000000", "#09090b", "#18181b", "#27272a", "#3f3f46", "#52525b", "#71717a", "#a1a1aa",
    // Row 2 — Deep Reds / Earth
    "#450a0a", "#7f1d1d", "#991b1b", "#b91c1c", "#7c2d12", "#9a3412", "#c2410c", "#ea580c",
    // Row 3 — Deep Greens / Teals
    "#064e3b", "#065f46", "#047857", "#059669", "#134e4a", "#115e59", "#0f766e", "#0d9488",
    // Row 4 — Deep Blues / Purples
    "#0f172a", "#1e293b", "#1e3a8a", "#1d4ed8", "#2e1065", "#4c1d95", "#5b21b6", "#6d28d9",
]

interface BackgroundPickerProps {
    color: string
    onChange: (hex: string) => void
}

export default function BackgroundPicker({ color, onChange }: BackgroundPickerProps) {
    const { h: initH, s: initS, v: initV } = hexToHsv(color || "#18181b")

    // Track previous prop to manually derive state changes
    const [prevColorProp, setPrevColorProp] = useState(color)

    const [hue, setHue] = useState(initH)
    const [sat, setSat] = useState(initS)
    const [val, setVal] = useState(initV)
    const [hexInput, setHexInput] = useState(color || "#18181b")

    const svCanvasRef = useRef<HTMLDivElement>(null)
    const hueBarRef = useRef<HTMLDivElement>(null)
    const draggingSV = useRef(false)
    const draggingHue = useRef(false)

    const currentHex = hsvToHex(hue, sat, val)

    if (color !== prevColorProp) {
        setPrevColorProp(color)

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
            {/* Preset grid first as requested */}
            <div className="cp-presets">
                {PRESET_COLORS.map((c) => (
                    <button
                        key={c}
                        className={`cp-preset-btn ${color.toUpperCase() === c.toUpperCase() ? "cp-preset-active" : ""}`}
                        style={{ backgroundColor: c }}
                        onClick={() => {
                            const { h, s, v } = hexToHsv(c)
                            setHue(h)
                            setSat(s)
                            setVal(v)
                            setHexInput(c)
                            onChange(c)
                        }}
                    />
                ))}
            </div>

            <div className="w-full h-px bg-border/40 my-3" />

            {/* Saturation / Value panel */}
            <div
                ref={svCanvasRef}
                className="cp-sv-panel"
                style={{ backgroundColor: hueColor }}
                onMouseDown={onSVMouseDown}
            >
                <div className="cp-sv-white" />
                <div className="cp-sv-black" />
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
                    className="cp-hex-input uppercase"
                    value={hexInput}
                    onChange={handleHexChange}
                    spellCheck={false}
                    maxLength={7}
                />
            </div>
        </div>
    )
}
