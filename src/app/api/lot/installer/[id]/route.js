import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/validators/authFromToken";

export async function GET(request, { params }) {
    try {
        const authError = await validateAdminAuth(request);
        if (authError) return authError;
        const { id } = await params;

        if (!id) {
            return NextResponse.json(
                { status: false, message: "id is required" },
                { status: 400 }
            );
        }
        const activeLots = await prisma.lot.findMany({
            where: {
                status: "ACTIVE",
                is_deleted: false,
                installer_id: id,
            },
            include: {
                project: {
                    select: {
                        name: true,
                        project_id: true,
                    },
                },
            },
            orderBy: {
                project: {
                    name: "asc",
                },
            },
        });

        return NextResponse.json(
            {
                status: true,
                message: "Installer lots fetched successfully",
                data: activeLots,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error in GET /api/lot/installer:", error);
        return NextResponse.json(
            { status: false, message: "Internal server error" },
            { status: 500 }
        );
    }
}
