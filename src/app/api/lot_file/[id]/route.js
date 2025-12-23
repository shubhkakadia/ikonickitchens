import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
    validateAdminAuth,
} from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";

export async function PATCH(request, { params }) {
    try {
        const authError = await validateAdminAuth(request);
        if (authError) return authError;
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
            console.error(`Failed to log lot file update: ${id}`);
        }
        return NextResponse.json(
            {
                status: true,
                message: "Lot file updated successfully",
                data: lotFile,
                ...(logged ? {} : { warning: "Note: Update succeeded but logging failed" })
            },
            { status: 200 }
        );
    }
    catch (error) {
        console.error("Error in PATCH /api/lot_file/[id]:", error);
        return NextResponse.json(
            { status: false, message: "Internal server error" },
            { status: 500 }
        );
    }
}