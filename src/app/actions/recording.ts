"use server";

import { db, classes, recordings } from "@/db";
import { eq } from "drizzle-orm";

export async function saveRecordingAction(
  sessionId: string,
  recordingUrl: string,
  resolution: string = "720p",
  chunkCount: number = 1,
  status: string = "processing"
) {
  try {
    if (!sessionId || !recordingUrl) {
      return { success: false, error: "sessionId and recordingUrl are required" };
    }

    // 1. Update tb_classes with recording_url for the session
    await db
      .update(classes)
      .set({
        recordingUrl: recordingUrl,
      })
      .where(eq(classes.sessionId, sessionId));

    // 2. Save into tb_recordings if not already existing
    const existingRec = await db.query.recordings.findFirst({
      where: eq(recordings.sessionId, sessionId),
    });

    if (existingRec) {
      await db
        .update(recordings)
        .set({
          downloadUrl: recordingUrl,
          status: status,
        })
        .where(eq(recordings.sessionId, sessionId));
    } else {
      await db.insert(recordings).values({
        sessionId: sessionId,
        resolution: resolution,
        chunkCount: chunkCount,
        fileName: `recording_${sessionId}.webm`,
        filePath: recordingUrl,
        downloadUrl: recordingUrl,
        status: status,
      });
    }

    return { success: true, recordingUrl };
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error("saveRecordingAction Error:", error);
    return { success: false, error: errMessage };
  }
}
