"use client"

import React, { useState, useEffect, useLayoutEffect, useRef } from "react"
import { MessageCircle, Minimize2, User2, Settings, MessageSquareOff, File as FileIcon, FileX } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSocket } from "../providers/socket-provider"
import { getHistoricalChats } from "@/app/actions/auth"
import { toast } from "sonner"

import MessageList from "./MessageList"
import ChatInput from "./ChatInput"
import UserList from "./UserList"

export interface Attachment {
    id: string
    type: "image" | "file"
    url: string
    name: string
    size?: number
}

export interface ChatMessage {
    id?: string
    user: { name: string; isTeacher: boolean }
    message: string
    timestamp: number
    attachments?: Attachment[]
}

export interface RoomUser {
    user_id: string
    username: string
    socket_id: string
    isMuted?: boolean
    mediaState?: { audio: boolean; video: boolean }
    textEnabled?: boolean
    attachmentsEnabled?: boolean
    drawingEnabled?: boolean
    role?: "teacher" | "student"
    isTeacher?: boolean
}

export interface Visitor {
    id: number;
    name: string;
    email: string | null;
    joinedAt: string;
    isOnline?: boolean;
}

interface ChatRoomProps {
    userCount: number
    roomUsers: RoomUser[]
    setRoomUsers: (users: RoomUser[]) => void
    setUserCount: (count: number) => void
    role: "teacher" | "student"
    userName: string
    sessionId: string
    isOpen: boolean
    setIsOpen: (open: boolean) => void
}

