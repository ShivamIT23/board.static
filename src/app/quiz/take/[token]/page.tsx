// "use client"

// import React, { useState, useEffect, useRef } from "react"
// import { useParams } from "next/navigation"
// import { toast, Toaster } from "sonner"
// import {
//   Loader2,
//   CheckCircle2,
//   XCircle,
//   Clock,
//   ArrowRight,
//   User,
//   AlertCircle,
//   Sparkles,
//   HelpCircle,
//   Check
// } from "lucide-react"

// // Types
// interface QuizQuestion {
//   question: string
//   options: string[]
// }

// interface QuizDetails {
//   id: number
//   shareToken: string
//   quizTitle: string
//   questions: QuizQuestion[]
//   timerDuration: number
//   expiresAt: string
// }

// interface SubmittedResultDetail {
//   question: string
//   options: string[]
//   correctOption: number
//   studentOption: number
//   isCorrect: boolean
// }

// interface SavedResult {
//   studentName: string
//   score: number
//   totalQuestions: number
//   timeTaken: number
//   submittedAt: string
//   results: SubmittedResultDetail[]
// }

// export default function StudentQuizPage() {
//   const params = useParams()
//   const token = params?.token as string
  
//   const [loading, setLoading] = useState(true)
//   const [errorMsg, setErrorMsg] = useState<string | null>(null)
//   const [isExpired, setIsExpired] = useState(false)
//   const [isInactive, setIsInactive] = useState(false)
  
//   const [quiz, setQuiz] = useState<QuizDetails | null>(null)
  
//   // Game states: 'gate' | 'taking' | 'submitting' | 'result'
//   const [gameState, setGameState] = useState<'gate' | 'taking' | 'submitting' | 'result'>('gate')
  
//   // Student input state
//   const [studentName, setStudentName] = useState("")
//   const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
//   const [answers, setAnswers] = useState<Record<number, number>>({})
  
//   // Timer state
//   const [timeLeft, setTimeLeft] = useState<number>(0)
//   const [timeTaken, setTimeTaken] = useState<number>(0)
//   const timerRef = useRef<NodeJS.Timeout | null>(null)
//   const timeTakenRef = useRef<number>(0)
  
//   // Final Result state
//   const [savedResult, setSavedResult] = useState<SavedResult | null>(null)

//   // 1. Fetch Shared Quiz & Check LocalStorage
//   useEffect(() => {
//     if (!token) return

//     async function loadQuiz() {
//       try {
//         // First check if user already completed this quiz and has result in localStorage
//         const localData = localStorage.getItem(`tutorarc_quiz_result_${token}`)
//         if (localData) {
//           try {
//             const parsed = JSON.parse(localData) as SavedResult
//             setSavedResult(parsed)
//             setGameState('result')
//             setLoading(false)
//             return
//           } catch (e) {
//             console.error("Failed to parse local quiz result", e)
//           }
//         }

//         const res = await fetch(`/api/quiz/share/${token}`)
//         const data = await res.json()

//         if (!res.ok) {
//           if (data.expired) {
//             setIsExpired(true)
//             setErrorMsg(data.error || "This quiz has expired.")
//           } else if (data.inactive) {
//             setIsInactive(true)
//             setErrorMsg(data.error || "This quiz is currently paused.")
//           } else {
//             setErrorMsg(data.error || "Could not load quiz details.")
//           }
//           return
//         }

//         setQuiz(data.quiz)
//         if (data.quiz.timerDuration > 0) {
//           setTimeLeft(data.quiz.timerDuration)
//         }
//       } catch (err) {
//         console.error("Fetch quiz details error:", err)
//         setErrorMsg("Failed to connect to server.")
//       } finally {
//         setLoading(false)
//       }
//     }

//     loadQuiz()
//   }, [token])

//   // Track time elapsed and decrement timer if taking quiz
//   useEffect(() => {
//     if (gameState !== 'taking') {
//       if (timerRef.current) clearInterval(timerRef.current)
//       return
//     }

//     timerRef.current = setInterval(() => {
//       // Increment time taken
//       timeTakenRef.current += 1
//       setTimeTaken(timeTakenRef.current)

//       // Decrement time left if limit exists
//       if (quiz && quiz.timerDuration > 0) {
//         setTimeLeft((prev) => {
//           if (prev <= 1) {
//             // Time is up! Trigger auto submit
//             if (timerRef.current) clearInterval(timerRef.current)
//             toast.warning("Time's up! Automatically submitting your answers.")
//             triggerSubmitQuiz(true)
//             return 0
//           }
//           return prev - 1
//         })
//       }
//     }, 1000)

//     return () => {
//       if (timerRef.current) clearInterval(timerRef.current)
//     }
//   }, [gameState, quiz])

//   // Start the Quiz
//   const handleStartQuiz = (e: React.FormEvent) => {
//     e.preventDefault()
//     if (!studentName.trim()) {
//       toast.error("Please enter your name to start.")
//       return
//     }
    
//     // Reset answers
//     setAnswers({})
//     setCurrentQuestionIndex(0)
//     timeTakenRef.current = 0
//     setTimeTaken(0)
//     if (quiz && quiz.timerDuration > 0) {
//       setTimeLeft(quiz.timerDuration)
//     }

//     setGameState('taking')
//   }

