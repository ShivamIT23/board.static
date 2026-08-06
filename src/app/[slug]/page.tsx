import { db, classes, classVisitors } from "@/db";
import { like, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import MainBoard from "@/components/Board/MainBoard";
import StudentGate from "@/components/Board/StudentGate";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Metadata } from "next";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>,
}): Promise<Metadata> {
    const { slug } = await params;
    if (!slug) return {};

    try {
        const session = await db.query.classes.findFirst({
            where: like(classes.teacherLink, `%/${slug}`)
        }) || await db.query.classes.findFirst({
            where: like(classes.studentLink, `%/${slug}`)
        });

        if (!session) {
            return {
                title: "Live Board - TutorArc",
                description: "Join your live advanced digital board classroom session on TutorArc."
            };
        }

        const titleText = session.name;
        const descText = session.description || "Join this live advanced interactive digital board session.";

        return {
            title: titleText,
            description: descText,
            openGraph: {
                title: titleText,
                description: descText,
                type: "website"
            },
            twitter: {
                card: "summary_large_image",
                title: titleText,
                description: descText
            }
        };
    } catch (error) {
        console.error("Error generating metadata:", error);
        return {
            title: "Live Board - TutorArc",
            description: "Join your live advanced digital board classroom session on TutorArc."
        };
    }
}

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
        // Mark session as started if teacher joins first time, or if it is an upcoming future class
        const startTimeParsed = teacherSession.startTime ? new Date(teacherSession.startTime) : null;
        const isUpcoming = startTimeParsed && startTimeParsed.getTime() > new Date().getTime();

        if (teacherSession.status === 'scheduled' || isUpcoming) {
            await db.update(classes).set({ 
                status: 'started',
                startTime: new Date()
            }).where(eq(classes.id, teacherSession.id));
            teacherSession.status = 'started';
            teacherSession.startTime = new Date();
        }

        /* ─── START OF END SESSION REDIRECT LOGIC ──── */
        if (teacherSession.isClassEnded === 1) {
            return redirect("/class-ended");
        }
        /*─── END OF END SESSION REDIRECT LOGIC ────────────────────── */
        return (
            <div className="flex flex-col h-screen overflow-hidden">
                <MainBoard 
                    duration={teacherSession.duration || 10} 
                    durationAdded={teacherSession.durationAdded || 60}
                    startTime={teacherSession.startTime ? new Date(teacherSession.startTime).getTime() : undefined}
                    sessionId={teacherSession.sessionId} 
                    role="teacher" 
                    userName="Teacher"
                    userId={`teacher-${teacherSession.teacherId}`}
                    isClassEnded={teacherSession.isClassEnded === 1}
                    endedAt={teacherSession.endedAt ? new Date(teacherSession.endedAt).getTime() : undefined}
                    hasQuiz={teacherSession.hasQuiz === 1}
                    classId={teacherSession.id}
                />
            </div>
        );
    }

    // 2. Check student slug in studentLink
    const studentSession = await db.query.classes.findFirst({
        where: like(classes.studentLink, `%/${slug}`)
    });

    if (studentSession) {
        /* ─── START OF END SESSION REDIRECT LOGIC ──── */
        if (studentSession.isClassEnded === 1) {
            return redirect("/class-ended");
        }
        /*─── END OF END SESSION REDIRECT LOGIC ────────────────────── */
        const cookieStore = await cookies();
        const authCookie = cookieStore.get(`board_auth_${studentSession.sessionId}`);
        let authData = authCookie ? JSON.parse(authCookie.value) : null;

        // Verify visitor exists (Prevents ghost ID errors)
        if (authData?.visitorId) {
            const visitorExists = await db.query.classVisitors.findFirst({
                where: eq(classVisitors.id, authData.visitorId)
            });
            if (!visitorExists) {
                authData = null;
            } else {
                // Ensure approvalStatus is synced with the latest database status
                authData.approvalStatus = visitorExists.approvalStatus;
            }
        }

        if (!authData || authData.approvalStatus !== 'approved') {
            return (
                <StudentGate
                    sessionId={studentSession.sessionId}
                    isRestricted={studentSession.isRestricted === 1}
                    className={studentSession.name}
                    isWaitingApproval={authData?.approvalStatus === 'pending'}
                    authData={authData}
                />
            );
        }

        return (
            <div className="flex flex-col h-screen overflow-hidden">
                <MainBoard
                    duration={studentSession.duration || 10}
                    durationAdded={studentSession.durationAdded || 60}
                    startTime={studentSession.startTime ? new Date(studentSession.startTime).getTime() : undefined}
                    sessionId={studentSession.sessionId}
                    role="student"
                    userName={authData.name}
                    userId={studentSession.isRestricted ? authData.email : authData.name}
                    visitorId={authData.visitorId}
                    isClassEnded={studentSession.isClassEnded === 1}
                    endedAt={studentSession.endedAt ? new Date(studentSession.endedAt).getTime() : undefined}
                    hasQuiz={studentSession.hasQuiz === 1}
                    classId={studentSession.id}
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
