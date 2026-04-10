"use server"

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, classChats } from "@/db";
import { eq, and, lt, desc, SQL } from "drizzle-orm";

export async function leaveSession(sessionId: string) {
    const cookieStore = await cookies();
    
    // 1. Clear the specific room session cookie
    cookieStore.delete(`board_auth_${sessionId}`);
    
    // 2. Clear Better Auth session cookies
    // Better Auth uses these common cookie names
    cookieStore.delete("better-auth.session_token");
    cookieStore.delete("better-auth.session");
    
    // 3. Redirect to the landing page or a specific logout page
    // Using a 303 or 302 to ensure the browser follows the redirect
    redirect("/");
}

export async function getHistoricalChats(sessionId: string, before?: number) {
    try {
        let whereClause: SQL = eq(classChats.sessionId, sessionId);
        
        if (before) {
            // Fetch messages older than the provided timestamp
            whereClause = and(whereClause, lt(classChats.timestamp, new Date(before)))!;
        }

        const results = await db.query.classChats.findMany({
            where: whereClause,
            orderBy: [desc(classChats.timestamp)],
            limit: 80,
        });

        // Return in ascending order for the UI (oldest to newest)
        const formatted = results.map(c => ({
            id: c.id.toString(),
            user: { name: c.userName, isTeacher: c.isTeacher === 1 },
            message: c.message,
            attachments: c.attachments ? JSON.parse(c.attachments) : undefined,
            timestamp: new Date(c.timestamp).getTime()
        })).reverse();

        return { status: 'success', data: formatted };
    } catch (error) {
        console.error("Failed to fetch historical chats directly from DB:", error);
        return { status: 'error', data: [] };
    }
}
