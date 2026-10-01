// Tests for src/app/api/v1/todo/create/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockAuthorizedUser } from "../../../helpers/auth";
import { buildRequest } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { POST } = await import("@/app/api/v1/todo/create/route");

const URL = "/api/v1/todo/create";
const post = (body, options) =>
  POST(buildRequest(URL, { method: "POST", body, ...options }));

const mockCreate = () => {
  prismaMock.users.count.mockResolvedValue(1);
  prismaMock.todo.create.mockImplementation(async ({ data }) => ({
    id: "todo-1",
    title: data.title,
    notes: data.notes,
    due_date: data.due_date,
    is_completed: false,
    completed_at: null,
    completed_by: null,
    created_by: { id: "user-1", username: "test.user", employee: null },
    tagged_users: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
  prismaMock.logs.create.mockResolvedValue({});
};

describe("POST /api/v1/todo/create", () => {
  describeAuthorization((o) => post({ title: "x" }, o), {
    modules: "dashboard",
    setup: mockCreate,
    untouched: () => [prismaMock.todo.create],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockAuthorizedUser({ userType: "manager", modules: ["dashboard"] });
      mockCreate();
    });

    it("creates a task owned by the caller and logs it", async () => {
      const res = await post({
        title: "  Order handles ",
        notes: "Black matte",
        due_date: "2026-10-05",
        tagged_user_ids: ["user-2"],
      });
      expect(res.status).toBe(200);
      const { data } = prismaMock.todo.create.mock.calls[0][0];
      expect(data).toMatchObject({
        title: "Order handles",
        notes: "Black matte",
        created_by_id: "user-1",
        tagged_users: { connect: [{ id: "user-2" }] },
      });
      expect(data.due_date.toISOString()).toBe("2026-10-05T00:00:00.000Z");
      expect(prismaMock.logs.create).toHaveBeenCalledWith({
        data: {
          user_id: "user-1",
          entity_type: "todo",
          entity_id: "todo-1",
          action: "CREATE",
          description: "Task created: Order handles",
        },
      });
    });

    it("allows a task with no due date, notes or tags", async () => {
      const res = await post({ title: "Call supplier" });
      expect(res.status).toBe(200);
      const { data } = prismaMock.todo.create.mock.calls[0][0];
      expect(data.due_date).toBeNull();
      expect(data.notes).toBeNull();
      expect(data.tagged_users).toEqual({ connect: [] });
    });

    it("400 when the title is blank", async () => {
      const res = await post({ title: "   " });
      expect(res.status).toBe(400);
      expect(prismaMock.todo.create).not.toHaveBeenCalled();
    });

    it("400 when the due date is invalid", async () => {
      const res = await post({ title: "x", due_date: "next week" });
      expect(res.status).toBe(400);
      expect(prismaMock.todo.create).not.toHaveBeenCalled();
    });

    it("never tags the creator on their own task", async () => {
      await post({ title: "x", tagged_user_ids: ["user-1", "user-2"] });
      const { data } = prismaMock.todo.create.mock.calls[0][0];
      expect(data.tagged_users).toEqual({ connect: [{ id: "user-2" }] });
    });

    it("400 when a tagged user does not exist or is inactive", async () => {
      prismaMock.users.count.mockResolvedValue(0);
      const res = await post({ title: "x", tagged_user_ids: ["ghost"] });
      expect(res.status).toBe(400);
      expect(prismaMock.todo.create).not.toHaveBeenCalled();
    });
  });
});
