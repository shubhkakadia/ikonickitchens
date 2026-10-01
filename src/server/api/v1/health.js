import "server-only"

import { NextResponse } from "next/server"

import { prisma } from "@/lib/db"

// Bounded so a hung connection fails the probe instead of holding it open.
const DB_CHECK_TIMEOUT_MS = 3000

async function checkDatabase() {
  let timer

  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`database check exceeded ${DB_CHECK_TIMEOUT_MS}ms`)),
          DB_CHECK_TIMEOUT_MS,
        )
      }),
    ])

    return { ok: true }
  } catch (error) {
    return { ok: false, error }
  } finally {
    clearTimeout(timer)
  }
}

export async function getHealth() {
  const database = await checkDatabase()

  if (!database.ok) {
    // Logged, never returned: the driver error can carry host and user details.
    console.error("Health check failed, database unreachable:", database.error)

    return NextResponse.json(
      {
        status: "error",
        service: "ikonickitchens",
        database: "unreachable",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    )
  }

  return NextResponse.json(
    {
      status: "ok",
      service: "ikonickitchens",
      database: "ok",
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  )
}
