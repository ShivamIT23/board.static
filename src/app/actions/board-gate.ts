"use server"

import { db, classes, students, classVisitors } from "@/db";
import { eq, and } from "drizzle-orm";
import { cookies } from "next/headers";

export async function verifyStudent(data: {
    sessionId: string;
    name?: string;
    email?: string;
    password?: string;
}) {
    const { sessionId, name, email, password } = data;

    // 1. Find the class (still local for redirection logic)
    const foundClass = await db.query.classes.findFirst({
        where: eq(classes.sessionId, sessionId)
    });

    if (!foundClass) return { error: "Class not found" };

    if (foundClass.isRestricted) {
        if (!email || !password) return { error: "Credentials required" };

        // ── 1. Check Credentials First ──
        const student = await db.query.students.findFirst({
            where: and(
                eq(students.email, email),
                eq(students.password, password),
                eq(students.teacherId, foundClass.teacherId)
            )
        });

        if (!student) return { error: "Invalid student credentials for this classroom" };

        // ── 2. Check Availability (Repeat Check) ──
        const activeVisitor = await db.query.classVisitors.findFirst({
            where: and(
                eq(classVisitors.classId, foundClass.id),
                eq(classVisitors.isActive, 1),
                eq(classVisitors.email, email || "")
            )
        });

        if (activeVisitor) {
            return { error: "This account is already active in this classroom." };
        }

        // Successful Restricted Join -> Register or Reactivate via DB
        let visitorId = 0;
        try {
            // Check if we already have a record for this student in this class
            const existingRecord = await db.query.classVisitors.findFirst({
                where: and(
                    eq(classVisitors.classId, foundClass.id),
                    eq(classVisitors.email, email || "")
                )
            });

            if (existingRecord) {
                // Update existing record
                await db.update(classVisitors)
                    .set({ isActive: 1 })
                    .where(eq(classVisitors.id, existingRecord.id));
                visitorId = existingRecord.id;
            } else {
                // Create new record
                const [inserted] = await db.insert(classVisitors).values({
                    classId: foundClass.id,
                    name: student.name,
                    email,
                    isActive: 1,
                });
                visitorId = (inserted as { insertId: number }).insertId;
            }
        } catch (err) {
            console.error("Registration DB error:", err);
        }

        // Set a secure cookie for this session
        (await cookies()).set(`board_auth_${sessionId}`, JSON.stringify({ 
            name: student.name, 
            email,
            visitorId 
        }), {
            maxAge: 60 * 60 * 24,
            path: '/',
        });

        return { success: true, name: student.name };
    } else {
        if (!name || name.trim().length < 2) return { error: "Name is required" };

        // ── Check Availability (Repeat Check) for Open Classrooms ──
        const activeVisitor = await db.query.classVisitors.findFirst({
            where: and(
                eq(classVisitors.classId, foundClass.id),
                eq(classVisitors.isActive, 1),
                eq(classVisitors.name, name || "")
            )
        });

        if (activeVisitor) {
            return { error: "This name is already active in this classroom. Please use another name." };
        }

        // Successful Unrestricted Join -> Register or Reactivate via DB
        let visitorId = 0;
        try {
            // Check if we already have a record for this name in this class
            const existingRecord = await db.query.classVisitors.findFirst({
                where: and(
                    eq(classVisitors.classId, foundClass.id),
                    eq(classVisitors.name, name || "")
                )
            });

            if (existingRecord) {
                // Update existing record
                await db.update(classVisitors)
                    .set({ isActive: 1 })
                    .where(eq(classVisitors.id, existingRecord.id));
                visitorId = existingRecord.id;
            } else {
                // Create new record
                const [inserted] = await db.insert(classVisitors).values({
                    classId: foundClass.id,
                    name,
                    isActive: 1,
                });
                visitorId = (inserted as { insertId: number }).insertId;
            }
        } catch (err) {
            console.error("Registration DB error:", err);
        }

        // Set cookie
        (await cookies()).set(`board_auth_${sessionId}`, JSON.stringify({ 
            name,
            visitorId
        }), {
            maxAge: 60 * 60 * 24,
            path: '/',
        });

        return { success: true, name };
    }
}
