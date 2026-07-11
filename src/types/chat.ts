export interface Attachment {
    id: string
    type: "image" | "file"
    url: string
    name: string
    size?: number
}

export interface ChatMessage {
    id?: string
    user: { name: string; isTeacher: boolean; visitorId?: number; id?: string }
    senderId?: string
    recipient?: "everyone" | "teacher"
    message: string
    timestamp: number
    attachments?: Attachment[]
    pollResults?: {
        question: string
        options: { text: string; votesCount: number }[]
        totalVotes: number
    }
    quizShare?: {
        shareToken: string
        quizTitle: string
    }
}

export interface PollOption {
    id: string
    text: string
    votes: string[]
}

export interface Poll {
    id: string
    question: string
    options: PollOption[]
    isActive: boolean
    createdAt: number
    createdBy: string
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

export interface QuizOption {
    id: string
    text: string
    votes: string[]
}

export interface QuizQuestion {
    id: string
    question: string
    options: QuizOption[]
    correctOption: number
}

export interface QuizState {
    id: string
    questions: QuizQuestion[]
    isActive: boolean
    createdAt: number
    submittedUsers: string[]
}