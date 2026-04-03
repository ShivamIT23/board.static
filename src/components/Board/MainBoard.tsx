"use client"

import React, { useState } from "react"
// Import new sub-components
import Toolbar from "./Toolbar"
import Whiteboard from "./Whiteboard"
import ChatRoom from "./ChatRoom"
import ThemeToggle from "../theme-toggle"

interface MainBoardProps {
    sessionId: string
    role: "teacher" | "student"
    userName: string
}

export default function MainBoard({ sessionId, role, userName }: MainBoardProps) {
    // Board State
    const [tool, setTool] = useState("pencil")
    const [color, setColor] = useState("#FFFFFF")
    const [boardColor, setBoardColor] = useState("#18181b")
    const [brushSize, setBrushSize] = useState(3)
    const [isLocked, setIsLocked] = useState(false)
    const [userCount, setUserCount] = useState(1) // Static count for preview


    const updateBoardBackground = (newColor: string) => {
        // Only update local state in static mode
        setBoardColor(newColor)
    }

    return (
        <div className="flex flex-col w-screen h-screen bg-background text-foreground overflow-hidden font-sans">
            {/* Minimal Board Header */}
            <header className="h-14 border-b border-border bg-header flex items-center justify-between px-6 z-40 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-black text-lg italic">B</span>
                        </div>
                        <span className="text-primary font-bold tracking-tighter text-xl">Board</span>
                    </div>
                    <div className="h-6 w-px bg-border mx-2" />
                    <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest leading-none mb-1">Active Session</span>
                        <span className="text-xs text-foreground font-medium">{sessionId}</span>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <ThemeToggle />
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-muted rounded-full border border-border">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">{userCount} Connected</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest leading-none mb-1">{role}</p>
                            <p className="text-sm text-foreground font-bold">{userName}</p>
                        </div>
                        <div className="w-10 h-10 bg-linear-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-black">
                            {userName.charAt(0).toUpperCase()}
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* 1. Sidebar Tools */}
                <Toolbar
                    tool={tool}
                    setTool={setTool}
                    role={role}
                    color={color}
                    setColor={setColor}
                    boardColor={boardColor}
                    setBoardColor={updateBoardBackground}
                    brushSize={brushSize}
                    setBrushSize={setBrushSize}
                />

                {/* 2. Main Drawing Canvas */}
                <div className="flex-1 overflow-hidden relative">
                    <Whiteboard
                        sessionId={sessionId}
                        role={role}
                        tool={tool}
                        color={color}
                        boardColor={boardColor}
                        brushSize={brushSize}
                        isLocked={isLocked}
                    />
                </div>

                {/* 3. Real-time Chat Panel */}
                <ChatRoom
                    sessionId={sessionId}
                    role={role}
                    userName={userName}
                />
            </div>
        </div>
    )
}
