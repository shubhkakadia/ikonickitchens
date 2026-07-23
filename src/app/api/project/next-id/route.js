import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
import { formatProjectId, getNextProjectSequence } from "@/lib/projectId";

export async function GET(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const clientId = new URL(request.url).searchParams.get("client_id");
    if (!clientId)
      return NextResponse.json(
        { status: false, message: "Client is required" },
        { status: 400 },
      );

    const client = await prisma.client.findFirst({
      where: { client_id: clientId, is_deleted: false },
      select: { client_slug: true },
    });
    if (!client)
      return NextResponse.json(
        { status: false, message: "Client not found" },
        { status: 404 },
      );
    if (!/^[A-Z]{4}$/.test(String(client.client_slug || "").toUpperCase()))
      return NextResponse.json(
        { status: false, message: "Client has an invalid slug" },
        { status: 409 },
      );

    const prefix = `IKC-${client.client_slug}-`;
    const projects = await prisma.project.findMany({
      where: { project_id: { startsWith: prefix } },
      select: { project_id: true },
    });
    const sequence = getNextProjectSequence(
      projects.map(({ project_id }) => project_id),
      client.client_slug,
    );
    if (!sequence)
      return NextResponse.json(
        {
          status: false,
          message: "Project ID sequence limit reached for this client",
        },
        { status: 409 },
      );
    return NextResponse.json({
      status: true,
      data: {
        project_id: formatProjectId(client.client_slug, sequence),
        sequence,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/project/next-id:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
