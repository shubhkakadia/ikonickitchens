import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  requireAuth,
  processDateTimeField,
} from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";
import { sendNotification } from "@/lib/notification";
import { sendProjectUpdate } from "@/lib/pushNotifications";
import { getUserFromToken } from "@/lib/validators/authFromToken";
import {
  getSyncTargets,
  syncStageUpsert,
  syncStageDelete,
} from "@/lib/stageSync";
import { publishUpdate, lotUrl } from "@/lib/updates";

const titleCaseStage = (name) =>
  String(name || "stage").replace(/\b\w/g, (c) => c.toUpperCase());

const statusLabel = (status) => String(status).replace(/_/g, " ").toLowerCase();
const timeOf = (date) => (date ? new Date(date).getTime() : null);

function describeStageChanges(before, after) {
  const changes = [];
  if (before.status !== after.status) {
    changes.push(
      `status ${statusLabel(before.status)} → ${statusLabel(after.status)}`,
    );
  }
  if (before.name !== after.name) changes.push("renamed");
  if (
    timeOf(before.startDate) !== timeOf(after.startDate) ||
    timeOf(before.endDate) !== timeOf(after.endDate)
  ) {
    changes.push("dates changed");
  }
  if ((before.notes || "") !== (after.notes || ""))
    changes.push("notes changed");
  const ids = (rows) =>
    (rows || [])
      .map((row) => row.employee_id)
      .sort()
      .join(",");
  if (ids(before.assigned_to) !== ids(after.assigned_to)) {
    changes.push("assignees changed");
  }
  return changes;
}

