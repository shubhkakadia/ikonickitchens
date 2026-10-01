// src/lib/db.ts
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../../generated/prisma/client";

const adapter = new PrismaMariaDb({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT ?? 3306),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  connectionLimit: 5,
  minimumIdle: 1,
  allowPublicKeyRetrieval: true,
});
declare global {
  var __prisma: PrismaClient | undefined;
}

// Password hashes are never loaded unless a query opts in with
// `omit: { password: false }` (sign-in and password change only). This also
// covers users rows pulled in through `include` on any relation.
export const prisma =
  globalThis.__prisma ??
  new PrismaClient({ adapter, omit: { users: { password: true } } });

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
