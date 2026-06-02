// ── HSV ↔ Hex color conversion helpers ────────────────────────

export function hsvToHex(h: number, s: number, v: number): string {
    const f = (n: number) => {
        const k = (n + h / 60) % 6
        return v - v * s * Math.max(Math.min(k, 4 - k, 1), 0)
    }
    const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0")
    return `#${toHex(f(5))}${toHex(f(3))}${toHex(f(1))}`
}

export function hexToHsv(hex: string): { h: number; s: number; v: number } {
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
