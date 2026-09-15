import { NextResponse } from "next/server";
import { db } from "@/db";
import { testimonials } from "@/db/schema";
import { eq, asc, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const list = await db
      .select()
      .from(testimonials)
      .where(eq(testimonials.status, 1))
      .orderBy(asc(testimonials.displayOrder), desc(testimonials.createdAt));

    return NextResponse.json(list, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Error fetching testimonials in board API:", error);
    return NextResponse.json([], {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}
