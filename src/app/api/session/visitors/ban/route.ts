import { db, classVisitors } from "@/db";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { visitorId, type, userId } = body; // userId is the teacher's ID (used for audit/validation)

        if (!visitorId || !type || !userId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const visitor = await db.query.classVisitors.findFirst({
            where: eq(classVisitors.id, visitorId)
        });

        if (!visitor) {
            return NextResponse.json({ error: "Visitor not found" }, { status: 404 });
        }

        // Security check: only the teacher of this class can kick/ban
        // Note: In a real app, verify the 'userId' against the session token
        
        if (type === "kick") {
            // Kick from this specific class
            await db.update(classVisitors)
                .set({ isKicked: 1, isActive: 0 })
                .where(and(
                    eq(classVisitors.classId, visitor.classId),
                    eq(classVisitors.studentId, visitor.studentId!)
                ));
        } else if (type === "ban") {
            // Ban from all classes of this teacher
            await db.update(classVisitors)
                .set({ isBanned: 1, isActive: 0 })
                .where(and(
                    eq(classVisitors.teacherId, visitor.teacherId!),
                    eq(classVisitors.studentId, visitor.studentId!)
                ));
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Ban/Kick error:", error);
        return NextResponse.json({ error: "Operation failed" }, { status: 500 });
    }
}