export default function ChatRoom({
    userCount,
    roomUsers,
    setRoomUsers,
    setUserCount,
    role,
    userName,
    sessionId,
    isOpen,
    setIsOpen
}: ChatRoomProps) {
    const { socket } = useSocket()
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [inputMessage, setInputMessage] = useState("")
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
    const scrollRestorationPending = useRef<{ prevScrollHeight: number; prevScrollTop: number } | null>(null)
    const firstMessageIdRef = useRef<number | null>(null)
    const lastMessageIdRef = useRef<number | null>(null)

    const visitorsRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [showScrollButton, setShowScrollButton] = useState(false)
    const [isAtBottom, setIsAtBottom] = useState(true)

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

        socket.emit("typing", { payload: { isTyping: true } })

        const timeout = setTimeout(() => {
            socket.emit("typing", { payload: { isTyping: false } })
        }, 3000)

        return () => {
            clearTimeout(timeout)
            socket.emit("typing", { payload: { isTyping: false } })
        }
    }, [socket, inputMessage])

    // Initial chat history fetch
    useEffect(() => {
        const fetchInitialChats = async () => {
            try {
                const data = await getHistoricalChats(sessionId)
                if (data.status === 'success' && Array.isArray(data.data)) {
                    setMessages(data.data)
                    if (data.data.length < 80) setCanLoadMore(false)
                }
            } catch (error) {
                console.error("Failed to fetch initial chats:", error)
            }
        }
        fetchInitialChats()
    }, [sessionId])

    useEffect(() => {
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
            if (data.visitors) setVisitors(data.visitors)
        } catch (error) {
            console.error("Failed to fetch visitors:", error)
        } finally {
            setIsLoadingVisitors(false)
        }
    }

    const toggleVisitors = () => {
        if (!showVisitors && role === "teacher") fetchVisitors()
        setShowVisitors(!showVisitors)
    }

    // --- Robust Scroll Management ---
    useLayoutEffect(() => {
        if (!scrollRef.current || messages.length === 0) return

        const currentFirstId = messages[0].timestamp
        const currentLastId = messages[messages.length - 1].timestamp

        const isInitialLoad = firstMessageIdRef.current === null
        const isPrepend = !isInitialLoad && currentFirstId !== firstMessageIdRef.current && currentLastId === lastMessageIdRef.current
        const isAppend = !isInitialLoad && currentLastId !== lastMessageIdRef.current

        if (isPrepend && scrollRestorationPending.current) {
            const { prevScrollHeight, prevScrollTop } = scrollRestorationPending.current
            const newScrollHeight = scrollRef.current.scrollHeight
            scrollRef.current.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight)
            scrollRestorationPending.current = null
        } else if (isInitialLoad && isOpen) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        } else if (isAppend && isAtBottom && isOpen) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }

        firstMessageIdRef.current = currentFirstId
        lastMessageIdRef.current = currentLastId
    }, [messages, isOpen, isAtBottom])

    useEffect(() => {
        if (isOpen) scrollToBottom()
    }, [isOpen])

    const toggleSetting = (type: "chat" | "attachments") => {
        if (!socket || role !== "teacher") return
        const event = type === "chat" ? "chat_toggle" : "chat_toggle_attachments"
        const current = type === "chat" ? roomSettings.chatEnabled : roomSettings.attachmentsEnabled
        socket.emit(event, { roomId: sessionId, payload: { enabled: !current } })
    }

    const toggleUserPermission = (userId: string, type: "text" | "attachments" | "drawing", currentEnabled: boolean) => {
        if (!socket || role !== "teacher") return
        let event = ""
        if (type === "text") event = "chat_toggle_user_text"
        else if (type === "attachments") event = "chat_toggle_user_attachments"
        else if (type === "drawing") event = "board_toggle_user_drawing"

        socket.emit(event, { roomId: sessionId, payload: { userId, enabled: !currentEnabled } })
    }

    const loadMore = async () => {
        if (!socket || isLoadingMore || !canLoadMore || messages.length === 0) return

        setIsLoadingMore(true)
        const container = scrollRef.current
        scrollRestorationPending.current = {
            prevScrollHeight: container?.scrollHeight ?? 0,
            prevScrollTop: container?.scrollTop ?? 0,
        }

        const oldestTimestamp = messages[0].timestamp

        try {
            const data = await getHistoricalChats(sessionId, oldestTimestamp)
            if (data.status === 'success' && Array.isArray(data.data)) {
                if (data.data.length === 0) {
                    setCanLoadMore(false)
                    scrollRestorationPending.current = null
                    return
                }
                setMessages((prev) => [...data.data, ...prev])
            } else {
                setCanLoadMore(false)
                scrollRestorationPending.current = null
            }
        } catch (error) {
            console.error("Load more error:", error)
            scrollRestorationPending.current = null
        } finally {
            setIsLoadingMore(false)
        }
    }

    const handleScroll = () => {
        if (!scrollRef.current) return
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
        setIsAtBottom(scrollHeight - scrollTop - clientHeight < 10)
        setShowScrollButton(scrollHeight - scrollTop - clientHeight > 300)

        if (scrollTop < 50 && canLoadMore && !isLoadingMore && messages.length > 0) {
            loadMore()
        }
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
            <div className="w-12 bg-card border-l border-border flex flex-col items-center py-4 gap-4 transition-all duration-300">
                <button
                    type="button"
                    onClick={() => setIsOpen(true)}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-all"
                    title="Open Chat"
                >
                    <MessageCircle size={20} />
                </button>
                <div className="flex flex-col items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-bold text-muted-foreground">{userCount}</span>
                </div>
            </div>
        )
    }

    return (
        <aside className="w-64 sm:w-72 md:w-80 flex flex-col bg-card border-l border-border transition-all duration-300 z-30 shrink-0 h-full relative">
            <div className="h-10 flex items-center justify-between px-3 sm:px-6 border-b border-border shrink-0">
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Chat</span>
                <div className="flex items-center gap-2 relative">
                    <button
                        type="button"
                        onClick={toggleVisitors}
                        className={cn(
                            "p-1.5 text-muted-foreground flex gap-1 items-center hover:text-foreground transition-colors",
                            showVisitors && "text-foreground bg-muted rounded-md"
                        )}
                    >
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />{userCount}<User2 size={16} />
                    </button>

                    {showVisitors && (
                        <div
                            ref={visitorsRef}
                            className="absolute top-10 right-0 w-52 bg-card border border-border rounded-[5px] shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in duration-200"
                        >
                            <UserList
                                roomUsers={roomUsers}
                                role={role}
                                visitors={visitors}
                                isLoadingVisitors={isLoadingVisitors}
                                toggleUserPermission={toggleUserPermission}
                                socket={socket}
                            />
                        </div>
                    )}

                    {role === "teacher" && (
                        <button
                            type="button"
                            onClick={() => setShowSettings(!showSettings)}
                            className={cn("p-1.5 text-muted-foreground hover:text-foreground", showSettings && "text-primary bg-primary/10 rounded-md")}
                        >
                            <Settings size={16} />
                        </button>
                    )}

                    <div className="flex items-center gap-2 relative ml-auto">
                        <button type="button" onClick={() => setIsOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground">
                            <Minimize2 size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {role === "teacher" && showSettings && (
                <div className="px-6 py-4 bg-muted/50 border-b border-border space-y-3 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-foreground">Global Chat</span>
                            <span className="text-[9px] text-muted-foreground">Enable/Disable chat for all</span>
                        </div>
                        <button
                            type="button"
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
                            type="button"
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

            <MessageList
                messages={messages}
                userName={userName}
                typingUsers={typingUsers}
                scrollRef={scrollRef}
                handleScroll={handleScroll}
                showScrollButton={showScrollButton}
                scrollToBottom={scrollToBottom}
                isLoadingMore={isLoadingMore}
                canLoadMore={canLoadMore}
                resolveAttachmentUrl={resolveAttachmentUrl}
            />

            <ChatInput
                inputMessage={inputMessage}
                setInputMessage={setInputMessage}
                sendMessage={sendMessage}
                fileInputRef={fileInputRef}
                handleFileSelect={handleFileSelect}
                selectedFile={selectedFile}
                filePreview={filePreview}
                clearSelectedFile={clearSelectedFile}
                role={role}
                roomSettings={roomSettings}
                roomUser={roomUsers.find(u => u.socket_id === socket?.id)}
                socket={socket}
            />
        </aside>
    )
}
