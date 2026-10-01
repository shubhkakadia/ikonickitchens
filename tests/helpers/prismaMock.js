import { vi } from "vitest";

// Builds a fake Prisma model whose methods are all vi.fn() stubs.
function mockModel() {
  return {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirstOrThrow: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  };
}

// Returns a prisma stand-in that lazily creates a mock model on first access,
// so tests can use any model (prisma.sessions, prisma.users, ...) without setup.
export function createPrismaMock() {
  const models = {};
  return new Proxy(
    {
      $transaction: vi.fn(async (arg) =>
        typeof arg === "function" ? arg(prismaProxy) : Promise.all(arg),
      ),
      // Raw-query helpers (used as tagged templates, e.g. SELECT ... FOR UPDATE)
      $executeRaw: vi.fn(),
      $queryRaw: vi.fn(),
    },
    {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (typeof prop === "symbol" || prop === "then") return undefined;
        models[prop] ??= mockModel();
        return models[prop];
      },
    },
  );
}

let prismaProxy;
export const prismaMock = (prismaProxy = createPrismaMock());
