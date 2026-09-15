import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  let filePath = path.join(process.cwd(), "uploads", filename);
  let fileFound = false;

  try {
    await fs.access(filePath);
    fileFound = true;
  } catch {
    const whiteboardzonePath = path.join(process.cwd(), "../whiteboardzone.com/uploads", filename);
    try {
      await fs.access(whiteboardzonePath);
      filePath = whiteboardzonePath;
      fileFound = true;
    } catch {
      fileFound = false;
    }
  }

  if (fileFound) {
    try {
      const fileBuffer = await fs.readFile(filePath);
      const ext = path.extname(filename).toLowerCase();
      const mimeTypes: Record<string, string> = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
        ".webp": "image/webp",
      };

      const contentType = mimeTypes[ext] || "application/octet-stream";

      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch (err) {
      console.error("Error reading local upload file:", err);
    }
  }

  // Fallback to fetching from main WhiteBoardZone host
  const remoteUrl = `${process.env.NEXT_PUBLIC_WHITEBOARDZONE_URL || "https://whiteboardzone.com"}/uploads/${filename}`;
  try {
    const res = await fetch(remoteUrl);
    if (res.ok) {
      const remoteBuffer = Buffer.from(await res.arrayBuffer());
      return new NextResponse(remoteBuffer, {
        status: 200,
        headers: {
          "Content-Type": res.headers.get("content-type") || "image/png",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }
  } catch (remoteErr) {
    console.warn("Could not fetch remote upload image:", remoteErr);
  }

  return new NextResponse("File not found", { status: 404 });
}
