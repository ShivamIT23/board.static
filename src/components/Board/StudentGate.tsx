"use client"
import React, { useState } from "react";
import { Loader2, ArrowRight, User, Lock, Mail } from "lucide-react";
import { verifyStudent } from "@/app/actions/board-gate";
import { toast } from "sonner";

interface StudentGateProps {
    sessionId: string;
    isRestricted: boolean;
    className: string;
}

export default function StudentGate({ sessionId, isRestricted, className }: StudentGateProps) {
    const [loading, setLoading] = useState(false);
    const [details, setDetails] = useState({
        name: "",
        email: "",
        password: ""
    });

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const result = await verifyStudent({
                sessionId,
                name: details.name,
                email: details.email,
                password: details.password
            });

            if (result.success) {
                toast.success(`Welcome to ${className}! Entering...`);
                // Reload the page to catch the new cookie
                window.location.reload();
            } else {
                toast.error(result.error || "Access denied to this session");
            }
        } catch {
            toast.error("An error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-md p-4 animate-in fade-in duration-500">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-[5px] p-8 shadow-2xl shadow-black/50 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#6366f1]/10 -mr-16 -mt-16 rounded-[5px] blur-3xl" />

                <div className="relative text-center space-y-6">
                    <div className="flex flex-col items-center">
                        {/* <div className="w-16 h-16 bg-[#6366f1] rounded-[5px] flex items-center justify-center shadow-lg shadow-[#6366f1]/20 mb-4 transform rotate-0 hover:rotate-0 transition-transform">
                            <span className="text-white font-black text-3xl">T</span>
                        </div> */}
                        <h2 className="text-4xl font-black text-white tracking-tight">{className}</h2>
                        <div className="inline-block px-3 py-1 bg-zinc-800 rounded-[5px] text-[10px] font-black uppercase tracking-widest text-zinc-400 mt-2 border border-zinc-700">
                            {isRestricted ? "🔐 Restricted Classroom" : "📖 Open Classroom"}
                        </div>
                    </div>

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
                                        className="w-full h-14 bg-zinc-950/50 border border-zinc-800 rounded-[5px] pl-12 pr-4 text-sm font-bold text-white focus:ring-2 focus:ring-[#6366f1] focus:border-transparent outline-none transition-all placeholder:text-zinc-700"
                                        value={details.name}
                                        onChange={(e) => setDetails({ ...details, name: e.target.value })}
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
                                            className="w-full h-14 bg-zinc-950/50 border border-zinc-800 rounded-[5px] pl-12 pr-4 text-sm font-bold text-white focus:ring-2 focus:ring-[#6366f1] outline-none transition-all placeholder:text-zinc-700"
                                            value={details.email}
                                            onChange={(e) => setDetails({ ...details, email: e.target.value })}
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
                                            className="w-full h-14 bg-zinc-950/50 border border-zinc-800 rounded-2xl pl-12 pr-4 text-sm font-bold text-white focus:ring-2 focus:ring-[#6366f1] outline-none transition-all placeholder:text-zinc-700"
                                            value={details.password}
                                            onChange={(e) => setDetails({ ...details, password: e.target.value })}
                                            disabled={loading}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-14 bg-[#6366f1] hover:bg-blue-500 disabled:opacity-50 text-white font-black rounded-[5px] flex items-center justify-center gap-2 transform active:scale-95 transition-all shadow-lg shadow-blue-900/40 relative overflow-hidden group"
                        >
                            {loading ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : (
                                <>
                                    Join Classroom <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="pt-2">
                        <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-wide">Powered by TutorArc Digital</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
