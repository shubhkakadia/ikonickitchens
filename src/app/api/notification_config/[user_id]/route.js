import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  validateAdminAuth,
  getUserFromToken,
} from "@/lib/validators/authFromToken";

// Helper function to check if user is admin/master-admin or accessing their own config
async function canAccessNotificationConfig(request, userId) {
  const session = await getUserFromToken(request);
  if (!session) return false;
  const userType = session.user_type?.toLowerCase();
  if (userType === "admin" || userType === "master-admin") return true;
  return String(session.user_id) === String(userId);
}

export async function GET(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    const { user_id } = await params;

    // Additional check: Only admin/master-admin or the user can access notification config
    if (!(await canAccessNotificationConfig(request, user_id))) {
      return NextResponse.json(
        {
          status: false,
          message:
            "Access denied. You can only access your own notification settings.",
        },
        { status: 403 },
      );
    }

    // Get notification config for the user, or create default if it doesn't exist
    let notificationConfig = await prisma.notification_config.findUnique({
      where: { user_id: user_id },
    });

    // If config doesn't exist, create a default one
    if (!notificationConfig) {
      notificationConfig = await prisma.notification_config.create({
        data: {
          user_id: user_id,
          meeting: false,
          material_to_order: false,
          material_to_order_ordered: false,
          assign_installer: false,
          stage_quote_approve: false,
          stage_material_appliances_selection: false,
          stage_drafting: false,
          stage_drafting_revision: false,
          stage_final_design_approval: false,
          stage_site_measurements: false,
          stage_final_approval_for_production: false,
          stage_machining_out: false,
          stage_material_order: false,
          stage_cnc: false,
          stage_assembly: false,
          stage_delivery: false,
          stage_installation: false,
          stage_invoice_sent: false,
          stage_maintenance: false,
          stage_job_completion: false,
          stock_transactions: false,
          supplier_statements: false,
        },
      });
    }

    return NextResponse.json(
      {
        status: true,
        message: "Notification config fetched successfully",
        data: notificationConfig,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in GET /api/notification_config/[user_id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    const { user_id } = await params;

    // Additional check: Only admin/master-admin or the user can update notification config
    if (!(await canAccessNotificationConfig(request, user_id))) {
      return NextResponse.json(
        {
          status: false,
          message:
            "Access denied. You can only update your own notification settings.",
        },
        { status: 403 },
      );
    }
    const body = await request.json();

    const {
      meeting,
      material_to_order,
      material_to_order_ordered,
      assign_installer,
      stage_quote_approve,
      stage_material_appliances_selection,
      stage_drafting,
      stage_drafting_revision,
      stage_final_design_approval,
      stage_site_measurements,
      stage_final_approval_for_production,
      stage_machining_out,
      stage_material_order,
      stage_cnc,
      stage_assembly,
      stage_delivery,
      stage_installation,
      stage_invoice_sent,
      stage_maintenance,
      stage_job_completion,
      stock_transactions,
      supplier_statements,
    } = body;

    // Get existing config to preserve values that aren't being updated
    const existingConfig = await prisma.notification_config.findUnique({
      where: { user_id: user_id },
    });

    // Use upsert to create or update the notification config
    const notificationConfig = await prisma.notification_config.upsert({
      where: { user_id: user_id },
      update: {
        meeting:
          meeting !== undefined ? meeting : (existingConfig?.meeting ?? false),
        material_to_order:
          material_to_order !== undefined
            ? material_to_order
            : (existingConfig?.material_to_order ?? false),
        material_to_order_ordered:
          material_to_order_ordered !== undefined
            ? material_to_order_ordered
            : (existingConfig?.material_to_order_ordered ?? false),
        assign_installer:
          assign_installer !== undefined
            ? assign_installer
            : (existingConfig?.assign_installer ?? false),
        stage_quote_approve:
          stage_quote_approve !== undefined
            ? stage_quote_approve
            : (existingConfig?.stage_quote_approve ?? false),
        stage_material_appliances_selection:
          stage_material_appliances_selection !== undefined
            ? stage_material_appliances_selection
            : (existingConfig?.stage_material_appliances_selection ?? false),
        stage_drafting:
          stage_drafting !== undefined
            ? stage_drafting
            : (existingConfig?.stage_drafting ?? false),
        stage_drafting_revision:
          stage_drafting_revision !== undefined
            ? stage_drafting_revision
            : (existingConfig?.stage_drafting_revision ?? false),
        stage_final_design_approval:
          stage_final_design_approval !== undefined
            ? stage_final_design_approval
            : (existingConfig?.stage_final_design_approval ?? false),
        stage_site_measurements:
          stage_site_measurements !== undefined
            ? stage_site_measurements
            : (existingConfig?.stage_site_measurements ?? false),
        stage_final_approval_for_production:
          stage_final_approval_for_production !== undefined
            ? stage_final_approval_for_production
            : (existingConfig?.stage_final_approval_for_production ?? false),
        stage_machining_out:
          stage_machining_out !== undefined
            ? stage_machining_out
            : (existingConfig?.stage_machining_out ?? false),
        stage_material_order:
          stage_material_order !== undefined
            ? stage_material_order
            : (existingConfig?.stage_material_order ?? false),
        stage_cnc:
          stage_cnc !== undefined
            ? stage_cnc
            : (existingConfig?.stage_cnc ?? false),
        stage_assembly:
          stage_assembly !== undefined
            ? stage_assembly
            : (existingConfig?.stage_assembly ?? false),
        stage_delivery:
          stage_delivery !== undefined
            ? stage_delivery
            : (existingConfig?.stage_delivery ?? false),
        stage_installation:
          stage_installation !== undefined
            ? stage_installation
            : (existingConfig?.stage_installation ?? false),
        stage_invoice_sent:
          stage_invoice_sent !== undefined
            ? stage_invoice_sent
            : (existingConfig?.stage_invoice_sent ?? false),
        stage_maintenance:
          stage_maintenance !== undefined
            ? stage_maintenance
            : (existingConfig?.stage_maintenance ?? false),
        stage_job_completion:
          stage_job_completion !== undefined
            ? stage_job_completion
            : (existingConfig?.stage_job_completion ?? false),
        stock_transactions:
          stock_transactions !== undefined
            ? stock_transactions
            : (existingConfig?.stock_transactions ?? false),
        supplier_statements:
          supplier_statements !== undefined
            ? supplier_statements
            : (existingConfig?.supplier_statements ?? false),
      },
      create: {
        user_id: user_id,
        meeting: meeting !== undefined ? meeting : false,
        material_to_order:
          material_to_order !== undefined ? material_to_order : false,
        material_to_order_ordered:
          material_to_order_ordered !== undefined
            ? material_to_order_ordered
            : false,
        assign_installer:
          assign_installer !== undefined ? assign_installer : false,
        stage_quote_approve:
          stage_quote_approve !== undefined ? stage_quote_approve : false,
        stage_material_appliances_selection:
          stage_material_appliances_selection !== undefined
            ? stage_material_appliances_selection
            : false,
        stage_drafting: stage_drafting !== undefined ? stage_drafting : false,
        stage_drafting_revision:
          stage_drafting_revision !== undefined
            ? stage_drafting_revision
            : false,
        stage_final_design_approval:
          stage_final_design_approval !== undefined
            ? stage_final_design_approval
            : false,
        stage_site_measurements:
          stage_site_measurements !== undefined
            ? stage_site_measurements
            : false,
        stage_final_approval_for_production:
          stage_final_approval_for_production !== undefined
            ? stage_final_approval_for_production
            : false,
        stage_machining_out:
          stage_machining_out !== undefined ? stage_machining_out : false,
        stage_material_order:
          stage_material_order !== undefined ? stage_material_order : false,
        stage_cnc: stage_cnc !== undefined ? stage_cnc : false,
        stage_assembly: stage_assembly !== undefined ? stage_assembly : false,
        stage_delivery: stage_delivery !== undefined ? stage_delivery : false,
        stage_installation:
          stage_installation !== undefined ? stage_installation : false,
        stage_invoice_sent:
          stage_invoice_sent !== undefined ? stage_invoice_sent : false,
        stage_maintenance:
          stage_maintenance !== undefined ? stage_maintenance : false,
        stage_job_completion:
          stage_job_completion !== undefined ? stage_job_completion : false,
        stock_transactions:
          stock_transactions !== undefined ? stock_transactions : false,
        supplier_statements:
          supplier_statements !== undefined ? supplier_statements : false,
      },
    });

    return NextResponse.json(
      {
        status: true,
        message: "Notification config updated successfully",
        data: notificationConfig,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in PATCH /api/notification_config/[user_id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal Server Error" },
      { status: 500 },
    );
  }
}
