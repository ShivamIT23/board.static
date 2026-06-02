"use client"
import React, { useState } from "react";
import { Loader2, ArrowRight, User, Lock, Mail, Clock, ShieldCheck } from "lucide-react";
import { verifyStudent } from "@/app/actions/board-gate";
import { toast } from "sonner";
import { SocketProvider } from "../providers/socket-provider";
import { useSocket } from "@/hooks/use-socket";
import { useEffect } from "react";

interface StudentGateProps {
    sessionId: string;
    isRestricted: boolean;
    className: string;
    isWaitingApproval?: boolean;
    authData?: { name: string; visitorId: number; email?: string; approvalStatus?: string };
}

function RejectedScreen() {
    return (
        <div className="relative text-center space-y-8 py-4">
            <div className="flex flex-col items-center">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 relative">
                    <Lock className="text-red-500 animate-pulse" size={40} />
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight">Request Declined</h2>
                <p className="text-zinc-400 text-sm mt-2 max-w-[280px]">
                    Your request to join this session was declined by the teacher.
                </p>
            </div>

            <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-[5px] p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                    <ShieldCheck size={20} />
                </div>
                <div className="text-left">
                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 leading-none mb-1">Status</div>
                    <div className="text-xs font-bold text-red-500 uppercase tracking-tight">Access Denied</div>
                </div>
            </div>
        </div>
    );
}

function WaitingScreen() {
    const { socket } = useSocket();

    useEffect(() => {
        if (!socket) return;

        socket.on("approved", ({ message }: { message: string }) => {
            toast.success(message);
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        });

        socket.on("rejected", ({ message }: { message: string }) => {
            toast.error(message);
            setTimeout(() => {
                window.location.href = "about:blank";
            }, 2000);
        });

        return () => {
            socket.off("approved");
            socket.off("rejected");
        };
    }, [socket]);

    return (
        <div className="relative text-center space-y-8 py-4">
            <div className="flex flex-col items-center">
                <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center mb-6 relative">
                    <Clock className="text-orange-500 animate-pulse" size={40} />
                    <div className="absolute inset-0 rounded-full border-2 border-orange-500/20 border-t-orange-500 animate-spin" />
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight">Waiting for Approval</h2>
                <p className="text-zinc-400 text-sm mt-2 max-w-[280px]">
                    The teacher has been notified. Please stay on this screen while we verify your request.
                </p>
            </div>

            <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-[5px] p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#6366f1]/10 flex items-center justify-center text-[#6366f1]">
                    <ShieldCheck size={20} />
                </div>
                <div className="text-left">
                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 leading-none mb-1">Status</div>
                    <div className="text-xs font-bold text-white uppercase tracking-tight">Request Pending...</div>
                </div>
            </div>

            <div className="animate-pulse flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
                <span className="w-1 h-1 rounded-full bg-zinc-600" />
                Awaiting Response
                <span className="w-1 h-1 rounded-full bg-zinc-600" />
            </div>
        </div>
    );
}

