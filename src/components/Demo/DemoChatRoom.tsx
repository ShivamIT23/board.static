"use client";

import React, { useState, useEffect, useRef } from "react";
import { MessageCircle, Minimize2, User2, Settings, MessageSquareOff, FileText, FileX, BarChart2, Video, Paperclip, Send, ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/utils";
import DemoStream from "./DemoStream";
import DemoUserList from "./DemoUserList";
import type { ChatMessage, Attachment } from "@/types/chat";
import { toast } from "sonner";
import Image from "next/image";

interface DemoChatRoomProps {
    userName?: string;
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    isVideoExpanded?: boolean;
    onOpenPoll?: () => void;
    onOpenQuiz?: () => void;
    onExpandChange?: (expanded: boolean) => void;
    isMobile?: boolean;
}

const STORAGE_KEY = "demo_chat_messages";

export default function DemoChatRoom({
    userName = "Teacher",
    isOpen,
    setIsOpen,
    isVideoExpanded,
    onOpenPoll,
    onOpenQuiz,
    onExpandChange,
    isMobile = false,
}: DemoChatRoomProps) {
    const [messages, setMessages] = useState<ChatMessage[]>(() => {
        if (typeof window !== "undefined") {
            try {
                const saved = sessionStorage.getItem(STORAGE_KEY);
                if (saved) return JSON.parse(saved);
            } catch (err) {
                console.error("Failed to load demo chats from sessionStorage:", err);
            }
        }
        return [];
    });

    const [inputText, setInputText] = useState("");
    const [pendingAttachment, setPendingAttachment] = useState<Attachment | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const [showVisitors, setShowVisitors] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [chatEnabled, setChatEnabled] = useState(true);
    const [attachmentsEnabled, setAttachmentsEnabled] = useState(true);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const visitorsRef = useRef<HTMLDivElement>(null);
    const visitorsButtonRef = useRef<HTMLButtonElement>(null);
    const settingsRef = useRef<HTMLDivElement>(null);
    const settingsButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (typeof window !== "undefined") {
            try {
                sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
            } catch (err) {
                console.error("Failed to save demo chats to sessionStorage:", err);
            }
        }
    }, [messages]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Handle click outside popovers (pointerdown supports touch and mouse)
    useEffect(() => {
        const handleClickOutside = (event: PointerEvent) => {
            const target = event.target as Node;
            if (
                showVisitors &&
                visitorsRef.current &&
                !visitorsRef.current.contains(target) &&
                visitorsButtonRef.current &&
                !visitorsButtonRef.current.contains(target)
            ) {
                setShowVisitors(false);
            }
            if (
                showSettings &&
                settingsRef.current &&
                !settingsRef.current.contains(target) &&
                settingsButtonRef.current &&
                !settingsButtonRef.current.contains(target)
            ) {
                setShowSettings(false);
            }
        };
        document.addEventListener("pointerdown", handleClickOutside);
        return () => document.removeEventListener("pointerdown", handleClickOutside);
    }, [showVisitors, showSettings]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            if (dataUrl) {
                const isImage = file.type.startsWith("image/");
                const newAttachment: Attachment = {
                    id: `att-${Date.now()}`,
                    name: file.name,
                    size: file.size,
                    type: isImage ? "image" : "file",
                    url: dataUrl,
                };
                setPendingAttachment(newAttachment);
                toast.success(`Attached "${file.name}"`);
            }
        };
        reader.readAsDataURL(file);
        e.target.value = "";
    };

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatEnabled) {
            toast.error("Chat is currently disabled");
            return;
        }
        if (!inputText.trim() && !pendingAttachment) return;

        const newMsg: ChatMessage = {
            id: `msg-${Date.now()}`,
            user: { name: userName, isTeacher: true },
            message: inputText.trim(),
            timestamp: Date.now(),
            attachments: pendingAttachment ? [pendingAttachment] : undefined,
        };

        setMessages((prev) => [...prev, newMsg]);
        setInputText("");
        setPendingAttachment(null);
    };

    const handleOpenAttachment = (attachment: Attachment) => {
        if (attachment.type === "image") {
            setPreviewUrl(attachment.url);
        } else {
            const win = window.open();
            if (win) {
                win.document.write(
                    `<html><head><title>${attachment.name}</title></head><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#111;"><iframe src="${attachment.url}" frameborder="0" style="width:100%;height:100%;"></iframe></body></html>`
                );
            }
        }
    };

    // ─── MOBILE: Don't render if not open ───
    if (isMobile && !isOpen) return null;

    return (
        <>
            {/* Mobile Backdrop */}
            {isMobile && (
                <div
                    className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200"
                    onClick={() => setIsOpen(false)}
                />
            )}

            <aside
                className={cn(
                    isMobile
                        ? "fixed bottom-0 left-0 right-0 h-[70%] z-50 flex flex-col bg-sidebar rounded-t-2xl border-t border-border shadow-2xl animate-sheet-up overflow-hidden"
                        : "flex flex-col bg-sidebar border-l border-border transition-all duration-300 relative z-30 shrink-0 h-full",
                    !isMobile && !isOpen ? "w-10 sm:w-14 items-center py-3" : !isMobile ? "w-64 sm:w-72 md:w-80" : ""
                )}
            >
                {/* Mobile Drag Indicator Handle */}
                {isMobile && (
                    <div className="w-full flex justify-center pt-2 pb-1 bg-sidebar cursor-pointer" onClick={() => setIsOpen(false)}>
                        <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
                    </div>
                )}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                accept="image/*,application/pdf,.doc,.docx,.txt"
            />

            {/* Top Video Stream Header - desktop only (mobile uses floating PiP) */}
            {!isMobile && (
                <div className={cn("w-full transition-all duration-300 shrink-0", !isOpen && !isVideoExpanded && "hidden")}>
                    <DemoStream
                        userName={userName}
                        isChatOpen={isOpen}
                        isVideoExpanded={isVideoExpanded}
                        onExpandChange={(exp) => {
                            onExpandChange?.(exp);
                        }}
                        onToggleChat={() => setIsOpen(!isOpen)}
                    />
                </div>
            )}

            {!isOpen ? (
                /* Collapsed / Minimized Vertical Sidebar View */
                <div className="flex flex-col items-center gap-4 w-full h-full py-2">
                    <button
                        type="button"
                        onClick={() => setIsOpen(true)}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-all relative group cursor-pointer"
                        title="Open Video & Audio Stream"
                    >
                        <Video size={20} />
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsOpen(true)}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-all relative group cursor-pointer"
                        title="Open Chat"
                    >
                        <MessageCircle size={20} />
                    </button>

                    <div className="flex flex-col items-center gap-1 mt-auto">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-muted-foreground">3</span>
                    </div>
                </div>
            ) : (
                /* Expanded Sidebar View */
                <div className="relative flex flex-col flex-1 min-h-0 overflow-hidden">
                    {/* Chat Header Bar (The Strip) */}
                    <div className="h-10 flex items-center justify-between px-2 sm:px-3 border-b border-border shrink-0 bg-sidebar z-20">
                        <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-[0.2em] text-muted-foreground shrink-0">
                            Chat
                        </span>

                        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                            {/* User List Popover Toggle Button */}
                            <button
                                ref={visitorsButtonRef}
                                type="button"
                                onClick={() => {
                                    setShowVisitors(!showVisitors);
                                    if (!showVisitors) setShowSettings(false);
                                }}
                                className={cn(
                                    "p-1 sm:p-1.5 text-muted-foreground flex gap-1 items-center hover:text-foreground transition-colors cursor-pointer rounded-md text-[11px] sm:text-xs font-bold",
                                    showVisitors && "text-foreground bg-muted"
                                )}
                                title="Active Participants"
                            >
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span>3</span>
                                <User2 size={15} />
                            </button>

                            {/* Polls Button */}
                            {onOpenPoll && (
                                <button
                                    type="button"
                                    onClick={onOpenPoll}
                                    className="p-1 sm:p-1.5 flex items-center gap-1 text-[11px] sm:text-xs font-bold rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                    title="Classroom Polls"
                                >
                                    <BarChart2 size={15} />
                                    <span className="hidden xs:inline text-[10px] font-extrabold uppercase">Polls</span>
                                </button>
                            )}

                            {/* Quiz Button */}
                            {onOpenQuiz && (
                                <button
                                    type="button"
                                    onClick={onOpenQuiz}
                                    className="p-1 sm:p-1.5 flex items-center gap-1 text-[11px] sm:text-xs font-bold rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                    title="Classroom Quiz"
                                >
                                    <span className="relative flex h-2 w-2 mr-0.5">
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-muted-foreground/60"></span>
                                    </span>
                                    <span className="hidden xs:inline text-[10px] font-extrabold uppercase">Quiz</span>
                                </button>
                            )}

                            {/* Room Settings Popover Button */}
                            <button
                                ref={settingsButtonRef}
                                type="button"
                                onClick={() => {
                                    setShowSettings(!showSettings);
                                    if (!showSettings) setShowVisitors(false);
                                }}
                                className={cn(
                                    "p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md cursor-pointer",
                                    showSettings && "bg-muted text-foreground"
                                )}
                                title="Room Settings"
                            >
                                <Settings size={16} />
                            </button>

                            {/* Minimize / Close Button */}
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className={cn(
                                    "p-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded-md hover:bg-muted",
                                    isMobile && "bg-muted/50"
                                )}
                                title={isMobile ? "Close Chat" : "Minimize Sidebar"}
                            >
                                {isMobile ? <X size={18} /> : <Minimize2 size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* Floating Popover 1: User List - placed directly below strip and aligned left-0 */}
                    {showVisitors && (
                        <div
                            ref={visitorsRef}
                            className="absolute top-10 left-0 w-64 sm:w-72 max-h-[calc(100%-48px)] bg-card border border-border rounded-lg shadow-2xl z-50 overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
                        >
                            <DemoUserList userName={userName} role="teacher" />
                        </div>
                    )}

                    {/* Floating Popover 2: Settings - placed directly below strip */}
                    {showSettings && (
                        <div
                            ref={settingsRef}
                            className="absolute top-10 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border shadow-2xl animate-in slide-in-from-top-2 duration-300"
                        >
                            <div className="p-3 space-y-3">
                                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[11px] font-bold text-foreground/90">Global Chat</span>
                                        <span className="text-[9px] text-muted-foreground leading-tight">Enable chat messaging for everyone</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const next = !chatEnabled;
                                            setChatEnabled(next);
                                            toast.success(`Global chat ${next ? "enabled" : "disabled"}`);
                                        }}
                                        className={cn(
                                            "relative w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 cursor-pointer",
                                            chatEnabled
                                                ? "bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/20"
                                                : "bg-rose-500/15 text-rose-500 hover:bg-rose-500/20"
                                        )}
                                    >
                                        {chatEnabled ? <MessageCircle size={16} /> : <MessageSquareOff size={16} />}
                                    </button>
                                </div>

                                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[11px] font-bold text-foreground/90">File Sharing</span>
                                        <span className="text-[9px] text-muted-foreground leading-tight">Allow attachments and screenshots</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const next = !attachmentsEnabled;
                                            setAttachmentsEnabled(next);
                                            toast.success(`File sharing ${next ? "enabled" : "disabled"}`);
                                        }}
                                        disabled={!chatEnabled}
                                        className={cn(
                                            "relative w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 disabled:opacity-30 cursor-pointer",
                                            attachmentsEnabled
                                                ? "bg-indigo-500/15 text-indigo-500 hover:bg-indigo-500/20"
                                                : "bg-zinc-500/15 text-zinc-500 hover:bg-zinc-500/20"
                                        )}
                                    >
                                        {attachmentsEnabled ? <FileText size={16} /> : <FileX size={16} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Messages Body */}
                    <div className="flex-1 overflow-y-auto p-3 flex flex-col justify-start">
                        {messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-3 my-auto text-muted-foreground/40 select-none">
                                <div className="w-16 h-16 rounded-full border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
                                    <MessageCircle className="w-8 h-8 opacity-40" />
                                </div>
                                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground/50">
                                    No Chats
                                </span>
                            </div>
                        ) : (
                            <div className="space-y-3 w-full">
                                {messages.map((msg) => {
                                    const isMe = msg.user.name === userName;
                                    return (
                                        <div
                                            key={msg.id}
                                            className={cn(
                                                "p-2.5 rounded-xl text-xs max-w-[92%] space-y-1.5 shadow-sm transition-all",
                                                isMe
                                                    ? "ml-auto bg-primary text-primary-foreground rounded-br-none"
                                                    : "mr-auto bg-muted/60 text-foreground border border-border/40 rounded-bl-none"
                                            )}
                                        >
                                            <div className="flex items-center justify-between gap-2 text-[10px] opacity-75">
                                                <span className="font-bold flex items-center gap-1">
                                                    {msg.user.name}
                                                    {msg.user.isTeacher && <span className="text-[9px] bg-primary-foreground/20 px-1 rounded">Host</span>}
                                                </span>
                                                <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                            </div>

                                            {/* Attachment Preview Card */}
                                            {msg.attachments && msg.attachments.length > 0 && (
                                                <div className="space-y-1.5 my-1">
                                                    {msg.attachments.map((att) => (
                                                        <div
                                                            key={att.id}
                                                            onClick={() => handleOpenAttachment(att)}
                                                            className={cn(
                                                                "flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer",
                                                                isMe
                                                                    ? "bg-primary-foreground/10 border-primary-foreground/20 hover:bg-primary-foreground/20"
                                                                    : "bg-background/80 border-border hover:bg-background"
                                                            )}
                                                        >
                                                            {att.type === "image" ? (
                                                                <div className="relative w-10 h-10 rounded overflow-hidden shrink-0 border border-black/10">
                                                                    <Image src={att.url} alt={att.name} fill className="object-cover" />
                                                                </div>
                                                            ) : (
                                                                <div className="w-8 h-8 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                                                    <FileText size={18} />
                                                                </div>
                                                            )}
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-[11px] font-bold truncate">{att.name}</p>
                                                                <p className="text-[9px] opacity-70">
                                                                    {att.size ? `${(att.size / 1024).toFixed(1)} KB` : "Document"}
                                                                </p>
                                                            </div>
                                                            <ExternalLink size={14} className="shrink-0 opacity-50" />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {msg.message && <p className="leading-relaxed break-words">{msg.message}</p>}
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>
                        )}
                    </div>

                    {/* Pending Attachment Preview */}
                    {pendingAttachment && (
                        <div className="px-4 py-2 bg-muted/50 border-t border-border flex items-center gap-3 animate-in slide-in-from-bottom-2 duration-300">
                            <div className="w-10 h-10 rounded bg-background border border-border flex items-center justify-center overflow-hidden shrink-0">
                                {pendingAttachment.type === "image" ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={pendingAttachment.url} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <FileText size={20} className="text-muted-foreground" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-bold truncate text-foreground">{pendingAttachment.name}</p>
                                <p className="text-[9px] text-muted-foreground">
                                    {pendingAttachment.size ? `${(pendingAttachment.size / 1024).toFixed(1)} KB` : "File"}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPendingAttachment(null)}
                                className="p-1 hover:text-red-500 transition-colors cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    )}

                    {/* Bottom Chat Input Bar */}
                    <form onSubmit={handleSendMessage} className="border-t border-border shrink-0 bg-sidebar">
                        <div className="flex">
                            <div className={cn(
                                "flex gap-1 w-full items-center bg-muted border border-border p-1 pr-2 focus-within:border-primary box-border focus-within:ring-0 focus-within:ring-offset-0 transition-all group",
                                !chatEnabled && "opacity-50 cursor-not-allowed"
                            )}>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={!attachmentsEnabled}
                                    className={cn(
                                        "w-10 h-10 flex items-center justify-center transition-colors hover:bg-background/50 rounded cursor-pointer shrink-0",
                                        !attachmentsEnabled
                                            ? "text-muted-foreground/30 cursor-not-allowed"
                                            : "text-muted-foreground hover:text-primary"
                                    )}
                                    title={!attachmentsEnabled ? "Files disabled" : "Attach file"}
                                >
                                    {!attachmentsEnabled ? <FileX size={20} /> : <Paperclip size={20} />}
                                </button>
                                <input
                                    type="text"
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    disabled={!chatEnabled}
                                    placeholder={
                                        !chatEnabled
                                            ? "Chat is disabled"
                                            : pendingAttachment
                                            ? "Add a caption..."
                                            : "Send a message..."
                                    }
                                    className="flex-1 h-10 px-1 bg-transparent text-sm font-medium outline-none text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={Boolean(
                                    (!inputText.trim() && !pendingAttachment) ||
                                    !chatEnabled ||
                                    (!attachmentsEnabled && pendingAttachment)
                                )}
                                className={cn(
                                    "w-14 h-auto flex items-center justify-center text-white hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md cursor-pointer shrink-0",
                                    "bg-[#6366F1]"
                                )}
                                title="Send Message"
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Image Preview Modal */}
            {previewUrl && (
                <div
                    className="fixed inset-0 z-9999 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
                    onClick={() => setPreviewUrl(null)}
                >
                    <div className="relative max-w-3xl max-h-[85vh] p-2 bg-card rounded-2xl shadow-2xl overflow-hidden border border-border" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end p-2">
                            <button
                                type="button"
                                onClick={() => setPreviewUrl(null)}
                                className="p-1 rounded-full bg-muted/80 hover:bg-muted text-foreground transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="relative w-[70vw] h-[65vh]">
                            <Image src={previewUrl} alt="Attachment Preview" fill className="object-contain" />
                        </div>
                    </div>
                </div>
            )}
        </aside>
    </>
    );
}
