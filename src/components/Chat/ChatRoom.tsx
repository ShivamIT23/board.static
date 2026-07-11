"use client"

import React, { useState, useEffect, useLayoutEffect, useRef } from "react"
import { MessageCircle, Minimize2, User2, Settings, MessageSquareOff, File as FileIcon, FileX, BarChart2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSocket } from "../providers/socket-provider"
import { getHistoricalChats } from "@/app/actions/auth"
import { toast } from "sonner"

import MessageList from "./MessageList"
import ChatInput from "./ChatInput"
import UserList from "./UserList"
import Swal from "sweetalert2"

import type { Attachment, ChatMessage, RoomUser, Visitor } from "@/types/chat"

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
    compact?: boolean
    onOpenPoll?: () => void
    hasActivePoll?: boolean
    onOpenQuiz?: () => void
    hasActiveQuiz?: boolean
    hasQuiz?: boolean
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
    setIsOpen,
    compact = false,
    onOpenPoll,
    hasActivePoll,
    onOpenQuiz,
    hasActiveQuiz
}: ChatRoomProps) {
    const { socket } = useSocket()
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [inputMessage, setInputMessage] = useState("")
    const [recipient, setRecipient] = useState<"everyone" | "teacher">("everyone")
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
        attachmentsEnabled: true,
        isAutoApprove: true
    })
    const [showSettings, setShowSettings] = useState(false)

    const scrollRef = useRef<HTMLDivElement>(null)
    const scrollRestorationPending = useRef<{ prevScrollHeight: number; prevScrollTop: number } | null>(null)
    const firstMessageIdRef = useRef<number | null>(null)
    const lastMessageIdRef = useRef<number | null>(null)

    const visitorsRef = useRef<HTMLDivElement>(null)
    const visitorsButtonRef = useRef<HTMLButtonElement>(null)
    const settingsRef = useRef<HTMLDivElement>(null)
    const settingsButtonRef = useRef<HTMLButtonElement>(null)
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

        socket.on("kicked", ({ message }: { message: string }) => {
            Swal.fire({
                title: "Kicked Out",
                text: message,
                icon: "warning",
                confirmButtonText: "OK"
            }).then(() => {
                window.location.href = "about:blank";
            });
        });

        socket.on("banned", ({ message }: { message: string }) => {
            Swal.fire({
                title: "Permanently Banned",
                text: message,
                icon: "error",
                confirmButtonText: "OK"
            }).then(() => {
                window.location.href = "about:blank";
            });
        });

        socket.on("chat_state", ({ payload }: { payload: { settings: typeof roomSettings } }) => {
            if (payload.settings) {
                setRoomSettings(prev => ({ ...prev, ...payload.settings }))
                if (payload.settings.chatEnabled === false && role === "student") {
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

        socket.emit("typing", { roomId: sessionId, payload: { isTyping: true } })

        const timeout = setTimeout(() => {
            socket.emit("typing", { roomId: sessionId, payload: { isTyping: false } })
        }, 3000)

        return () => {
            clearTimeout(timeout)
            socket.emit("typing", { roomId: sessionId, payload: { isTyping: false } })
        }
    }, [socket, inputMessage, sessionId])

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
            // Close visitors if clicking outside
            if (visitorsRef.current && !visitorsRef.current.contains(event.target as Node) &&
                visitorsButtonRef.current && !visitorsButtonRef.current.contains(event.target as Node)) {
                setShowVisitors(false)
            }
            // Close settings if clicking outside
            if (settingsRef.current && !settingsRef.current.contains(event.target as Node) &&
                settingsButtonRef.current && !settingsButtonRef.current.contains(event.target as Node)) {
                setShowSettings(false)
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
        setShowVisitors(prev => {
            const next = !prev;
            if (next) setShowSettings(false);
            if (next && role === "teacher") fetchVisitors();
            return next;
        });
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
            roomId: sessionId,
            payload: {
                message: inputMessage,
                recipient,
                attachments: attachments.length > 0 ? attachments : undefined
            }
        })
        setInputMessage("")
        clearSelectedFile()
    }

    // Compact mode: render just the message list + input without wrapper/header
    if (compact) {
        return (
            <div className="flex flex-col h-full">
                <MessageList
                    messages={messages}
                    userName={userName}
                    scrollRef={scrollRef}
                    handleScroll={handleScroll}
                    showScrollButton={showScrollButton}
                    scrollToBottom={scrollToBottom}
                    isLoadingMore={isLoadingMore}
                    canLoadMore={canLoadMore}
                    resolveAttachmentUrl={resolveAttachmentUrl}
                    role={role}
                />
                {Object.keys(typingUsers).length > 0 && (
                    <div className="px-4 py-1.5 bg-muted/30 border-t border-border/50">
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
                <ChatInput
                    inputMessage={inputMessage}
                    setInputMessage={setInputMessage}
                    recipient={recipient}
                    setRecipient={setRecipient}
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
            </div>
        )
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
                        ref={visitorsButtonRef}
                        type="button"
                        onClick={toggleVisitors}
                        className={cn(
                            "p-1.5 text-muted-foreground flex gap-1 items-center hover:text-foreground transition-colors",
                            showVisitors && "text-foreground bg-muted rounded-md"
                        )}
                    >
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />{userCount}<User2 size={16} />
                    </button>

                    {role === "teacher" && onOpenPoll && (
                        <button
                            type="button"
                            onClick={onOpenPoll}
                            className={cn(
                                "p-1.5 flex items-center gap-1 text-xs font-bold rounded-md transition-colors",
                                hasActivePoll
                                    ? "bg-emerald-500/20 text-emerald-500 animate-pulse"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            )}
                            title="Classroom Polls"
                        >
                            <BarChart2 size={16} />
                            <span className="text-[10px] font-extrabold uppercase">Polls</span>
                        </button>
                    )}

                    {role === "teacher" && onOpenQuiz && (
                        <button
                            type="button"
                            onClick={onOpenQuiz}
                            className={cn(
                                "p-1.5 flex items-center gap-1 text-xs font-bold rounded-md transition-colors",
                                hasActiveQuiz
                                    ? "bg-indigo-500/20 text-indigo-450 dark:text-indigo-400 animate-pulse border border-indigo-500/30"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            )}
                            title="Classroom Quiz"
                        >
                            <span className="relative flex h-2 w-2 mr-0.5">
                                {hasActiveQuiz && (
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                )}
                                <span className={cn("relative inline-flex rounded-full h-2 w-2", hasActiveQuiz ? "bg-indigo-500" : "bg-muted-foreground/60")}></span>
                            </span>
                            <span className="text-[10px] font-extrabold uppercase">Quiz</span>
                        </button>
                    )}

                    {role === "student" && hasActiveQuiz && onOpenQuiz && (
                        <button
                            type="button"
                            onClick={onOpenQuiz}
                            className="p-1.5 flex items-center gap-1 text-xs font-bold rounded-md bg-indigo-500/25 text-indigo-650 dark:text-indigo-300 animate-pulse border border-indigo-500/30 transition-all hover:scale-105"
                            title="Take Live Quiz"
                        >
                            <span className="relative flex h-2 w-2 mr-0.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                            </span>
                            <span className="text-[10px] font-extrabold uppercase animate-pulse">Quiz Live!</span>
                        </button>
                    )}

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
                                isAutoApprove={roomSettings.isAutoApprove}
                                toggleUserPermission={toggleUserPermission}
                                socket={socket}
                            />
                        </div>
                    )}

                    {role === "teacher" && (
                        <button
                            ref={settingsButtonRef}
                            type="button"
                            onClick={() => {
                                setShowSettings(prev => {
                                    const next = !prev;
                                    if (next) setShowVisitors(false);
                                    return next;
                                });
                            }}
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
                <div
                    ref={settingsRef}
                    className="absolute top-[40px] left-0 right-0 z-50 bg-background/60 backdrop-blur-xl border-b border-border shadow-2xl animate-in slide-in-from-top-2 duration-300"
                >
                    <div className="px-2 py-2 space-y-4">
                        {/* <div className="flex items-center justify-between mb-1">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/70">Room Controls</h3>
                            <div className="h-px flex-1 bg-border/40 ml-3" />
                        </div> */}

                        <div className="flex items-center justify-between p-2 rounded-[2px] bg-muted/30 hover:bg-muted/50 transition-colors group">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[11px] font-bold text-foreground/90 group-hover:text-foreground transition-colors">Global Chat</span>
                                <span className="text-[9px] text-muted-foreground leading-tight">Enable chat messaging for everyone</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => toggleSetting("chat")}
                                className={cn(
                                    "relative w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300",
                                    roomSettings.chatEnabled
                                        ? "bg-emerald-500/15 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.1)] hover:bg-emerald-500/20"
                                        : "bg-rose-500/15 text-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.1)] hover:bg-rose-500/20"
                                )}
                            >
                                {roomSettings.chatEnabled ? <MessageCircle size={16} /> : <MessageSquareOff size={16} />}
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-2 rounded-[2px] bg-muted/30 hover:bg-muted/50 transition-colors group">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[11px] font-bold text-foreground/90 group-hover:text-foreground transition-colors">File Sharing</span>
                                <span className="text-[9px] text-muted-foreground leading-tight">Allow attachments and screenshots</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => toggleSetting("attachments")}
                                disabled={!roomSettings.chatEnabled}
                                className={cn(
                                    "relative w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 disabled:opacity-30",
                                    roomSettings.attachmentsEnabled
                                        ? "bg-indigo-500/15 text-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.1)] hover:bg-indigo-500/20"
                                        : "bg-zinc-500/15 text-zinc-500 hover:bg-zinc-500/20"
                                )}
                            >
                                {roomSettings.attachmentsEnabled ? <FileIcon size={16} /> : <FileX size={16} />}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <MessageList
                role={role}
                messages={messages}
                userName={userName}
                scrollRef={scrollRef}
                handleScroll={handleScroll}
                showScrollButton={showScrollButton}
                scrollToBottom={scrollToBottom}
                isLoadingMore={isLoadingMore}
                canLoadMore={canLoadMore}
                resolveAttachmentUrl={resolveAttachmentUrl}
            />

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

            <ChatInput
                inputMessage={inputMessage}
                setInputMessage={setInputMessage}
                recipient={recipient}
                setRecipient={setRecipient}
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
