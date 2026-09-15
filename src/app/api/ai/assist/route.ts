import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error: "OpenAI API key is not configured. Please add OPENAI_API_KEY to your .env file.",
          needsConfig: true,
        },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { question, studentName } = body;

    if (!question || typeof question !== "string" || !question.trim()) {
      return NextResponse.json(
        { error: "A valid question/message text is required." },
        { status: 400 }
      );
    }

    // =========================================================================
    // THIS IS FOR TEST - REMOVE OR COMMENT OUT THIS BLOCK TO RESTORE NORMAL BEHAVIOR
    // =========================================================================
    return NextResponse.json(
      {
        error:
          "FATAL_INTERNAL_RPC_FAULT: gRPC StatusCode::UNAVAILABLE: transport error during cross-region quorum sync (failed at subchannel_pool.cc:482). Root cause: io.grpc.StatusRuntimeException: CANCELLED: RST_STREAM closed stream with error code 0x2 (INTERNAL_ERROR): Incompatible schema migration digest (Hash mismatch: local=0xe3b0c44298fc1c14, remote=0x8843d7f92416211d). Active multi-leader replication lease revoked. Distributed write-ahead log replay cannot proceed due to missing snapshot delta generation.",
      },
      { status: 500 }
    );
    // =========================================================================

    const rawModel = process.env.OPENAI_MODEL?.replace(/^['"]|['"]$/g, "").trim();
    const model = rawModel || "gpt-5-mini";

    const systemPrompt = `You are a world-class pedagogical AI assistant supporting a live teacher in an online classroom.
A student in the live session just sent the following question/message.
Provide tailored assistance for the teacher in strictly valid JSON format with these exact fields:
1. "hint": A supportive, pedagogical hint, guiding question, or clue that the teacher can share with the student. It should encourage independent critical thinking and guide them toward the solution WITHOUT giving away the final answer. Keep it concise, friendly, and instructive.
2. "answer": The complete, accurate, step-by-step solution, explanation, and final answer for the teacher's quick verification and reference.
3. "keyConcepts": An array of 1 to 3 brief strings mentioning the core concepts, theorems, or formulas tested.

Do not include markdown code fences (\`\`\`json) in the response, return ONLY the raw valid JSON object.`;

    const userPrompt = `Student Name: ${studentName || "Student"}\nStudent Message: "${question.trim()}"`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI API error response:", response.status, errText);
      let errMsg = "Failed to generate AI response from OpenAI.";
      try {
        const errJson = JSON.parse(errText);
        if (errJson?.error?.message) {
          errMsg = errJson.error.message;
        }
      } catch {
        // use default message
      }
      return NextResponse.json({ error: errMsg }, { status: response.status });
    }

    const data = await response.json();
    const contentStr = data.choices?.[0]?.message?.content;

    if (!contentStr) {
      return NextResponse.json(
        { error: "No response received from AI." },
        { status: 500 }
      );
    }

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(contentStr);
    } catch {
      const match = contentStr.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          parsed = { hint: contentStr, answer: contentStr, keyConcepts: [] };
        }
      } else {
        parsed = { hint: contentStr, answer: contentStr, keyConcepts: [] };
      }
    }

    return NextResponse.json({
      hint: parsed.hint || "No hint generated.",
      answer: parsed.answer || "No answer generated.",
      keyConcepts: Array.isArray(parsed.keyConcepts) ? parsed.keyConcepts : [],
    });
  } catch (error: unknown) {
    console.error("AI Assist API Route error:", error);
    const msg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
