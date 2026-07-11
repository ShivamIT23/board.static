"use client"

import React, { useState, useEffect, useCallback } from "react"
import { X, CheckCircle2, Clock, BarChart3, Play, StopCircle, Trash2, AlertCircle, Award, Check, Share2, RefreshCw, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Socket } from "socket.io-client"
import type { QuizState } from "@/types/chat"

interface QuizSubmission {
    id: number
    studentName: string
    score: number
    totalQuestions: number
    timeTaken: number
    submittedAt: string
}

interface QuizModalProps {
    isOpen: boolean
    onClose: () => void
    role: "teacher" | "student"
    currentQuiz: QuizState | null
    socket: Socket | null
    sessionId: string
    userId?: string
    classId?: number
    userName?: string
}

function QuizTimer({ createdAt }: { createdAt?: number }) {
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

interface FetchedQuizQuestion {
    id?: string
    question: string
    options: string[]
    correctOption: number
}

export default function QuizModal({
    isOpen,
    onClose,
    role,
    currentQuiz,
    socket,
    sessionId,
    userId,
    classId,
    userName
}: QuizModalProps) {
    const [fetchedQuestions, setFetchedQuestions] = useState<FetchedQuizQuestion[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [errorMsg, setErrorMsg] = useState("")
    
    // Student answers state: questionId -> optionId
    const [answers, setAnswers] = useState<Record<string, string>>({})
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Share quiz link state
    const [isSharing, setIsSharing] = useState(false)
    const [sharedToken, setSharedToken] = useState<string | null>(null)
    const [showResults, setShowResults] = useState(false)
    const [submissions, setSubmissions] = useState<QuizSubmission[]>([])
    const [isLoadingResults, setIsLoadingResults] = useState(false)

    // Fetch quiz questions for teacher if no active/existing quiz is loaded
    useEffect(() => {
        if (!isOpen || role !== "teacher" || currentQuiz) return;

        const fetchQuiz = async () => {
            setIsLoading(true)
            setErrorMsg("")
            try {
                const res = await fetch(`/api/quiz?sessionId=${sessionId}`)
                if (!res.ok) {
                    const data = await res.json()
                    throw new Error(data.error || "Failed to fetch quiz")
                }
                const data = await res.json()
                setFetchedQuestions(data.questions || [])
            } catch (err: unknown) {
                console.error("Fetch quiz error:", err)
                const message = err instanceof Error ? err.message : "Could not load quiz questions";
                setErrorMsg(message)
            } finally {
                setIsLoading(false)
            }
        }

        fetchQuiz()
    }, [isOpen, role, sessionId, currentQuiz])



    // Fetch quiz submissions for teacher results view
    const fetchSubmissions = useCallback(async (token: string) => {
        setIsLoadingResults(true)
        try {
            const res = await fetch(`/api/quiz/share/${token}/results`)
            if (res.ok) {
                const data = await res.json()
                setSubmissions(data.submissions || [])
            }
        } catch (err) {
            console.error("Fetch submissions error:", err)
        } finally {
            setIsLoadingResults(false)
        }
    }, [])

    // Auto-refresh submissions when results panel is open
    useEffect(() => {
        if (!showResults || !sharedToken) return
        fetchSubmissions(sharedToken)
        const interval = setInterval(() => fetchSubmissions(sharedToken), 8000)
        return () => clearInterval(interval)
    }, [showResults, sharedToken, fetchSubmissions])

    if (!isOpen) return null

    const studentVoterId = userId || ""
    const studentHasSubmitted = currentQuiz && studentVoterId && currentQuiz.submittedUsers.includes(studentVoterId)

    // Handle teacher launching the quiz
    const handleLaunchQuiz = () => {
        if (!socket || fetchedQuestions.length === 0) return
        
        socket.emit("quiz_create", {
            roomId: sessionId,
            payload: {
                questions: fetchedQuestions.map(q => ({
                    question: q.question,
                    options: q.options,
                    correctOption: q.correctOption
                }))
            }
        })
    }

    // Handle teacher sharing quiz link via chat
    const handleShareQuizLink = async () => {
        if (!socket || isSharing) return
        setIsSharing(true)
        try {
            const res = await fetch("/api/quiz/share", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId }),
            })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || "Failed to create quiz link")
            }
            const data = await res.json()
            setSharedToken(data.shareToken)

            // Emit socket event to broadcast link to all students
            socket.emit("quiz_share_link", {
                roomId: sessionId,
                payload: {
                    shareToken: data.shareToken,
                    quizTitle: data.quizTitle,
                },
            })
        } catch (err: unknown) {
            console.error("Share quiz link error:", err)
            const message = err instanceof Error ? err.message : "Could not share quiz link"
            alert(message)
        } finally {
            setIsSharing(false)
        }
    }




    // Handle student selecting an answer
    const handleSelectOption = (questionId: string, optionId: string) => {
        if (studentHasSubmitted || !currentQuiz?.isActive) return
        setAnswers(prev => ({
            ...prev,
            [questionId]: optionId
        }))
    }

    // Handle student submitting the quiz
    const handleSubmitQuiz = () => {
        if (!socket || !currentQuiz || studentHasSubmitted) return
        
        // Ensure all questions are answered
        const allAnswered = currentQuiz.questions.every(q => answers[q.id])
        if (!allAnswered) {
            alert("Please answer all questions before submitting.")
            return
        }

        setIsSubmitting(true)
        
        const answersPayload = Object.entries(answers).map(([qId, optId]) => ({
            questionId: qId,
            optionId: optId
        }))

        socket.emit("quiz_submit", {
            roomId: sessionId,
            payload: {
                answers: answersPayload
            }
        })

        // Give a brief duration to show loading, then UI will update via socket quiz_update
        setTimeout(() => {
            setIsSubmitting(false)
        }, 1000)
    }

    // Handle teacher ending the quiz
    const handleEndQuiz = () => {
        if (!socket) return
        socket.emit("quiz_end", { roomId: sessionId })
    }

    // Handle teacher deleting/resetting the quiz
    const handleDeleteQuiz = () => {
        if (!socket) return
        socket.emit("quiz_delete", { roomId: sessionId })
        setFetchedQuestions([])
    }

    // Calculate student score if they submitted
    const calculateScore = () => {
        if (!currentQuiz) return { score: 0, total: 0 }
        let score = 0
        currentQuiz.questions.forEach(q => {
            // Find option voted by student
            const votedOpt = q.options.find(opt => opt.votes.includes(studentVoterId))
            if (votedOpt) {
                const votedIndex = q.options.indexOf(votedOpt)
                if (votedIndex === q.correctOption) {
                    score++
                }
            }
        })
        return { score, total: currentQuiz.questions.length }
    }

    const { score, total } = calculateScore()

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="relative w-[540px] max-w-[94vw] bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] transition-all duration-300">
                
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/40 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
                            <BarChart3 size={18} />
                        </div>
                        <div>
                            <h3 className="font-extrabold text-lg text-foreground tracking-tight">Classroom Quiz</h3>
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Live Activity</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {currentQuiz?.isActive && (
                            <QuizTimer createdAt={currentQuiz.createdAt} />
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="p-5 overflow-y-auto space-y-6 flex-1">
                    {/* Error message */}
                    {errorMsg && (
                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold flex items-center gap-2">
                            <AlertCircle size={15} />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {/* TEACHER FLOW */}
                    {role === "teacher" && (
                        <>
                            {/* Option 1: No Quiz Started yet */}
                            {!currentQuiz && (
                                <div className="space-y-4">
                                    {isLoading ? (
                                        <div className="flex flex-col items-center justify-center py-12 space-y-3">
                                            <div className="w-8 h-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                                            <span className="text-xs text-muted-foreground font-bold">Loading quiz questions...</span>
                                        </div>
                                    ) : fetchedQuestions.length > 0 ? (
                                        <div className="space-y-4">
                                            <div className="p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/10 text-indigo-400 text-xs font-semibold">
                                                A quiz with {fetchedQuestions.length} questions is ready to launch.
                                            </div>
                                            
                                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                                                {fetchedQuestions.map((q, idx) => (
                                                    <div key={q.id || idx} className="p-3 rounded-lg bg-muted/40 border border-border space-y-2">
                                                        <h4 className="font-bold text-xs text-foreground">{idx + 1}. {q.question}</h4>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {q.options.map((opt: string, optIdx: number) => (
                                                                <div 
                                                                    key={optIdx} 
                                                                    className={cn(
                                                                        "p-1.5 rounded text-[11px] font-medium border",
                                                                        optIdx === q.correctOption 
                                                                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                                                                            : "bg-background border-border text-muted-foreground"
                                                                    )}
                                                                >
                                                                    <span className="font-bold mr-1">{String.fromCharCode(65 + optIdx)}.</span> {opt}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={handleLaunchQuiz}
                                                    className="flex-1 py-2.5 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition-all shadow-md flex items-center justify-center gap-2 border border-indigo-500/40"
                                                >
                                                    <Play size={15} fill="currentColor" /> Launch Live Quiz
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleShareQuizLink}
                                                    disabled={isSharing || !!sharedToken}
                                                    className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-all shadow-md flex items-center justify-center gap-2 border border-emerald-500/40 disabled:opacity-50"
                                                >
                                                    {isSharing ? (
                                                        <>
                                                            <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                                                            Sharing...
                                                        </>
                                                    ) : sharedToken ? (
                                                        <>
                                                            <CheckCircle2 size={15} /> Link Shared!
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Share2 size={15} /> Share Quiz Link
                                                        </>
                                                    )}
                                                </button>
                                            </div>

                                            {sharedToken && (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowResults(true)}
                                                    className="w-full py-2 rounded-lg bg-muted/60 text-foreground font-bold text-xs hover:bg-muted transition-all flex items-center justify-center gap-2 border border-border mt-2"
                                                >
                                                    <BarChart3 size={14} /> View Student Results ({submissions.length})
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="py-12 text-center text-xs text-muted-foreground font-semibold">
                                            No quiz configured for this class session. Add questions in the portal before launching.
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Option 2: Active or Ended Quiz Results */}
                            {currentQuiz && (
                                <div className="space-y-5">
                                    <div className="flex items-center justify-between border-b border-border/60 pb-3">
                                        <div>
                                            <span className={cn(
                                                "px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider",
                                                currentQuiz.isActive ? "bg-emerald-500 text-white animate-pulse" : "bg-muted text-muted-foreground"
                                            )}>
                                                {currentQuiz.isActive ? "Live Quiz Running" : "Quiz Ended"}
                                            </span>
                                        </div>
                                        <span className="text-xs text-muted-foreground font-extrabold uppercase tracking-wider">
                                            {currentQuiz.submittedUsers.length} submissions received
                                        </span>
                                    </div>

                                    {/* Correct Answer % Summary for Teacher */}
                                    {currentQuiz.submittedUsers.length > 0 && (
                                        <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-3">
                                            <h4 className="font-extrabold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                                <BarChart3 size={13} /> Correct Answer Rate per Question
                                            </h4>
                                            <div className="space-y-2">
                                                {currentQuiz.questions.map((q, idx) => {
                                                    const totalVotesForQ = q.options.reduce((sum, o) => sum + o.votes.length, 0)
                                                    const correctVotes = q.options[q.correctOption]?.votes.length || 0
                                                    const correctPct = totalVotesForQ > 0 ? Math.round((correctVotes / totalVotesForQ) * 100) : 0

                                                    return (
                                                        <div key={q.id} className="flex items-center gap-3">
                                                            <span className="text-[11px] font-bold text-muted-foreground w-6 shrink-0">Q{idx + 1}</span>
                                                            <div className="flex-1 h-2.5 bg-border/40 rounded-full overflow-hidden">
                                                                <div 
                                                                    className={cn(
                                                                        "h-full rounded-full transition-all duration-700",
                                                                        correctPct >= 70 ? "bg-emerald-500" : correctPct >= 40 ? "bg-amber-500" : "bg-red-500"
                                                                    )}
                                                                    style={{ width: `${correctPct}%` }}
                                                                />
                                                            </div>
                                                            <span className={cn(
                                                                "text-[11px] font-extrabold w-10 text-right",
                                                                correctPct >= 70 ? "text-emerald-500" : correctPct >= 40 ? "text-amber-500" : "text-red-500"
                                                            )}>
                                                                {correctPct}%
                                                            </span>
                                                            {correctPct < 40 && (
                                                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 font-bold shrink-0">Needs Review</span>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Questions Results */}
                                    <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                                        {currentQuiz.questions.map((q, idx) => {
                                            const totalVotesForQ = q.options.reduce((sum, o) => sum + o.votes.length, 0)

                                            return (
                                                <div key={q.id} className="p-4 rounded-lg bg-muted/40 border border-border space-y-3">
                                                    <h4 className="font-bold text-sm text-foreground">{idx + 1}. {q.question}</h4>
                                                    <div className="space-y-2">
                                                        {q.options.map((opt, optIdx) => {
                                                            const votesCount = opt.votes.length
                                                            const pct = totalVotesForQ > 0 ? Math.round((votesCount / totalVotesForQ) * 100) : 0
                                                            const isCorrect = optIdx === q.correctOption

                                                            return (
                                                                <div key={opt.id} className="space-y-1">
                                                                    <div className="flex justify-between items-center text-xs font-semibold">
                                                                        <span className={cn(
                                                                            "flex items-center gap-1.5",
                                                                            isCorrect ? "text-emerald-500 font-bold" : "text-foreground"
                                                                        )}>
                                                                            {isCorrect && <Check size={14} className="shrink-0" />}
                                                                            {opt.text}
                                                                        </span>
                                                                        <span className="text-muted-foreground text-[11px] font-medium">{votesCount} votes ({pct}%)</span>
                                                                    </div>
                                                                    <div className="h-2 w-full bg-border/40 rounded-full overflow-hidden relative">
                                                                        <div 
                                                                            className={cn(
                                                                                "h-full rounded-full transition-all duration-500",
                                                                                isCorrect ? "bg-emerald-500" : "bg-indigo-500"
                                                                            )}
                                                                            style={{ width: `${pct}%` }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-3 pt-2">
                                        {currentQuiz.isActive ? (
                                            <button
                                                type="button"
                                                onClick={handleEndQuiz}
                                                className="flex-1 py-2.5 rounded-lg bg-amber-500/15 text-amber-600 hover:bg-amber-500/25 font-bold text-xs flex items-center justify-center gap-1.5 border border-amber-500/35 transition-colors cursor-pointer"
                                            >
                                                <StopCircle size={15} /> End Active Quiz
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={handleDeleteQuiz}
                                                className="flex-1 py-2.5 rounded-lg bg-red-500/15 text-red-600 hover:bg-red-500/25 font-bold text-xs flex items-center justify-center gap-1.5 border border-red-500/35 transition-colors cursor-pointer"
                                            >
                                                <Trash2 size={15} /> Reset / Delete Quiz
                                            </button>
                                        )}
                                    </div>

                                    {!sharedToken && (
                                        <button
                                            type="button"
                                            onClick={handleShareQuizLink}
                                            disabled={isSharing}
                                            className="w-full py-2.5 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-all shadow-md flex items-center justify-center gap-2 border border-emerald-500/40 disabled:opacity-50 mt-2 cursor-pointer"
                                        >
                                            {isSharing ? (
                                                <>
                                                    <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                                                    Sharing...
                                                </>
                                            ) : (
                                                <>
                                                    <Share2 size={15} /> Share Quiz Link in Chat
                                                </>
                                            )}
                                        </button>
                                    )}

                                    {sharedToken && (
                                        <div className="space-y-2 mt-2">
                                            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-2">
                                                <CheckCircle2 size={14} /> Quiz link shared in chat
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setShowResults(true)}
                                                className="w-full py-2 rounded-lg bg-muted/60 text-foreground font-bold text-xs hover:bg-muted transition-all flex items-center justify-center gap-2 border border-border cursor-pointer"
                                            >
                                                <BarChart3 size={14} /> View Student Results ({submissions.length})
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {/* STUDENT FLOW */}
                    {role === "student" && (
                        <>
                            {/* Quiz not started */}
                            {!currentQuiz && (
                                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                    <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500 animate-pulse">
                                        <Clock size={24} />
                                    </div>
                                    <div className="text-center space-y-1">
                                        <h4 className="font-extrabold text-foreground text-sm">Waiting for Quiz to start</h4>
                                        <p className="text-xs text-muted-foreground font-medium">Your teacher hasn&apos;t launched the quiz yet. Keep this window open.</p>
                                    </div>
                                </div>
                            )}

                            {/* Active Quiz and Student hasn't submitted yet */}
                            {currentQuiz && currentQuiz.isActive && !studentHasSubmitted && (
                                <div className="space-y-5">
                                    <div className="p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/10 text-indigo-400 text-xs font-semibold flex items-center gap-2">
                                        <AlertCircle size={15} className="shrink-0" />
                                        <span>Answer all questions below and submit. Double-check your choices!</span>
                                    </div>

                                    <div className="space-y-5 max-h-[380px] overflow-y-auto pr-1">
                                        {currentQuiz.questions.map((q, idx) => (
                                            <div key={q.id} className="p-4 rounded-lg bg-muted/40 border border-border space-y-3">
                                                <h4 className="font-bold text-sm text-foreground">{idx + 1}. {q.question}</h4>
                                                <div className="space-y-2">
                                                    {q.options.map((opt) => {
                                                        const isSelected = answers[q.id] === opt.id

                                                        return (
                                                            <div
                                                                key={opt.id}
                                                                onClick={() => handleSelectOption(q.id, opt.id)}
                                                                className={cn(
                                                                    "p-3 rounded-lg border text-xs font-semibold cursor-pointer transition-all flex items-center justify-between",
                                                                    isSelected 
                                                                        ? "border-indigo-500 bg-indigo-500/10 text-indigo-400" 
                                                                        : "border-border bg-card text-foreground hover:bg-muted/40"
                                                                )}
                                                            >
                                                                <span>{opt.text}</span>
                                                                <div className={cn(
                                                                    "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ml-3",
                                                                    isSelected ? "border-indigo-500 bg-indigo-500" : "border-muted-foreground/30"
                                                                )}>
                                                                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleSubmitQuiz}
                                        disabled={isSubmitting || !currentQuiz.questions.every(q => answers[q.id])}
                                        className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-800 transition-all shadow-md flex items-center justify-center gap-2 border border-indigo-500/40 disabled:opacity-50"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                                                <span>Submitting answers...</span>
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 size={15} />
                                                <span>Submit Answers</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* Active Quiz and Student already submitted — show live results */}
                            {currentQuiz && currentQuiz.isActive && studentHasSubmitted && (
                                <div className="space-y-5">
                                    {/* Score header */}
                                    <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-4">
                                        <div className="p-2.5 rounded-full bg-emerald-500/20 text-emerald-400">
                                            <CheckCircle2 size={28} />
                                        </div>
                                        <div>
                                            <h4 className="font-extrabold text-sm text-foreground">Submitted!</h4>
                                            <p className="text-xs text-muted-foreground font-semibold">
                                                Your Score: <span className="text-emerald-400 font-extrabold text-sm">{score}</span> / {total} Correct
                                            </p>
                                        </div>
                                    </div>

                                    {/* Live question-by-question breakdown */}
                                    <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                                        {currentQuiz.questions.map((q, idx) => {
                                            const studentVotedOpt = q.options.find(opt => opt.votes.includes(studentVoterId))
                                            const studentVotedIdx = studentVotedOpt ? q.options.indexOf(studentVotedOpt) : -1
                                            const isQuestionCorrect = studentVotedIdx === q.correctOption

                                            return (
                                                <div key={q.id} className={cn(
                                                    "p-4 rounded-lg border space-y-3",
                                                    isQuestionCorrect
                                                        ? "bg-emerald-500/5 border-emerald-500/20"
                                                        : "bg-red-500/5 border-red-500/20"
                                                )}>
                                                    <div className="flex items-start justify-between gap-2">
                                                        <h4 className="font-bold text-sm text-foreground">{idx + 1}. {q.question}</h4>
                                                        {isQuestionCorrect ? (
                                                            <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 font-extrabold uppercase">Correct</span>
                                                        ) : (
                                                            <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-500 font-extrabold uppercase">Wrong</span>
                                                        )}
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        {q.options.map((opt, optIdx) => {
                                                            const isCorrect = optIdx === q.correctOption
                                                            const isStudentChoice = optIdx === studentVotedIdx

                                                            return (
                                                                <div
                                                                    key={opt.id}
                                                                    className={cn(
                                                                        "p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-between",
                                                                        isCorrect
                                                                            ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-500"
                                                                            : isStudentChoice
                                                                                ? "border-red-500/40 bg-red-500/5 text-red-500"
                                                                                : "border-border bg-card text-foreground"
                                                                    )}
                                                                >
                                                                    <span className="flex items-center gap-1.5 truncate">
                                                                        {isCorrect && <Check size={14} className="shrink-0" />}
                                                                        {opt.text}
                                                                        {isStudentChoice && !isCorrect && (
                                                                            <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/10 font-bold shrink-0 ml-1">Your answer</span>
                                                                        )}
                                                                    </span>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Quiz Inactive (Ended) & Student submitted: show final results and score! */}
                            {currentQuiz && !currentQuiz.isActive && (
                                <div className="space-y-5">
                                    {studentHasSubmitted ? (
                                        <div className="p-4 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center gap-4">
                                            <div className="p-2.5 rounded-full bg-indigo-500/20 text-indigo-400">
                                                <Award size={28} />
                                            </div>
                                            <div>
                                                <h4 className="font-extrabold text-sm text-foreground">Quiz Finished</h4>
                                                <p className="text-xs text-muted-foreground font-semibold">
                                                    Your Score: <span className="text-indigo-400 font-extrabold text-sm">{score}</span> / {total} Correct
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold flex items-center gap-2">
                                            <AlertCircle size={15} className="shrink-0" />
                                            <span>Quiz ended. You did not submit answers in time.</span>
                                        </div>
                                    )}

                                    {/* Questions and correct answers review */}
                                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                                        {currentQuiz.questions.map((q, idx) => {
                                            const totalVotesForQ = q.options.reduce((sum, o) => sum + o.votes.length, 0)
                                            // Find option voted by student
                                            const studentVotedOpt = q.options.find(opt => opt.votes.includes(studentVoterId))
                                            const studentVotedIdx = studentVotedOpt ? q.options.indexOf(studentVotedOpt) : -1

                                            return (
                                                <div key={q.id} className="p-4 rounded-lg bg-muted/40 border border-border space-y-3">
                                                    <h4 className="font-bold text-sm text-foreground">{idx + 1}. {q.question}</h4>
                                                    <div className="space-y-2">
                                                        {q.options.map((opt, optIdx) => {
                                                            const votesCount = opt.votes.length
                                                            const pct = totalVotesForQ > 0 ? Math.round((votesCount / totalVotesForQ) * 100) : 0
                                                            const isCorrect = optIdx === q.correctOption
                                                            const isStudentChoice = optIdx === studentVotedIdx

                                                            return (
                                                                <div 
                                                                    key={opt.id} 
                                                                    className={cn(
                                                                        "p-2.5 rounded-lg border text-xs font-semibold relative overflow-hidden",
                                                                        isCorrect 
                                                                            ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-500" 
                                                                            : isStudentChoice 
                                                                                ? "border-red-500/40 bg-red-500/5 text-red-500" 
                                                                                : "border-border bg-card text-foreground"
                                                                    )}
                                                                >
                                                                    <div className="flex justify-between items-center relative z-10">
                                                                        <span className="truncate flex items-center gap-1.5">
                                                                            {isCorrect && <Check size={14} className="shrink-0" />}
                                                                            {opt.text}
                                                                            {isStudentChoice && (
                                                                                <span className="text-[9px] px-1 py-0.5 rounded bg-muted/50 font-bold shrink-0 ml-1.5">Your choice</span>
                                                                            )}
                                                                        </span>
                                                                        <span className="text-muted-foreground text-[10px] font-medium ml-2 shrink-0">{pct}%</span>
                                                                    </div>
                                                                    {/* Background vote distribution bar */}
                                                                    <div className="absolute top-0 bottom-0 left-0 bg-muted-foreground/5 pointer-events-none" style={{ width: `${pct}%` }} />
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

            </div>

            {/* Results Overlay Panel */}
            {showResults && sharedToken && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="relative w-[540px] max-w-[94vw] bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        {/* Results Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/40 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                                    <Users size={18} />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-lg text-foreground tracking-tight">Quiz Results</h3>
                                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                                        {submissions.length} Submissions
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => sharedToken && fetchSubmissions(sharedToken)}
                                    disabled={isLoadingResults}
                                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors cursor-pointer"
                                >
                                    <RefreshCw size={16} className={isLoadingResults ? "animate-spin" : ""} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowResults(false)}
                                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors cursor-pointer"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Results Body */}
                        <div className="p-5 overflow-y-auto flex-1 space-y-3">
                            {isLoadingResults && submissions.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                                    <div className="w-8 h-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                                    <span className="text-xs text-muted-foreground font-bold">Loading results...</span>
                                </div>
                            ) : submissions.length === 0 ? (
                                <div className="py-12 text-center space-y-3">
                                    <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground mx-auto">
                                        <Users size={24} />
                                    </div>
                                    <p className="text-xs text-muted-foreground font-bold">No submissions yet. Waiting for students...</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {/* Table Header */}
                                    <div className="grid grid-cols-[1fr_60px_60px_70px] gap-2 px-3 py-2 text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider border-b border-border">
                                        <span>Student</span>
                                        <span className="text-center">Score</span>
                                        <span className="text-center">Time</span>
                                        <span className="text-right">When</span>
                                    </div>
                                    {submissions.map((sub) => {
                                        const pct = sub.totalQuestions > 0 ? Math.round((sub.score / sub.totalQuestions) * 100) : 0
                                        return (
                                            <div key={sub.id} className="grid grid-cols-[1fr_60px_60px_70px] gap-2 px-3 py-2.5 rounded-lg bg-muted/30 border border-border/60 items-center">
                                                <span className="text-xs font-bold text-foreground truncate">{sub.studentName}</span>
                                                <span className={cn(
                                                    "text-xs font-extrabold text-center",
                                                    pct >= 70 ? "text-emerald-500" : pct >= 40 ? "text-amber-500" : "text-red-500"
                                                )}>
                                                    {sub.score}/{sub.totalQuestions}
                                                </span>
                                                <span className="text-[11px] font-semibold text-muted-foreground text-center">{sub.timeTaken}s</span>
                                                <span className="text-[10px] font-medium text-muted-foreground text-right">
                                                    {new Date(sub.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
