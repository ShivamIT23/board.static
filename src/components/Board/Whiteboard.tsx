"use client"

import React, { useEffect, useRef } from "react"
import { Canvas, PencilBrush, util, FabricObject, TEvent } from "fabric"

interface WhiteboardProps {
    sessionId: string
    role: "teacher" | "student"
    tool: string
    color: string
    boardColor: string
    brushSize: number
    isLocked: boolean
}

export default function Whiteboard({ sessionId, role, tool, color, boardColor, brushSize, isLocked }: WhiteboardProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const fabricRef = useRef<Canvas | null>(null)

    // Initial Canvas Setup
    useEffect(() => {
        if (!canvasRef.current || !containerRef.current) return

        const canvas = new Canvas(canvasRef.current, {
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
            backgroundColor: boardColor,
            isDrawingMode: true
        })

        fabricRef.current = canvas
        canvas.freeDrawingBrush = new PencilBrush(canvas)
        if (canvas.freeDrawingBrush) {
            canvas.freeDrawingBrush.color = color
            canvas.freeDrawingBrush.width = brushSize
        }
        // ... (lines 40-106 remain largely the same, but I'll replace the whole block for certainty)
        canvas.on("path:created", (e: TEvent & { path: FabricObject }) => {
            if (role === "student" && isLocked) {
                canvas.remove(e.path)
                return
            }
            const path = e.path
            path.selectable = role === "teacher"
            // socket?.emit("stroke_end", ...) removed for static mode
        })

        const handleResize = () => {
            if (!containerRef.current) return
            canvas.setDimensions({
                width: containerRef.current.clientWidth,
                height: containerRef.current.clientHeight
            })
            canvas.renderAll()
        }
        window.addEventListener("resize", handleResize)

        return () => {
            canvas.dispose()
            window.removeEventListener("resize", handleResize)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId, role])

    // Sync Board Background
    useEffect(() => {
        if (fabricRef.current) {
            fabricRef.current.backgroundColor = boardColor
            fabricRef.current.renderAll()
        }
    }, [boardColor])

    // Incoming Socket Synchronization - DISABLED for static version
    useEffect(() => {
        return () => { }
    }, [role, boardColor])

    // Local Tool Sync
    useEffect(() => {
        if (!fabricRef.current) return
        const canvas = fabricRef.current

        switch (tool) {
            case "pencil":
                canvas.isDrawingMode = true
                if (canvas.freeDrawingBrush) {
                    canvas.freeDrawingBrush.color = color
                    canvas.freeDrawingBrush.width = brushSize
                }
                break
            case "eraser":
                canvas.isDrawingMode = true
                if (canvas.freeDrawingBrush) {
                    canvas.freeDrawingBrush.color = boardColor // Erase by matching board background
                    canvas.freeDrawingBrush.width = brushSize * 4
                }
                break
            default:
                canvas.isDrawingMode = false
                break
        }
    }, [tool, color, brushSize, boardColor])

    return (
        <div ref={containerRef} className="flex-1 h-full bg-background relative overflow-hidden flex items-center justify-center p-6">
            <div
                className="w-full h-full rounded-2xl overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)] dark:shadow-[0_0_20px_rgba(255,255,255,0.2)] border border-border transition-all duration-400"
                style={{ backgroundColor: boardColor }}
            >
                <canvas className="h-full w-full" ref={canvasRef} />
            </div>
        </div>
    )
}
