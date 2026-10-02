import { prisma } from "@/lib/db";
import { getUserFromToken, hasModule } from "@/lib/validators/authFromToken";

// Each update type is visible to users holding at least one of `modules`.
// These are the page-gating flags from ProtectedRoute's siteMap, so a
// recipient can always open the link they receive.
export const UPDATE_TYPE_CONFIG = {
  CALENDAR_EVENT_CREATED: {
    label: "Calendar event created",
    modules: ["calendar"],
  },
  CALENDAR_EVENT_UPDATED: {
    label: "Calendar event updated",
    modules: ["calendar"],
  },
  PROJECT_CREATED: { label: "Project created", modules: ["project_details"] },
  PROJECT_UPDATED: { label: "Project updated", modules: ["project_details"] },
  STAGE_UPDATED: {
    label: "Stage updated",
    modules: ["project_details", "lotatglance"],
  },
  LOT_NOTES_UPDATED: {
    label: "Lot notes updated",
    modules: ["project_details"],
  },
  LOT_FILE_UPLOADED: {
    label: "Lot file uploaded",
    modules: ["project_details"],
  },
  MTO_CREATED: {
    label: "Materials to order created",
    modules: ["materialstoorder"],
  },
  MTO_ORDERED: { label: "Materials ordered", modules: ["materialstoorder"] },
  SUPPLIER_STATEMENT_ADDED: {
    label: "Supplier statement added",
    modules: ["statements"],
  },
};

export const UPDATE_TYPES = Object.keys(UPDATE_TYPE_CONFIG);

// TabKind enum -> the tab ids used by /admin/projects/[id] (see
// src/components/constants.jsx). The three site-photo kinds are subtabs.
const SITE_PHOTO_SUBTABS = {
  DELIVERY_PHOTOS: "delivery",
  INSTALLATION_PHOTOS: "installation",
  MAINTENANCE_PHOTOS: "maintenance",
};

export const TAB_KIND_LABELS = {
  ARCHITECTURE_DRAWINGS: "Architecture Drawings",
  APPLIANCES_SPECIFICATIONS: "Appliances and Specifications",
  MATERIAL_SELECTION: "Material Selection",
  CABINETRY_DRAWINGS: "Cabinetry Drawings",
  CHANGES_TO_DO: "Changes to Do",
  SITE_MEASUREMENTS: "Site Measurements",
  DELIVERY_PHOTOS: "Delivery Photos",
  INSTALLATION_PHOTOS: "Installation Photos",
  MAINTENANCE_PHOTOS: "Maintenance Photos",
  FINISHED_SITE_PHOTOS: "Finished Site Photos",
};

// Deep link to a lot (and optionally a tab) on the project page
export function lotUrl(projectId, lotId, tabKind) {
  const base = `/admin/projects/${String(projectId).toLowerCase()}?lot=${encodeURIComponent(lotId)}`;
  if (!tabKind) return `${base}&tab=overview`;
  const sub = SITE_PHOTO_SUBTABS[tabKind];
  if (sub) return `${base}&tab=site_photos&sub=${sub}`;
  return `${base}&tab=${String(tabKind).toLowerCase()}`;
}

