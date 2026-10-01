// Tests for src/app/api/v1/todo/[id]/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockAuthorizedUser, mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest, routeContext } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { PATCH, DELETE } = await import("@/app/api/v1/todo/[id]/route");

const ID = "todo-1";
const URL = `/api/v1/todo/${ID}`;
const ctx = () => routeContext({ id: ID });
const patch = (body, options) =>
  PATCH(buildRequest(URL, { method: "PATCH", body, ...options }), ctx());
const del = (options) =>
  DELETE(buildRequest(URL, { method: "DELETE", ...options }), ctx());

// The caller is "user-1" (see tests/helpers/auth.js).
const stored = (overrides = {}) => ({
  id: ID,
  title: "Order handles",
  is_completed: false,
  created_by_id: "user-2",
  tagged_users: [{ id: "user-1" }],
  ...overrides,
});

const setup = (todo = stored()) => {
  prismaMock.todo.findFirst.mockResolvedValue(todo);
  prismaMock.todo.update.mockImplementation(async ({ data }) => ({
    ...todo,
    ...data,
    notes: data.notes ?? null,
    due_date: data.due_date ?? null,
    completed_at: data.completed_at ?? null,
    completed_by: null,
    created_by: null,
    tagged_users: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
  prismaMock.users.count.mockResolvedValue(1);
  prismaMock.logs.create.mockResolvedValue({});
};

const asManager = () =>
  mockAuthorizedUser({ userType: "manager", modules: ["dashboard"] });
const updateArgs = () => prismaMock.todo.update.mock.calls[0][0];
const logged = () => prismaMock.logs.create.mock.calls[0][0].data;

describe("PATCH /api/v1/todo/[id]", () => {
  describeAuthorization((o) => patch({ notes: "x" }, o), {
    modules: "dashboard",
    setup: () => setup(),
    untouched: () => [prismaMock.todo.update],
  });

  describe("handler", () => {
    beforeEach(() => {
      asManager();
      setup();
    });

    it("completing records who and when, and logs a status change", async () => {
      const res = await patch({ is_completed: true });
      expect(res.status).toBe(200);
      const { data } = updateArgs();
      expect(data.is_completed).toBe(true);
      expect(data.completed_by_id).toBe("user-1");
      expect(data.completed_at).toBeInstanceOf(Date);
      expect(logged()).toMatchObject({ action: "STATUS_CHANGE", entity_id: ID });
    });

    it("unchecking clears the completion details", async () => {
      setup(stored({ is_completed: true }));
      await patch({ is_completed: false });
      expect(updateArgs().data).toMatchObject({
        is_completed: false,
        completed_at: null,
        completed_by_id: null,
      });
    });

    it("re-sending the current state leaves the completion time alone", async () => {
      setup(stored({ is_completed: true }));
      const res = await patch({ is_completed: true });
      expect(res.status).toBe(400); // nothing to update
      expect(prismaMock.todo.update).not.toHaveBeenCalled();
    });

    it("a tagged user can complete and edit notes", async () => {
      const res = await patch({ is_completed: true, notes: "  Done, see invoice " });
      expect(res.status).toBe(200);
      expect(updateArgs().data.notes).toBe("Done, see invoice");
    });

    it("a tagged user cannot change the title, due date or tags", async () => {
      for (const body of [
        { title: "New" },
        { due_date: "2026-11-01" },
        { tagged_user_ids: [] },
      ]) {
        const res = await patch(body);
        expect(res.status).toBe(403);
      }
      expect(prismaMock.todo.update).not.toHaveBeenCalled();
    });

    it("404 for someone who is neither creator nor tagged", async () => {
      setup(stored({ created_by_id: "user-9", tagged_users: [{ id: "user-8" }] }));
      const res = await patch({ is_completed: true });
      expect(res.status).toBe(404);
      expect(prismaMock.todo.update).not.toHaveBeenCalled();
    });

    it("404 when the task does not exist or was deleted", async () => {
      prismaMock.todo.findFirst.mockResolvedValue(null);
      expect((await patch({ is_completed: true })).status).toBe(404);
      expect(prismaMock.todo.findFirst.mock.calls[0][0].where).toEqual({
        id: ID,
        is_deleted: false,
      });
    });

    it("the creator can edit title, due date and tags", async () => {
      setup(stored({ created_by_id: "user-1", tagged_users: [] }));
      const res = await patch({
        title: " Order hinges ",
        due_date: "2026-11-01",
        tagged_user_ids: ["user-1", "user-3"],
      });
      expect(res.status).toBe(200);
      const { data } = updateArgs();
      expect(data.title).toBe("Order hinges");
      expect(data.due_date.toISOString()).toBe("2026-11-01T00:00:00.000Z");
      expect(data.tagged_users).toEqual({ set: [{ id: "user-3" }] });
      expect(logged().action).toBe("UPDATE");
    });

    it("the creator can clear the due date", async () => {
      setup(stored({ created_by_id: "user-1" }));
      await patch({ due_date: null });
      expect(updateArgs().data.due_date).toBeNull();
    });

    it("400 for a blank title or a bad date", async () => {
      setup(stored({ created_by_id: "user-1" }));
      expect((await patch({ title: " " })).status).toBe(400);
      expect((await patch({ due_date: "soon" })).status).toBe(400);
      expect(prismaMock.todo.update).not.toHaveBeenCalled();
    });

    it("a master-admin can edit any task", async () => {
      mockMasterAdmin();
      setup(stored({ created_by_id: "user-9", tagged_users: [] }));
      const res = await patch({ title: "Renamed" });
      expect(res.status).toBe(200);
    });
  });
});

describe("DELETE /api/v1/todo/[id]", () => {
  // Owned by the caller, so the creator-only rule doesn't mask the access checks.
  describeAuthorization(del, {
    modules: "dashboard",
    setup: () => setup(stored({ created_by_id: "user-1" })),
    untouched: () => [prismaMock.todo.update],
  });

  describe("handler", () => {
    beforeEach(() => asManager());

    it("soft-deletes for the creator and logs it", async () => {
      setup(stored({ created_by_id: "user-1" }));
      const res = await del();
      expect(res.status).toBe(200);
      expect(updateArgs()).toEqual({ where: { id: ID }, data: { is_deleted: true } });
      expect(logged()).toMatchObject({ action: "DELETE", entity_type: "todo" });
    });

    it("403 for a tagged user who is not the creator", async () => {
      setup();
      const res = await del();
      expect(res.status).toBe(403);
      expect(prismaMock.todo.update).not.toHaveBeenCalled();
    });

    it("404 for an unrelated user", async () => {
      setup(stored({ created_by_id: "user-9", tagged_users: [] }));
      expect((await del()).status).toBe(404);
    });
  });
});
