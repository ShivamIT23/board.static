"use server"

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

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
