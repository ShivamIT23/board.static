import React, { useState, useEffect, useRef } from "react"

// Optimized Timer Component
export const SessionTimer = React.memo(({ initialDuration, role, sessionId }: { initialDuration: number, role: string, sessionId: string }) => {
    function formatMinutesToMMSS(minutes: number) {
        const totalSeconds = Math.floor(minutes * 60);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    const [timeLeft, setTimeLeft] = useState(initialDuration)
    const timeLeftRef = useRef(initialDuration)
    useEffect(() => { timeLeftRef.current = timeLeft }, [timeLeft])
    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft((prev) => (prev <= 0 ? 0 : prev - 1 / 60));
        }, 1000);
        return () => clearInterval(timer);
    }, []);
    useEffect(() => {
        if (role === "teacher") {
            const syncTimer = setInterval(async () => {
                try {
                    const res = await fetch("/api/session/duration", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ sessionId, duration: timeLeftRef.current })
                    });
                    console.log(res);
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
            }, 1 * 60 * 1000);
            return () => clearInterval(syncTimer);
        }
    }, [role, sessionId]);
    return (
        <div className="flex items-center gap-1.5 px-1 py-0.5 h-full">
            <span className={`text-sm font-black uppercase tracking-widest ${timeLeft < 5 ? 'text-red-500 animate-pulse-scale' : 'text-green-600 dark:text-green-500'}`}>
                {formatMinutesToMMSS(timeLeft)}
            </span>
        </div>
    )
})
SessionTimer.displayName = "SessionTimer"