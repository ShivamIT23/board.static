"use client"

import React, { useState, useEffect, useRef } from "react"
import { MessageCircle, Send, Minimize2, User2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface ChatMessage {
    user: { name: string; isTeacher: boolean }
    message: string
    timestamp: number
}

interface ChatRoomProps {
    userCount: number
    role: "teacher" | "student"
    userName: string
    sessionId: string
}

interface Visitor {
    id: number;
    name: string;
    email: string | null;
    joinedAt: string;
}

export default function ChatRoom({ userCount, role, userName, sessionId }: ChatRoomProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [inputMessage, setInputMessage] = useState("")
    const [isOpen, setIsOpen] = useState(true)
    const [showVisitors, setShowVisitors] = useState(false)
    const [visitors, setVisitors] = useState<Visitor[]>([])
    const [isLoadingVisitors, setIsLoadingVisitors] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)
    const visitorsRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        // Close visitors list when clicking outside
        function handleClickOutside(event: MouseEvent) {
            if (visitorsRef.current && !visitorsRef.current.contains(event.target as Node)) {
                setShowVisitors(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const fetchVisitors = async () => {
        if (role !== "teacher") return
        setIsLoadingVisitors(true)
        try {
            const res = await fetch(`/api/session/visitors?sessionId=${sessionId}`)
            const data = await res.json()
            if (data.visitors) {
                setVisitors(data.visitors)
            }
        } catch (error) {
            console.error("Failed to fetch visitors:", error)
        } finally {
            setIsLoadingVisitors(false)
        }
    }

    const toggleVisitors = () => {
        if (role !== "teacher") return
        if (!showVisitors) {
            fetchVisitors()
        }
        setShowVisitors(!showVisitors)
    }

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages])


    const sendMessage = (e: React.FormEvent) => {
        e.preventDefault()
        if (!inputMessage.trim()) return

        // Directly add message to local state in static mode
        const newMessage: ChatMessage = {
            message: inputMessage,
            user: { name: userName, isTeacher: role === "teacher" },
            timestamp: Date.now()
        }
        setMessages((prev: ChatMessage[]) => [...prev, newMessage])
        setInputMessage("")
    }

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all z-50"
            >
                <MessageCircle size={24} />
            </button>
        )
    }

    return (
        <aside className="w-80 flex flex-col bg-card border-l border-border transition-all duration-300 z-30 shrink-0 h-full relative">
            <div className="h-14 flex items-center justify-between px-6 border-b border-border shrink-0">
                <span className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">Chat</span>
                <div className="flex items-center gap-2 relative">
                    <button
                        id="users"
                        onClick={toggleVisitors}
                        className={cn(
                            "p-1.5 text-muted-foreground flex gap-1 items-center hover:text-foreground transition-colors",
                            showVisitors && "text-foreground bg-muted rounded-md"
                        )}
                        title={role === "teacher" ? "View all visitors" : "Active users"}
                    >
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />{userCount}<User2 size={16} />
                    </button>

                    {/* Visitors Dropdown */}
                    {showVisitors && role === "teacher" && (
                        <div
                            ref={visitorsRef}
                            className="absolute top-10 right-0 w-44 bg-card border border-border rounded-[5px] shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in duration-200"
                        >
                            {/* <div className="p-3 border-b border-border bg-muted/50">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Session Visitors</h3>
                            </div> */}
                            <div className="max-h-64 overflow-y-auto custom-scrollbar">
                                {isLoadingVisitors ? (
                                    <div className="p-8 flex justify-center">
                                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                    </div>
                                ) : visitors.length === 0 ? (
                                    <div className="p-6 text-center text-[10px] text-muted-foreground font-bold uppercase tracking-widest leading-relaxed">
                                        No visitors recorded
                                    </div>
                                ) : (
                                    <div className="py-2">
                                        {visitors.map((visitor) => (
                                            <div key={visitor.id} className="px-2 py-1 hover:bg-muted/50 transition-colors group">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                                                        {visitor.name}
                                                    </span>
                                                    <div className="flex items-center justify-between mt-0.5">
                                                        <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                                                            {visitor.email || "No email"}
                                                        </span>
                                                        <span className="text-[8px] text-muted-foreground font-black opacity-60">
                                                            {new Date(visitor.joinedAt).toLocaleTimeString([], {
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                                timeZone: 'UTC'
                                                            })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <button onClick={() => setIsOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground">
                        <Minimize2 size={16} />
                    </button>
                </div>
            </div>

            {/* Messages Stack */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-muted/30">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4">
                        <div className="p-6 rounded-full bg-muted border border-border">
                            <MessageCircle size={40} className="text-zinc-200" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em]">No Chats</p>
                    </div>
                ) : (
                    messages.map((msg, i) => (
                        <div key={i} className={cn(
                            "flex flex-col max-w-[85%]",
                            msg.user.name === userName ? "items-end ml-auto" : "items-start"
                        )}>
                            <div className="flex items-center gap-2 mb-1 px-1">
                                <span className={cn(
                                    "text-[9px] font-black uppercase tracking-widest",
                                    msg.user.isTeacher ? "text-primary font-bold" : "text-muted-foreground"
                                )}>
                                    {msg.user.name} {msg.user.isTeacher && "(Instructor)"}
                                </span>
                                <span className="text-[8px] text-muted-foreground font-bold">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div className={cn(
                                "px-4 py-3 rounded-[5px] text-sm font-medium leading-relaxed shadow-sm",
                                msg.user.name === userName
                                    ? "bg-primary text-primary-foreground rounded-tr-none"
                                    : "bg-card border border-border text-foreground rounded-tl-none"
                            )}>
                                {msg.message}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Input Processor */}
            <form onSubmit={sendMessage} className=" bg-card border-t border-border flex">
                <div className="flex gap-3 w-full items-center bg-muted border border-border p-1 pr-2 focus-within:border-primary box-border focus-within:ring-0 focus-within:ring-offset-0 transition-all">
                    <input
                        type="text"
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        placeholder="Send a message..."
                        className="flex-1 h-10 px-3 bg-transparent text-sm font-medium outline-none text-foreground placeholder:text-muted-foreground"
                    />

                </div>
                <button
                    type="submit"
                    disabled={!inputMessage.trim()}
                    className="w-14 h-full flex items-center justify-center bg-[#6366F1] text-white hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                    <Send size={18} />
                </button>
            </form>
        </aside>
    )
}
