import { NextResponse } from "next/server";
import { db, classes, quizzes, sharedQuizzes } from "@/db";
import { eq, and, inArray, desc } from "drizzle-orm";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  try {
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
      id?: number;
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
            questions = parsedQuestions.map((q: { question: string; options: string[]; correctOption: number }, idx: number) => ({
              id: sq.id * 1000 + idx, // generate a unique virtual ID
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
      const list = await db.select().from(quizzes).where(inArray(quizzes.classId, siblingIds));
      questions = list.map(q => {
        let parsedOptions = [];
        try {
          parsedOptions = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
        } catch (e) {
          console.error("Failed to parse options for quiz id", q.id, e);
        }
        return {
          id: q.id,
          question: q.question,
          options: parsedOptions,
          correctOption: q.correctOption,
        };
      });
    }

    return NextResponse.json({ questions });
  } catch (error) {
    console.error("GET Board Quiz Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
