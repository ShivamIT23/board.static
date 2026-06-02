// ── Shape tool IDs & geometry helpers ──────────────────────────

export const SHAPE_TOOL_IDS = ["rectangle", "square", "circle", "triangle", "right-triangle", "diamond", "rhombus", "star", "line", "arrow", "ellipse", "pentagon", "parallelogram", "graph-axis", "large-grid", "graph-plain", "graph-labeled"] as const

export function isShapeTool(t: string): boolean {
    return (SHAPE_TOOL_IDS as readonly string[]).includes(t) ||
        (SHAPE_TOOL_IDS as readonly string[]).includes(t.replace(/^f-/, '')) ||
        t.startsWith("large-grid:") || t.startsWith("graph-plain:") || t.startsWith("graph-labeled:") || t.startsWith("symbol:") || t.startsWith("emoji:")
}

// ── Polygon point generators ──────────────────────────────────

export function getTrianglePoints(w: number, h: number) {
    return [{ x: w / 2, y: 0 }, { x: w, y: h }, { x: 0, y: h }]
}

export function getRightTrianglePoints(w: number, h: number) {
    return [{ x: 0, y: 0 }, { x: w, y: h }, { x: 0, y: h }]
}

export function getDiamondPoints(w: number, h: number) {
    return [{ x: w / 2, y: 0 }, { x: w, y: h / 2 }, { x: w / 2, y: h }, { x: 0, y: h / 2 }]
}

export function getPentagonPoints(w: number, h: number) {
    const cx = w / 2, cy = h / 2
    const r = Math.min(w, h) / 2
    const pts = []
    for (let i = 0; i < 5; i++) {
        const angle = (Math.PI / 2) * -1 + (Math.PI * 2 / 5) * i
        pts.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) })
    }
    return pts
}

export function getParallelogramPoints(w: number, h: number) {
    const offset = w * 0.25
    return [{ x: offset, y: 0 }, { x: w, y: 0 }, { x: w - offset, y: h }, { x: 0, y: h }]
}

export function getStarPoints(w: number, h: number) {
    const cx = w / 2, cy = h / 2
    const outerR = Math.min(w, h) / 2, innerR = outerR * 0.4
    const pts: { x: number; y: number }[] = []
    for (let i = 0; i < 10; i++) {
        const angle = (Math.PI / 2) * -1 + (Math.PI / 5) * i
        const r = i % 2 === 0 ? outerR : innerR
        pts.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) })
    }
    return pts
}
