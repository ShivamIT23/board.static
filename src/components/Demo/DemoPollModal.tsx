"use client"

import React, { useState, useEffect } from "react"
import { BarChart2, CheckCircle2, Plus, Trash2, X, Play, StopCircle, RotateCcw, History, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Poll } from "@/types/chat"

interface PollModalProps {
    isOpen: boolean
    onClose: () => void
    role: "teacher" | "student"
    poll: Poll | null
    pollsHistory?: Poll[]
    sessionId: string
    userId?: string
    onLaunchPoll?: (newPoll: Poll) => void
    onEndPoll?: () => void
    onVotePoll?: (optionId: string) => void
}

function PollTimer({ createdAt }: { createdAt?: number }) {
    const [elapsed, setElapsed] = useState(0)

    useEffect(() => {
        if (!createdAt) return
        const updateTimer = () => {
            const now = Date.now()
            const diff = Math.max(0, Math.floor((now - createdAt) / 1000))
            setElapsed(diff)
        }
        updateTimer()
        const interval = setInterval(updateTimer, 1000)
        return () => clearInterval(interval)
    }, [createdAt])

    const mins = String(Math.floor(elapsed / 60)).padStart(2, '0')
    const secs = String(elapsed % 60).padStart(2, '0')

    return (
        <span className="flex items-center gap-1 font-mono text-xs font-extrabold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-[4px] border border-amber-500/20">
            <Clock size={12} />
            {mins}:{secs}
        </span>
    )
}

