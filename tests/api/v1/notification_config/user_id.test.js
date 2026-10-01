// Tests for src/app/api/v1/notification_config/[user_id]/route.js
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../helpers/prismaMock";
import { mockAuthorizedUser, mockMasterAdmin } from "../../../helpers/auth";
import { buildRequest, routeContext } from "../../../helpers/request";
import { describeAuthorization } from "../../../helpers/authCases";

const { GET, PATCH } =
  await import("@/app/api/v1/notification_config/[user_id]/route");

const ALL_ROLES = ["master-admin", "admin", "manager", "employee"];
const SELF_ID = "user-1"; // the id the auth helpers give the signed-in user
const OTHER_ID = "user-2";

// Every flag the route reads and writes
const FLAGS = [
  "meeting",
  "material_to_order",
  "material_to_order_ordered",
  "assign_installer",
  "stage_quote_approve",
  "stage_material_appliances_selection",
  "stage_drafting",
  "stage_drafting_revision",
  "stage_final_design_approval",
  "stage_site_measurements",
  "stage_final_approval_for_production",
  "stage_machining_out",
  "stage_material_order",
  "stage_cnc",
  "stage_assembly",
  "stage_delivery",
  "stage_installation",
  "stage_invoice_sent",
  "stage_maintenance",
  "stage_job_completion",
  "stock_transactions",
  "supplier_statements",
];

const flagsAll = (value) => Object.fromEntries(FLAGS.map((f) => [f, value]));
const storedConfig = (userId = SELF_ID, flags = flagsAll(false)) => ({
  id: "config-1",
  user_id: userId,
  ...flags,
});

const url = (id) => `/api/v1/notification_config/${id}`;

describe("GET /api/v1/notification_config/[user_id]", () => {
  const get = (id = SELF_ID, options) =>
    GET(buildRequest(url(id), options), routeContext({ user_id: id }));

  function mockFetch(found = storedConfig()) {
    prismaMock.notification_config.findUnique.mockResolvedValue(found);
    prismaMock.notification_config.create.mockImplementation(
      async ({ data }) => ({
        id: "config-new",
        ...data,
      }),
    );
  }

  // Matrix runs against the caller's own id, which every role may access.
  describeAuthorization((options) => get(SELF_ID, options), {
    roles: ALL_ROLES,
    setup: () => mockFetch(),
    untouched: () => [
      prismaMock.notification_config.findUnique,
      prismaMock.notification_config.create,
    ],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockFetch();
    });

    it.each(["admin", "manager", "employee"])(
      "returns a %s's own config",
      async (userType) => {
        mockAuthorizedUser({ userType });

        const res = await get(SELF_ID);

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
          status: true,
          message: "Notification config fetched successfully",
          data: storedConfig(),
        });
        expect(prismaMock.notification_config.findUnique).toHaveBeenCalledWith({
          where: { user_id: SELF_ID },
        });
        expect(prismaMock.notification_config.create).not.toHaveBeenCalled();
      },
    );

    it.each(["manager", "employee"])(
      "returns 403 when a %s reads someone else's config",
      async (userType) => {
        mockAuthorizedUser({ userType });

        const res = await get(OTHER_ID);

        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({
          status: false,
          message:
            "Access denied. You can only access your own notification settings.",
        });
        expect(
          prismaMock.notification_config.findUnique,
        ).not.toHaveBeenCalled();
      },
    );

    it.each(["admin", "master-admin"])(
      "lets a %s read anyone's config",
      async (userType) => {
        mockAuthorizedUser({ userType });
        mockFetch(storedConfig(OTHER_ID));

        const res = await get(OTHER_ID);

        expect(res.status).toBe(200);
        expect((await res.json()).data.user_id).toBe(OTHER_ID);
        expect(prismaMock.notification_config.findUnique).toHaveBeenCalledWith({
          where: { user_id: OTHER_ID },
        });
      },
    );

    it("creates and returns an all-off default config when none exists", async () => {
      mockMasterAdmin();
      mockFetch(null);

      const res = await get(OTHER_ID);

      expect(res.status).toBe(200);
      expect(prismaMock.notification_config.create).toHaveBeenCalledWith({
        data: { user_id: OTHER_ID, ...flagsAll(false) },
      });
      const json = await res.json();
      expect(json.message).toBe("Notification config fetched successfully");
      expect(json.data).toEqual({
        id: "config-new",
        user_id: OTHER_ID,
        ...flagsAll(false),
      });
    });

    it("returns 500 when the lookup fails", async () => {
      mockMasterAdmin();
      prismaMock.notification_config.findUnique.mockRejectedValue(
        new Error("DB down"),
      );

      const res = await get();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: false,
        message: "Internal Server Error",
      });
    });

    it("returns 500 when creating the default fails", async () => {
      mockMasterAdmin();
      mockFetch(null);
      prismaMock.notification_config.create.mockRejectedValue(
        new Error("FK violation"),
      );

      const res = await get();

      expect(res.status).toBe(500);
    });
  });
});

