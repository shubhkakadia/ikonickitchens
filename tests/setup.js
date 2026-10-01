import { vi, beforeEach } from "vitest";

// Every test uses the in-memory Prisma mock; nothing touches a real database.
vi.mock("@/lib/db", async () => {
  const { prismaMock } = await import("./helpers/prismaMock");
  return { prisma: prismaMock, default: prismaMock };
});

// Routes log expected failures with console.error; keep test output clean.
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
