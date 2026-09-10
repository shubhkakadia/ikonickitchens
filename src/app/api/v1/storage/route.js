import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import {
  validateAdminAuth,
  getUserFromToken,
} from "@/lib/validators/authFromToken";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { prisma } from "@/lib/db";

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = "Australia/Adelaide";
const UPLOAD_ROOT = "mediauploads";

// Walking the upload tree is the slow part, so the whole payload is cached.
// Storage does not move fast enough to need a fresh walk on every dashboard load.
const CACHE_TTL_MS = 5 * 60 * 1000;
let cache = { at: 0, payload: null };

async function directorySize(root) {
  let bytes = 0;
  let count = 0;
  async function walk(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return; // missing or unreadable directory contributes nothing
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        try {
          const stat = await fs.stat(full);
          bytes += stat.size;
          count += 1;
        } catch {
          // file vanished mid-walk; skip it
        }
      }
    }
  }
  await walk(root);
  return { bytes, count };
}

export async function GET(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    const session = await getUserFromToken(request);
    if (!session) {
      return NextResponse.json(
        { status: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    // Infrastructure data: master-admin, or anyone with config access.
    const isMaster = (session.user_type || "").toLowerCase() === "master-admin";
    if (!isMaster) {
      const access = await prisma.module_access.findUnique({
        where: { user_id: session.user_id },
        select: { config: true },
      });
      if (!access?.config) {
        return NextResponse.json(
          { status: false, message: "Forbidden" },
          { status: 403 },
        );
      }
    }

    const refresh = new URL(request.url).searchParams.get("refresh") === "1";
    if (!refresh && cache.payload && Date.now() - cache.at < CACHE_TTL_MS) {
      return NextResponse.json(
        {
          status: true,
          message: "Storage usage fetched successfully",
          data: { ...cache.payload, cached: true },
        },
        { status: 200 },
      );
    }

    const uploadRoot = path.join(process.cwd(), UPLOAD_ROOT);
    const months6Ago = dayjs().tz(TZ).subtract(5, "month").startOf("month").utc().toDate();

    const [files, disk, dbTables, mediaRows, lotFileRows, supplierFileRows] =
      await Promise.all([
        directorySize(uploadRoot),
        fs.statfs(process.cwd()).catch(() => null),
        // Prisma cannot report physical table sizes; information_schema can.
        prisma.$queryRaw`
          SELECT TABLE_NAME AS name,
                 (DATA_LENGTH + INDEX_LENGTH) AS bytes
          FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = DATABASE()
          ORDER BY bytes DESC
        `,
        prisma.media.findMany({
          where: { createdAt: { gte: months6Ago }, is_deleted: false },
          select: { size: true, createdAt: true },
        }),
        prisma.lot_file.findMany({
          where: { createdAt: { gte: months6Ago }, is_deleted: false },
          select: { size: true, createdAt: true },
        }),
        prisma.supplier_file.findMany({
          where: { createdAt: { gte: months6Ago }, is_deleted: false },
          select: { size: true, createdAt: true },
        }),
      ]);

    const dbBytes = dbTables.reduce((sum, t) => sum + Number(t.bytes ?? 0), 0);
    const totalBytes = dbBytes + files.bytes;

    // Growth is derived from recorded file sizes, which is the only history
    // this schema keeps. It tracks uploads, not database growth.
    const monthKeys = Array.from({ length: 6 }, (_, i) =>
      dayjs().tz(TZ).subtract(5 - i, "month").format("YYYY-MM"),
    );
    const growth = new Map(monthKeys.map((k) => [k, 0]));
    for (const row of [...mediaRows, ...lotFileRows, ...supplierFileRows]) {
      const key = dayjs(row.createdAt).tz(TZ).format("YYYY-MM");
      if (growth.has(key)) growth.set(key, growth.get(key) + Number(row.size ?? 0));
    }
    const growthByMonth = monthKeys.map((month) => ({
      month,
      bytes: growth.get(month) ?? 0,
    }));

    // Average over completed months only; the current month is partial.
    const completed = growthByMonth.slice(0, -1);
    const avgMonthlyBytes = completed.length
      ? Math.round(completed.reduce((s, m) => s + m.bytes, 0) / completed.length)
      : 0;

    // An explicit plan quota beats raw disk size when the host sells capacity.
    const limitEnv = Number(process.env.STORAGE_LIMIT_GB);
    const limitBytes =
      Number.isFinite(limitEnv) && limitEnv > 0
        ? limitEnv * 1024 ** 3
        : disk
          ? Number(disk.blocks) * Number(disk.bsize)
          : null;

    const usedAgainstLimit =
      Number.isFinite(limitEnv) && limitEnv > 0
        ? totalBytes
        : disk
          ? (Number(disk.blocks) - Number(disk.bfree)) * Number(disk.bsize)
          : totalBytes;

    const freeBytes = limitBytes ? Math.max(0, limitBytes - usedAgainstLimit) : null;
    const percentUsed = limitBytes
      ? Math.round((usedAgainstLimit / limitBytes) * 1000) / 10
      : null;
    const monthsRemaining =
      freeBytes != null && avgMonthlyBytes > 0
        ? Math.floor(freeBytes / avgMonthlyBytes)
        : null;

    const payload = {
      generatedAt: new Date().toISOString(),
      cached: false,
      database: {
        bytes: dbBytes,
        tableCount: dbTables.length,
        largestTables: dbTables.slice(0, 5).map((t) => ({
          name: t.name,
          bytes: Number(t.bytes ?? 0),
        })),
      },
      files: { bytes: files.bytes, count: files.count, root: UPLOAD_ROOT },
      totalBytes,
      limitBytes,
      usedAgainstLimit,
      freeBytes,
      percentUsed,
      // How the limit was decided, so the UI can say so honestly.
      limitSource:
        Number.isFinite(limitEnv) && limitEnv > 0
          ? "plan"
          : disk
            ? "disk"
            : "unknown",
      growthByMonth,
      avgMonthlyBytes,
      monthsRemaining,
    };

    cache = { at: Date.now(), payload };

    return NextResponse.json(
      { status: true, message: "Storage usage fetched successfully", data: payload },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in GET /api/v1/storage:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
