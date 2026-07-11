import { NextResponse } from "next/server";
import { db, classes, quizzes, sharedQuizzes } from "@/db";
import { eq, and, inArray, desc } from "drizzle-orm";
import crypto from "crypto";

/**
 * POST /api/quiz/share
 * Teacher creates a shareable quiz link from the board.
 * Expects: { sessionId, quizTitle?, timerDuration?, expiryHours? }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, quizTitle, timerDuration, expiryHours } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    // Look up the class by sessionId
    const session = await db.query.classes.findFirst({
      where: eq(classes.sessionId, sessionId),
    });

    if (!session) {
      return NextResponse.json({ error: "Class session not found" }, { status: 404 });
    }

    // Find all classes with the same name and teacher to support recurring/linked sessions
    const siblingClasses = await db
      .select({ id: classes.id })
      .from(classes)
      .where(
        and(
          eq(classes.name, session.name),
          eq(classes.teacherId, session.teacherId)
        )
      );

    const siblingIds = siblingClasses.map(c => c.id);

    interface QuizQuestion {
      question: string;
      options: string[];
      correctOption: number;
    }

    let questions: QuizQuestion[] = [];

    // 1. Try to fetch from sharedQuizzes first (where the portal saves them)
    if (siblingIds.length > 0) {
      const sharedList = await db
        .select()
        .from(sharedQuizzes)
        .where(inArray(sharedQuizzes.classId, siblingIds))
        .orderBy(desc(sharedQuizzes.id))
        .limit(1);

      if (sharedList.length > 0) {
        const sq = sharedList[0];
        try {
          const parsedQuestions = typeof sq.questions === 'string' ? JSON.parse(sq.questions) : sq.questions;
          if (Array.isArray(parsedQuestions)) {
            questions = parsedQuestions.map((q: { question: string; options: string[]; correctOption: number }) => ({
              question: q.question,
              options: q.options,
              correctOption: q.correctOption
            }));
          }
        } catch (e) {
          console.error("Failed to parse questions from shared quiz", sq.id, e);
        }
      }
    }

    // 2. Fall back to quizzes table if no shared quizzes found
    if (questions.length === 0 && siblingIds.length > 0) {
      const questionsList = await db.select().from(quizzes).where(inArray(quizzes.classId, siblingIds));
      questions = questionsList.map((q) => {
        let parsedOptions: string[] = [];
        try {
          parsedOptions = typeof q.options === "string" ? JSON.parse(q.options) : q.options;
        } catch (e) {
          console.error("Failed to parse options for quiz id", q.id, e);
        }
        return {
          question: q.question,
          options: parsedOptions,
          correctOption: q.correctOption,
        };
      });
    }

    if (questions.length === 0) {
      return NextResponse.json({ error: "No quiz questions found for this class" }, { status: 400 });
    }

    const shareToken = crypto.randomBytes(16).toString("hex");
    const expiryTime = expiryHours ? parseFloat(expiryHours) : 24;
    const expiresAt = new Date(Date.now() + expiryTime * 60 * 60 * 1000);

    await db.insert(sharedQuizzes).values({
      shareToken,
      teacherId: session.teacherId,
      classId: session.id,
      quizTitle: quizTitle || session.name || "Quiz",
      questions: JSON.stringify(questions),
      timerDuration: timerDuration ? parseInt(timerDuration, 10) : 0,
      expiresAt,
      isActive: 1,
    });

    return NextResponse.json({ shareToken, quizTitle: quizTitle || session.name || "Quiz" });
  } catch (error) {
    console.error("POST Create Shared Quiz (Board) Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
