import { NextResponse } from "next/server";
import { db, verifications } from "@/db";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const { phoneNumber, otp, name } = await req.json();

    if (!phoneNumber || !otp) {
      return NextResponse.json({ error: "Phone number and OTP code are required." }, { status: 400 });
    }

    const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, "");
    const cleanOtp = String(otp).trim();
    const identifier = `quiz_otp:${cleanPhone}`;

    const record = await db.query.verifications.findFirst({
      where: and(
        eq(verifications.identifier, identifier),
        eq(verifications.value, cleanOtp)
      ),
    });

    if (!record) {
      return NextResponse.json({ error: "Invalid verification code. Please check and try again." }, { status: 400 });
    }

    if (new Date(record.expiresAt).getTime() < Date.now()) {
      await db.delete(verifications).where(eq(verifications.id, record.id));
      return NextResponse.json({ error: "Verification code has expired. Please request a new one." }, { status: 400 });
    }

    // Delete used OTP
    await db.delete(verifications).where(eq(verifications.id, record.id));

    // Store verified phone status in tb_verifications (90 days)
    const verifiedIdentifier = `quiz_verified:${cleanPhone}`;
    await db.delete(verifications).where(eq(verifications.identifier, verifiedIdentifier));
    await db.insert(verifications).values({
      id: crypto.randomUUID(),
      identifier: verifiedIdentifier,
      value: name ? String(name).trim() : "verified",
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    });

    const studentName = name ? String(name).trim() : "";
    const sessionData = {
      name: studentName,
      phoneNumber: cleanPhone,
      verified: true,
      verifiedAt: Date.now(),
    };

    const response = NextResponse.json({
      success: true,
      message: "Phone number successfully verified!",
      verifiedPhone: cleanPhone,
      name: studentName,
      session: sessionData,
    });

    // Set persistent 90-day cookie so user skips verification in the future
    response.cookies.set("quiz_student_session", JSON.stringify(sessionData), {
      path: "/",
      maxAge: 90 * 24 * 60 * 60, // 90 days
      sameSite: "lax",
      httpOnly: false, // accessible client-side to prefill / restore session
    });

    return response;
  } catch (error) {
    console.error("Quiz OTP Verify Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