export default function DemoPollModal({
    isOpen,
    onClose,
    role,
    poll,
    pollsHistory = [],
    sessionId,
    userId,
    onLaunchPoll,
    onEndPoll,
    onVotePoll,
}: PollModalProps) {
    const [isCreating, setIsCreating] = useState(false)
    const [question, setQuestion] = useState("How clear is today's topic on Whiteboard tools?")
    const [options, setOptions] = useState(["Completely Clear! 👍", "Need a quick review 🤔", "Please re-explain ❓"])

    const handleAddOption = () => {
        if (options.length < 5) {
            setOptions([...options, ""])
        }
    }

    const handleRemoveOption = (index: number) => {
        if (options.length > 2) {
            setOptions(options.filter((_, i) => i !== index))
        }
    }

    const handleOptionChange = (index: number, text: string) => {
        const updated = [...options]
        updated[index] = text
        setOptions(updated)
    }

    const handleLaunchPoll = (e: React.FormEvent) => {
        e.preventDefault()
        const validOptions = options.filter(o => o.trim())
        if (!question.trim() || validOptions.length < 2) return

        if (onLaunchPoll) {
            const now = Date.now()
            const newPoll: Poll = {
                id: `demo-poll-${now}`,
                question: question.trim(),
                options: validOptions.map((opt, idx) => ({
                    id: `opt-${idx}`,
                    text: opt,
                    votes: idx === 0 ? ["student-1", "student-2"] : idx === 1 ? ["student-3"] : [],
                })),
                isActive: true,
                createdAt: now,
                createdBy: "Teacher",
            }
            onLaunchPoll(newPoll)
        }
        setIsCreating(false)
    }

    const handleRelaunchPoll = (histPoll: Poll, now: number) => {
        if (onLaunchPoll) {
            const relPoll: Poll = {
                ...histPoll,
                id: `demo-poll-${now}`,
                isActive: true,
                createdAt: now,
            }
            onLaunchPoll(relPoll)
        }
        setIsCreating(false)
    }

    const handleVote = (optionId: string) => {
        if (!poll || !poll.isActive || userVotedOptionId) return
        if (onVotePoll) {
            onVotePoll(optionId)
        }
    }

    const handleEndPoll = () => {
        if (onEndPoll) {
            onEndPoll()
        }
    }

    // Calculate votes tally for current poll
    const totalVotes = poll ? poll.options.reduce((sum, opt) => sum + opt.votes.length, 0) : 0
    const userVotedOptionId = (poll && userId)
        ? poll.options.find(opt => opt.votes.includes(userId))?.id
        : undefined

    const totalPollsCount = pollsHistory.length || (poll ? 1 : 0)

    if (!isOpen) return null

    // Students who already voted — never show the modal
    const hasStudentVoted = role === "student" && userId && poll?.options.some(opt => opt.votes.includes(userId))
    if (hasStudentVoted) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-I 2 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="relative w-[480px] max-w-[94vw] min-h-[340px] bg-card border border-border rounded-[5px] shadow-2xl overflow-hidden flex flex-col max-h-[88vh] transition-all duration-300">
                
                {/* Header matching user wireframe with comfortable padding */}
                <div className="flex items-center justify-between px-2 gap-3 py-2 border-b border-border/80 bg-muted/40">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-[5px] bg-primary/10 text-primary">
                            <BarChart2 size={16} />
                        </div>
                        <h3 className="font-extrabold text-lg text-foreground tracking-tight">Polls</h3>
                    </div>

                    <div className="flex items-center">
                        {role === "teacher" && (
                            <button
                                type="button"
                                onClick={() => setIsCreating(prev => !prev)}
                                className="px-1.5 py-1 rounded-[5px] bg-primary/10 text-primary hover:bg-primary/20 font-extrabold text-xs flex items-center gap-1.5 transition-colors border border-primary/20"
                            >
                                <Plus size={15} />
                                <span>{isCreating ? "view history" : "new"}</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors ml-1"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Main Content Area with generous padding */}
                <div className="p-4 overflow-y-auto space-y-5 flex-1">
                    
                    {/* Mode 1: Create Poll Form */}
                    {isCreating && role === "teacher" ? (
                        <form onSubmit={handleLaunchPoll} className="space-y-6 animate-in fade-in duration-200">
                            <div className="flex items-center justify-between pb-2">
                                <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Create New Poll</span>
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-bold text-muted-foreground">Question</label>
                                <input
                                    type="text"
                                    value={question}
                                    onChange={(e) => setQuestion(e.target.value)}
                                    placeholder="e.g. Do you understand this topic?"
                                    className="w-full px-2 py-1.5 rounded-[5px] bg-muted/40 border border-border text-sm font-medium outline-none focus:border-primary text-foreground"
                                    required
                                />
                            </div>

                            <div className="space-y-3.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-muted-foreground">Options</label>
                                    {options.length < 5 && (
                                        <button
                                            type="button"
                                            onClick={handleAddOption}
                                            className="text-xs text-primary hover:underline font-bold flex items-center gap-1"
                                        >
                                            <Plus size={14} /> Add Option
                                        </button>
                                    )}
                                </div>

                                {options.map((opt, idx) => (
                                    <div key={idx} className="flex items-center gap-3">
                                        <span className="w-6 text-center text-xs font-extrabold text-muted-foreground">{String.fromCharCode(65 + idx)}</span>
                                        <input
                                            type="text"
                                            value={opt}
                                            onChange={(e) => handleOptionChange(idx, e.target.value)}
                                            placeholder={`Option ${idx + 1}`}
                                            className="flex-1 px-2 py-1 rounded-[5px] bg-muted/40 border border-border text-xs font-medium outline-none focus:border-primary text-foreground"
                                            required
                                        />
                                        {options.length > 2 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveOption(idx)}
                                                className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <button
                                type="submit"
                                disabled={!question.trim() || options.filter(o => o.trim()).length < 2}
                                className="w-full mt-2 py-2 rounded-[5px] bg-primary text-primary-foreground font-bold text-xs hover:opacity-90 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <Play size={15} fill="currentColor" /> Launch Poll
                            </button>
                        </form>
                    ) : (
                        /* Mode 2: Live Poll + History (Matches User Diagram) */
                        <div className="space-y-4 animate-in fade-in duration-200">
                            
                            {/* Active Poll Banner if running */}
                            {poll && poll.isActive && (
                                <div className="p-2 rounded-[5px] bg-emerald-500/10 border border-emerald-500/30 space-y-3.5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-emerald-500 text-white animate-pulse">
                                                Active Poll
                                            </span>
                                            {role === "teacher" && (
                                                <PollTimer createdAt={poll.createdAt} />
                                            )}
                                        </div>
                                        <span className="text-xs text-muted-foreground font-bold">
                                            {role === "teacher" ? `${totalVotes} votes cast` : ""}
                                        </span>
                                    </div>
                                    <h4 className="font-extrabold text-base text-foreground">{poll.question}</h4>

                                    <div className="space-y-2.5">
                                        {poll.options.map((option) => {
                                            const vCount = option.votes.length
                                            const pct = totalVotes > 0 ? Math.round((vCount / totalVotes) * 100) : 0
                                            const isMyChoice = userVotedOptionId === option.id
                                            const showResults = role === "teacher" || !!userVotedOptionId

                                            return (
                                                <div
                                                    key={option.id}
                                                    onClick={() => {
                                                        if (role === "student" && !userVotedOptionId) handleVote(option.id)
                                                    }}
                                                    className={cn(
                                                        "relative overflow-hidden p-2 mb-1 rounded-[5px] border text-xs font-semibold transition-all",
                                                        role === "student" && !userVotedOptionId ? "cursor-pointer hover:border-primary hover:bg-muted/40" : "",
                                                        isMyChoice ? "border-primary bg-primary/10" : "border-border bg-card"
                                                    )}
                                                >
                                                    <div className="flex justify-between items-center relative z-10">
                                                        <span className="truncate text-foreground flex items-center gap-2">
                                                            {isMyChoice && <CheckCircle2 size={15} className="text-primary shrink-0" />}
                                                            {option.text}
                                                        </span>
                                                        {showResults && (
                                                            <span className="text-xs font-bold text-muted-foreground ml-2 shrink-0">{vCount} ({pct}%)</span>
                                                        )}
                                                    </div>
                                                    {showResults && (
                                                        <div className="absolute top-0 bottom-0 left-0 bg-primary/20 transition-all pointer-events-none" style={{ width: `${pct}%` }} />
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>

                                    {role === "teacher" && (
                                        <button
                                            type="button"
                                            onClick={handleEndPoll}
                                            className="w-full py-1.5 rounded-[5px] mt-2 bg-amber-500/15 text-amber-600 hover:bg-amber-500/25 font-bold text-xs flex items-center justify-center gap-1.5 border border-amber-500/30 transition-colors"
                                        >
                                            <StopCircle size={15} /> End Active Poll
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* History Container Box — only visible to teachers */}
                            {role === "teacher" && (
                                <div className="rounded-[5px] border border-border bg-muted/20 p-2 space-y-4">
                                    <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                                        <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                            <History size={12} /> history
                                        </span>
                                    </div>

                                    {/* Scrollable History List */}
                                    <div className="max-h-[240px] overflow-y-auto pr-1 w-full space-y-3 no-scrollbar">
                                        {pollsHistory.length > 0 ? (
                                            pollsHistory.map((histPoll) => {
                                                const hTotal = histPoll.options.reduce((s, o) => s + o.votes.length, 0)
                                                return (
                                                    <div
                                                        key={histPoll.id}
                                                        className="p-1.5 rounded-[5px] bg-card border border-border/80 hover:border-border transition-all flex items-center justify-between gap-3 shadow-2xs"
                                                    >
                                                        <div className="min-w-0 flex-1">
                                                            <p className="font-bold text-xs text-foreground truncate">{histPoll.question}</p>
                                                            <p className="text-[10px] text-muted-foreground font-medium mt-1">
                                                                {histPoll.options.length} options • {hTotal} votes
                                                            </p>
                                                        </div>

                                                        <button
                                                            type="button"
                                                            onClick={() => handleRelaunchPoll(histPoll, Date.now())}
                                                            className="px-3 py-1.5 rounded-[5px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 font-bold text-xs flex items-center gap-1.5 shrink-0 border border-emerald-500/30 transition-colors"
                                                            title="Launch this poll again"
                                                        >
                                                            <RotateCcw size={13} />
                                                            <span>launch again</span>
                                                        </button>
                                                    </div>
                                                )
                                            })
                                        ) : (
                                            <div className="py-8 text-center text-xs text-muted-foreground font-semibold">
                                                No poll history yet.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer — only visible to teachers */}
                {role === "teacher" && (
                    <div className="px-2 py-2 border-t border-border/80 bg-muted/40 flex items-center justify-between">
                        <div className="px-2 py-1.5 rounded-[5px] bg-card border border-border text-xs font-bold text-foreground shadow-2xs flex items-center gap-2">
                            <span className="text-muted-foreground">total polls:</span>
                            <span className="text-primary font-black text-sm">{totalPollsCount}</span>
                        </div>
                    </div>
                )}

            </div>
        </div>
    )
}
