import { NextResponse } from "next/server";
import { db, sharedQuizzes } from "@/db";
import { eq } from "drizzle-orm";

/**
 * Student-only endpoint to fetch shared quiz details.
 * Strips correctOption from questions to prevent cheating.
 * Checks expiry and active status.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  try {
    const quiz = await db.query.sharedQuizzes.findFirst({
      where: eq(sharedQuizzes.shareToken, token),
    });

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    // Check expiration
    const now = new Date();
    const isExpired = new Date(quiz.expiresAt).getTime() < now.getTime();
    if (isExpired) {
      return NextResponse.json({ error: "This quiz link has expired.", expired: true }, { status: 403 });
    }

    // Check active status
    if (quiz.isActive === 0) {
      return NextResponse.json({ error: "This quiz is currently paused.", inactive: true }, { status: 403 });
    }

    let parsedQuestions = [];
    try {
      parsedQuestions = typeof quiz.questions === 'string' ? JSON.parse(quiz.questions) : quiz.questions;
    } catch (e) {
      console.error("Failed to parse quiz questions", e);
    }

    // Strip correctOption for student security
    const strippedQuestions = parsedQuestions.map((q: { question: string; options: string[] }) => ({
      question: q.question,
      options: q.options,
    }));

    return NextResponse.json({
      quiz: {
        id: quiz.id,
        shareToken: quiz.shareToken,
        quizTitle: quiz.quizTitle,
        questions: strippedQuestions,
        timerDuration: quiz.timerDuration,
        expiresAt: quiz.expiresAt,
      },
    });
  } catch (error) {
    console.error("GET Shared Quiz (Student) Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
