import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
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
    const lotTab = await prisma.lot_tab.findUnique({
      where: { id },
    });
    return NextResponse.json(
      {
        status: true,
        message: "Lot tab notes fetched successfully",
        data: lotTab,
      },
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
    const { notes } = await request.json();
    const lotTab = await prisma.lot_tab.update({
      where: { id },
      data: { notes },
    });
    const logged = await withLogging(
      request,
      "lot_tab_notes",
      id,
      "UPDATE",
      `Lot tab notes updated successfully: ${lotTab.notes}`
    );
    if (!logged) {
      return NextResponse.json(
        { status: false, message: "Failed to log lot tab notes update" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      {
        status: true,
        message: "Lot tab notes updated successfully",
        data: lotTab,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}
