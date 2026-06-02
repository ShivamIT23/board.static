import { db, classBoardStates, classBoardFiles } from "@/db";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// GET /api/board-state?sessionId=XXX — Load board state directly from DB
// Saving is handled by socket-provider's sync.service.ts (every 30s)
export async function GET(req: NextRequest) {
    const sessionId = req.nextUrl.searchParams.get("sessionId");
    if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

    try {
        // Fetch all pages for this session
        const pages = await db.query.classBoardStates.findMany({
            where: eq(classBoardStates.sessionId, sessionId),
        });

        // Build page-keyed object: { 0: [...objects], 1: [...objects] }
        const boardState: Record<number, unknown[]> = {};
        for (const page of pages) {
            try {
                boardState[page.page] = JSON.parse(page.data);
            } catch { boardState[page.page] = []; }
        }

        // Fetch board files
        const files = await db.query.classBoardFiles.findMany({
            where: eq(classBoardFiles.sessionId, sessionId),
        });

        return NextResponse.json({ status: "success", boardState, boardFiles: files });
    } catch (error) {
        console.error("Board state fetch error:", error);
        return NextResponse.json({ error: "Failed to fetch board state" }, { status: 500 });
    }
}
