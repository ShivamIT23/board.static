"use client"

import React, { useState, useEffect, useRef } from "react"
import { MessageCircle, Send, Minimize2, User2, Paperclip, FileText, X, Download, Settings, MessageSquare, MessageSquareOff, File as FileIcon, FileX, Lock, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSocket } from "../providers/socket-provider"
import { getHistoricalChats } from "@/app/actions/auth"
import { toast } from "sonner"

interface Attachment {
    id: string
    type: "image" | "file"
    url: string
    name: string
    size?: number
}

interface ChatMessage {
    id?: string
    user: { name: string; isTeacher: boolean }
    message: string
    timestamp: number
    attachments?: Attachment[]
}

interface RoomUser {
    user_id: string
    username: string
    socket_id: string
    isMuted?: boolean
    mediaState?: { audio: boolean; video: boolean }
    textEnabled?: boolean
    attachmentsEnabled?: boolean
}

interface ChatRoomProps {
    userCount: number
    roomUsers: RoomUser[]
    setRoomUsers: (users: RoomUser[]) => void
    setUserCount: (count: number) => void
    role: "teacher" | "student"
    userName: string
    sessionId: string
}

interface Visitor {
    id: number;
    name: string;
    email: string | null;
    joinedAt: string;
    isOnline?: boolean;
}