export async function PATCH(request, { params }) {
  try {
    const authError = await requireAuth(request, {
      modules: ["project_details", "lotatglance", "site_measurements"],
    });
    if (authError) return authError;
    const { id } = await params;
    const { name, status, notes, startDate, endDate, assigned_to } =
      await request.json();

    const existingStage = await prisma.stage.findUnique({
      where: { stage_id: id },
      include: {
        lot: {
          select: { startDate: true, installationDueDate: true },
        },
      },
    });

    if (!existingStage) {
      return NextResponse.json(
        { status: false, message: "Stage not found" },
        { status: 404 },
      );
    }

    // Assignees before the update (the transaction replaces them), so the
    // feed can tell whether they changed
    const previousAssignees = await prisma.stage_employee.findMany({
      where: { stage_id: id },
      select: { employee_id: true },
    });

    const stageStartDate = startDate ? new Date(startDate) : null;
    const stageEndDate = endDate ? new Date(endDate) : null;
    if (stageStartDate || stageEndDate) {
      if (
        !existingStage.lot.startDate ||
        !existingStage.lot.installationDueDate
      ) {
        return NextResponse.json(
          {
            status: false,
            message:
              "Set the parent lot start and installation due dates before scheduling a stage",
          },
          { status: 400 },
        );
      }
      if (
        (stageStartDate && stageStartDate < existingStage.lot.startDate) ||
        (stageEndDate && stageEndDate > existingStage.lot.installationDueDate)
      ) {
        return NextResponse.json(
          {
            status: false,
            message: "Stage dates must stay within the parent lot date range",
          },
          { status: 400 },
        );
      }
    }

    // Use transaction to ensure atomicity - all operations succeed or all fail
    let syncResult = null;
    const stage = await prisma.$transaction(async (tx) => {
      // Update the stage basic information
      const updatedStage = await tx.stage.update({
        where: { stage_id: id },
        data: {
          name: name ? name.toLowerCase() : undefined,
          status,
          notes,
          startDate:
            startDate && startDate.trim() !== ""
              ? processDateTimeField(startDate)
              : null,
          endDate:
            endDate && endDate.trim() !== ""
              ? processDateTimeField(endDate)
              : null,
        },
      });

      // Handle employee assignments: delete all existing, then create new ones
      // First, delete all existing assignments for this stage
      await tx.stage_employee.deleteMany({
        where: { stage_id: id },
      });

      // Then create new assignments if any
      // If this fails, the entire transaction (including stage update and delete) will roll back
      if (assigned_to && assigned_to.length > 0) {
        await tx.stage_employee.createMany({
          data: assigned_to.map((employee_id) => ({
            stage_id: id,
            employee_id: employee_id,
          })),
          skipDuplicates: true, // Safety check, though should be unnecessary after delete
        });
      }

      // Mirror onto the other lots when the project has sync_all_lots enabled.
      // Siblings are matched by the stage's previous name so renames propagate.
      const siblings = await getSyncTargets(tx, existingStage.lot_id);
      if (siblings.length > 0) {
        syncResult = await syncStageUpsert(tx, {
          siblings,
          matchName: existingStage.name,
          name,
          // Use the stored result so a partial update (e.g. notes only) still
          // gives newly created sibling stages a valid status
          status: updatedStage.status,
          notes: updatedStage.notes,
          startDate,
          endDate,
          assigned_to,
        });
      }

      return updatedStage;
    });

    // Fetch the updated stage with all relationships
    const updatedStage = await prisma.stage.findUnique({
      where: { stage_id: id },
      include: {
        lot: {
          include: {
            project: {
              include: {
                client: {
                  select: {
                    client_name: true,
                  },
                },
              },
            },
          },
        },
        assigned_to: {
          include: {
            employee: {
              select: {
                first_name: true,
                last_name: true,
              },
            },
          },
        },
      },
    });

    const logged = await withLogging(
      request,
      "stage",
      id,
      "UPDATE",
      `Stage updated successfully: ${updatedStage.name} for lot: ${updatedStage.lot_id} and project: ${updatedStage.lot?.project?.name}${
        syncResult
          ? ` (synced to ${syncResult.syncedLots.length} other lot(s))`
          : ""
      }`,
    );

    // Feed entry, only when something actually changed (the lot-at-a-glance
    // drag and the stage table can save repeatedly without changes)
    const changes = describeStageChanges(
      { ...existingStage, assigned_to: previousAssignees },
      updatedStage,
    );
    if (changes.length) {
      const stageLabel = titleCaseStage(updatedStage.name);
      await publishUpdate({
        req: request,
        type: "STAGE_UPDATED",
        title: "Stage updated",
        message: `${stageLabel}: ${changes.join(", ")} (${updatedStage.lot?.name || updatedStage.lot_id}, ${updatedStage.lot?.project?.name || "project"})`,
        url: lotUrl(updatedStage.lot?.project_id, updatedStage.lot_id),
        dedupeKey: `stage:${id}`,
        windowMinutes: 5,
      });
    }

    // Send notification if stage is completed
    if (updatedStage.status === "DONE") {
      try {
        await sendNotification(
          {
            type: "stage",
            stage_id: id,
            lot_id: updatedStage.lot_id,
            stage_name: updatedStage.name,
            status: updatedStage.status,
            project_name: updatedStage.lot?.project?.name || "Unknown Project",
            client_name:
              updatedStage.lot?.project?.client?.client_name ||
              "Unknown Client",
          },
          "stage_completed",
        );
      } catch (notificationError) {
        console.error(
          "Failed to send stage completion notification:",
          notificationError,
        );
        // Don't fail the request if notification fails
      }
    }

    try {
      const session = await getUserFromToken(request);
      await sendProjectUpdate({
        lotId: updatedStage.lot_id,
        actorUserId: session?.user_id,
      });
    } catch (pushError) {
      console.error(
        "Failed to send project update push notification:",
        pushError,
      );
      // The stage update must not fail when the push provider is unavailable.
    }

    if (!logged) {
      console.error(`Failed to log stage update: ${id} - ${updatedStage.name}`);
    }
    return NextResponse.json(
      {
        status: true,
        message: "Stage updated successfully",
        data: updatedStage,
        ...(syncResult ? { sync: syncResult } : {}),
        ...(logged
          ? {}
          : { warning: "Note: Update succeeded but logging failed" }),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in PATCH /api/v1/stage/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const authError = await requireAuth(request, {
      modules: ["project_details"],
    });
    if (authError) return authError;
    const { id } = await params;
    let syncResult = null;
    const stage = await prisma.$transaction(async (tx) => {
      const deleted = await tx.stage.delete({
        where: { stage_id: id },
        include: {
          lot: {
            select: {
              project: { select: { project_id: true, name: true } },
            },
          },
        },
      });

      // Mirror the delete onto the other lots when sync_all_lots is enabled
      const siblings = await getSyncTargets(tx, deleted.lot_id);
      if (siblings.length > 0) {
        syncResult = await syncStageDelete(tx, {
          siblings,
          name: deleted.name,
        });
      }
      return deleted;
    });
    const logged = await withLogging(
      request,
      "stage",
      id,
      "DELETE",
      `Stage deleted successfully: ${stage.name} for lot: ${stage.lot_id} and project: ${stage.lot?.project?.name}${
        syncResult
          ? ` (also removed from ${syncResult.syncedLots.length} other lot(s))`
          : ""
      }`,
    );
    if (!logged) {
      console.error(`Failed to log stage deletion: ${id} - ${stage.name}`);
      return NextResponse.json(
        {
          status: true,
          message: "Stage deleted successfully",
          data: stage,
          ...(syncResult ? { sync: syncResult } : {}),
          warning: "Note: Deletion succeeded but logging failed",
        },
        { status: 200 },
      );
    }
    return NextResponse.json(
      {
        status: true,
        message: "Stage deleted successfully",
        data: stage,
        ...(syncResult ? { sync: syncResult } : {}),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in DELETE /api/v1/stage/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
