"use client"

import React, { useState, useEffect, useRef } from "react"
import { MessageCircle, Send, Minimize2, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface ChatMessage {
    user: { name: string; isTeacher: boolean }
    message: string
    timestamp: number
}

interface ChatRoomProps {
    sessionId: string
    role: "teacher" | "student"
    userName: string
}

export default function ChatRoom({ sessionId, role, userName }: ChatRoomProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [inputMessage, setInputMessage] = useState("")
    const [isOpen, setIsOpen] = useState(true)
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        // No socket listeners for static mode
        return () => { }
    }, [])

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
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Chat and Communicate</span>
                <div className="flex items-center gap-2">
                    <button className="p-1.5 text-muted-foreground hover:text-foreground"><Minimize2 size={16} /></button>
                    <button onClick={() => setIsOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground"><X size={16} /></button>
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
            <form onSubmit={sendMessage} className="p-6 bg-card border-t border-border">
                <div className="flex gap-3 items-center bg-muted border border-border rounded-[5px] p-1 pr-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                    <input
                        type="text"
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        placeholder="Send a message..."
                        className="flex-1 h-10 px-3 bg-transparent text-sm font-medium outline-none text-foreground placeholder:text-muted-foreground"
                    />
                    <button
                        type="submit"
                        disabled={!inputMessage.trim()}
                        className="w-10 h-10 flex items-center justify-center bg-primary text-primary-foreground rounded-[5px] hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    >
                        <Send size={18} />
                    </button>
                </div>
            </form>
        </aside>
    )
}
