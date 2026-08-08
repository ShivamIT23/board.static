import { NextResponse } from "next/server";
import { db, classes, recordings } from "@/db";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, recordingUrl, resolution, chunkCount } = body;

    if (!sessionId || !recordingUrl) {
      return NextResponse.json(
        { error: "sessionId and recordingUrl are required" },
        { status: 400 }
      );
    }

    const classSessionId = sessionId.includes("_") ? sessionId.split("_")[0] : sessionId;
    const fileName = recordingUrl.substring(recordingUrl.lastIndexOf("/") + 1) || `recording_${sessionId}.webm`;

    // 1. Update tb_classes with recording_url for the session
    await db
      .update(classes)
      .set({
        recordingUrl: recordingUrl,
      })
      .where(eq(classes.sessionId, classSessionId));

    // 2. Save into tb_recordings matching by fileName / downloadUrl
    const existingRec = await db.query.recordings.findFirst({
      where: eq(recordings.fileName, fileName),
    });

    if (existingRec) {
      await db
        .update(recordings)
        .set({
          downloadUrl: recordingUrl,
          status: "completed",
        })
        .where(eq(recordings.fileName, fileName));
    } else {
      await db.insert(recordings).values({
        sessionId: classSessionId,
        resolution: resolution || "720p",
        chunkCount: chunkCount || 1,
        fileName: fileName,
        filePath: recordingUrl,
        downloadUrl: recordingUrl,
        status: "completed",
      });
    }


    return NextResponse.json({ success: true, recordingUrl });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error("Save Recording Route Error:", error);
    return NextResponse.json(
      { error: errMessage || "Internal Server Error" },
      { status: 500 }
    );
  }
}