export default function ChatRoom({ userCount, roomUsers, setRoomUsers, setUserCount, role, userName, sessionId }: ChatRoomProps) {
    const { socket } = useSocket()
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [inputMessage, setInputMessage] = useState("")
    const [isOpen, setIsOpen] = useState(true)
    const [showVisitors, setShowVisitors] = useState(false)
    const [visitors, setVisitors] = useState<Visitor[]>([])
    const [isLoadingVisitors, setIsLoadingVisitors] = useState(false)
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const [canLoadMore, setCanLoadMore] = useState(true)
    const [typingUsers, setTypingUsers] = useState<Record<string, string>>({})
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [filePreview, setFilePreview] = useState<string | null>(null)
    const [roomSettings, setRoomSettings] = useState({
        chatEnabled: true,
        attachmentsEnabled: true
    })
    const [showSettings, setShowSettings] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)
    const isLoadMoreAction = useRef(false)
    const visitorsRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [showScrollButton, setShowScrollButton] = useState(false)

    // Socket listeners
    useEffect(() => {
        if (!socket) return

        socket.on("chat", ({ payload }: { payload: ChatMessage }) => {
            setMessages((prev) => {
                const key = `${payload.user.name}-${payload.message}-${payload.timestamp}`
                if (prev.some(m => `${m.user.name}-${m.message}-${m.timestamp}` === key)) return prev
                return [...prev, payload]
            })
        })

        socket.on("chat_state", ({ payload }: { payload: { settings: typeof roomSettings } }) => {
            if (payload.settings) {
                setRoomSettings(payload.settings)
                if (!payload.settings.chatEnabled && role === "student") {
                    toast.info("Chat has been disabled by the instructor")
                }
            }
        })

        socket.on("typing", ({ payload }: { payload: { user: { id: string, name: string }, isTyping: boolean } }) => {
            setTypingUsers((prev) => {
                const updated = { ...prev }
                if (payload.isTyping) {
                    updated[payload.user.id] = payload.user.name
                } else {
                    delete updated[payload.user.id]
                }
                return updated
            })
        })

        socket.on("chat_history", ({ payload }: { payload: ChatMessage[] }) => {
            setMessages((prev) => {
                const combined = [...prev, ...payload]
                const unique = Array.from(new Map(combined.map(m => [`${m.user.name}-${m.message}-${m.timestamp}`, m])).values())
                return unique.sort((a, b) => a.timestamp - b.timestamp)
            })
        })

        socket.on("room_users", ({ payload }: { payload: { count: number; users: RoomUser[] } }) => {
            setUserCount(payload.count)
            setRoomUsers(payload.users)
        })

        return () => {
            socket.off("chat_state")
            socket.off("chat")
            socket.off("chat_history")
            socket.off("typing")
            socket.off("room_users")
        }
    }, [socket, setRoomUsers, setUserCount, role])

    // Typing emission logic
    useEffect(() => {
        if (!socket || !inputMessage.trim()) return

        socket.emit("typing", {
            payload: { isTyping: true }
        })

        const timeout = setTimeout(() => {
            socket.emit("typing", {
                payload: { isTyping: false }
            })
        }, 3000)

        return () => {
            clearTimeout(timeout)
            socket.emit("typing", {
                payload: { isTyping: false }
            })
        }
    }, [socket, inputMessage])

    // Initial chat history fetch
    useEffect(() => {
        const fetchInitialChats = async () => {
            try {
                const data = await getHistoricalChats(sessionId)
                if (data.status === 'success' && Array.isArray(data.data)) {
                    setMessages(data.data)
                    // If we got fewer than 80 messages, we've likely hit the bottom of history
                    if (data.data.length < 80) {
                        setCanLoadMore(false)
                    }
                }
            } catch (error) {
                console.error("Failed to fetch initial chats:", error)
            }
        }
        fetchInitialChats()
    }, [sessionId])

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
        if (!showVisitors && role === "teacher") {
            fetchVisitors()
        }
        setShowVisitors(!showVisitors)
    }

    useEffect(() => {
        // Only auto-scroll to bottom if we are not loading more messages
        if (scrollRef.current && !isLoadingMore && !isLoadMoreAction.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
        // Reset the flag after processing the update
        if (!isLoadingMore) {
            isLoadMoreAction.current = false
        }
    }, [messages, isLoadingMore])

    const toggleSetting = (type: "chat" | "attachments") => {
        if (!socket || role !== "teacher") return
        const event = type === "chat" ? "chat_toggle" : "chat_toggle_attachments"
        const current = type === "chat" ? roomSettings.chatEnabled : roomSettings.attachmentsEnabled
        socket.emit(event, { roomId: sessionId, payload: { enabled: !current } })
    }

    const toggleUserPermission = (userId: string, type: "text" | "attachments", currentEnabled: boolean) => {
        if (!socket || role !== "teacher") return
        const event = type === "text" ? "chat_toggle_user_text" : "chat_toggle_user_attachments"
        socket.emit(event, { roomId: sessionId, payload: { userId, enabled: !currentEnabled } })
    }

    const loadMore = async () => {
        if (!socket || isLoadingMore || !canLoadMore) return

        setIsLoadingMore(true)
        const oldestTimestamp = messages[0].timestamp

        try {
            const data = await getHistoricalChats(sessionId, oldestTimestamp)
            if (data.status === 'success' && Array.isArray(data.data)) {
                if (data.data.length === 0) {
                    setCanLoadMore(false)
                    return
                }

                // Capture scroll height before prepending
                const scrollHeight = scrollRef.current?.scrollHeight || 0
                isLoadMoreAction.current = true

                setMessages((prev) => [...data.data, ...prev])

                // Restore scroll position after React updates the DOM
                setTimeout(() => {
                    if (scrollRef.current) {
                        const newScrollHeight = scrollRef.current.scrollHeight
                        scrollRef.current.scrollTop = newScrollHeight - scrollHeight
                    }
                }, 0)
            } else {
                setCanLoadMore(false)
            }
        } catch (error) {
            console.error("Load more error:", error)
        } finally {
            setIsLoadingMore(false)
        }
    }

    const handleScroll = () => {
        if (!scrollRef.current) return
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
        // If user is more than 300px from bottom, show the button
        setShowScrollButton(scrollHeight - scrollTop - clientHeight > 300)
    }

    const scrollToBottom = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: 'smooth'
            })
        }
    }

    const resolveAttachmentUrl = (url: string) => {
        if (!url) return ""
        if (url.startsWith("data:") || url.startsWith("http")) return url
        const backendUrl = process.env.NEXT_PUBLIC_MAIN_BACKEND_URL || "http://localhost:5002"
        return `${backendUrl}${url.startsWith("/") ? "" : "/"}${url}`
    }


    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > 2 * 1024 * 1024) {
            toast.error("File size must be less than 2MB")
            if (fileInputRef.current) fileInputRef.current.value = ""
            return
        }

        setSelectedFile(file)
        if (file.type.startsWith("image/")) {
            const reader = new FileReader()
            reader.onloadend = () => setFilePreview(reader.result as string)
            reader.readAsDataURL(file)
        } else {
            setFilePreview(null)
        }
    }

    const clearSelectedFile = () => {
        setSelectedFile(null)
        setFilePreview(null)
        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault()
        if ((!inputMessage.trim() && !selectedFile) || !socket) return

        const attachments: Attachment[] = []
        if (selectedFile) {
            const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader()
                reader.onloadend = () => resolve(reader.result as string)
                reader.readAsDataURL(selectedFile)
            })

            attachments.push({
                id: crypto.randomUUID(),
                type: selectedFile.type.startsWith("image/") ? "image" : "file",
                url: base64,
                name: selectedFile.name,
                size: selectedFile.size
            })
        }

        socket.emit("chat", {
            payload: {
                message: inputMessage,
                attachments: attachments.length > 0 ? attachments : undefined
            }
        })
        setInputMessage("")
        clearSelectedFile()
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

                    {/* Visitors/Online Users Dropdown */}
                    {showVisitors && (
                        <div
                            ref={visitorsRef}
                            className="absolute top-10 right-0 w-52 bg-card border border-border rounded-[5px] shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in duration-200"
                        >
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
                                        roomUsers.map((user) => (
                                            <div key={user.socket_id} className="px-3 py-1.5 hover:bg-muted/50 transition-colors flex items-center justify-between group">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                    <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                                                        {user.username} {user.socket_id === socket?.id && "(You)"}
                                                    </span>
                                                </div>
                                                {role === "teacher" && user.socket_id !== socket?.id && (
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
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
                                                            onClick={() => toggleUserPermission(user.user_id, "attachments", user.attachmentsEnabled ?? true)}
                                                            className={cn(
                                                                "p-1 rounded transition-colors",
                                                                user.attachmentsEnabled !== false ? "text-amber-500 hover:bg-amber-500/10" : "text-zinc-400 hover:bg-zinc-400/10"
                                                            )}
                                                            title={user.attachmentsEnabled !== false ? "Disable files" : "Enable files"}
                                                        >
                                                            {user.attachmentsEnabled !== false ? <FileIcon size={12} /> : <FileX size={12} />}
                                                        </button>
                                                    </div>
                                                )}
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
                                                <div key={visitor.id} className="px-3 py-1.5 hover:bg-muted/50 transition-colors group">
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
                    )}

                    {role === "teacher" && (
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={cn("p-1.5 text-muted-foreground hover:text-foreground", showSettings && "text-primary bg-primary/10 rounded-md")}
                            title="Chat Controls"
                        >
                            <Settings size={16} />
                        </button>
                    )}
                    <button onClick={() => setIsOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground">
                        <Minimize2 size={16} />
                    </button>
                </div>
            </div>

            {/* Teacher Controls Panel */}
            {role === "teacher" && showSettings && (
                <div className="px-6 py-4 bg-muted/50 border-b border-border space-y-3 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-foreground">Global Chat</span>
                            <span className="text-[9px] text-muted-foreground">Enable/Disable chat for all</span>
                        </div>
                        <button
                            onClick={() => toggleSetting("chat")}
                            className={cn(
                                "p-2 rounded-md transition-all",
                                roomSettings.chatEnabled ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20" : "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                            )}
                        >
                            {roomSettings.chatEnabled ? <MessageCircle size={16} /> : <MessageSquareOff size={16} />}
                        </button>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-foreground">File Sharing</span>
                            <span className="text-[9px] text-muted-foreground">Global file sharing toggle</span>
                        </div>
                        <button
                            onClick={() => toggleSetting("attachments")}
                            disabled={!roomSettings.chatEnabled}
                            className={cn(
                                "p-2 rounded-md transition-all disabled:opacity-30",
                                roomSettings.attachmentsEnabled ? "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20" : "bg-zinc-500/10 text-zinc-500 hover:bg-zinc-500/20"
                            )}
                        >
                            {roomSettings.attachmentsEnabled ? <FileIcon size={16} /> : <FileX size={16} />}
                        </button>
                    </div>
                </div>
            )}

            {/* Messages Stack */}
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-6 flex flex-col space-y-6 bg-muted/30 relative"
            >
                {canLoadMore && messages.length > 0 && (
                    <div className="flex justify-center pb-2">
                        <button
                            onClick={loadMore}
                            disabled={isLoadingMore}
                            className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                        >
                            {isLoadingMore ? "Loading..." : "Load older messages"}
                        </button>
                    </div>
                )}
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
                                {msg.message && <p className="mb-2 last:mb-0">{msg.message}</p>}

                                {msg.attachments && msg.attachments.length > 0 && (
                                    <div className="space-y-2 mt-2">
                                        {msg.attachments.map((att) => (
                                            <div key={att.id} className="overflow-hidden rounded-md border border-border/20">
                                                {att.type === "image" ? (
                                                    <div className="relative group">
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                            src={resolveAttachmentUrl(att.url)}
                                                            alt={att.name}
                                                            className="max-w-full h-auto rounded-md cursor-zoom-in hover:opacity-95 transition-opacity"
                                                            onClick={() => window.open(resolveAttachmentUrl(att.url), '_blank')}
                                                        />
                                                        <a
                                                            href={resolveAttachmentUrl(att.url)}
                                                            download={att.name}
                                                            className="absolute bottom-2 right-2 p-1.5 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <Download size={14} />
                                                        </a>
                                                    </div>
                                                ) : (
                                                    <a
                                                        href={resolveAttachmentUrl(att.url)}
                                                        download={att.name}
                                                        className={cn(
                                                            "flex items-center gap-3 p-3 text-xs hover:bg-black/5 transition-colors",
                                                            msg.user.name === userName ? "text-primary-foreground bg-white/10" : "text-foreground bg-muted"
                                                        )}
                                                    >
                                                        <FileText size={24} className="shrink-0 opacity-80" />
                                                        <div className="flex flex-col min-w-0 flex-1">
                                                            <span className="font-bold truncate">{att.name}</span>
                                                            <span className="opacity-60">{(att.size ? (att.size / 1024).toFixed(1) : 0)} KB</span>
                                                        </div>
                                                        <Download size={16} className="shrink-0 opacity-60" />
                                                    </a>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}

                {showScrollButton && (
                    <button
                        onClick={scrollToBottom}
                        className="sticky bottom-0 ml-auto z-50 p-1.5 bg-secondary text-primary-background rounded-[5px] shadow-2xl hover:scale-110 active:scale-95 transition-all animate-in fade-in zoom-in duration-300 border border-white/20 backdrop-blur-sm"
                        title="Scroll to bottom"
                    >
                        <ChevronDown size={24} className="animate-bounce pt-1" />
                    </button>
                )}
            </div>

            {/* Typing Indicator */}
            {Object.keys(typingUsers).length > 0 && (
                <div className="px-6 py-2 bg-muted/30 border-t border-border/50">
                    <p className="text-[10px] text-muted-foreground animate-pulse flex items-center gap-2">
                        <span className="flex gap-1">
                            <span className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]" />
                            <span className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]" />
                            <span className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" />
                        </span>
                        {Object.values(typingUsers).join(", ")} {Object.keys(typingUsers).length > 1 ? "are" : "is"} typing...
                    </p>
                </div>
            )}

            {/* Input Processor */}
            <form onSubmit={sendMessage} className=" bg-card border-t border-border flex flex-col">
                {selectedFile && (
                    <div className="px-4 py-2 bg-muted/50 border-b border-border flex items-center gap-3 animate-in slide-in-from-bottom-2 duration-300">
                        <div className="w-10 h-10 rounded bg-background border border-border flex items-center justify-center overflow-hidden shrink-0">
                            {filePreview ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={filePreview} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                                <FileText size={20} className="text-muted-foreground" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold truncate text-foreground">{selectedFile.name}</p>
                            <p className="text-[9px] text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <button
                            type="button"
                            onClick={clearSelectedFile}
                            className="p-1 hover:text-red-500 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}
                {(!roomSettings.chatEnabled && role === "student" && roomUsers.find(u => u.socket_id === socket?.id)?.textEnabled !== true) ? (
                    <div className="h-14 flex items-center justify-center bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-widest gap-2">
                        <Lock size={14} /> Chat Disabled by Instructor
                    </div>
                ) : (
                    <div className="flex">
                        <div className={cn(
                            "flex gap-3 w-full items-center bg-muted border border-border p-1 pr-2 focus-within:border-primary box-border focus-within:ring-0 focus-within:ring-offset-0 transition-all group",
                            (!roomSettings.chatEnabled && role === "student") && "opacity-50 cursor-not-allowed"
                        )}>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                className="hidden"
                                accept="*/*"
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={
                                    (role === "student" && roomUsers.find(u => u.socket_id === socket?.id)?.attachmentsEnabled === false)
                                }
                                className={cn(
                                    "w-10 h-10 flex items-center justify-center transition-colors hover:bg-background/50 rounded",
                                    (role === "student" && roomUsers.find(u => u.socket_id === socket?.id)?.attachmentsEnabled === false)
                                        ? "text-muted-foreground/30 cursor-not-allowed"
                                        : "text-muted-foreground hover:text-primary"
                                )}
                                title={(role === "student" && roomUsers.find(u => u.socket_id === socket?.id)?.attachmentsEnabled === false) ? "Files disabled" : "Attach file"}
                            >
                                {(role === "student" && roomUsers.find(u => u.socket_id === socket?.id)?.attachmentsEnabled === false) ? <FileX size={20} /> : <Paperclip size={20} />}
                            </button>
                            <input
                                type="text"
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                disabled={
                                    role === "student" && roomUsers.find(u => u.socket_id === socket?.id)?.textEnabled === false
                                }
                                placeholder={
                                    (role === "student" && roomUsers.find(u => u.socket_id === socket?.id)?.textEnabled === false) ? "Chat is disabled" :
                                        selectedFile ? "Add a caption..." : "Send a message..."
                                }
                                className="flex-1 h-10 px-3 bg-transparent text-sm font-medium outline-none text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={Boolean(
                                (!inputMessage.trim() && !selectedFile) ||
                                !socket ||
                                (role === "student" && roomUsers.find(u => u.socket_id === socket?.id)?.textEnabled === false && !selectedFile) ||
                                (role === "student" && roomUsers.find(u => u.socket_id === socket?.id)?.attachmentsEnabled === false && selectedFile)
                            )}
                            className="w-14 h-full flex items-center justify-center bg-[#6366F1] text-white hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                        >
                            <Send size={18} />
                        </button>
                    </div>
                )}
            </form>
        </aside>
    )
}
