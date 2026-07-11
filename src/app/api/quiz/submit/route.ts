import { NextResponse } from "next/server";
import { db, sharedQuizzes, quizSubmissions } from "@/db";
import { eq } from "drizzle-orm";

interface QuizQuestion {
  question: string;
  options: string[];
  correctOption: number;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { shareToken, studentName, answers, timeTaken } = body;

    if (!shareToken || !studentName?.trim() || !answers) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const quiz = await db.query.sharedQuizzes.findFirst({
      where: eq(sharedQuizzes.shareToken, shareToken),
    });

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    // Check expiration and status
    const now = new Date();
    const isExpired = new Date(quiz.expiresAt).getTime() < now.getTime();
    if (isExpired) {
      return NextResponse.json({ error: "This quiz has expired." }, { status: 403 });
    }
    if (quiz.isActive === 0) {
      return NextResponse.json({ error: "This quiz is inactive." }, { status: 403 });
    }

    let parsedQuestions: QuizQuestion[] = [];
    try {
      parsedQuestions = typeof quiz.questions === 'string' 
        ? JSON.parse(quiz.questions) as QuizQuestion[] 
        : quiz.questions as unknown as QuizQuestion[];
    } catch (e) {
      console.error("Failed to parse quiz questions", e);
    }

    let score = 0;
    const totalQuestions = parsedQuestions.length;
    const results = [];

    for (let i = 0; i < totalQuestions; i++) {
      const q = parsedQuestions[i];
      const studentOptionStr = answers[i] !== undefined ? answers[i] : answers[String(i)];
      const studentOption = studentOptionStr !== undefined ? parseInt(studentOptionStr, 10) : -1;
      const isCorrect = studentOption === q.correctOption;

      if (isCorrect) {
        score++;
      }

      results.push({
        question: q.question,
        options: q.options,
        correctOption: q.correctOption,
        studentOption,
        isCorrect,
      });
    }

    await db.insert(quizSubmissions).values({
      quizLinkId: quiz.id,
      studentName: studentName.trim(),
      answers: JSON.stringify(answers),
      score,
      totalQuestions,
      timeTaken: timeTaken ? parseInt(timeTaken, 10) : 0,
    });

    return NextResponse.json({
      success: true,
      score,
      totalQuestions,
      results,
    });
  } catch (error) {
    console.error("POST Submit Quiz Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
