import { MessageSquare, MessageSquareOff, Pencil, PencilOff, UserMinus, Ban, Check, X, Shield, ShieldOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { RoomUser, Visitor } from "@/types/chat"
import type { Socket } from "socket.io-client"
import Swal from "sweetalert2"

interface UserListProps {
    roomUsers: RoomUser[]
    role: "teacher" | "student"
    visitors: Visitor[]
    isLoadingVisitors: boolean
    isAutoApprove: boolean
    toggleUserPermission: (userId: string, type: "text" | "attachments" | "drawing", currentEnabled: boolean) => void
    socket: Socket | null
}

export default function UserList({
    roomUsers,
    role,
    visitors,
    isLoadingVisitors,
    isAutoApprove,
    toggleUserPermission,
    socket
}: UserListProps) {

    const handleKick = async (user: RoomUser) => {
        const { isConfirmed } = await Swal.fire({
            title: "Kick Student?",
            text: `Are you sure you want to kick ${user.username} out of this class?`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#f97316",
            confirmButtonText: "Yes, Kick Out"
        });

        if (isConfirmed && socket) {
            socket.emit("board_kick_user", {
                payload: { visitorId: user.visitor_id, userId: user.user_id }
            });
        }
    };

    const handleBan = async (user: RoomUser) => {
        const { isConfirmed } = await Swal.fire({
            title: "Ban Student?",
            text: `Are you sure you want to PERMANENTLY ban ${user.username} from ALL your classes?`,
            icon: "error",
            showCancelButton: true,
            confirmButtonColor: "#ef4444",
            confirmButtonText: "Yes, Ban Permanently"
        });

        if (isConfirmed && socket) {
            socket.emit("board_ban_user", {
                payload: { visitorId: user.visitor_id, userId: user.user_id }
            });
        }
    };

    const handleApprove = (user: RoomUser) => {
        if (socket) {
            socket.emit("board_approve_student", {
                visitorId: user.visitor_id,
                userId: user.user_id
            });
        }
    };

    const handleReject = (user: RoomUser) => {
        if (socket) {
            socket.emit("board_reject_student", {
                visitorId: user.visitor_id,
                userId: user.user_id
            });
        }
    };

    const toggleAutoApprove = () => {
        if (socket && role === "teacher") {
            socket.emit("board_toggle_auto_approve", {
                isAutoApprove: !isAutoApprove
            });
        }
    };

    const pendingUsers = roomUsers.filter(u => u.approvalStatus === 'pending');
    const activeUsers = roomUsers.filter(u => u.approvalStatus !== 'pending');

    return (
        <div className="flex flex-col h-full bg-card">
            {/* Header with Auto-Approve Toggle */}
            <div className="p-3 border-b border-border flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Active Students</span>
                    <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full">
                        {activeUsers.length}
                    </span>
                </div>

                {role === "teacher" && (
                    <button
                        onClick={toggleAutoApprove}
                        className={cn(
                            "flex items-center justify-between p-1.5 rounded-[4px] border transition-all text-[10px] font-bold uppercase",
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
                            <div key={user.socket_id} className="flex items-center justify-between p-2 rounded-[3px] bg-orange-500/5 border border-orange-500/10">
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-6 h-6 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-600 text-[10px] font-black uppercase border border-orange-500/20">
                                        {user.username.charAt(0)}
                                    </div>
                                    <span className="text-[11px] font-bold text-foreground/90 truncate max-w-[80px]">
                                        {user.username}_{user.visitor_id}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => handleApprove(user)}
                                        className="p-1 rounded bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-sm"
                                        title="Approve"
                                    >
                                        <Check size={10} />
                                    </button>
                                    <button
                                        onClick={() => handleReject(user)}
                                        className="p-1 rounded bg-red-500 text-white hover:bg-red-600 transition-colors shadow-sm"
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
                        <div key={user.socket_id} className="group flex items-center justify-between p-1 rounded-[3px] hover:bg-muted/50 transition-all border border-transparent hover:border-border/40">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="relative">
                                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[11px] font-black uppercase border border-primary/20">
                                        {user.username.charAt(0)}
                                    </div>
                                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-card shadow-sm" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[11px] font-bold text-foreground/90 truncate">
                                        {user.username}{role === "teacher" && user.role !== "teacher" && user.visitor_id && `_${user.visitor_id}`}
                                    </span>
                                    <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-tight">
                                        {user.role}
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {user.socket_id !== socket?.id && role === "teacher" && (
                                    <>
                                    <div className="flex items-center">
                                        <button
                                            type="button"
                                            onClick={() => toggleUserPermission(user.user_id, "text", user.textEnabled ?? true)}
                                            className={cn(
                                                "p-1 rounded transition-colors",
                                                user.textEnabled !== false ? "text-indigo-500 hover:bg-indigo-500/10" : "text-zinc-400 hover:bg-zinc-400/10"
                                            )}
                                            title={user.textEnabled !== false ? "Disable chat" : "Enable chat"}
                                        >
                                            {user.textEnabled !== false ? <MessageSquare size={12} /> : <MessageSquareOff size={12} />}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => toggleUserPermission(user.user_id, "drawing", user.drawingEnabled ?? true)}
                                            className={cn(
                                                "p-1 rounded transition-colors",
                                                user.drawingEnabled !== false ? "text-blue-500 hover:bg-blue-500/10" : "text-zinc-400 hover:bg-zinc-400/10"
                                            )}
                                            title={user.drawingEnabled !== false ? "Disable drawing" : "Enable drawing"}
                                        >
                                            {user.drawingEnabled !== false ? <Pencil size={12} /> : <PencilOff size={12} />}
                                        </button>
                                        </div>
                                        <div className="flex items-center">
                                        <div className="w-px h-3 bg-border mx-0.5" />
                                        <button
                                            type="button"
                                            onClick={() => handleKick(user)}
                                            className="p-1 rounded text-orange-500 hover:bg-orange-500/10 transition-colors"
                                            title="Kick Out"
                                        >
                                            <UserMinus size={12} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleBan(user)}
                                            className="p-1 rounded text-red-500 hover:bg-red-500/10 transition-colors"
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

            {role === "teacher" && (
                <div className="p-2 bg-muted/20 border-t border-border">
                    <div className="flex items-center justify-between px-1 mb-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Class History</span>
                    </div>
                    <div className="space-y-1">
                        {isLoadingVisitors ? (
                            <div className="text-[9px] text-muted-foreground p-2 text-center animate-pulse">Loading history...</div>
                        ) : visitors.length === 0 ? (
                            <div className="text-[9px] text-muted-foreground p-2 text-center italic">No previous visitors found</div>
                        ) : (
                            visitors.slice(0, 5).map((v) => (
                                <div key={v.id} className="flex items-center justify-between p-1.5 rounded-[2px] hover:bg-muted/30 transition-colors">
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[10px] font-bold truncate">{v.name}_{v.id}</span>
                                        <span className="text-[8px] text-muted-foreground">{v.joinedAt ? new Date(v.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
                                    </div>
                                    {v.isBanned ? (
                                        <span className="text-[8px] font-black text-red-500 uppercase px-1 py-0.5 bg-red-500/10 rounded-sm">Banned</span>
                                    ) : v.isKicked ? (
                                        <span className="text-[8px] font-black text-orange-500 uppercase px-1 py-0.5 bg-orange-500/10 rounded-sm">Kicked</span>
                                    ) : (
                                        <span className={cn("w-1.5 h-1.5 rounded-full", v.isActive ? "bg-emerald-500" : "bg-zinc-500/30")} />
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
