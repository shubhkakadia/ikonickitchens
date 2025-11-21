import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  isAdmin,
  isSessionExpired,
} from "../../../../../lib/validators/authFromToken";
import { withLogging } from "../../../../../lib/withLogging";

export async function GET(request, { params }) {
  try {
    const admin = await isAdmin(request);
    if (!admin) {
      return NextResponse.json(
        { status: false, message: "Unauthorized" },
        { status: 401 }
      );
    }
    if (await isSessionExpired(request)) {
      return NextResponse.json(
        { status: false, message: "Session expired" },
        { status: 401 }
      );
    }
    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { project_id: id },
      include: {
        client: true,
        lots: true,
        materials_to_order: {
          include: {
            lots: {
              include: {
                project: true,
              },
            },
            items: {
              include: {
                item: {
                  include: {
                    sheet: true,
                    handle: true,
                    hardware: true,
                    accessory: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    return NextResponse.json(
      { status: true, message: "Project fetched successfully", data: project },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const admin = await isAdmin(request);
    if (!admin) {
      return NextResponse.json(
        { status: false, message: "Unauthorized" },
        { status: 401 }
      );
    }
    if (await isSessionExpired(request)) {
      return NextResponse.json(
        { status: false, message: "Session expired" },
        { status: 401 }
      );
    }
    const { id } = await params;
    const project = await prisma.project.delete({
      where: { project_id: id },
    });
    const logged = await withLogging(
      request,
      "project",
      id,
      "DELETE",
      `Project deleted successfully: ${project.name}`
    );
    if (!logged) {
      return NextResponse.json(
        { status: false, message: "Failed to log project deletion" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { status: true, message: "Project deleted successfully", data: project },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const admin = await isAdmin(request);
    if (!admin) {
      return NextResponse.json(
        { status: false, message: "Unauthorized" },
        { status: 401 }
      );
    }
    if (await isSessionExpired(request)) {
      return NextResponse.json(
        { status: false, message: "Session expired" },
        { status: 401 }
      );
    }
    const { id } = await params;
    const { name, client_id } = await request.json();

    // Build update data object with only provided fields
    const updateData = {};

    if (name !== undefined) {
      updateData.name = name;
    }

    if (client_id !== undefined) {
      updateData.client_id = client_id ? client_id.toLowerCase() : null;
    }

    const project = await prisma.project.update({
      where: { project_id: id },
      data: updateData,
    });
    const logged = await withLogging(
      request,
      "project",
      id,
      "UPDATE",
      `Project updated successfully: ${project.name}`
    );
    if (!logged) {
      return NextResponse.json(
        { status: false, message: "Failed to log project update" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { status: true, message: "Project updated successfully", data: project },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}
