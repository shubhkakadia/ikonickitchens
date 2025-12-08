import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  isAdmin,
  isSessionExpired,
  processDateTimeField,
} from "../../../../../lib/validators/authFromToken";
import { withLogging } from "../../../../../lib/withLogging";

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
        const lotFile = await prisma.lot_file.update({
            where: { id },
            data: { notes },
        });
        const logged = await withLogging(
            request,
            "lot_file",
            id,
            "UPDATE",
            `Lot file updated successfully: ${lotFile.notes}`
        );
        if (!logged) {
            return NextResponse.json(
                { status: false, message: "Failed to log lot file update" },
                { status: 500 }
            );
        }
        return NextResponse.json(
            { status: true, message: "Lot file updated successfully", data: lotFile },
            { status: 200 }
        );
    }
    catch (error) {
        return NextResponse.json(
            { status: false, message: "Internal server error", error: error.message },
            { status: 500 }
        );
    }
}