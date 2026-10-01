import { processDateTimeField } from "@/lib/validators/authFromToken";

const toDate = (value) =>
  value && String(value).trim() !== "" ? processDateTimeField(value) : null;

// Returns the other (non-deleted) lots of the lot's project when the project
// has `sync_all_lots` switched on, otherwise an empty array.
export async function getSyncTargets(tx, lotId) {
  const lot = await tx.lot.findUnique({
    where: { lot_id: lotId },
    select: {
      project: { select: { project_id: true, sync_all_lots: true } },
    },
  });
  if (!lot?.project?.sync_all_lots) return [];

  return tx.lot.findMany({
    where: {
      project_id: lot.project.project_id,
      is_deleted: false,
      lot_id: { not: lotId },
    },
    select: { lot_id: true, name: true, startDate: true, installationDueDate: true },
  });
}

// Same rule the stage routes apply to the lot being edited: scheduling a stage
// needs both lot dates and the stage must sit inside them.
function datesFitLot(lot, startDate, endDate) {
  if (!startDate && !endDate) return true;
  if (!lot.startDate || !lot.installationDueDate) return false;
  if (startDate && startDate < lot.startDate) return false;
  if (endDate && endDate > lot.installationDueDate) return false;
  return true;
}

// Mirrors a stage onto every sibling lot: updates the stage with `matchName`
// or creates it when the lot has none. Lots whose date range cannot hold the
// stage dates are skipped and reported rather than failing the request.
export async function syncStageUpsert(
  tx,
  { siblings, matchName, name, status, notes, startDate, endDate, assigned_to },
) {
  const start = toDate(startDate);
  const end = toDate(endDate);
  const syncedLots = [];
  const skippedLots = [];

  for (const sibling of siblings) {
    if (!datesFitLot(sibling, start, end)) {
      skippedLots.push(sibling.lot_id);
      continue;
    }

    const existing = await tx.stage.findFirst({
      where: { lot_id: sibling.lot_id, name: matchName },
      select: { stage_id: true },
    });

    const data = {
      name: name ? name.toLowerCase() : matchName,
      status,
      notes,
      startDate: start,
      endDate: end,
    };

    let stageId;
    if (existing) {
      stageId = existing.stage_id;
      await tx.stage.update({ where: { stage_id: stageId }, data });
      await tx.stage_employee.deleteMany({ where: { stage_id: stageId } });
    } else {
      const created = await tx.stage.create({
        data: { ...data, lot_id: sibling.lot_id },
      });
      stageId = created.stage_id;
    }

    if (assigned_to && assigned_to.length > 0) {
      await tx.stage_employee.createMany({
        data: assigned_to.map((employee_id) => ({
          stage_id: stageId,
          employee_id,
        })),
        skipDuplicates: true,
      });
    }
    syncedLots.push(sibling.lot_id);
  }

  return { syncedLots, skippedLots };
}

// Removes the same-named stage from every sibling lot. Assignments go with it
// through the stage_employee cascade.
export async function syncStageDelete(tx, { siblings, name }) {
  if (siblings.length === 0) return { syncedLots: [], skippedLots: [] };
  await tx.stage.deleteMany({
    where: { lot_id: { in: siblings.map((s) => s.lot_id) }, name },
  });
  return { syncedLots: siblings.map((s) => s.lot_id), skippedLots: [] };
}
