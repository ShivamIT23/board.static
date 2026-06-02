export interface Attachment {
    id: string
    type: "image" | "file"
    url: string
    name: string
    size?: number
}

export interface ChatMessage {
    id?: string
    user: { name: string; isTeacher: boolean; visitorId?: number }
    message: string
    timestamp: number
    attachments?: Attachment[]
}

export interface RoomUser {
    user_id: string
    username: string
    visitor_id?: number
    socket_id: string
    isMuted?: boolean
    mediaState?: { audio: boolean; video: boolean }
    textEnabled?: boolean
    attachmentsEnabled?: boolean
    drawingEnabled?: boolean
    role?: "teacher" | "student"
    isTeacher?: boolean
    approvalStatus?: 'pending' | 'approved' | 'rejected'
}

export interface Visitor {
    id: number;
    name: string;
    email: string | null;
    joinedAt: string;
    leftAt?: string | null;
    lastSeenAt?: string | null;
    isActive?: boolean;
    isBanned?: boolean;
    isKicked?: boolean;
}