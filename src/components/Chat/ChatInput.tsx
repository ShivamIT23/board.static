"use client"

import React from "react"
import { Send, Paperclip, FileText, X, FileX, Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import { RoomUser } from "@/types/chat"
import type { Socket } from "socket.io-client"

interface ChatInputProps {
    inputMessage: string
    setInputMessage: (val: string) => void
    recipient: "everyone" | "teacher"
    setRecipient: (val: "everyone" | "teacher") => void
    sendMessage: (e: React.FormEvent) => void
    fileInputRef: React.RefObject<HTMLInputElement | null>
    handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
    selectedFile: File | null
    filePreview: string | null
    clearSelectedFile: () => void
    role: "teacher" | "student"
    roomSettings: { chatEnabled: boolean; attachmentsEnabled: boolean }
    roomUser?: RoomUser
    socket: Socket | null
}

export default function ChatInput({
    inputMessage,
    setInputMessage,
    recipient,
    setRecipient,
    sendMessage,
    fileInputRef,
    handleFileSelect,
    selectedFile,
    filePreview,
    clearSelectedFile,
    role,
    roomSettings,
    roomUser,
    socket
}: ChatInputProps) {
    const isChatDisabledForStudent = role === "student" && !roomSettings.chatEnabled && roomUser?.textEnabled !== true
    const isAttachmentDisabledForStudent = role === "student" && roomUser?.attachmentsEnabled === false

    return (
        <form onSubmit={sendMessage} className="bg-card border-t border-border flex flex-col">
            {/* Target Recipient Selector Bar (Students only) */}
            {role === "student" && (
                <div className="px-3 py-1.5 bg-muted/40 border-b border-border/50 flex items-center justify-between text-[11px] font-medium">
                    <span className="text-muted-foreground font-bold">Send to:</span>
                    <div className="flex items-center gap-1 bg-background p-0.5 rounded-lg border border-border">
                        <button
                            type="button"
                            onClick={() => setRecipient("everyone")}
                            className={cn(
                                "px-2.5 py-0.5 rounded-md font-extrabold text-[10px] transition-all",
                                recipient === "everyone"
                                    ? "bg-primary text-primary-foreground shadow-xs"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Everyone
                        </button>
                        <button
                            type="button"
                            onClick={() => setRecipient("teacher")}
                            className={cn(
                                "px-2.5 py-0.5 rounded-md font-extrabold text-[10px] transition-all flex items-center gap-1",
                                recipient === "teacher"
                                    ? "bg-amber-500 text-white shadow-xs"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Lock size={10} /> Teacher Only
                        </button>
                    </div>
                </div>
            )}

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

            {isChatDisabledForStudent ? (
                <div className="h-14 flex items-center justify-center bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-widest gap-2">
                    <Lock size={14} /> Chat Disabled by Instructor
                </div>
            ) : (
                <div className="flex">
                    <div className={cn(
                        "flex gap-1 w-full items-center bg-muted border border-border p-1 pr-2 focus-within:border-primary box-border focus-within:ring-0 focus-within:ring-offset-0 transition-all group",
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
                            disabled={isAttachmentDisabledForStudent}
                            className={cn(
                                "w-10 h-10 flex items-center justify-center transition-colors hover:bg-background/50 rounded",
                                isAttachmentDisabledForStudent
                                    ? "text-muted-foreground/30 cursor-not-allowed"
                                    : "text-muted-foreground hover:text-primary"
                            )}
                            title={isAttachmentDisabledForStudent ? "Files disabled" : "Attach file"}
                        >
                            {isAttachmentDisabledForStudent ? <FileX size={20} /> : <Paperclip size={20} />}
                        </button>
                        <input
                            type="text"
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            disabled={role === "student" && roomUser?.textEnabled === false}
                            placeholder={
                                (role === "student" && roomUser?.textEnabled === false) ? "Chat is disabled" :
                                    selectedFile ? "Add a caption..." : recipient === "teacher" ? "Message to teacher only..." : "Send a message..."
                            }
                            className="flex-1 h-10 px-1 bg-transparent text-sm font-medium outline-none text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={Boolean(
                            (!inputMessage.trim() && !selectedFile) ||
                            !socket ||
                            (role === "student" && roomUser?.textEnabled === false && !selectedFile) ||
                            (isAttachmentDisabledForStudent && selectedFile)
                        )}
                        className={cn(
                            "w-14 h-full flex items-center justify-center text-white hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md",
                            recipient === "teacher" ? "bg-amber-500 hover:bg-amber-600" : "bg-[#6366F1]"
                        )}
                    >
                        <Send size={18} />
                    </button>
                </div>
            )}
        </form>
    )
}
