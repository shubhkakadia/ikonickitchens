import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
import { normalizeClientSlug, isValidClientSlug } from "@/lib/clientSlug";

export async function GET(request) {
  const authError = await validateAdminAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const slug = normalizeClientSlug(searchParams.get("slug"));
  const excludeId = searchParams.get("excludeId");

  if (!isValidClientSlug(slug)) {
    return NextResponse.json({
      status: true,
      available: false,
      message: "Slug must be exactly 4 letters",
    });
  }

  const existing = await prisma.client.findFirst({
    where: {
      client_slug: slug,
      ...(excludeId ? { NOT: { client_id: excludeId } } : {}),
    },
    select: { client_id: true },
  });

  return NextResponse.json({ status: true, available: !existing });
}