export default function StudentGate({ sessionId, isRestricted, className, isWaitingApproval, authData }: StudentGateProps) {
    const [loading, setLoading] = useState(false);
    const [entering, setEntering] = useState(false);
    const [error, setError] = useState("");
    const [details, setDetails] = useState({
        name: "",
        email: "",
        password: ""
    });

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const result = await verifyStudent({
                sessionId,
                name: details.name,
                email: details.email,
                password: details.password
            });

            if (result.success) {
                if (result.isPending) {
                    toast.info("Request sent! Waiting for teacher approval.");
                    // Refresh to show waiting screen
                    window.location.reload();
                } else {
                    setEntering(true);
                    toast.success(`Welcome to ${className}! Entering...`);
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                }
            } else {
                toast.error(result.error || "Access denied to this session");
                setError(result.error || "Access denied to this session");
                setLoading(false);
            }
        } catch {
            toast.error("An error occurred. Please try again.");
            setError("Something went wrong. Please try again.");
            setLoading(false);
        }
    };

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "https://socket.tutorarc.cloud";
    const isRejected = authData?.approvalStatus === "rejected";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-md p-4 animate-in fade-in duration-500">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-[5px] p-8 shadow-2xl shadow-black/50 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#6366f1]/10 -mr-16 -mt-16 rounded-[5px] blur-3xl" />

                <div className="relative text-center space-y-6">
                    {!isWaitingApproval && !isRejected && (
                        <div className="flex flex-col items-center">
                            <h2 className="text-4xl font-black text-white tracking-tight">{className}</h2>
                            <div className="inline-block px-3 py-1 bg-zinc-800 rounded-[5px] text-[10px] font-black uppercase tracking-widest text-zinc-400 mt-2 border border-zinc-700">
                                {isRestricted ? "🔐 Restricted Classroom" : "📖 Open Classroom"}
                            </div>
                        </div>
                    )}

                    {isWaitingApproval && authData ? (
                        <SocketProvider 
                            url={socketUrl} 
                            roomId={sessionId} 
                            user={{ 
                                id: isRestricted ? authData.email! : authData.name, 
                                name: authData.name, 
                                isTeacher: false, 
                                visitorId: authData.visitorId 
                            }}
                        >
                            <WaitingScreen />
                        </SocketProvider>
                    ) : isRejected ? (
                        <RejectedScreen />
                    ) : (
                        <form onSubmit={handleJoin} className="space-y-4">
                            {!isRestricted ? (
                                <div className="space-y-1.5 text-left text-white">
                                    <label className="text-[10px] font-black uppercase tracking-widest pl-1 text-zinc-500">Your Full Name</label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600">
                                            <User size={18} />
                                        </div>
                                        <input
                                            required
                                            type="text"
                                            placeholder="Name to identify you"
                                            suppressHydrationWarning
                                            className="w-full h-14 bg-zinc-950/50 border border-zinc-800 rounded-[5px] pl-12 pr-4 text-sm font-bold text-white focus:ring-2 focus:ring-[#6366f1] focus:border-transparent outline-none transition-all placeholder:text-zinc-700"
                                            value={details.name}
                                            onChange={(e) => {
                                                setDetails({ ...details, name: e.target.value })
                                                if (error) setError("")
                                            }}
                                            disabled={loading}
                                            autoFocus
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4 text-left">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest pl-1 text-zinc-500">Student Email</label>
                                        <div className="relative">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600">
                                                <Mail size={18} />
                                            </div>
                                            <input
                                                required
                                                type="email"
                                                placeholder="your@email.com"
                                                suppressHydrationWarning
                                                className="w-full h-14 bg-zinc-950/50 border border-zinc-800 rounded-[5px] pl-12 pr-4 text-sm font-bold text-white focus:ring-2 focus:ring-[#6366f1] outline-none transition-all placeholder:text-zinc-700"
                                                value={details.email}
                                                onChange={(e) => {
                                                    setDetails({ ...details, email: e.target.value })
                                                    if (error) setError("")
                                                }}
                                                disabled={loading}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest pl-1 text-zinc-500">Class Password</label>
                                        <div className="relative">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600">
                                                <Lock size={18} />
                                            </div>
                                            <input
                                                required
                                                type="password"
                                                placeholder="••••••••"
                                                suppressHydrationWarning
                                                className="w-full h-14 bg-zinc-950/50 border border-zinc-800 rounded-[5px] pl-12 pr-4 text-sm font-bold text-white focus:ring-2 focus:ring-[#6366f1] outline-none transition-all placeholder:text-zinc-700"
                                                value={details.password}
                                                onChange={(e) => {
                                                    setDetails({ ...details, password: e.target.value })
                                                    if (error) setError("")
                                                }}
                                                disabled={loading}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-[11px] font-bold py-3 px-4 rounded-[5px] animate-in slide-in-from-top-1 duration-300 text-center">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading || entering}
                                suppressHydrationWarning
                                className="w-full h-14 bg-[#6366f1] hover:bg-blue-500 disabled:opacity-50 text-white font-black rounded-[5px] flex items-center justify-center gap-2 transform active:scale-95 transition-all shadow-lg shadow-blue-900/40 relative overflow-hidden group"
                            >
                                {entering ? (
                                    <>Entering class... <Loader2 className="animate-spin" size={20} /></>
                                ) : loading ? (
                                    <Loader2 className="animate-spin" size={20} />
                                ) : (
                                    <>
                                        Join Classroom <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </form>
                    )}

                    <div className="pt-2">
                        <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-wide">Powered by TutorArc Digital</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