//   // Answer selection
//   const handleSelectOption = (optIdx: number) => {
//     setAnswers((prev) => ({
//       ...prev,
//       [currentQuestionIndex]: optIdx
//     }))
//   }

//   // Navigation helpers
//   const handleNext = () => {
//     if (quiz && currentQuestionIndex < quiz.questions.length - 1) {
//       setCurrentQuestionIndex(currentQuestionIndex + 1)
//     }
//   }

//   const handlePrev = () => {
//     if (currentQuestionIndex > 0) {
//       setCurrentQuestionIndex(currentQuestionIndex - 1)
//     }
//   }

//   // Submit Quiz Action
//   const triggerSubmitQuiz = async (forceWithCurrentAnswers = false) => {
//     if (!quiz || !studentName.trim()) return

//     // Verify all answered if not forced (e.g. time ran out)
//     if (!forceWithCurrentAnswers) {
//       const totalQs = quiz.questions.length
//       const answeredCount = Object.keys(answers).length
//       if (answeredCount < totalQs) {
//         // Focus the first unanswered question
//         for (let i = 0; i < totalQs; i++) {
//           if (answers[i] === undefined) {
//             setCurrentQuestionIndex(i)
//             toast.error(`Please answer all questions. Question ${i + 1} is missing.`)
//             return
//           }
//         }
//       }
//     }

//     setGameState('submitting')
//     if (timerRef.current) clearInterval(timerRef.current)

//     try {
//       const res = await fetch("/api/quiz/submit", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           shareToken: token,
//           studentName,
//           answers,
//           timeTaken: timeTakenRef.current
//         })
//       })

//       if (res.ok) {
//         const data = await res.json()
//         const resultPayload: SavedResult = {
//           studentName,
//           score: data.score,
//           totalQuestions: data.totalQuestions,
//           timeTaken: timeTakenRef.current,
//           submittedAt: new Date().toISOString(),
//           results: data.results
//         }
        
//         // Save to localStorage
//         localStorage.setItem(`tutorarc_quiz_result_${token}`, JSON.stringify(resultPayload))
//         setSavedResult(resultPayload)
//         setGameState('result')
//         toast.success("Quiz submitted successfully!")
//       } else {
//         const data = await res.json()
//         toast.error(data.error || "Failed to submit answers.")
//         setGameState('taking')
//       }
//     } catch (error) {
//       console.error("Submit quiz error:", error)
//       toast.error("Network error submitting quiz.")
//       setGameState('taking')
//     }
//   }

//   // Get Score Message / Trophy Badge
//   const getFeedbackDetails = (score: number, total: number) => {
//     const pct = (score / total) * 100
//     if (pct === 100) {
//       return {
//         badge: "Gold Trophy",
//         message: "Outstanding! Perfect Score!",
//         color: "text-amber-400 bg-amber-500/10 border-amber-500/20"
//       }
//     } else if (pct >= 80) {
//       return {
//         badge: "Silver Award",
//         message: "Excellent job! You did fantastic!",
//         color: "text-zinc-300 bg-zinc-400/10 border-zinc-400/20"
//       }
//     } else if (pct >= 50) {
//       return {
//         badge: "Star Performer",
//         message: "Good effort! Keep practicing to get better.",
//         color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20"
//       }
//     } else {
//       return {
//         badge: "Certificate of Attempt",
//         message: "Keep practicing! Review the correct answers below.",
//         color: "text-red-400 bg-red-500/10 border-red-500/20"
//       }
//     }
//   }

//   // Loading View
//   if (loading) {
//     return (
//       <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white gap-4">
//         <Loader2 className="animate-spin text-indigo-500" size={40} />
//         <p className="text-sm font-semibold tracking-wider text-zinc-400">Loading Quiz...</p>
//       </div>
//     )
//   }

//   // ERROR / EXPIRATION / INACTIVE VIEWS
//   if (errorMsg) {
//     return (
//       <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6 text-center">
//         <div className="max-w-md w-full backdrop-blur-md bg-zinc-900/50 p-8 rounded-2xl border border-zinc-800 shadow-2xl space-y-6">
//           <div className="inline-flex p-3 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
//             <AlertCircle size={32} />
//           </div>
//           <h2 className="text-2xl font-bold">Quiz Unavailable</h2>
//           <p className="text-zinc-400 text-sm leading-relaxed">{errorMsg}</p>
          
//           {isExpired && (
//             <div className="text-xs text-zinc-500 bg-zinc-900 p-3 rounded-lg">
//               This link had an expiry limit and has expired. Contact your teacher to generate a new quiz link.
//             </div>
//           )}

//           {isInactive && (
//             <div className="text-xs text-zinc-500 bg-zinc-900 p-3 rounded-lg">
//               The quiz is currently paused. Please wait for the teacher to activate it.
//             </div>
//           )}
//         </div>
//       </div>
//     )
//   }

//   // GAME STATE: GATE SCREEN (Enter name to start)
//   if (gameState === 'gate' && quiz) {
//     return (
//       <div className="min-h-screen bg-linear-to-b from-zinc-950 to-zinc-900 text-white flex items-center justify-center p-6">
//         <Toaster position="top-right" richColors />
//         <div className="max-w-md w-full backdrop-blur-md bg-zinc-900/40 p-8 rounded-2xl border border-zinc-850 shadow-2xl space-y-6">
//           <div className="text-center space-y-2">
//             <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest bg-indigo-500/5 px-2.5 py-1 rounded-full border border-indigo-500/10">
//               QUIZ GATEWAY
//             </span>
//             <h1 className="text-2xl font-extrabold tracking-tight pt-2">{quiz.quizTitle}</h1>
//             <p className="text-xs text-zinc-500">
//               {quiz.questions.length} Multiple Choice Questions
//             </p>
//           </div>

