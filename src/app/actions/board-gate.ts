"use server"

import { db, classes, students, classVisitors } from "@/db";
import { eq, and, or } from "drizzle-orm";
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

    // Get or create a persistent student fingerprint ID from cookies
    const cookieStore = await cookies();
    let studentId = cookieStore.get("board_student_id")?.value;
    if (!studentId) {
        studentId = crypto.randomUUID();
        cookieStore.set("board_student_id", studentId, {
            maxAge: 60 * 60 * 24 * 365, // 1 year
            path: "/",
        });
    }

    // Check for existing kick/ban status
    const banRecord = await db.query.classVisitors.findFirst({
        where: and(
            eq(classVisitors.studentId, studentId),
            or(
                and(eq(classVisitors.teacherId, foundClass.teacherId), eq(classVisitors.isBanned, 1)),
                and(eq(classVisitors.classId, foundClass.id), eq(classVisitors.isKicked, 1))
            )
        )
    });

    if (banRecord) {
        if (banRecord.isBanned) return { error: "You are permanently banned by this teacher from all their classes." };
        if (banRecord.isKicked) return { error: "You have been kicked out of this specific classroom." };
    }

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
        let currentApprovalStatus: 'pending' | 'approved' | 'rejected' = foundClass.isAutoApprove ? 'approved' : 'pending';

        try {
            // ── 3. Check Capacity ──
            const activeVisitors = await db.query.classVisitors.findMany({
                where: and(eq(classVisitors.classId, foundClass.id), eq(classVisitors.isActive, 1), eq(classVisitors.approvalStatus, 'approved'))
            });

            if (activeVisitors.length >= (foundClass.maxStudents || 10)) {
                return { error: "Classroom is full. No more seats left." };
            }

            // Check if we already have a record for this student in this class
            const existingRecord = await db.query.classVisitors.findFirst({
                where: and(
                    eq(classVisitors.classId, foundClass.id),
                    eq(classVisitors.email, email || "")
                )
            });

            if (existingRecord) {
                const newStatus = existingRecord.approvalStatus === 'rejected' ? currentApprovalStatus : existingRecord.approvalStatus;

                // Update existing record
                await db.update(classVisitors)
                    .set({ 
                        isActive: 1, 
                        studentId, 
                        teacherId: foundClass.teacherId,
                        approvalStatus: newStatus
                    })
                    .where(eq(classVisitors.id, existingRecord.id));
                visitorId = existingRecord.id;
                currentApprovalStatus = (newStatus as 'pending' | 'approved' | 'rejected');
            } else {
                // Create new record
                const [inserted] = await db.insert(classVisitors).values({
                    classId: foundClass.id,
                    teacherId: foundClass.teacherId,
                    studentId,
                    name: student.name,
                    email,
                    isActive: 1,
                    approvalStatus: currentApprovalStatus
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
            visitorId,
            approvalStatus: currentApprovalStatus
        }), {
            maxAge: 60 * 60 * 24,
            path: '/',
        });

        return { 
            success: true, 
            name: student.name, 
            isPending: currentApprovalStatus === 'pending' 
        };
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
        let currentApprovalStatus: 'pending' | 'approved' | 'rejected' = foundClass.isAutoApprove ? 'approved' : 'pending';
        
        try {
            // ── 1. Check Capacity ──
            const activeVisitors = await db.query.classVisitors.findMany({
                where: and(eq(classVisitors.classId, foundClass.id), eq(classVisitors.isActive, 1), eq(classVisitors.approvalStatus, 'approved'))
            });

            if (activeVisitors.length >= (foundClass.maxStudents || 10)) {
                return { error: "Classroom is full. No more seats left." };
            }

            // Check if we already have a record for this name in this class
            const existingRecord = await db.query.classVisitors.findFirst({
                where: and(
                    eq(classVisitors.classId, foundClass.id),
                    eq(classVisitors.name, name || "")
                )
            });

            if (existingRecord) {
                // If they were rejected, maybe let them try again? 
                // Or if they were pending, keep them pending.
                const newStatus = existingRecord.approvalStatus === 'rejected' ? currentApprovalStatus : existingRecord.approvalStatus;
                
                await db.update(classVisitors)
                    .set({ 
                        isActive: 1, 
                        studentId, 
                        teacherId: foundClass.teacherId,
                        approvalStatus: newStatus
                    })
                    .where(eq(classVisitors.id, existingRecord.id));
                visitorId = existingRecord.id;
                currentApprovalStatus = (newStatus as 'pending' | 'approved' | 'rejected');
            } else {
                // Create new record
                const [inserted] = await db.insert(classVisitors).values({
                    classId: foundClass.id,
                    teacherId: foundClass.teacherId,
                    studentId,
                    name,
                    isActive: 1,
                    approvalStatus: currentApprovalStatus
                });
                visitorId = (inserted as { insertId: number }).insertId;
            }
        } catch (err) {
            console.error("Registration DB error:", err);
        }

        // Set cookie
        (await cookies()).set(`board_auth_${sessionId}`, JSON.stringify({ 
            name,
            visitorId,
            approvalStatus: currentApprovalStatus
        }), {
            maxAge: 60 * 60 * 24,
            path: '/',
        });

        return { 
            success: true, 
            name, 
            isPending: currentApprovalStatus === 'pending' 
        };
    }
}
