"use client"

import React from "react"
import { MessageCircle, Download, FileText, ChevronDown, Lock, BarChart2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { ChatMessage } from "@/types/chat"

interface MessageListProps {
    messages: ChatMessage[]
    userName: string
    scrollRef: React.RefObject<HTMLDivElement | null>
    handleScroll: (e: React.UIEvent<HTMLDivElement>) => void
    showScrollButton: boolean
    scrollToBottom: () => void
    isLoadingMore: boolean
    canLoadMore: boolean
    resolveAttachmentUrl: (url: string) => string
    role: "teacher" | "student"
}

export default function MessageList({
    messages,
    userName,
    scrollRef,
    handleScroll,
    showScrollButton,
    scrollToBottom,
    isLoadingMore,
    canLoadMore,
    resolveAttachmentUrl,
    role
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
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className={cn(
                                            "text-[12px] font-extrabold tracking-wide truncate",
                                            isSelf
                                                ? "text-primary"
                                                : msg.user.isTeacher
                                                    ? "text-amber-500"
                                                    : "text-emerald-600 dark:text-emerald-400"
                                        )}>
                                            {msg.user.name}{role === "teacher" && !msg.user.isTeacher && msg.user.visitorId ? `_${msg.user.visitorId}` : ""}{isSelf ? " (You)" : msg.user.isTeacher ? " (Instructor)" : ""} says :
                                        </span>
                                        {msg.recipient === "teacher" && (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0">
                                                <Lock size={9} /> Private to Teacher
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-muted-foreground font-semibold shrink-0 ml-4">{timeStr}</span>
                                </div>
                                <div className={cn(
                                    "px-4 py-3 text-sm leading-relaxed text-foreground bg-card",
                                    isSelf ? "text-right" : "text-left"
                                )}>
                                    {msg.message && <p>{msg.message}</p>}

                                    {/* Compact Poll Results in Chat */}
                                    {msg.pollResults && (
                                        <div className="mt-2.5 p-3 rounded-xl bg-muted/40 border border-border/70 space-y-2 text-left">
                                            <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-1.5">
                                                <span className="text-[11px] font-extrabold text-foreground flex items-center gap-1.5">
                                                    <BarChart2 size={13} className="text-emerald-500 shrink-0" />
                                                    {msg.pollResults.question}
                                                </span>
                                                <span className="text-[9px] font-bold text-muted-foreground shrink-0">{msg.pollResults.totalVotes} votes</span>
                                            </div>
                                            <div className="space-y-1.5 pt-1">
                                                {msg.pollResults.options.map((opt, oIdx) => {
                                                    const total = msg.pollResults!.totalVotes
                                                    const pct = total > 0 ? Math.round((opt.votesCount / total) * 100) : 0
                                                    return (
                                                        <div key={oIdx} className="space-y-0.5">
                                                            <div className="flex justify-between text-[10px] font-semibold text-foreground">
                                                                <span className="truncate pr-2">{opt.text}</span>
                                                                <span className="shrink-0 text-muted-foreground">{opt.votesCount} ({pct}%)</span>
                                                            </div>
                                                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                                                <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Compact Quiz in Chat */}
                                    {msg.quizShare && (
                                        <div className="mt-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2 text-left max-w-sm">
                                            <div className="flex items-center justify-between gap-2 border-b border-amber-500/20 pb-1.5">
                                                <span className="text-[11px] font-extrabold text-foreground flex items-center gap-1.5">
                                                    <FileText size={13} className="text-amber-500 shrink-0" />
                                                    {msg.quizShare.quizTitle}
                                                </span>
                                                <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider shrink-0 bg-amber-500/10 px-1.5 py-0.5 rounded">Quiz</span>
                                            </div>
                                            <div className="pt-1">
                                                {role === "student" ? (
                                                    <a
                                                        href={`/quiz/take/${msg.quizShare.shareToken}?name=${encodeURIComponent(userName)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center justify-center w-full px-3 py-2 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 active:scale-98 rounded-lg transition-all shadow-sm"
                                                    >
                                                        Take Quiz
                                                    </a>
                                                ) : (
                                                    <div className="text-[11px] text-muted-foreground font-semibold flex flex-col gap-1">
                                                        <span>Link shared with students.</span>
                                                        <span className="text-[9px] text-amber-500">Open the Quiz modal from the toolbar to view real-time results.</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    
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