describe("PATCH /api/v1/notification_config/[user_id]", () => {
  const patch = (body = { meeting: true }, options = {}, id = SELF_ID) =>
    PATCH(
      buildRequest(url(id), { method: "PATCH", body, ...options }),
      routeContext({ user_id: id }),
    );

  function mockUpdate(existing = null) {
    prismaMock.notification_config.findUnique.mockResolvedValue(existing);
    prismaMock.notification_config.upsert.mockImplementation(
      async ({ create }) => ({ id: "config-1", ...create }),
    );
  }

  const upsertArgs = () =>
    prismaMock.notification_config.upsert.mock.calls[0][0];

  describeAuthorization((options) => patch(undefined, options), {
    roles: ALL_ROLES,
    setup: () => mockUpdate(),
    untouched: () => [
      prismaMock.notification_config.findUnique,
      prismaMock.notification_config.upsert,
    ],
  });

  describe("handler", () => {
    beforeEach(() => {
      mockMasterAdmin();
      mockUpdate();
    });

    it("upserts the config for the user", async () => {
      const res = await patch({ meeting: true });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe(true);
      expect(json.message).toBe("Notification config updated successfully");
      expect(json.data).toMatchObject({ user_id: SELF_ID, meeting: true });
      expect(upsertArgs().where).toEqual({ user_id: SELF_ID });
    });

    it("creates with all flags off except those sent when there is no config", async () => {
      await patch({ meeting: true, stage_cnc: true });

      expect(upsertArgs().create).toEqual({
        user_id: SELF_ID,
        ...flagsAll(false),
        meeting: true,
        stage_cnc: true,
      });
    });

    it("writes every flag on update, keeping existing values for omitted ones", async () => {
      const existing = storedConfig(SELF_ID, {
        ...flagsAll(false),
        meeting: true,
        stage_drafting: true,
        supplier_statements: true,
      });
      mockUpdate(existing);

      await patch({ stage_cnc: true, meeting: false });

      expect(upsertArgs().update).toEqual({
        ...flagsAll(false),
        meeting: false, // changed
        stage_cnc: true, // changed
        stage_drafting: true, // kept
        supplier_statements: true, // kept
      });
    });

    it("lets a flag be switched off explicitly", async () => {
      mockUpdate(storedConfig(SELF_ID, { ...flagsAll(true) }));

      await patch({ stage_cnc: false });

      expect(upsertArgs().update.stage_cnc).toBe(false);
      expect(upsertArgs().update.meeting).toBe(true);
    });

    it("falls back to false for omitted flags when the existing value is null", async () => {
      mockUpdate({ id: "c", user_id: SELF_ID, meeting: null });

      await patch({});

      expect(upsertArgs().update).toEqual(flagsAll(false));
    });

    it("looks up the existing config before upserting", async () => {
      await patch();

      expect(prismaMock.notification_config.findUnique).toHaveBeenCalledWith({
        where: { user_id: SELF_ID },
      });
    });

    it("ignores keys that are not notification flags", async () => {
      await patch({
        meeting: true,
        id: "forced",
        user_id: "someone-else",
        stage_updates: true,
        bogus: true,
      });

      const { create, update, where } = upsertArgs();
      expect(where).toEqual({ user_id: SELF_ID });
      expect(create.user_id).toBe(SELF_ID);
      for (const data of [create, update]) {
        expect(data).not.toHaveProperty("id");
        expect(data).not.toHaveProperty("stage_updates");
        expect(data).not.toHaveProperty("bogus");
      }
    });

    // Current behaviour: values are not validated or coerced.
    it("passes non-boolean values straight through", async () => {
      await patch({ meeting: "yes", stage_cnc: null });

      expect(upsertArgs().create.meeting).toBe("yes");
      expect(upsertArgs().create.stage_cnc).toBeNull();
    });

    it("does not write an activity log", async () => {
      await patch();

      expect(prismaMock.logs.create).not.toHaveBeenCalled();
    });

    describe("who may update", () => {
      it.each(["manager", "employee"])(
        "lets a %s update their own config",
        async (userType) => {
          mockAuthorizedUser({ userType });

          const res = await patch({ meeting: true }, {}, SELF_ID);

          expect(res.status).toBe(200);
        },
      );

      it.each(["manager", "employee"])(
        "returns 403 when a %s updates someone else's config",
        async (userType) => {
          mockAuthorizedUser({ userType });

          const res = await patch({ meeting: true }, {}, OTHER_ID);

          expect(res.status).toBe(403);
          expect(await res.json()).toEqual({
            status: false,
            message:
              "Access denied. You can only update your own notification settings.",
          });
          expect(
            prismaMock.notification_config.findUnique,
          ).not.toHaveBeenCalled();
          expect(prismaMock.notification_config.upsert).not.toHaveBeenCalled();
        },
      );

      it.each(["admin", "master-admin"])(
        "lets a %s update anyone's config",
        async (userType) => {
          mockAuthorizedUser({ userType });

          const res = await patch({ meeting: true }, {}, OTHER_ID);

          expect(res.status).toBe(200);
          expect(upsertArgs().where).toEqual({ user_id: OTHER_ID });
          expect(upsertArgs().create.user_id).toBe(OTHER_ID);
        },
      );
    });

    describe("failures", () => {
      it("returns 500 when the lookup fails", async () => {
        prismaMock.notification_config.findUnique.mockRejectedValue(
          new Error("DB down"),
        );

        const res = await patch();

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({
          status: false,
          message: "Internal Server Error",
        });
        expect(prismaMock.notification_config.upsert).not.toHaveBeenCalled();
      });

      it("returns 500 when the upsert fails", async () => {
        prismaMock.notification_config.upsert.mockRejectedValue(
          new Error("FK violation"),
        );

        const res = await patch();

        expect(res.status).toBe(500);
      });

      it("returns 500 for a malformed JSON body", async () => {
        const res = await PATCH(
          buildRequest(url(SELF_ID), {
            method: "PATCH",
            rawBody: "{not json",
            headers: { "content-type": "application/json" },
          }),
          routeContext({ user_id: SELF_ID }),
        );

        expect(res.status).toBe(500);
        expect(prismaMock.notification_config.upsert).not.toHaveBeenCalled();
      });
    });
  });
});
