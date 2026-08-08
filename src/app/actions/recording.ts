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
      // Do not overwrite if worker callback already marked recording as completed
      const newStatus = existingRec.status === "completed" ? "completed" : status;
      await db
        .update(recordings)
        .set({
          downloadUrl: recordingUrl,
          status: newStatus,
        })
        .where(eq(recordings.fileName, fileName));
    } else {
      await db.insert(recordings).values({
        sessionId: classSessionId,
        resolution: resolution,
        chunkCount: chunkCount,
        fileName: fileName,
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
