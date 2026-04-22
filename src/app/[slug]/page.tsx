import { db, classes, classVisitors } from "@/db";
import { like, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import MainBoard from "@/components/Board/MainBoard";
import StudentGate from "@/components/Board/StudentGate";
import { cookies } from "next/headers";
// import { redirect } from "next/navigation";

export default async function LiveSlugPage({
    params,
}: {
    params: Promise<{ slug: string }>,
}) {
    const { slug } = await params;

    if (!slug) return notFound();

    // 1. Check teacher slug in teacherLink
    const teacherSession = await db.query.classes.findFirst({
        where: like(classes.teacherLink, `%/${slug}`)
    });

    if (teacherSession) {
        /* ─── START OF END SESSION REDIRECT LOGIC (COMMENTABLE) ────
        if (teacherSession.isClassEnded === 1) {
            const endedAt = teacherSession.endedAt ? new Date(teacherSession.endedAt).getTime() : 0;
            const now = new Date().getTime(); 
            if (now - endedAt > 10 * 60 * 1000) {
                return redirect("https://tutorarc.cloud");
            }
        }
        ─── END OF END SESSION REDIRECT LOGIC ────────────────────── */
        return (
            <div className="flex flex-col h-screen overflow-hidden">
                <MainBoard 
                    duration={teacherSession.duration || 10} 
                    sessionId={teacherSession.sessionId} 
                    role="teacher" 
                    userName="Teacher"
                    userId={`teacher-${teacherSession.teacherId}`}
                    // isClassEnded={teacherSession.isClassEnded === 1}
                    // endedAt={teacherSession.endedAt ? new Date(teacherSession.endedAt).getTime() : undefined}
                />
            </div>
        );
    }

    // 2. Check student slug in studentLink
    const studentSession = await db.query.classes.findFirst({
        where: like(classes.studentLink, `%/${slug}`)
    });

    if (studentSession) {
        /* ─── START OF END SESSION REDIRECT LOGIC (COMMENTABLE) ────
        if (studentSession.isClassEnded === 1) {
            const endedAt = studentSession.endedAt ? new Date(studentSession.endedAt).getTime() : 0;
            const now = new Date().getTime(); 
            if (now - endedAt > 10 * 60 * 1000) {
                return redirect("https://tutorarc.cloud");
            }
        }
        ─── END OF END SESSION REDIRECT LOGIC ────────────────────── */
        const cookieStore = await cookies();
        const authCookie = cookieStore.get(`board_auth_${studentSession.sessionId}`);
        let authData = authCookie ? JSON.parse(authCookie.value) : null;

        // Verify visitor exists (Prevents ghost ID errors)
        if (authData?.visitorId) {
            const visitorExists = await db.query.classVisitors.findFirst({
                where: eq(classVisitors.id, authData.visitorId)
            });
            if (!visitorExists) authData = null;
        }

        if (!authData) {
            return (
                <StudentGate
                    sessionId={studentSession.sessionId}
                    isRestricted={studentSession.isRestricted === 1}
                    className={studentSession.name}
                />
            );
        }

        return (
            <div className="flex flex-col h-screen overflow-hidden">
                <MainBoard
                    duration={studentSession.duration || 10}
                    sessionId={studentSession.sessionId}
                    role="student"
                    userName={authData.name}
                    userId={studentSession.isRestricted ? authData.email : authData.name}
                    visitorId={authData.visitorId}
                    // isClassEnded={studentSession.isClassEnded === 1}
                    // endedAt={studentSession.endedAt ? new Date(studentSession.endedAt).getTime() : undefined}
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-zinc-950 text-white gap-4 text-center p-4">
            <h1 className="text-xl font-bold">Invalid or Expired Link</h1>
            <p className="text-sm text-zinc-500">This link does not match any active classroom session.</p>
        </div>
    );
}
