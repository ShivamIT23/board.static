import { db, classes, classVisitors } from "@/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
        return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    try {
        const classSession = await db.query.classes.findFirst({
            where: eq(classes.sessionId, sessionId)
        });

        if (!classSession) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        const visitors = await db.query.classVisitors.findMany({
            where: eq(classVisitors.classId, classSession.id),
            orderBy: (visitors, { desc }) => [desc(visitors.joinedAt)]
        });

        return NextResponse.json({ visitors });
    } catch (error) {
        console.error("Fetch visitors error:", error);
        return NextResponse.json({ error: "Failed to fetch visitors" }, { status: 500 });
    }
}