//           <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-850 space-y-3">
//             <div className="flex items-center justify-between text-xs text-zinc-400 border-b border-zinc-850/60 pb-2">
//               <span className="flex items-center gap-1.5"><Clock size={12} /> Time Limit</span>
//               <span className="font-bold text-zinc-200">
//                 {quiz.timerDuration > 0 ? `${Math.floor(quiz.timerDuration / 60)} Minutes` : "No limit"}
//               </span>
//             </div>
            
//             {quiz.timerDuration > 0 && (
//               <div className="text-[10px] text-amber-400 leading-relaxed bg-amber-500/5 px-2 py-1 rounded border border-amber-500/10">
//                 ⚠️ Once started, the timer cannot be paused. Make sure you complete it before time ends, or your current answers will be submitted.
//               </div>
//             )}
//           </div>

//           <form onSubmit={handleStartQuiz} className="space-y-4">
//             <div className="space-y-2">
//               <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
//                 Enter Your Full Name
//               </label>
//               <div className="relative">
//                 <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500">
//                   <User size={16} />
//                 </span>
//                 <input
//                   type="text"
//                   required
//                   placeholder="e.g. Alex Smith"
//                   className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-zinc-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-zinc-600"
//                   value={studentName}
//                   onChange={(e) => setStudentName(e.target.value)}
//                 />
//               </div>
//             </div>

//             <button
//               type="submit"
//               className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-lg shadow-indigo-500/10 cursor-pointer"
//             >
//               Start Quiz <ArrowRight size={18} />
//             </button>
//           </form>
//         </div>
//       </div>
//     )
//   }

//   // GAME STATE: TAKING QUIZ
//   if (gameState === 'taking' && quiz) {
//     const currentQuestion = quiz.questions[currentQuestionIndex]
//     const hasNext = currentQuestionIndex < quiz.questions.length - 1
//     const totalQs = quiz.questions.length
    
//     // Formatting remaining time mins:secs
//     const mins = String(Math.floor(timeLeft / 60)).padStart(2, "0")
//     const secs = String(timeLeft % 60).padStart(2, "0")
//     const selectedOption = answers[currentQuestionIndex]

//     return (
//       <div className="min-h-screen bg-zinc-950 text-white flex flex-col justify-between p-6">
//         <Toaster position="top-right" richColors />
        
//         {/* Top Header */}
//         <header className="max-w-3xl w-full mx-auto flex items-center justify-between shrink-0">
//           <div>
//             <h1 className="font-bold text-sm text-zinc-300">{quiz.quizTitle}</h1>
//             <p className="text-[10px] text-zinc-500">Student: {studentName}</p>
//           </div>

//           {quiz.timerDuration > 0 && (
//             <div
//               className={`flex items-center gap-1.5 font-mono text-xs font-extrabold px-3 py-1 rounded-lg border ${
//                 timeLeft < 30
//                   ? "text-red-400 bg-red-500/10 border-red-500/20 animate-pulse"
//                   : "text-amber-400 bg-amber-500/10 border-amber-500/20"
//               }`}
//             >
//               <Clock size={14} />
//               {mins}:{secs}
//             </div>
//           )}
//         </header>

//         {/* Quiz Panel Body */}
//         <main className="max-w-3xl w-full mx-auto my-auto py-8 flex flex-col gap-6">
          
//           {/* Question Progress bar */}
//           <div className="space-y-2">
//             <div className="flex justify-between items-center text-xs text-zinc-400">
//               <span>Question {currentQuestionIndex + 1} of {totalQs}</span>
//               <span>{Math.round(((currentQuestionIndex + 1) / totalQs) * 100)}% Complete</span>
//             </div>
//             <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden border border-zinc-850">
//               <div
//                 className="bg-indigo-500 h-full rounded-full transition-all duration-300"
//                 style={{ width: `${((currentQuestionIndex + 1) / totalQs) * 100}%` }}
//               />
//             </div>
//           </div>

//           {/* Question Card */}
//           <div className="p-6 md:p-8 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-6 shadow-xl">
//             <h2 className="text-lg md:text-xl font-bold text-zinc-100 flex items-start gap-3">
//               <HelpCircle className="text-indigo-400 shrink-0 mt-1" size={20} />
//               {currentQuestion.question}
//             </h2>

