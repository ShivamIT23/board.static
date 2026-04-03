import { db, classes } from "@/db";
import { like } from "drizzle-orm";
import { notFound } from "next/navigation";
import MainBoard from "@/components/Board/MainBoard";

export default async function LiveSlugPage({
    params,
    searchParams
}: {
    params: Promise<{ slug: string }>,
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const { slug } = await params;
    const { name } = await searchParams;

    if (!slug) return notFound();

    // Check teacher slug in teacherLink
    const teacherSession = await db.query.classes.findFirst({
        where: like(classes.teacherLink, `%/${slug}`)
    });

    if (teacherSession) {
        return (
            <div className="flex flex-col h-screen overflow-hidden">
                <MainBoard sessionId={teacherSession.sessionId} role="teacher" userName="Teacher" />
            </div>
        );
    }

    // Check student slug in studentLink
    const studentSession = await db.query.classes.findFirst({
        where: like(classes.studentLink, `%/${slug}`)
    });

    if (studentSession) {
        const displayName = (name as string) || "Student";
        return (
            <div className="flex flex-col h-screen overflow-hidden">
                <MainBoard sessionId={studentSession.sessionId} role="student" userName={displayName} />
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
