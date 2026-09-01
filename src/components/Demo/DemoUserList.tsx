"use client";

import React, { useState } from "react";
import { MessageSquare, MessageSquareOff, Pencil, PencilOff, UserMinus, Ban, Check, X, Shield, ShieldOff, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Swal from "sweetalert2";

interface DemoUserItem {
    id: string;
    name: string;
    role: "teacher" | "student";
    visitorId?: string;
    textEnabled: boolean;
    drawingEnabled: boolean;
    approvalStatus: "approved" | "pending";
    isOnline: boolean;
}

interface DemoVisitorItem {
    id: string;
    name: string;
    joinedAt: string;
    isBanned?: boolean;
    isKicked?: boolean;
    isActive?: boolean;
}

interface DemoUserListProps {
    role?: "teacher" | "student";
    userName?: string;
    onToggleDrawing?: (enabled: boolean) => void;
}

export default function DemoUserList({
    role = "teacher",
    userName = "Teacher",
    onToggleDrawing,
}: DemoUserListProps) {
    const [isAutoApprove, setIsAutoApprove] = useState(false);

    const [users, setUsers] = useState<DemoUserItem[]>([
        { id: "u-1", name: userName, role: "teacher", textEnabled: true, drawingEnabled: true, approvalStatus: "approved", isOnline: true },
        { id: "u-2", name: "Alex Johnson", role: "student", visitorId: "102", textEnabled: true, drawingEnabled: true, approvalStatus: "approved", isOnline: true },
        { id: "u-3", name: "Sarah Miller", role: "student", visitorId: "105", textEnabled: true, drawingEnabled: false, approvalStatus: "approved", isOnline: true },
        { id: "u-5", name: "Emma Watson", role: "student", visitorId: "114", textEnabled: true, drawingEnabled: true, approvalStatus: "pending", isOnline: false },
    ]);

    const [visitors, setVisitors] = useState<DemoVisitorItem[]>([
        { id: "v-88", name: "Liam Smith", joinedAt: "10:15 AM", isActive: false },
        { id: "v-72", name: "Olivia Davis", joinedAt: "09:45 AM", isKicked: true },
        { id: "v-44", name: "Ethan Brown", joinedAt: "09:12 AM", isBanned: true },
    ]);

    const togglePermission = (userId: string, type: "text" | "drawing") => {
        setUsers((prev) =>
            prev.map((u) => {
                if (u.id !== userId) return u;
                const nextState = type === "text" ? !u.textEnabled : !u.drawingEnabled;
                const updated = {
                    ...u,
                    [type === "text" ? "textEnabled" : "drawingEnabled"]: nextState,
                };
                toast.success(`${type === "text" ? "Chat" : "Drawing"} permission for ${u.name} set to ${nextState ? "Enabled" : "Disabled"}`);
                if (type === "drawing" && onToggleDrawing && u.role === "student") {
                    onToggleDrawing(nextState);
                }
                return updated;
            })
        );
    };

    const handleKick = async (user: DemoUserItem) => {
        const { isConfirmed } = await Swal.fire({
            title: "Kick Student?",
            text: `Are you sure you want to kick ${user.name} out of this demo class?`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#f97316",
            cancelButtonColor: "#6b7280",
            confirmButtonText: "Yes, Kick Out",
            cancelButtonText: "Cancel",
        });

        if (isConfirmed) {
            setUsers((prev) => prev.filter((u) => u.id !== user.id));
            setVisitors((prev) => [
                { id: `v-${user.visitorId || Date.now()}`, name: user.name, joinedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), isKicked: true },
                ...prev,
            ]);
            toast.success(`${user.name} has been kicked out.`);
        }
    };

    const handleBan = async (user: DemoUserItem) => {
        const { isConfirmed } = await Swal.fire({
            title: "Ban Student?",
            text: `Are you sure you want to PERMANENTLY ban ${user.name}?`,
            icon: "error",
            showCancelButton: true,
            confirmButtonColor: "#ef4444",
            cancelButtonColor: "#6b7280",
            confirmButtonText: "Yes, Ban Permanently",
            cancelButtonText: "Cancel",
        });

        if (isConfirmed) {
            setUsers((prev) => prev.filter((u) => u.id !== user.id));
            setVisitors((prev) => [
                { id: `v-${user.visitorId || Date.now()}`, name: user.name, joinedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), isBanned: true },
                ...prev,
            ]);
            toast.error(`${user.name} has been permanently banned.`);
        }
    };

    const handleApprove = (user: DemoUserItem) => {
        setUsers((prev) =>
            prev.map((u) => (u.id === user.id ? { ...u, approvalStatus: "approved", isOnline: true } : u))
        );
        toast.success(`Approved ${user.name} into the session.`);
    };

    const handleReject = (user: DemoUserItem) => {
        setUsers((prev) => prev.filter((u) => u.id !== user.id));
        toast.info(`Rejected request from ${user.name}.`);
    };

    const toggleAutoApprove = () => {
        const next = !isAutoApprove;
        setIsAutoApprove(next);
        toast.success(`Auto-Approve turned ${next ? "ON" : "OFF"}`);
    };

    const pendingUsers = users.filter((u) => u.approvalStatus === "pending");
    const activeUsers = users.filter((u) => u.approvalStatus === "approved");

    return (
        <div className="flex flex-col h-full bg-card">
            {/* Header with Auto-Approve Toggle */}
            <div className="p-3 border-b border-border flex flex-col gap-2 shrink-0">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                        <Users size={12} /> Active Participants
                    </span>
                    <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full">
                        {activeUsers.length}
                    </span>
                </div>

                {role === "teacher" && (
                    <button
                        type="button"
                        onClick={toggleAutoApprove}
                        className={cn(
                            "flex items-center justify-between p-1.5 rounded-[4px] border transition-all text-[10px] font-bold uppercase cursor-pointer",
                            isAutoApprove
                                ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-600"
                                : "bg-orange-500/5 border-orange-500/20 text-orange-600"
                        )}
                    >
                        <div className="flex items-center gap-1.5">
                            {isAutoApprove ? <Shield size={12} /> : <ShieldOff size={12} />}
                            <span>{isAutoApprove ? "Auto-Approve ON" : "Auto-Approve OFF"}</span>
                        </div>
                        <div className={cn(
                            "w-6 h-3 rounded-full relative transition-colors",
                            isAutoApprove ? "bg-emerald-500" : "bg-zinc-300"
                        )}>
                            <div className={cn(
                                "absolute top-0.5 w-2 h-2 rounded-full bg-white transition-all shadow-sm",
                                isAutoApprove ? "right-0.5" : "left-0.5"
                            )} />
                        </div>
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-4 custom-scrollbar">
                {/* Pending Requests Section */}
                {role === "teacher" && pendingUsers.length > 0 && (
                    <div className="space-y-1.5">
                        <div className="px-1 flex items-center justify-between">
                            <span className="text-[9px] font-black uppercase tracking-widest text-orange-500 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                                Waiting Approval
                            </span>
                            <span className="text-[9px] font-bold text-orange-500/60 bg-orange-500/5 px-1 rounded-sm">
                                {pendingUsers.length}
                            </span>
                        </div>
                        {pendingUsers.map((user) => (
                            <div key={user.id} className="flex items-center justify-between p-2 rounded-[3px] bg-orange-500/5 border border-orange-500/10">
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-6 h-6 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-600 text-[10px] font-black uppercase border border-orange-500/20">
                                        {user.name.charAt(0)}
                                    </div>
                                    <span className="text-[11px] font-bold text-foreground/90 truncate max-w-[100px]">
                                        {user.name}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => handleApprove(user)}
                                        className="p-1 rounded bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-sm cursor-pointer"
                                        title="Approve"
                                    >
                                        <Check size={10} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleReject(user)}
                                        className="p-1 rounded bg-red-500 text-white hover:bg-red-600 transition-colors shadow-sm cursor-pointer"
                                        title="Reject"
                                    >
                                        <X size={10} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Active Users Section */}
                <div className="space-y-1">
                    {activeUsers.map((user) => (
                        <div key={user.id} className="group flex items-center justify-between p-1.5 rounded-[4px] hover:bg-muted/50 transition-all border border-transparent hover:border-border/40">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="relative">
                                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[11px] font-black uppercase border border-primary/20">
                                        {user.name.charAt(0)}
                                    </div>
                                    {user.isOnline && (
                                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-card shadow-sm" />
                                    )}
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[11px] font-bold text-foreground/90 truncate">
                                        {user.name}
                                    </span>
                                    <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-tight">
                                        {user.role}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                {user.role !== "teacher" && role === "teacher" && (
                                    <>
                                        <div className="flex items-center">
                                            <button
                                                type="button"
                                                onClick={() => togglePermission(user.id, "text")}
                                                className={cn(
                                                    "p-1 rounded transition-colors cursor-pointer",
                                                    user.textEnabled ? "text-indigo-500 hover:bg-indigo-500/10" : "text-zinc-400 hover:bg-zinc-400/10"
                                                )}
                                                title={user.textEnabled ? "Disable Chat" : "Enable Chat"}
                                            >
                                                {user.textEnabled ? <MessageSquare size={12} /> : <MessageSquareOff size={12} />}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => togglePermission(user.id, "drawing")}
                                                className={cn(
                                                    "p-1 rounded transition-colors cursor-pointer",
                                                    user.drawingEnabled ? "text-blue-500 hover:bg-blue-500/10" : "text-zinc-400 hover:bg-zinc-400/10"
                                                )}
                                                title={user.drawingEnabled ? "Disable Drawing" : "Enable Drawing"}
                                            >
                                                {user.drawingEnabled ? <Pencil size={12} /> : <PencilOff size={12} />}
                                            </button>
                                        </div>
                                        <div className="flex items-center">
                                            <div className="w-px h-3 bg-border mx-0.5" />
                                            <button
                                                type="button"
                                                onClick={() => handleKick(user)}
                                                className="p-1 rounded text-orange-500 hover:bg-orange-500/10 transition-colors cursor-pointer"
                                                title="Kick Out"
                                            >
                                                <UserMinus size={12} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleBan(user)}
                                                className="p-1 rounded text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                                                title="Ban Permanently"
                                            >
                                                <Ban size={12} />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Class History */}
            {role === "teacher" && (
                <div className="p-2 bg-muted/20 border-t border-border shrink-0">
                    <div className="flex items-center justify-between px-1 mb-1.5">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">Class History</span>
                    </div>
                    <div className="space-y-1">
                        {visitors.map((v) => (
                            <div key={v.id} className="flex items-center justify-between p-1 rounded-[3px] hover:bg-muted/30 transition-colors text-[10px]">
                                <div className="flex flex-col min-w-0">
                                    <span className="font-bold truncate">{v.name}</span>
                                    <span className="text-[8px] text-muted-foreground">{v.joinedAt}</span>
                                </div>
                                {v.isBanned ? (
                                    <span className="text-[8px] font-black text-red-500 uppercase px-1 py-0.5 bg-red-500/10 rounded-xs">Banned</span>
                                ) : v.isKicked ? (
                                    <span className="text-[8px] font-black text-orange-500 uppercase px-1 py-0.5 bg-orange-500/10 rounded-xs">Kicked</span>
                                ) : (
                                    <span className={cn("w-1.5 h-1.5 rounded-full", v.isActive ? "bg-emerald-500" : "bg-zinc-500/30")} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