//             {/* Options grid */}
//             <div className="grid grid-cols-1 gap-3">
//               {currentQuestion.options.map((opt, optIdx) => {
//                 const isSelected = selectedOption === optIdx
//                 return (
//                   <button
//                     key={optIdx}
//                     onClick={() => handleSelectOption(optIdx)}
//                     className={`text-left p-4 rounded-xl border text-sm transition-all flex items-center justify-between cursor-pointer ${
//                       isSelected
//                         ? "bg-indigo-600/15 border-indigo-500 text-white font-semibold"
//                         : "bg-zinc-950/40 border-zinc-850 text-zinc-300 hover:bg-zinc-900 hover:border-zinc-750"
//                     }`}
//                   >
//                     <span>{opt}</span>
//                     <div
//                       className={`h-5 w-5 rounded-full border flex items-center justify-center text-xs font-bold ${
//                         isSelected
//                           ? "bg-indigo-500 border-indigo-400 text-white"
//                           : "border-zinc-700 text-transparent"
//                       }`}
//                     >
//                       {isSelected && <Check size={12} />}
//                     </div>
//                   </button>
//                 )
//               })}
//             </div>
//           </div>
//         </main>

//         {/* Footer Navigation */}
//         <footer className="max-w-3xl w-full mx-auto flex items-center justify-between shrink-0 border-t border-zinc-900 pt-6">
//           <button
//             onClick={handlePrev}
//             disabled={currentQuestionIndex === 0}
//             className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 border border-zinc-850 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
//           >
//             Previous
//           </button>

//           {hasNext ? (
//             <button
//               onClick={handleNext}
//               disabled={selectedOption === undefined}
//               className="px-6 py-2.5 text-xs font-bold text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
//             >
//               Next Question
//             </button>
//           ) : (
//             <button
//               onClick={() => triggerSubmitQuiz(false)}
//               disabled={selectedOption === undefined}
//               className="px-8 py-3 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer"
//             >
//               Submit Quiz
//             </button>
//           )}
//         </footer>
//       </div>
//     )
//   }

//   // GAME STATE: SUBMITTING ANSWERS
//   if (gameState === 'submitting') {
//     return (
//       <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white gap-4">
//         <Loader2 className="animate-spin text-emerald-500" size={40} />
//         <p className="text-sm font-semibold tracking-wider text-zinc-400">Verifying score & logging result...</p>
//       </div>
//     )
//   }

//   // GAME STATE: RESULT VIEW
//   if (gameState === 'result' && savedResult) {
//     const feedback = getFeedbackDetails(savedResult.score, savedResult.totalQuestions)
//     const pct = Math.round((savedResult.score / savedResult.totalQuestions) * 100)

//     return (
//       <div className="min-h-screen bg-zinc-950 text-white p-6 md:p-10 font-sans">
//         <Toaster position="top-right" richColors />
//         <div className="max-w-3xl mx-auto space-y-8">
          
//           {/* Result Card */}
//           <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8 flex flex-col items-center text-center space-y-6 shadow-xl relative overflow-hidden">
//             {/* Background Accent Gradients */}
//             <div className="absolute inset-0 bg-linear-to-b from-indigo-500/5 to-transparent pointer-events-none" />

//             <div className={`inline-flex px-4 py-1.5 rounded-full text-xs font-bold border uppercase tracking-wider ${feedback.color}`}>
//               {feedback.badge}
//             </div>

//             <div className="space-y-2">
//               <h1 className="text-xl text-zinc-400 font-medium">Hello {savedResult.studentName}, your result:</h1>
//               <div className="text-5xl font-extrabold bg-linear-to-r from-emerald-400 to-indigo-400 bg-clip-text text-transparent">
//                 {savedResult.score} / {savedResult.totalQuestions}
//               </div>
//               <div className="text-sm text-zinc-500 font-semibold">{pct}% Correct Answers</div>
//             </div>

//             <p className="text-sm text-zinc-300 max-w-md font-semibold">
//               {feedback.message}
//             </p>

//             <div className="grid grid-cols-2 gap-4 w-full max-w-sm pt-4 border-t border-zinc-800/80">
//               <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-850">
//                 <span className="text-[10px] text-zinc-500 uppercase tracking-widest block">Time Taken</span>
//                 <span className="text-sm font-bold text-zinc-200 mt-0.5 block">{savedResult.timeTaken}s</span>
//               </div>
//               <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-850">
//                 <span className="text-[10px] text-zinc-500 uppercase tracking-widest block">Submitted On</span>
//                 <span className="text-xs font-bold text-zinc-400 mt-1 block">
//                   {new Date(savedResult.submittedAt).toLocaleDateString()}
//                 </span>
//               </div>
//             </div>

//             <div className="text-[10px] text-zinc-500 bg-zinc-950/30 px-3 py-1 rounded border border-zinc-850/60">
//               🔒 Score saved in localStorage. Re-taking this quiz link is disabled.
//             </div>
//           </div>

//           {/* Detailed Question breakdown */}
//           <div className="space-y-4">
//             <h2 className="text-lg font-bold text-white flex items-center gap-2">
//               <Sparkles className="text-indigo-400" size={18} /> Answers Review
//             </h2>

//             <div className="space-y-4">
//               {savedResult.results.map((r, idx) => (
//                 <div
//                   key={idx}
//                   className={`p-5 rounded-xl border flex flex-col gap-4 shadow ${
//                     r.isCorrect
//                       ? "bg-emerald-950/5 border-emerald-900/60"
//                       : "bg-red-950/5 border-red-900/60"
//                   }`}
//                 >
//                   <div className="flex items-start justify-between gap-4">
//                     <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
//                       Question {idx + 1}
//                     </span>
//                     <span
//                       className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
//                         r.isCorrect
//                           ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
//                           : "bg-red-500/10 text-red-400 border border-red-500/20"
//                       }`}
//                     >
//                       {r.isCorrect ? "Correct" : "Incorrect"}
//                     </span>
//                   </div>

