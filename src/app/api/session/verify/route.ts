import { db } from "@/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { slug } = await req.json();

        if (!slug) {
            return NextResponse.json({ error: "Slug is required" }, { status: 400 });
        }

        // 1. Check if it's a teacher slug
        // const teacherSession = await db.query.classes.findFirst({
        //     where: eq(classes.teacherLink, slug.includes("/") ? slug : `*/live/${slug}`) // Support both full URL and just slug
        // });

        // Better way: search by slug explicitly if we had a slug field
        // Since we have teacherLink as a full URL, we use like
        const sessionByTeacherLink = await db.query.classes.findFirst({
            where: (classes, { like }) => like(classes.teacherLink, `%/${slug}`)
        });

        if (sessionByTeacherLink) {
            return NextResponse.json({
                role: "teacher",
                sessionId: sessionByTeacherLink.sessionId,
                token: sessionByTeacherLink.teacherToken,
                name: "Teacher"
            });
        }

        // 2. Check if it's a student slug
        const sessionByStudentLink = await db.query.classes.findFirst({
            where: (classes, { like }) => like(classes.studentLink, `%/${slug}`)
        });

        if (sessionByStudentLink) {
            return NextResponse.json({
                role: "student",
                sessionId: sessionByStudentLink.sessionId,
                token: sessionByStudentLink.studentToken,
                name: "Student"
            });
        }

        return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
    } catch (error) {
        console.error("Session Verification Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
