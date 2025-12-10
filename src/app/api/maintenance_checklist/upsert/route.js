import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";

export async function POST(request) {
    try {
        const authError = await validateAdminAuth(request);
        if (authError) return authError;
        const { lot_file_id, prepared_by_office, prepared_by_production, delivered_to_site, installed } = await request.json();
        const existingMaintenanceChecklist = await prisma.maintenance_checklist.findUnique({
            where: { lot_file_id },
        });

        const maintenance_checklist = await prisma.maintenance_checklist.upsert({
            where: { lot_file_id },
            update: { prepared_by_office, prepared_by_production, delivered_to_site, installed },
            create: { lot_file_id, prepared_by_office, prepared_by_production, delivered_to_site, installed },
        });
        const logged = await withLogging(
            request,
            "maintenance_checklist",
            maintenance_checklist.id,
            existingMaintenanceChecklist ? "UPDATE" : "CREATE",
            `Maintenance checklist upserted successfully: ${maintenance_checklist.id}`
        );
        if (!logged) {
            console.error(`Failed to log maintenance checklist upsert: ${maintenance_checklist.id}`);
            return NextResponse.json({ status: false, message: "Internal server error" }, { status: 500 });
        }
        return NextResponse.json({ status: true, message: "Maintenance checklist upserted successfully", data: maintenance_checklist }, { status: 201 });
    } catch (error) {
        console.error("Error in POST /api/maintenance_checklist/upsert:", error);
        return NextResponse.json({ status: false, message: "Internal server error" }, { status: 500 });
    }
}