//                   <p className="text-sm font-bold text-zinc-200">{r.question}</p>

//                   <div className="grid grid-cols-1 gap-2.5">
//                     {r.options.map((opt, optIdx) => {
//                       const isCorrectOption = optIdx === r.correctOption
//                       const isStudentSelected = optIdx === r.studentOption

//                       return (
//                         <div
//                           key={optIdx}
//                           className={`p-3 rounded-lg text-xs flex items-center justify-between border ${
//                             isCorrectOption
//                               ? "bg-emerald-950/20 border-emerald-800 text-emerald-300 font-bold"
//                               : isStudentSelected
//                               ? "bg-red-950/20 border-red-900 text-red-300 font-semibold"
//                               : "bg-zinc-950/20 border-zinc-850/60 text-zinc-450"
//                           }`}
//                         >
//                           <span>{opt}</span>
//                           <div className="flex items-center gap-2">
//                             {isCorrectOption && (
//                               <span className="inline-flex items-center gap-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
//                                 <CheckCircle2 size={10} /> Correct Answer
//                               </span>
//                             )}
//                             {isStudentSelected && !isCorrectOption && (
//                               <span className="inline-flex items-center gap-0.5 bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
//                                 <XCircle size={10} /> Your Selection
//                               </span>
//                             )}
//                             {isStudentSelected && isCorrectOption && (
//                               <span className="inline-flex items-center gap-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
//                                 <CheckCircle2 size={10} /> Selected Correctly
//                               </span>
//                             )}
//                           </div>
//                         </div>
//                       )
//                     })}
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </div>

//         </div>
//       </div>
//     )
//   }

//   return null
// }


"use client"

import React, { useState, useEffect, useRef, useCallback, Suspense } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { toast, Toaster } from "sonner"
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  User,
  AlertCircle,
  Sparkles,
  HelpCircle,
  Check,
  Printer
} from "lucide-react"

// Types
interface QuizQuestion {
  question: string
  options: string[]
}

interface QuizDetails {
  id: number
  shareToken: string
  quizTitle: string
  questions: QuizQuestion[]
  timerDuration: number
  expiresAt: string
}

interface SubmittedResultDetail {
  question: string
  options: string[]
  correctOption: number
  studentOption: number
  isCorrect: boolean
}

interface SavedResult {
  studentName: string
  score: number
  totalQuestions: number
  timeTaken: number
  submittedAt: string
  results: SubmittedResultDetail[]
}

