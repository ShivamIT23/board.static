"use client"

import React from "react"
import { MessageCircle, Download, FileText, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { ChatMessage } from "./ChatRoom"

interface MessageListProps {
    messages: ChatMessage[]
    userName: string
    typingUsers: Record<string, string>
    scrollRef: React.RefObject<HTMLDivElement | null>
    handleScroll: (e: React.UIEvent<HTMLDivElement>) => void
    showScrollButton: boolean
    scrollToBottom: () => void
    isLoadingMore: boolean
    canLoadMore: boolean
    resolveAttachmentUrl: (url: string) => string
}

export default function MessageList({
    messages,
    userName,
    typingUsers,
    scrollRef,
    handleScroll,
    showScrollButton,
    scrollToBottom,
    isLoadingMore,
    canLoadMore,
    resolveAttachmentUrl,
}: MessageListProps) {
    return (
        <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-0 flex flex-col space-y-4 bg-muted/30 relative no-scrollbar"
        >
            {/* Infinite Scroll Loading Indicator */}
            {isLoadingMore && canLoadMore && (
                <div className="h-12 flex items-center justify-center shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" />
                    </div>
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
                messages.map((msg, i) => {
                    const isSelf = msg.user.name === userName
                    const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    })

                    return (
                        <div key={i} className={cn(
                            "flex flex-col w-full",
                            isSelf ? "ml-auto items-end" : "mr-auto items-start"
                        )}>
                            <div className={cn(
                                "overflow-hidden border-b border-border w-full",
                                isSelf
                                    ? "border-r-2 border-r-primary"
                                    : msg.user.isTeacher
                                        ? "border-l-2 border-l-amber-500"
                                        : "border-l-2 border-l-emerald-500"
                            )}>
                                <div className={cn(
                                    "flex items-center justify-between px-3 py-2 border-b border-border/50",
                                    isSelf
                                        ? "bg-primary/10"
                                        : msg.user.isTeacher
                                            ? "bg-amber-500/10"
                                            : "bg-emerald-500/10"
                                )}>
                                    <span className={cn(
                                        "text-[12px] font-extrabold tracking-wide",
                                        isSelf
                                            ? "text-primary"
                                            : msg.user.isTeacher
                                                ? "text-amber-500"
                                                : "text-emerald-600 dark:text-emerald-400"
                                    )}>
                                        {msg.user.name}{isSelf ? " (You)" : msg.user.isTeacher ? " (Instructor)" : ""} says :
                                    </span>
                                    <span className="text-[10px] text-muted-foreground font-semibold shrink-0 ml-4">{timeStr}</span>
                                </div>
                                <div className={cn(
                                    "px-4 py-3 text-sm leading-relaxed text-foreground bg-card",
                                    isSelf ? "text-right" : "text-left"
                                )}>
                                    {msg.message && <p>{msg.message}</p>}
                                    
                                    {msg.attachments && msg.attachments.length > 0 && (
                                        <div className={`space-y-2 mt-2 w-fit ${isSelf ? "ml-auto" : "mr-auto"}`}>
                                            {msg.attachments.map((att) => (
                                                <div key={att.id} className="overflow-hidden rounded-[3px] border border-border">
                                                    {att.type === "image" ? (
                                                        <div className="relative group">
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <img
                                                                src={resolveAttachmentUrl(att.url)}
                                                                alt={att.name}
                                                                className="max-w-full max-h-[160px] h-auto rounded-[3px] cursor-zoom-in hover:opacity-95 transition-opacity"
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
                                                                "flex items-center gap-3 p-3 text-xs transition-colors",
                                                                isSelf
                                                                    ? "bg-primary/10 hover:bg-primary/15 text-primary border-t border-primary/20"
                                                                    : "bg-muted hover:bg-muted/80 text-foreground border-t border-border"
                                                            )}
                                                        >
                                                            <FileText size={24} className={cn("shrink-0", isSelf ? "text-primary" : "text-muted-foreground")} />
                                                            <div className="flex flex-col min-w-0 flex-1">
                                                                <span className="font-bold truncate text-foreground">{att.name}</span>
                                                                <span className="text-muted-foreground text-[10px]">{(att.size ? (att.size / 1024).toFixed(1) : 0)} KB</span>
                                                            </div>
                                                            <Download size={16} className={cn("shrink-0", isSelf ? "text-primary" : "text-muted-foreground")} />
                                                        </a>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })
            )}

            {showScrollButton && (
                <button
                    type="button"
                    onClick={scrollToBottom}
                    className="sticky bottom-4 ml-auto mr-4 z-50 p-1.5 bg-secondary text-primary-background rounded-[5px] shadow-2xl hover:scale-110 active:scale-95 transition-all animate-in fade-in zoom-in duration-300 border border-white/20 backdrop-blur-sm"
                    title="Scroll to bottom"
                >
                    <ChevronDown size={24} className="animate-bounce pt-1" />
                </button>
            )}

            {/* Typing Indicator inside scroll area in original view? No, it's outside. 
                Wait, in provided code it's OUTSIDE the scroll area div. 
                I'll keep it outside in ChatRoom.tsx.
            */}
        </div>
    )
}
