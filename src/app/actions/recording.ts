"use server";

import { db, classes, recordings } from "@/db";
import { eq } from "drizzle-orm";

export async function saveRecordingAction(
  sessionId: string,
  recordingUrl: string,
  resolution: string = "720p",
  chunkCount: number = 1,
  status: string = "processing",
  recordingSizeInMB?: string
) {
  try {
    if (!sessionId || !recordingUrl) {
      return { success: false, error: "sessionId and recordingUrl are required" };
    }

    const classSessionId = sessionId.includes("_") ? sessionId.split("_")[0] : sessionId;
    const fileName = recordingUrl.substring(recordingUrl.lastIndexOf("/") + 1) || `recording_${sessionId}.webm`;

    // 1. Update tb_classes recordingSizeInMB if present (do not overwrite single recordingUrl on classes)
    if (recordingSizeInMB) {
      await db
        .update(classes)
        .set({
          recordingSizeInMB: recordingSizeInMB,
        })
        .where(eq(classes.sessionId, classSessionId));
    }

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
          ...(recordingSizeInMB && { recordingSizeInMB }),
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
        recordingSizeInMB: recordingSizeInMB || null,
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

export async function getRecordingsAction(sessionId: string) {
  try {
    if (!sessionId) return { success: false, recordings: [] };
    const classSessionId = sessionId.includes("_") ? sessionId.split("_")[0] : sessionId;
    const recs = await db.query.recordings.findMany({
      where: eq(recordings.sessionId, classSessionId),
      orderBy: (recordings, { asc }) => [asc(recordings.createdAt)],
    });
    return {
      success: true,
      recordings: recs.map(r => ({
        id: String(r.id),
        downloadUrl: r.downloadUrl,
        fileName: r.fileName,
        chunkCount: r.chunkCount || 1,
        recordingSizeInMB: r.recordingSizeInMB || undefined,
        status: r.status,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
      })),
    };
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error("getRecordingsAction Error:", errMessage);
    return { success: false, recordings: [] };
  }
}