// The business runs on Adelaide time (see the meeting routes)
export function formatAdelaide(date) {
  const parsed = new Date(date);
  if (!date || Number.isNaN(parsed.getTime())) return "an unknown time";
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Adelaide",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

// Update types the signed-in user may currently see. Applied at read time as
// well as at write time, so revoking a module hides old updates immediately.
export function allowedTypesFor(auth) {
  return UPDATE_TYPES.filter((type) =>
    UPDATE_TYPE_CONFIG[type].modules.some((flag) => hasModule(auth, flag)),
  );
}

function recipientWhere(type, actorId) {
  const flags = UPDATE_TYPE_CONFIG[type].modules;
  return {
    is_active: true,
    ...(actorId ? { id: { not: actorId } } : {}),
    // "employee" accounts only use site photos, never the admin feed
    user_type: { not: "employee" },
    OR: [
      { user_type: "master-admin" },
      {
        module_access: { is: { OR: flags.map((flag) => ({ [flag]: true })) } },
      },
    ],
  };
}

/**
 * Publishes an update to every user whose module access allows `type`
 * (the actor is excluded). Never throws: a feed failure must not fail the
 * business request that triggered it, same contract as withLogging.
 *
 * - dedupeKey / onDuplicate: when an event with the same key and actor exists
 *   (inside `windowMinutes` if given), "refresh" rewrites it and marks it
 *   unread again, "skip" does nothing.
 * - actorId: pass auth.user.id when the route has it; otherwise it is taken
 *   from the request's session token.
 */
export async function publishUpdate({
  req,
  actorId,
  type,
  title,
  message,
  url,
  dedupeKey = null,
  onDuplicate = "refresh",
  windowMinutes = null,
}) {
  try {
    if (!UPDATE_TYPE_CONFIG[type]) {
      console.error("publishUpdate: unknown update type", type);
      return false;
    }

    let actor = actorId;
    if (!actor && req) {
      const session = await getUserFromToken(req);
      actor = session?.user_id || null;
    }

    const recipients = await prisma.users.findMany({
      where: recipientWhere(type, actor),
      select: { id: true },
    });
    if (!recipients?.length) return true;

    if (dedupeKey) {
      const existing = await prisma.update_event.findFirst({
        where: {
          dedupe_key: dedupeKey,
          // "refresh" collapses one user's repeated edits; "skip" is a
          // once-ever guard and must hold whoever triggered it
          ...(onDuplicate === "skip" ? {} : { actor_id: actor }),
          ...(windowMinutes
            ? {
                updatedAt: {
                  gte: new Date(Date.now() - windowMinutes * 60000),
                },
              }
            : {}),
        },
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      });

      if (existing) {
        if (onDuplicate === "skip") return true;
        await prisma.update_event.update({
          where: { id: existing.id },
          data: { title, message, url },
        });
        await prisma.update_recipient.updateMany({
          where: { update_id: existing.id },
          data: { read_at: null },
        });
        await prisma.update_recipient.createMany({
          data: recipients.map((user) => ({
            update_id: existing.id,
            user_id: user.id,
          })),
          skipDuplicates: true,
        });
        return true;
      }
    }

    await prisma.update_event.create({
      data: {
        type,
        actor_id: actor,
        title,
        message,
        url,
        dedupe_key: dedupeKey,
        recipients: {
          create: recipients.map((user) => ({ user_id: user.id })),
        },
      },
    });
    return true;
  } catch (error) {
    console.error("Error publishing update:", error);
    return false;
  }
}

// Lot notes are autosaved, so repeated saves by the same user on the same
// lot and tab collapse into one update (refreshed, and unread again) for 30
// minutes. Pass tabKind for tab notes; omit it for the lot overview notes.
export async function publishLotNotesUpdate({ req, lotId, tabKind = null }) {
  try {
    const lot = await prisma.lot.findUnique({
      where: { lot_id: lotId },
      select: {
        lot_id: true,
        name: true,
        project_id: true,
        project: { select: { name: true } },
      },
    });
    if (!lot) return false;
    const tabLabel = tabKind ? TAB_KIND_LABELS[tabKind] || tabKind : "Overview";
    return await publishUpdate({
      req,
      type: "LOT_NOTES_UPDATED",
      title: "Lot notes updated",
      message: `${tabLabel} notes (${lot.name}, ${lot.project?.name || lot.project_id})`,
      url: lotUrl(lot.project_id, lot.lot_id, tabKind),
      dedupeKey: `notes:${lot.lot_id}:${tabKind || "overview"}`,
      windowMinutes: 30,
    });
  } catch (error) {
    console.error("Error publishing lot notes update:", error);
    return false;
  }
}

// An MTO counts as created once it has items. The project page first creates
// an empty draft just to attach files, so empty drafts are not announced; the
// create route and the first PATCH that adds items both call this, and the
// once-ever dedupe key keeps it to a single update.
export function publishMtoCreated({ req, mtoId, projectName, itemCount }) {
  if (!itemCount) return false;
  return publishUpdate({
    req,
    type: "MTO_CREATED",
    title: "Materials to order created",
    message: `${itemCount} item${itemCount === 1 ? "" : "s"}${projectName ? ` for ${projectName}` : ""}`,
    url: `/admin/suppliers/materialstoorder?mto=${mtoId}`,
    dedupeKey: `mto-created:${mtoId}`,
    onDuplicate: "skip",
  });
}

// Announces that materials were ordered from a supplier against an MTO. `key`
// identifies the order (a purchase order id, or "mto:supplier" for the line
// path) so the same order is announced only once.
export async function publishMtoOrdered({
  req,
  mtoId,
  supplierId,
  orderNo = null,
  key,
  windowMinutes = null,
}) {
  try {
    const [supplier, mto] = await Promise.all([
      prisma.supplier.findUnique({
        where: { supplier_id: supplierId },
        select: { name: true },
      }),
      prisma.materials_to_order.findUnique({
        where: { id: mtoId },
        select: { project: { select: { name: true } } },
      }),
    ]);
    const supplierName = supplier?.name || "supplier";
    return await publishUpdate({
      req,
      type: "MTO_ORDERED",
      title: "Materials ordered",
      message: `Ordered from ${supplierName}${orderNo ? ` (order ${orderNo})` : ""}${
        mto?.project?.name ? ` for ${mto.project.name}` : ""
      }`,
      url: `/admin/suppliers/materialstoorder?mto=${mtoId}`,
      dedupeKey: `mto-ordered:${key}`,
      onDuplicate: "skip",
      windowMinutes,
    });
  } catch (error) {
    console.error("Error publishing MTO ordered update:", error);
    return false;
  }
}

export const UPDATE_ACTOR_INCLUDE = {
  select: {
    id: true,
    username: true,
    employee: { select: { first_name: true, last_name: true } },
  },
};

export function actorName(actor) {
  if (!actor) return "Someone";
  const full = [actor.employee?.first_name, actor.employee?.last_name]
    .filter(Boolean)
    .join(" ");
  return full || actor.username;
}

// Flattens a update_recipient row (with its event) for the client
export function presentUpdate(row) {
  const { update: event } = row;
  return {
    id: event.id,
    type: event.type,
    label: UPDATE_TYPE_CONFIG[event.type]?.label ?? event.type,
    title: event.title,
    message: event.message,
    url: event.url,
    actor: event.actor
      ? { id: event.actor.id, name: actorName(event.actor) }
      : null,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    read_at: row.read_at,
    is_read: Boolean(row.read_at),
  };
}

// Prisma `where` for the caller's own feed rows, limited to what they can see
export function feedWhere(auth, { unread = false, type = null } = {}) {
  const allowed = allowedTypesFor(auth);
  const types = type && allowed.includes(type) ? [type] : type ? [] : allowed;
  return {
    user_id: auth.user.id,
    ...(unread ? { read_at: null } : {}),
    update: { type: { in: types } },
  };
}
