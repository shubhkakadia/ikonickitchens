// Tests for src/app/api/v1/todo/all/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockAuthorizedUser } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET } = await import("@/app/api/v1/todo/all/route");

const get = (query = "", options) =>
  GET(buildRequest(`/api/v1/todo/all${query}`, { method: "GET", ...options }));

const row = (id, due, extra = {}) => ({
  id,
  title: id,
  notes: null,
  due_date: due ? new Date(`${due}T00:00:00.000Z`) : null,
  is_completed: false,
  completed_at: null,
  completed_by: null,
  created_by: { id: "user-1", username: "test.user", employee: null },
  tagged_users: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...extra,
});

const setup = () => {
  prismaMock.todo.count.mockResolvedValue(0);
  prismaMock.todo.findMany.mockResolvedValue([]);
};

describe("GET /api/v1/todo/all", () => {
  describeAuthorization((o) => get("", o), {
    modules: "dashboard",
    setup,
    untouched: () => [prismaMock.todo.findMany],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockAuthorizedUser({ userType: "manager", modules: ["dashboard"] });
      setup();
    });

    it("only returns tasks the caller created or is tagged on", async () => {
      await get();
      const { where } = prismaMock.todo.findMany.mock.calls[0][0];
      expect(where).toMatchObject({
        is_deleted: false,
        is_completed: false,
        OR: [
          { created_by_id: "user-1" },
          { tagged_users: { some: { id: "user-1" } } },
        ],
      });
    });

    it("sorts active tasks by due date with undated tasks last", async () => {
      prismaMock.todo.findMany.mockResolvedValue([
        row("undated"),
        row("later", "2026-12-01"),
        row("sooner", "2026-10-02"),
      ]);
      const res = await get("?status=active");
      const { data } = await res.json();
      expect(data.todos.map((t) => t.id)).toEqual(["sooner", "later", "undated"]);
    });

    it("pages the completed history, newest completion first", async () => {
      const page = Array.from({ length: 21 }, (_, i) =>
        row(`done-${i}`, null, { is_completed: true, completed_at: new Date() }),
      );
      prismaMock.todo.findMany.mockResolvedValue(page);
      prismaMock.todo.count.mockResolvedValueOnce(2).mockResolvedValueOnce(21);

      const res = await get("?status=completed&skip=20");
      const { data } = await res.json();

      const args = prismaMock.todo.findMany.mock.calls[0][0];
      expect(args.where.is_completed).toBe(true);
      expect(args.orderBy).toEqual({ completed_at: "desc" });
      expect(args.skip).toBe(20);
      expect(data.todos).toHaveLength(20);
      expect(data.hasMore).toBe(true);
      expect(data.counts).toEqual({ active: 2, completed: 21 });
    });
  });
});
