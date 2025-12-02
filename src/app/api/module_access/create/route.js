import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request) {
    try {

        const { body } = await request.json();
        const moduleAccess = await prisma.module_access.create({
            data: body,
        });
        return NextResponse.json({ status: true, message: "Module access created successfully", data: moduleAccess });
    } catch (error) {
        return NextResponse.json(
            { status: false, message: "Internal server error" },
            { status: 500, error: error.message }
        );
    }
}