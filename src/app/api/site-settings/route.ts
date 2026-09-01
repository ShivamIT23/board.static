import { NextResponse } from "next/server";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const DEFAULT_MARQUEE_TEXT = "THIS IS A DEMO SESSION THAT'S WHY SOME FEATURES ARE DISABLED. FOR MORE DETAILS, CALL AT +91-7503663732";

export async function GET() {
  try {
    const record = await db.query.siteSettings.findFirst({
      where: eq(siteSettings.settingKey, "default"),
    });

    const data = {
      whatsappNumber: record?.whatsappNumber || "+91-7503663732",
      supportEmail: record?.supportEmail || "digital@tutorarc.com",
      marqueeText: record?.marqueeText || DEFAULT_MARQUEE_TEXT,
      contactPhone: record?.contactPhone || "+91-7503663732",
    };

    return NextResponse.json(data, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Error fetching site settings API in board:", error);
    return NextResponse.json(
      {
        whatsappNumber: "+91-7503663732",
        supportEmail: "digital@tutorarc.com",
        marqueeText: DEFAULT_MARQUEE_TEXT,
        contactPhone: "+91-7503663732",
      },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}
