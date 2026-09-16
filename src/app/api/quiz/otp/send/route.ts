import { NextResponse } from "next/server";
import { db, sharedQuizzes, verifications } from "@/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

// WebTech SMS Gateway helper using DLT approved template
async function sendSmsViaWebTech({
  mobile,
  code,
  senderId = "TUTARC",
}: {
  mobile: string;
  code: string;
  senderId?: string;
}): Promise<{ success: boolean; response: string }> {
  // Extract 10-digit mobile number for Indian SMS gateways
  const cleanMobile = mobile.replace(/\D/g, "").slice(-10);

  // Template: "{#var#} is your OTP for {#var#} at {#var#} - {#var#}"
  const message = `${code} is your OTP for Quiz Verification at WhiteboardZone - WHITEBOARDZONE`;

  const postData = new URLSearchParams({
    "authentic-key": "353353686976616e616e643530301604145245",
    "senderid": senderId,
    "route": "1",
    "number": cleanMobile,
    "message": message,
    "templateid": "1207161892216614998",
  });

  try {
    const res = await fetch("http://smpp.webtechsolution.co/http-tokenkeyapi.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: postData.toString(),
    });

    const responseText = await res.text();
    console.log(`[SMS OTP] Gateway response for ${cleanMobile}:`, responseText);
    const isSuccess = res.ok && (responseText.includes("msg-id") || responseText.includes("success") || responseText.includes("Sent"));
    return { success: isSuccess, response: responseText };
  } catch (err) {
    console.error(`[SMS OTP] Gateway request failed for ${cleanMobile}:`, err);
    return { success: false, response: String(err) };
  }
}

export async function POST(req: Request) {
  try {
    const { shareToken, phoneNumber } = await req.json();

    if (!phoneNumber || typeof phoneNumber !== "string") {
      return NextResponse.json({ error: "Phone number is required." }, { status: 400 });
    }

    // Clean phone number: remove spaces, dashes, brackets
    const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, "");
    const digitsOnly = cleanPhone.replace(/\D/g, "");
    if (digitsOnly.length < 10) {
      return NextResponse.json({ error: "Please enter a valid 10-digit phone number." }, { status: 400 });
    }

    // Validate quiz if shareToken is provided
    if (shareToken) {
      const quiz = await db.query.sharedQuizzes.findFirst({
        where: eq(sharedQuizzes.shareToken, shareToken),
      });

      if (!quiz) {
        return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
      }

      const now = new Date();
      if (new Date(quiz.expiresAt).getTime() < now.getTime()) {
        return NextResponse.json({ error: "This quiz has expired." }, { status: 403 });
      }
      if (quiz.isActive === 0) {
        return NextResponse.json({ error: "This quiz is currently inactive." }, { status: 403 });
      }
    }

    // Generate secure 6-digit numeric OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const identifier = `quiz_otp:${cleanPhone}`;

    // Delete any existing OTP for this phone
    await db.delete(verifications).where(eq(verifications.identifier, identifier));

    // Store in tb_verifications with 10-minute validity
    await db.insert(verifications).values({
      id: crypto.randomUUID(),
      identifier,
      value: code,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    console.log(`[Quiz OTP] Code ${code} generated for ${cleanPhone}`);

    // Dispatch SMS via WebTech SMPP gateway
    const smsResult = await sendSmsViaWebTech({
      mobile: cleanPhone,
      code,
      senderId: process.env.SMS_SENDER_ID || "DIJTAL",
    });

    const sentViaSms = smsResult.success;

    // Optional WhatsApp Cloud API delivery as backup if configured
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    const token = process.env.WHATSAPP_TOKEN;
    let sentViaWhatsApp = false;

    if (phoneId && token) {
      try {
        const formattedTo = cleanPhone.startsWith("+") ? cleanPhone.slice(1) : cleanPhone;
        const waUrl = `https://graph.facebook.com/v22.0/${phoneId}/messages`;

        const waRes = await fetch(waUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: formattedTo,
            type: "text",
            text: {
              body: `Your WhiteboardZone Quiz Verification Code is ${code}. Valid for 10 minutes. Do not share this code.`,
            },
          }),
        });

        if (waRes.ok) {
          sentViaWhatsApp = true;
          console.log(`[Quiz OTP] Sent via WhatsApp to ${cleanPhone}`);
        }
      } catch (waErr) {
        console.warn("[Quiz OTP] WhatsApp delivery backup failed:", waErr);
      }
    }

    if (!sentViaSms && !sentViaWhatsApp) {
      console.error(`[Quiz OTP] Failed to send SMS or WhatsApp to ${cleanPhone}`);
      return NextResponse.json(
        { error: "Unable to dispatch verification SMS. Please verify your phone number and try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `OTP successfully sent to ${cleanPhone} via SMS.`,
      phoneNumber: cleanPhone,
    });
  } catch (error) {
    console.error("Quiz OTP Send Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
