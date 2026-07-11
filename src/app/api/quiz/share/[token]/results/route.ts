import { NextResponse } from "next/server";
import { db, sharedQuizzes, quizSubmissions } from "@/db";
import { eq } from "drizzle-orm";

/**
 * GET /api/quiz/share/[token]/results
 * Returns quiz details + all student submissions for the teacher to view.
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

    let parsedQuestions = [];
    try {
      parsedQuestions =
        typeof quiz.questions === "string"
          ? JSON.parse(quiz.questions)
          : quiz.questions;
    } catch (e) {
      console.error("Failed to parse quiz questions", e);
    }

    // Fetch all student submissions for this quiz
    const submissions = await db
      .select()
      .from(quizSubmissions)
      .where(eq(quizSubmissions.quizLinkId, quiz.id));

    return NextResponse.json({
      quiz: {
        id: quiz.id,
        shareToken: quiz.shareToken,
        quizTitle: quiz.quizTitle,
        questions: parsedQuestions,
        timerDuration: quiz.timerDuration,
        expiresAt: quiz.expiresAt,
        isActive: quiz.isActive,
        createdAt: quiz.createdAt,
      },
      submissions: submissions.map((s) => {
        let parsedAnswers = {};
        try {
          parsedAnswers =
            typeof s.answers === "string" ? JSON.parse(s.answers) : s.answers;
        } catch {}
        return {
          id: s.id,
          studentName: s.studentName,
          answers: parsedAnswers,
          score: s.score,
          totalQuestions: s.totalQuestions,
          timeTaken: s.timeTaken,
          submittedAt: s.submittedAt,
        };
      }),
    });
  } catch (error) {
    console.error("GET Quiz Results Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
