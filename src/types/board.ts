import { FabricObject, IText } from "fabric"

export type BoardFabricObject = FabricObject & { id?: string; _synced?: boolean };
export type BoardIText = IText & { id?: string; _synced?: boolean };

// ── Whiteboard payload interfaces ─────────────────────────────

export interface WhiteboardProps {
    sessionId: string
    role: "teacher" | "student"
    tool: string
    color: string
    boardColor: string
    bgImages?: string[]       // array of data URLs for stacked PDF pages
    brushSize: number
    currentPage: number
    onToolChange?: (tool: string) => void
    shapeBorderColor?: string
    drawingEnabled?: boolean
    isViewLocked: boolean
    textColor?: string
    fontSize?: number
    setFontSize?: (size: number) => void
    fontFamily?: string
    setFontFamily?: (family: string) => void
}

export interface ShapePayload {
    id: string;
    page?: number;
    shapeType: string;
    position: { x: number; y: number };
    widthRatio?: number;
    heightRatio?: number;
    fill?: string;
    stroke?: string;
    strokeWidthRatio?: number;
    timestamp?: number;
}

export interface TextPayload {
    id: string;
    page?: number;
    text?: string;
    color?: string;
    fontSize?: number;
    fontSizeRatio?: number;
    fontFamily?: string;
    position: { x: number; y: number };
    timestamp?: number;
}

export interface ImagePayload {
    id: string;
    url: string;
    position: { x: number; y: number };
    widthRatio?: number;
    heightRatio?: number;
    scale?: number;
    addedBy?: string;
    page?: number;
}

export interface FullStrokePayload {
    id: string;
    points: { x: number; y: number }[];
    color: string;
    width: number;
    page?: number;
    timestamp?: number;
    strokeLineCap?: CanvasLineCap;
    // Saved position after user moved it
    movedPosition?: { x: number; y: number };
    movedWidthRatio?: number;
    movedHeightRatio?: number;
}

export interface StoredBoardObject {
    type: string;
    payload: FullStrokePayload | TextPayload | ShapePayload | ImagePayload;
    timestamp: number;
}

export interface StrokePayload {
    id: string
    type: "start" | "draw" | "end"
    point: { x: number; y: number }
    color?: string
    width?: number
    page?: number
    strokeLineCap?: CanvasLineCap
}

export interface LaserPayload {
    point: { x: number; y: number }
    prevPoint?: { x: number; y: number } | null
}

export interface LiveStroke {
    points: Array<{ x: number; y: number }>
    color: string
    width: number
}
