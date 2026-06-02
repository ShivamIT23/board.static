import { db, classes } from "@/db";
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

        return NextResponse.json({
            duration: classSession.duration,
            durationAdded: classSession.durationAdded
        });
    } catch (error) {
        console.error("Fetch duration error:", error);
        return NextResponse.json({ error: "Failed to fetch duration" }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const { sessionId, duration, durationAdded } = await req.json();

        if (!sessionId) {
            return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
        }

        const updateData: Record<string, number> = {};
        if (duration !== undefined) updateData.duration = duration;
        if (durationAdded !== undefined) updateData.durationAdded = durationAdded;

        await db.update(classes)
            .set(updateData)
            .where(eq(classes.sessionId, sessionId));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Update duration error:", error);
        return NextResponse.json({ error: "Failed to update duration" }, { status: 500 });
    }
}
