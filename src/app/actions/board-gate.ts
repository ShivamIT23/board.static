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

    // 1. Find the class
    const foundClass = await db.query.classes.findFirst({
        where: eq(classes.sessionId, sessionId)
    });

    if (!foundClass) return { error: "Class not found" };

    if (foundClass.isRestricted) {
        if (!email || !password) return { error: "Credentials required" };

        const student = await db.query.students.findFirst({
            where: and(
                eq(students.email, email),
                eq(students.password, password), // Production: hash check
                eq(students.teacherId, foundClass.teacherId)
            )
        });

        if (!student) return { error: "Invalid student credentials for this classroom" };

        // Successful Restricted Join
        await db.insert(classVisitors).values({
            classId: foundClass.id,
            name: student.name,
            email: email,
        });

        // Set a secure cookie for this session
        (await cookies()).set(`board_auth_${sessionId}`, JSON.stringify({ name: student.name, email }), {
            maxAge: 60 * 60 * 24, // 24 hours
            path: '/',
        });

        return { success: true, name: student.name };
    } else {
        if (!name || name.trim().length < 2) return { error: "Name is required" };

        // Successful Unrestricted Join
        await db.insert(classVisitors).values({
            classId: foundClass.id,
            name: name,
        });

        // Set cookie
        (await cookies()).set(`board_auth_${sessionId}`, JSON.stringify({ name }), {
            maxAge: 60 * 60 * 24,
            path: '/',
        });

        return { success: true, name };
    }
}