function StudentQuizPageContent() {
  const params = useParams()
  const token = params?.token as string
  const searchParams = useSearchParams()
  const nameParam = searchParams ? searchParams.get("name") : null
  
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isExpired, setIsExpired] = useState(false)
  const [isInactive, setIsInactive] = useState(false)
  
  const [quiz, setQuiz] = useState<QuizDetails | null>(null)
  
  // Game states: 'gate' | 'taking' | 'submitting' | 'result'
  const [gameState, setGameState] = useState<'gate' | 'taking' | 'submitting' | 'result'>('gate')
  
  // Student input state
  const [studentName, setStudentName] = useState("")

  useEffect(() => {
    if (nameParam) {
      setStudentName(nameParam)
    }
  }, [nameParam])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  
  // Timer state
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const timeTakenRef = useRef<number>(0)
  
  // Final Result state
  const [savedResult, setSavedResult] = useState<SavedResult | null>(null)

  // 1. Fetch Shared Quiz & Check LocalStorage
  useEffect(() => {
    if (!token) return

    async function loadQuiz() {
      try {
        // First check if user already completed this quiz and has result in localStorage
        const localData = localStorage.getItem(`tutorarc_quiz_result_${token}`)
        if (localData) {
          try {
            const parsed = JSON.parse(localData) as SavedResult
            setSavedResult(parsed)
            setGameState('result')
            setLoading(false)
            return
          } catch (e) {
            console.error("Failed to parse local quiz result", e)
          }
        }

        const res = await fetch(`/api/quiz/share/${token}`)
        const data = await res.json()

        if (!res.ok) {
          if (data.expired) {
            setIsExpired(true)
            setErrorMsg(data.error || "This quiz has expired.")
          } else if (data.inactive) {
            setIsInactive(true)
            setErrorMsg(data.error || "This quiz is currently paused.")
          } else {
            setErrorMsg(data.error || "Could not load quiz details.")
          }
          return
        }

        setQuiz(data.quiz)
        if (data.quiz.timerDuration > 0) {
          setTimeLeft(data.quiz.timerDuration)
        }
      } catch (err) {
        console.error("Fetch quiz details error:", err)
        setErrorMsg("Failed to connect to server.")
      } finally {
        setLoading(false)
      }
    }

    loadQuiz()
  }, [token])

  // Submit Quiz Action
  const triggerSubmitQuiz = useCallback(async (forceWithCurrentAnswers = false) => {
    if (!quiz || !studentName.trim()) return

    // Verify all answered if not forced (e.g. time ran out)
    if (!forceWithCurrentAnswers) {
      const totalQs = quiz.questions.length
      const answeredCount = Object.keys(answers).length
      if (answeredCount < totalQs) {
        // Focus the first unanswered question
        for (let i = 0; i < totalQs; i++) {
          if (answers[i] === undefined) {
            setCurrentQuestionIndex(i)
            toast.error(`Please answer all questions. Question ${i + 1} is missing.`)
            return
          }
        }
      }
    }

    setGameState('submitting')
    if (timerRef.current) clearInterval(timerRef.current)

    try {
      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shareToken: token,
          studentName,
          answers,
          timeTaken: timeTakenRef.current
        })
      })

      if (res.ok) {
        const data = await res.json()
        const resultPayload: SavedResult = {
          studentName,
          score: data.score,
          totalQuestions: data.totalQuestions,
          timeTaken: timeTakenRef.current,
          submittedAt: new Date().toISOString(),
          results: data.results
        }
        
        // Save to localStorage
        localStorage.setItem(`tutorarc_quiz_result_${token}`, JSON.stringify(resultPayload))
        setSavedResult(resultPayload)
        setGameState('result')
        toast.success("Quiz submitted successfully!")
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to submit answers.")
        setGameState('taking')
      }
    } catch (error) {
      console.error("Submit quiz error:", error)
      toast.error("Network error submitting quiz.")
      setGameState('taking')
    }
  }, [quiz, studentName, answers, token])

  // Track time elapsed and decrement timer if taking quiz
  useEffect(() => {
    if (gameState !== 'taking') {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }

    timerRef.current = setInterval(() => {
      // Increment time taken
      timeTakenRef.current += 1

      // Decrement time left if limit exists
      if (quiz && quiz.timerDuration > 0) {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // Time is up! Trigger auto submit
            if (timerRef.current) clearInterval(timerRef.current)
            toast.warning("Time's up! Automatically submitting your answers.")
            triggerSubmitQuiz(true)
            return 0
          }
          return prev - 1
        })
      }
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [gameState, quiz, triggerSubmitQuiz])

  // Start the Quiz
  const handleStartQuiz = (e: React.FormEvent) => {
    e.preventDefault()
    if (!studentName.trim()) {
      toast.error("Please enter your name to start.")
      return
    }
    
    // Reset answers
    setAnswers({})
    setCurrentQuestionIndex(0)
    timeTakenRef.current = 0
    if (quiz && quiz.timerDuration > 0) {
      setTimeLeft(quiz.timerDuration)
    }

    setGameState('taking')
  }

  // Answer selection
  const handleSelectOption = (optIdx: number) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQuestionIndex]: optIdx
    }))
  }

  // Navigation helpers
  const handleNext = () => {
    if (quiz && currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    }
  }

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
    }
  }

  // Get Score Message / Trophy Badge
  const getFeedbackDetails = (score: number, total: number) => {
    const pct = (score / total) * 100
    if (pct === 100) {
      return {
        badge: "Gold Trophy",
        message: "Outstanding! Perfect Score!",
        color: "text-amber-400 bg-amber-500/10 border-amber-500/20"
      }
    } else if (pct >= 80) {
      return {
        badge: "Silver Award",
        message: "Excellent job! You did fantastic!",
        color: "text-zinc-300 bg-zinc-400/10 border-zinc-400/20"
      }
    } else if (pct >= 50) {
      return {
        badge: "Star Performer",
        message: "Good effort! Keep practicing to get better.",
        color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20"
      }
    } else {
      return {
        badge: "Certificate of Attempt",
        message: "Keep practicing! Review the correct answers below.",
        color: "text-red-400 bg-red-500/10 border-red-500/20"
      }
    }
  }

  // Loading View
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white gap-4">
        <Loader2 className="animate-spin text-indigo-500" size={40} />
        <p className="text-sm font-semibold tracking-wider text-zinc-400">Loading Quiz...</p>
      </div>
    )
  }

  // ERROR / EXPIRATION / INACTIVE VIEWS
  if (errorMsg) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full backdrop-blur-md bg-zinc-900/50 p-8 rounded-2xl border border-zinc-800 shadow-2xl space-y-6">
          <div className="inline-flex p-3 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-2xl font-bold">Quiz Unavailable</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">{errorMsg}</p>
          
          {isExpired && (
            <div className="text-xs text-zinc-500 bg-zinc-900 p-3 rounded-lg">
              This link had an expiry limit and has expired. Contact your teacher to generate a new quiz link.
            </div>
          )}

          {isInactive && (
            <div className="text-xs text-zinc-500 bg-zinc-900 p-3 rounded-lg">
              The quiz is currently paused. Please wait for the teacher to activate it.
            </div>
          )}
        </div>
      </div>
    )
  }

  // GAME STATE: GATE SCREEN (Enter name to start)
  if (gameState === 'gate' && quiz) {
    return (
      <div className="min-h-screen bg-linear-to-b from-zinc-950 to-zinc-900 text-white flex items-center justify-center p-6">
        <Toaster position="top-right" richColors />
        <div className="max-w-md w-full backdrop-blur-md bg-zinc-900/40 p-8 rounded-[5px] border border-zinc-850 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest bg-indigo-500/5 px-2.5 py-1 rounded-full border border-indigo-500/10">
              QUIZ GATEWAY
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight pt-2">{quiz.quizTitle}</h1>
            <p className="text-xs text-zinc-500">
              {quiz.questions.length} Multiple Choice Questions
            </p>
          </div>

          <div className="p-4 bg-zinc-950 rounded-[5px] border border-zinc-850 space-y-3">
            <div className="flex items-center justify-between text-xs text-zinc-400 border-b border-zinc-850/60 pb-2">
              <span className="flex items-center gap-1.5"><Clock size={12} /> Time Limit</span>
              <span className="font-bold text-zinc-200">
                {quiz.timerDuration > 0 ? `${Math.floor(quiz.timerDuration / 60)} Minutes` : "No limit"}
              </span>
            </div>
            
            {quiz.timerDuration > 0 && (
              <div className="text-[10px] text-amber-400 leading-relaxed bg-amber-500/5 px-2 py-1 rounded border border-amber-500/10">
                ⚠️ Once started, the timer cannot be paused. Make sure you complete it before time ends, or your current answers will be submitted.
              </div>
            )}
          </div>

          <form onSubmit={handleStartQuiz} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                Enter Your Full Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500">
                  <User size={16} />
                </span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Smith"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-[5px] pl-10 pr-4 py-2.5 text-sm text-zinc-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-zinc-600"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-[5px] bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-lg shadow-indigo-500/10 cursor-pointer"
            >
              Start Quiz <ArrowRight size={18} />
            </button>
          </form>
        </div>
      </div>
    )
  }

  // GAME STATE: TAKING QUIZ
  if (gameState === 'taking' && quiz) {
    const currentQuestion = quiz.questions[currentQuestionIndex]
    const hasNext = currentQuestionIndex < quiz.questions.length - 1
    const totalQs = quiz.questions.length
    
    // Formatting remaining time mins:secs
    const mins = String(Math.floor(timeLeft / 60)).padStart(2, "0")
    const secs = String(timeLeft % 60).padStart(2, "0")
    const selectedOption = answers[currentQuestionIndex]

    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col justify-between p-6">
        <Toaster position="top-right" richColors />
        
        {/* Top Header */}
        <header className="max-w-3xl w-full mx-auto flex items-center justify-between shrink-0">
          <div>
            <h1 className="font-bold text-sm text-zinc-300">{quiz.quizTitle}</h1>
            <p className="text-[10px] text-zinc-500">Student: {studentName}</p>
          </div>

          {quiz.timerDuration > 0 && (
            <div
              className={`flex items-center gap-1.5 font-mono text-xs font-extrabold px-3 py-1 rounded-lg border ${
                timeLeft < 30
                  ? "text-red-400 bg-red-500/10 border-red-500/20 animate-pulse"
                  : "text-amber-400 bg-amber-500/10 border-amber-500/20"
              }`}
            >
              <Clock size={14} />
              {mins}:{secs}
            </div>
          )}
        </header>

        {/* Quiz Panel Body */}
        <main className="max-w-3xl w-full mx-auto my-auto py-8 flex flex-col gap-6">
          
          {/* Question Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs text-zinc-400">
              <span>Question {currentQuestionIndex + 1} of {totalQs}</span>
              <span>{Math.round(((currentQuestionIndex + 1) / totalQs) * 100)}% Complete</span>
            </div>
            <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden border border-zinc-850">
              <div
                className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${((currentQuestionIndex + 1) / totalQs) * 100}%` }}
              />
            </div>
          </div>

          {/* Question Card */}
          <div className="p-6 md:p-8 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-6 shadow-xl">
            <h2 className="text-lg md:text-xl font-bold text-zinc-100 flex items-start gap-3">
              <HelpCircle className="text-indigo-400 shrink-0 mt-1" size={20} />
              {currentQuestion.question}
            </h2>

            {/* Options grid */}
            <div className="grid grid-cols-1 gap-3">
              {currentQuestion.options.map((opt, optIdx) => {
                const isSelected = selectedOption === optIdx
                return (
                  <button
                    key={optIdx}
                    onClick={() => handleSelectOption(optIdx)}
                    className={`text-left p-4 rounded-xl border text-sm transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? "bg-indigo-600/15 border-indigo-500 text-white font-semibold"
                        : "bg-zinc-950/40 border-zinc-850 text-zinc-300 hover:bg-zinc-900 hover:border-zinc-750"
                    }`}
                  >
                    <span>{opt}</span>
                    <div
                      className={`h-5 w-5 rounded-full border flex items-center justify-center text-xs font-bold ${
                        isSelected
                          ? "bg-indigo-500 border-indigo-400 text-white"
                          : "border-zinc-700 text-transparent"
                      }`}
                    >
                      {isSelected && <Check size={12} />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </main>

        {/* Footer Navigation */}
        <footer className="max-w-3xl w-full mx-auto flex items-center justify-between shrink-0 border-t border-zinc-900 pt-6">
          <button
            onClick={handlePrev}
            disabled={currentQuestionIndex === 0}
            className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 border border-zinc-850 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
          >
            Previous
          </button>

          {hasNext ? (
            <button
              onClick={handleNext}
              disabled={selectedOption === undefined}
              className="px-6 py-2.5 text-xs font-bold text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Next Question
            </button>
          ) : (
            <button
              onClick={() => triggerSubmitQuiz(false)}
              disabled={selectedOption === undefined}
              className="px-8 py-3 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Submit Quiz
            </button>
          )}
        </footer>
      </div>
    )
  }

  // GAME STATE: SUBMITTING ANSWERS
  if (gameState === 'submitting') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white gap-4">
        <Loader2 className="animate-spin text-emerald-500" size={40} />
        <p className="text-sm font-semibold tracking-wider text-zinc-400">Verifying score & logging result...</p>
      </div>
    )
  }

  // GAME STATE: RESULT VIEW
  if (gameState === 'result' && savedResult) {
    const feedback = getFeedbackDetails(savedResult.score, savedResult.totalQuestions)
    const pct = Math.round((savedResult.score / savedResult.totalQuestions) * 100)

    return (
      <div className="min-h-screen bg-zinc-950 text-white p-6 md:p-10 font-sans">
        <Toaster position="top-right" richColors />
        <div className="max-w-3xl mx-auto space-y-8">
          
          {/* Result Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8 flex flex-col items-center text-center space-y-6 shadow-xl relative overflow-hidden">
            {/* Background Accent Gradients */}
            <div className="absolute inset-0 bg-linear-to-b from-indigo-500/5 to-transparent pointer-events-none" />

            <div className={`inline-flex px-4 py-1.5 rounded-full text-xs font-bold border uppercase tracking-wider ${feedback.color}`}>
              {feedback.badge}
            </div>

            <div className="space-y-2">
              <h1 className="text-xl text-zinc-400 font-medium">Hello {savedResult.studentName}, your result:</h1>
              <div className="text-5xl font-extrabold bg-linear-to-r from-emerald-400 to-indigo-400 bg-clip-text text-transparent">
                {savedResult.score} / {savedResult.totalQuestions}
              </div>
              <div className="text-sm text-zinc-500 font-semibold">{pct}% Correct Answers</div>
            </div>

            <p className="text-sm text-zinc-300 max-w-md font-semibold">
              {feedback.message}
            </p>

            <div className="grid grid-cols-2 gap-4 w-full max-w-sm pt-4 border-t border-zinc-800/80">
              <div className="bg-zinc-950/60 p-3 rounded-[4px] border border-zinc-850">
                <span className="text-[10px] text-zinc-500 uppercase tracking-widest block">Time Taken</span>
                <span className="text-sm font-bold text-zinc-200 mt-0.5 block">{savedResult.timeTaken}s</span>
              </div>
              <div className="bg-zinc-950/60 p-3 rounded-[4px] border border-zinc-850">
                <span className="text-[10px] text-zinc-500 uppercase tracking-widest block">Submitted On</span>
                <span className="text-xs font-bold text-zinc-400 mt-1 block">
                  {new Date(savedResult.submittedAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="text-[10px] text-zinc-500 bg-zinc-950/30 px-3 py-1 rounded border border-zinc-850/60">
              🔒 Score saved in localStorage. Re-taking this quiz link is disabled.
            </div>

            <button
              onClick={() => window.print()}
              className="print:hidden inline-flex items-center gap-2 px-5 py-2.5 rounded-[4px] bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-all shadow-lg shadow-indigo-500/20 cursor-pointer mt-2"
            >
              <Printer size={16} /> Print Results
            </button>
          </div>

          {/* Detailed Question breakdown */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="text-indigo-400" size={18} /> Answers Review
            </h2>

            <div className="space-y-4">
              {savedResult.results.map((r, idx) => (
                <div
                  key={idx}
                  className={`p-5 rounded-xl border flex flex-col gap-4 shadow ${
                    r.isCorrect
                      ? "bg-emerald-950/5 border-emerald-900/60"
                      : "bg-red-950/5 border-red-900/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                      Question {idx + 1}
                    </span>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        r.isCorrect
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-red-500/10 text-red-400 border border-red-500/20"
                      }`}
                    >
                      {r.isCorrect ? "Correct" : "Incorrect"}
                    </span>
                  </div>

                  <p className="text-sm font-bold text-zinc-200">{r.question}</p>

                  <div className="grid grid-cols-1 gap-2.5">
                    {r.options.map((opt, optIdx) => {
                      const isCorrectOption = optIdx === r.correctOption
                      const isStudentSelected = optIdx === r.studentOption

                      return (
                        <div
                          key={optIdx}
                          className={`p-3 rounded-lg text-xs flex items-center justify-between border ${
                            isCorrectOption
                              ? "bg-emerald-950/20 border-emerald-800 text-emerald-300 font-bold"
                              : isStudentSelected
                              ? "bg-red-950/20 border-red-900 text-red-300 font-semibold"
                              : "bg-zinc-950/20 border-zinc-850/60 text-zinc-450"
                          }`}
                        >
                          <span>{opt}</span>
                          <div className="flex items-center gap-2">
                            {isCorrectOption && (
                              <span className="inline-flex items-center gap-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
                                <CheckCircle2 size={10} /> Correct Answer
                              </span>
                            )}
                            {isStudentSelected && !isCorrectOption && (
                              <span className="inline-flex items-center gap-0.5 bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
                                <XCircle size={10} /> Your Selection
                              </span>
                            )}
                            {isStudentSelected && isCorrectOption && (
                              <span className="inline-flex items-center gap-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
                                <CheckCircle2 size={10} /> Selected Correctly
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    )
  }

  return null
}

export default function StudentQuizPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin mb-4" />
        <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Loading Quiz...</p>
      </div>
    }>
      <StudentQuizPageContent />
    </Suspense>
  )
}
