"use client"

import React, { useState, useEffect, useRef } from "react"
import {
    Sparkles,
    X,
    Lightbulb,
    CheckCircle2,
    Copy,
    Check,
    Send,
    RefreshCw,
    AlertCircle,
    Brain,
    Lock,
    Tag
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ChatMessage } from "@/types/chat"

interface TeacherAiModalProps {
    isOpen: boolean
    onClose: () => void
    message: ChatMessage | null
    onInsertIntoChat?: (text: string) => void
}

interface AiResponseData {
    hint: string
    answer: string
    keyConcepts: string[]
}

export default function TeacherAiModal({
    isOpen,
    onClose,
    message,
    onInsertIntoChat
}: TeacherAiModalProps) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [needsConfig, setNeedsConfig] = useState(false)
    const [aiData, setAiData] = useState<AiResponseData | null>(null)
    const [activeTab, setActiveTab] = useState<"hint" | "answer">("hint")
    const [copiedTab, setCopiedTab] = useState<"hint" | "answer" | null>(null)

    // In-memory cache by message key to avoid duplicate OpenAI API calls
    const cacheRef = useRef<Map<string, AiResponseData>>(new Map())

    const messageText = message?.message || ""
    const studentName = message?.user?.name || "Student"
    const messageKey = message ? `${message.user.name}-${message.message}-${message.timestamp}` : ""

    const fetchAiAssist = React.useCallback(async (forceRefresh = false) => {
        if (!messageText.trim()) return

        if (!forceRefresh && cacheRef.current.has(messageKey)) {
            setAiData(cacheRef.current.get(messageKey)!)
            setError(null)
            setNeedsConfig(false)
            return
        }

        setLoading(true)
        setError(null)
        setNeedsConfig(false)

        try {
            const res = await fetch("/api/ai/assist", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    question: messageText,
                    studentName: studentName
                })
            })

            const data = await res.json()

            if (!res.ok) {
                if (data.needsConfig) {
                    setNeedsConfig(true)
                }
                throw new Error(data.error || "Failed to generate AI assist response.")
            }

            const responseData: AiResponseData = {
                hint: data.hint || "No hint available.",
                answer: data.answer || "No answer available.",
                keyConcepts: Array.isArray(data.keyConcepts) ? data.keyConcepts : []
            }

            cacheRef.current.set(messageKey, responseData)
            setAiData(responseData)
        } catch (err: unknown) {
            console.error("AI Assist error:", err)
            const msg = err instanceof Error ? err.message : "Error generating AI response."
            setError(msg)
        } finally {
            setLoading(false)
        }
    }, [messageText, studentName, messageKey])

    useEffect(() => {
        if (isOpen && message) {
            fetchAiAssist()
            setActiveTab("hint")
            setCopiedTab(null)
        } else {
            setAiData(null)
            setError(null)
            setNeedsConfig(false)
        }
    }, [isOpen, message, fetchAiAssist])

    if (!isOpen || !message) return null

    const handleCopy = (type: "hint" | "answer") => {
        if (!aiData) return
        const textToCopy = type === "hint" ? aiData.hint : aiData.answer
        navigator.clipboard.writeText(textToCopy)
        setCopiedTab(type)
        setTimeout(() => setCopiedTab(null), 2000)
    }

    const handleInsert = (type: "hint" | "answer") => {
        if (!aiData || !onInsertIntoChat) return
        const textToInsert = type === "hint" ? `💡 Hint: ${aiData.hint}` : aiData.answer
        onInsertIntoChat(textToInsert)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/40">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-linear-to-tr from-purple-600 to-indigo-500 text-white shadow-md shadow-purple-500/20">
                            <Sparkles size={18} className="animate-pulse" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-extrabold text-foreground tracking-tight">AI Teacher Assistant</h3>
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                    <Lock size={9} />
                                </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground">Hints & step-by-step solutions for student queries</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                        title="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content Area */}
                <div className="p-5 overflow-y-auto space-y-4 no-scrollbar">
                    {/* Student Question Card */}
                    <div className="p-3.5 rounded-xl bg-muted/50 border border-border/80 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-extrabold text-foreground flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                {studentName} asked:
                            </span>
                        </div>
                        <p className="text-xs text-foreground/90 font-medium bg-background/60 p-2.5 rounded-lg border border-border/40 italic">
                            &ldquo;{messageText}&rdquo;
                        </p>
                    </div>

                    {/* Loading State */}
                    {loading && (
                        <div className="py-12 flex flex-col items-center justify-center space-y-3">
                            <div className="relative flex items-center justify-center">
                                <div className="w-12 h-12 rounded-full border-2 border-purple-500/20 border-t-purple-600 animate-spin" />
                                <Brain size={20} className="text-purple-600 absolute" />
                            </div>
                            <div className="text-center space-y-1">
                                <p className="text-xs font-bold text-foreground">Analyzing question with AI...</p>
                                <p className="text-[11px] text-muted-foreground">Formulating pedagogical hint and full solution</p>
                            </div>
                        </div>
                    )}

                    {/* Error State */}
                    {!loading && error && (
                        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 space-y-3 text-destructive">
                            <div className="flex items-start gap-2.5">
                                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                                <div className="space-y-1 text-xs">
                                    <p className="font-bold">Failed to generate AI guidance</p>
                                    <p className="text-muted-foreground">{error}</p>
                                    {needsConfig && (
                                        <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-1">
                                            To enable this feature, please add your <code className="bg-muted px-1 py-0.5 rounded font-mono">OPENAI_API_KEY=...</code> to <code className="bg-muted px-1 py-0.5 rounded font-mono">.env</code>.
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => fetchAiAssist(true)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-card hover:bg-muted text-foreground border border-border shadow-sm transition-all cursor-pointer"
                            >
                                <RefreshCw size={12} />
                                Try Again
                            </button>
                        </div>
                    )}

                    {/* AI Results */}
                    {!loading && !error && aiData && (
                        <div className="space-y-4">
                            {/* Key Concepts Tags */}
                            {aiData.keyConcepts && aiData.keyConcepts.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mr-1">
                                        <Tag size={10} /> Concepts:
                                    </span>
                                    {aiData.keyConcepts.map((concept, idx) => (
                                        <span
                                            key={idx}
                                            className="px-2 py-0.5 text-[11px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 rounded-md"
                                        >
                                            {concept}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Tab Switcher */}
                            <div className="flex p-1 bg-muted rounded-xl border border-border">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab("hint")}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer",
                                        activeTab === "hint"
                                            ? "bg-card text-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <Lightbulb size={14} className={activeTab === "hint" ? "text-amber-500" : ""} />
                                    <span>Guiding Hint</span>
                                    <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full font-bold">
                                        For Student
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab("answer")}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer",
                                        activeTab === "answer"
                                            ? "bg-card text-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <CheckCircle2 size={14} className={activeTab === "answer" ? "text-emerald-500" : ""} />
                                    <span>Full Solution</span>
                                    <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full font-bold">
                                        Teacher Only
                                    </span>
                                </button>
                            </div>

                            {/* Active Tab Content */}
                            {activeTab === "hint" ? (
                                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                                            <Lightbulb size={13} /> Recommended Hint
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">Nudge student toward the answer</span>
                                    </div>
                                    <div className="text-xs leading-relaxed text-foreground font-medium whitespace-pre-wrap">
                                        {aiData.hint}
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                            <CheckCircle2 size={13} /> Complete Solution & Answer
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">Full reference solution</span>
                                    </div>
                                    <div className="text-xs leading-relaxed text-foreground font-medium whitespace-pre-wrap">
                                        {aiData.answer}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                {!loading && !error && aiData && (
                    <div className="flex items-center justify-between px-5 py-3.5 border-t border-border bg-muted/30">
                        <button
                            type="button"
                            onClick={() => fetchAiAssist(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                            title="Regenerate with fresh AI response"
                        >
                            <RefreshCw size={13} />
                            Regenerate
                        </button>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => handleCopy(activeTab)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-card hover:bg-muted text-foreground border border-border shadow-sm transition-all cursor-pointer"
                            >
                                {copiedTab === activeTab ? (
                                    <>
                                        <Check size={13} className="text-emerald-500" />
                                        <span>Copied!</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy size={13} />
                                        <span>Copy {activeTab === "hint" ? "Hint" : "Answer"}</span>
                                    </>
                                )}
                            </button>

                            {onInsertIntoChat && (
                                <button
                                    type="button"
                                    onClick={() => handleInsert(activeTab)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-primary hover:bg-primary/90 shadow-md shadow-primary/20 transition-all active:scale-98 cursor-pointer"
                                >
                                    <Send size={13} />
                                    <span>Insert into Chat</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
