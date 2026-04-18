"use client"

import React from "react"
import { MessageSquare, MessageSquareOff, Pencil, PencilOff, File as FileIcon, FileX } from "lucide-react"
import { cn } from "@/lib/utils"
import { RoomUser, Visitor } from "./ChatRoom"
import type { Socket } from "socket.io-client"

interface UserListProps {
    roomUsers: RoomUser[]
    role: "teacher" | "student"
    visitors: Visitor[]
    isLoadingVisitors: boolean
    toggleUserPermission: (userId: string, type: "text" | "attachments" | "drawing", currentEnabled: boolean) => void
    socket: Socket | null
}

export default function UserList({
    roomUsers,
    role,
    visitors,
    isLoadingVisitors,
    toggleUserPermission,
    socket
}: UserListProps) {
    return (
        <div className="flex flex-col">
            <div className="p-3 border-b border-border bg-muted/50">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    {role === "teacher" ? "Online & Visitors" : "Online Users"}
                </h3>
            </div>
            <div className="max-h-64 overflow-y-auto custom-scrollbar">
                {/* Online Users Section */}
                <div className="py-2 border-b border-border">
                    <div className="px-3 mb-1">
                        <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-tighter">Online ({roomUsers.length})</span>
                    </div>
                    {roomUsers.length === 0 ? (
                        <div className="px-3 py-2 text-[10px] text-muted-foreground italic">No one online</div>
                    ) : role === "teacher" ? (
                        [...roomUsers]
                            .sort((a, b) => (a.role === "teacher" ? -1 : b.role === "teacher" ? 1 : 0))
                            .map((user) => (
                                <div key={user.socket_id} className="px-3 py-1.5 hover:bg-muted/50 transition-colors flex items-center justify-between group">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                                            {user.username} {user.socket_id === socket?.id && "(You)"}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {user.socket_id !== socket?.id && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleUserPermission(user.user_id, "text", user.textEnabled ?? true)}
                                                    className={cn(
                                                        "p-1 rounded transition-colors",
                                                        user.textEnabled !== false ? "text-indigo-500 hover:bg-indigo-500/10" : "text-zinc-400 hover:bg-zinc-400/10"
                                                    )}
                                                    title={user.textEnabled !== false ? "Disable text" : "Enable text"}
                                                >
                                                    {user.textEnabled !== false ? <MessageSquare size={12} /> : <MessageSquareOff size={12} />}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleUserPermission(user.user_id, "drawing", user.drawingEnabled ?? true)}
                                                    className={cn(
                                                        "p-1 rounded transition-colors",
                                                        user.drawingEnabled !== false ? "text-blue-500 hover:bg-blue-500/10" : "text-zinc-400 hover:bg-zinc-400/10"
                                                    )}
                                                    title={user.drawingEnabled !== false ? "Disable drawing" : "Enable drawing"}
                                                >
                                                    {user.drawingEnabled !== false ? <Pencil size={12} /> : <PencilOff size={12} />}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleUserPermission(user.user_id, "attachments", user.attachmentsEnabled ?? true)}
                                                    className={cn(
                                                        "p-1 rounded transition-colors",
                                                        user.attachmentsEnabled !== false ? "text-amber-500 hover:bg-amber-500/10" : "text-zinc-400 hover:bg-zinc-400/10"
                                                    )}
                                                    title={user.attachmentsEnabled !== false ? "Disable files" : "Enable files"}
                                                >
                                                    {user.attachmentsEnabled !== false ? <FileIcon size={12} /> : <FileX size={12} />}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))
                    ) : (
                        <div className="px-3 py-3 text-[10px] text-muted-foreground leading-relaxed flex flex-col gap-1">
                            <p className="font-bold text-zinc-400">Student List is Private</p>
                            <p className="opacity-60 text-[9px]">Individual names are only visible to the instructor.</p>
                        </div>
                    )}
                </div>

                {/* Historical Visitors (Teacher only) */}
                {role === "teacher" && (
                    <div className="py-2">
                        <div className="px-3 mb-1">
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">Past Visitors</span>
                        </div>
                        {isLoadingVisitors ? (
                            <div className="p-4 flex justify-center">
                                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : visitors.filter(v => !roomUsers.some(ru => ru.username === v.name)).length === 0 ? (
                            <div className="px-3 py-2 text-[10px] text-muted-foreground italic">No other visitors</div>
                        ) : (
                            visitors.filter(v => !roomUsers.some(ru => ru.username === v.name)).map((visitor) => (
                                <div key={visitor.id} className="px-3 py-1.5 hover:bg-muted/50 transition-colors group flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-muted-foreground group-hover:text-foreground transition-colors">
                                            {visitor.name}
                                        </span>
                                        <span className="text-[8px] text-muted-foreground opacity-60">
                                            Last seen: {new Date(visitor.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
