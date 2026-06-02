import React, { useState, useEffect, useRef, useCallback } from "react"
import { useSocket } from "@/hooks/use-socket"
import { toast } from "sonner"
import Swal from "sweetalert2"

// Optimized Timer Component
export const SessionTimer = React.memo(({ initialDuration, durationAdded, startTime, role, sessionId, onEndSession, isClassEnded }: { initialDuration: number, durationAdded?: number, startTime?: number, role: string, sessionId: string, onEndSession?: (sid: string) => void, isClassEnded?: boolean }) => {
    const { socket } = useSocket()

    function formatMinutesToMMSS(minutes: number) {
        const totalSeconds = Math.max(0, Math.floor(minutes * 60));
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    const [timeLeft, setTimeLeft] = useState(() => {
        if (!startTime) return initialDuration;
        const now = Date.now();
        const elapsedMinutes = (now - startTime) / 60000;
        return Math.max(0, (durationAdded || initialDuration) - elapsedMinutes);
    })
    const timeLeftRef = useRef(timeLeft)
    const hasAutoPromptedRef = useRef(false)

    useEffect(() => { timeLeftRef.current = timeLeft }, [timeLeft])

    // Countdown timer - authoritative based on startTime
    useEffect(() => {
        if (isClassEnded) return; // Don't run timer when class is ended
        const timer = setInterval(() => {
            if (startTime) {
                const now = Date.now();
                const elapsedMinutes = (now - startTime) / 60000;
                const total = durationAdded || initialDuration;
                setTimeLeft(Math.max(0, total - elapsedMinutes));
            } else {
                setTimeLeft((prev) => (prev <= 0 ? 0 : prev - 1 / 60));
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [startTime, durationAdded, initialDuration, isClassEnded]);

    // Teacher: sync duration to DB every 60 seconds
    // Student: poll duration from DB every 60 seconds
    useEffect(() => {
        if (isClassEnded) return; // Don't sync when class is ended
        if (role === "teacher") {
            const syncTimer = setInterval(async () => {
                try {
                    await fetch("/api/session/duration", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ sessionId, duration: timeLeftRef.current })
                    });
                } catch (error) { console.error("Sync error:", error); }
            }, 60000);
            return () => clearInterval(syncTimer);
        } else {
            const syncTimer = setInterval(async () => {
                try {
                    const res = await fetch(`/api/session/duration?sessionId=${sessionId}`);
                    const data = await res.json();
                    if (data.duration !== undefined) setTimeLeft(data.duration);
                } catch (error) { console.error("Fetch error:", error); }
            }, 60000);
            return () => clearInterval(syncTimer);
        }
    }, [role, sessionId, isClassEnded]);

    // Listen for duration_extended socket events (both teacher and students)
    useEffect(() => {
        if (!socket) return;
        const handleDurationExtended = ({ payload }: { payload: { addedMinutes: number } }) => {
            const { addedMinutes } = payload;
            setTimeLeft(prev => prev + addedMinutes);
            hasAutoPromptedRef.current = false; // Reset so it can prompt again if needed
            if (role === "student") {
                toast.success(`Session extended by ${addedMinutes} minutes!`, { duration: 5000 });
            }
        };
        socket.on("duration_extended", handleDurationExtended);
        return () => { socket.off("duration_extended", handleDurationExtended); };
    }, [socket, role]);

    // Teacher: show extend prompt
    const showExtendDialog = useCallback(async () => {
        const { value: minutes } = await Swal.fire({
            title: "⏰ Extend Session",
            text: "Would you like to add more time?",
            input: "select",
            inputOptions: {
                "5": "5 minutes",
                "10": "10 minutes",
                "15": "15 minutes",
                "20": "20 minutes",
                "30": "30 minutes",
                "45": "45 minutes",
                "60": "60 minutes",
            },
            inputPlaceholder: "Select duration to add",
            showCancelButton: true,
            confirmButtonText: "Extend",
            confirmButtonColor: "#6366f1",
            cancelButtonText: "No, continue",
            cancelButtonColor: "#6b7280",
        });

        if (minutes) {
            const addedMinutes = parseInt(minutes);

            // 1. Emit via socket to update all clients in real-time
            socket?.emit("duration_extend", {
                roomId: sessionId,
                payload: { addedMinutes }
            });

            // 2. Persist both duration and durationAdded to the database
            try {
                const newDuration = timeLeftRef.current + addedMinutes;
                // Fetch current durationAdded first
                const res = await fetch(`/api/session/duration?sessionId=${sessionId}`);
                const data = await res.json();
                const currentDurationAdded = data.durationAdded || 60;

                await fetch("/api/session/duration", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        sessionId,
                        duration: newDuration,
                        durationAdded: currentDurationAdded + addedMinutes
                    })
                });
            } catch (error) {
                console.error("Failed to persist duration extension:", error);
            }

            toast.success(`Session extended by ${addedMinutes} minutes`);
        }
    }, [socket, sessionId]);

    // Auto-trigger extend prompt when time reaches 5 minutes (teacher only, once)
    useEffect(() => {
        if (role !== "teacher" || isClassEnded) return;
        if (timeLeft <= 5 && timeLeft > 4.9 && !hasAutoPromptedRef.current) {
            hasAutoPromptedRef.current = true;
            // Use setTimeout to avoid modifying ref synchronously in the effect body
            setTimeout(() => showExtendDialog(), 0);
        }
    }, [timeLeft, role, showExtendDialog, isClassEnded]);

    // Teacher: when timer reaches 0, show a 10-second auto-end countdown Swal
    const hasShownZeroPromptRef = useRef(false)
    useEffect(() => {
        if (role !== "teacher" || isClassEnded) return
        if (timeLeft > 0 || hasShownZeroPromptRef.current) return
        hasShownZeroPromptRef.current = true

        let countdown = 10
        const swalInstance = Swal.fire({
            title: "⏰ Time's Up!",
            html: `<p>The session time has ended.</p><p>The class will auto-end in <b id="swal-countdown">${countdown}</b> seconds.</p><p>Would you like to extend the session?</p>`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Extend Time",
            confirmButtonColor: "#6366f1",
            cancelButtonText: "End Class Now",
            cancelButtonColor: "#ef4444",
            allowOutsideClick: false,
            allowEscapeKey: false,
            didOpen: () => {
                const countdownEl = document.getElementById('swal-countdown')
                const timer = setInterval(() => {
                    countdown--
                    if (countdownEl) countdownEl.textContent = countdown.toString()
                    if (countdown <= 0) {
                        clearInterval(timer)
                        Swal.close()
                    }
                }, 1000)
                    // Store timer so it can be cleared on dismiss
                    ; (Swal as unknown as { _countdownTimer?: ReturnType<typeof setInterval> })._countdownTimer = timer
            },
            willClose: () => {
                const timer = (Swal as unknown as { _countdownTimer?: ReturnType<typeof setInterval> })._countdownTimer
                if (timer) clearInterval(timer)
            }
        })

        swalInstance.then((result) => {
            if (result.isConfirmed) {
                // Teacher chose to extend — show the extend dialog
                hasShownZeroPromptRef.current = false
                showExtendDialog()
            } else {
                // Teacher chose "End Class Now" OR countdown expired → end the class
                if (onEndSession) onEndSession(sessionId)
            }
        })
    }, [timeLeft, role, sessionId, onEndSession, showExtendDialog, isClassEnded])

    const isLowTime = timeLeft <= 5;
    const isCritical = timeLeft <= 1;

    return (
        <div className="flex items-center gap-1.5 px-1 py-0.5 h-full">
            <span className={`text-sm font-black uppercase tracking-widest transition-all duration-300 ${isCritical
                    ? 'text-red-500 animate-pulse scale-110'
                    : isLowTime
                        ? 'text-amber-500 animate-pulse-scale'
                        : 'text-green-600 dark:text-green-500'
                }`}>
                {formatMinutesToMMSS(timeLeft)}
            </span>
            {/* Manual extend button for teacher when < 5 min and session not ended */}
            {role === "teacher" && isLowTime && !isClassEnded && (
                <button
                    onClick={showExtendDialog}
                    className="ml-1 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-md transition-all duration-200 animate-in fade-in zoom-in"
                    title="Extend session time"
                >
                    + Time
                </button>
            )}
        </div>
    )
})
SessionTimer.displayName = "SessionTimer"