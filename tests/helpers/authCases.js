import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "./prismaMock";
import { mockAuthorizedUser, VALID_TOKEN } from "./auth";

const ALL_USER_TYPES = ["master-admin", "admin", "manager", "employee"];
const STAFF_ROLES = ["master-admin", "admin", "manager"];

/**
 * Generates the standard requireAuth() test matrix for one route handler.
 *
 * call(requestOptions) -> Promise<Response>   invokes the handler
 * options:
 *   roles     user types the route allows (default: staff roles)
 *   modules   module_access key(s); holding any one of them grants access
 *   setup     primes prisma mocks so an authorised call can succeed
 *   untouched () => mock fns that must not run when access is denied
 *   authOnly  only generate the 401 (authentication) cases, for routes with
 *             custom role/permission rules that are tested separately
 */
export function describeAuthorization(
  call,
  {
    roles = STAFF_ROLES,
    modules,
    setup,
    untouched = () => [],
    authOnly = false,
  } = {},
) {
  const moduleList = modules ? [].concat(modules) : [];
  const deniedRoles = ALL_USER_TYPES.filter((r) => !roles.includes(r));

  const expectDenied = async (res, status, message) => {
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ status: false, message });
    for (const fn of untouched()) expect(fn).not.toHaveBeenCalled();
  };
  const expectAllowed = (res) => {
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  };

  describe("authorization", () => {
    beforeEach(() => setup?.());

    it("401 when the Authorization header is missing", async () => {
      await expectDenied(await call({ token: null }), 401, "Unauthorized");
      expect(prismaMock.sessions.findUnique).not.toHaveBeenCalled();
    });

    it("401 when the Authorization header is not a Bearer token", async () => {
      const res = await call({
        token: null,
        headers: { authorization: `Basic ${VALID_TOKEN}` },
      });
      await expectDenied(res, 401, "Unauthorized");
    });

    it("401 when the session token is unknown", async () => {
      prismaMock.sessions.findUnique.mockResolvedValue(null);
      await expectDenied(await call({ token: "nope" }), 401, "Unauthorized");
      expect(prismaMock.sessions.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { token: "nope" } }),
      );
    });

    it("401 when the session has no user", async () => {
      prismaMock.sessions.findUnique.mockResolvedValue({
        id: "s",
        expires_at: new Date(Date.now() + 60_000),
        user: null,
      });
      await expectDenied(await call(), 401, "Unauthorized");
    });

    it("401 when the session lookup throws", async () => {
      prismaMock.sessions.findUnique.mockRejectedValue(new Error("DB down"));
      await expectDenied(await call(), 401, "Unauthorized");
    });

    it("401 when the session has expired", async () => {
      mockAuthorizedUser({ userType: "master-admin", expired: true });
      await expectDenied(await call(), 401, "Session expired");
    });

    it("401 when the account is inactive", async () => {
      mockAuthorizedUser({ userType: "master-admin", isActive: false });
      await expectDenied(await call(), 401, "Account is inactive");
    });

    if (authOnly) return;

    for (const role of deniedRoles) {
      it(`403 for role "${role}" even with every module`, async () => {
        mockAuthorizedUser({ userType: role, modules: moduleList });
        await expectDenied(await call(), 403, "Insufficient permissions");
      });
    }

    if (moduleList.length) {
      for (const role of roles.filter((r) => r !== "master-admin")) {
        it(`403 for "${role}" without the required module`, async () => {
          mockAuthorizedUser({
            userType: role,
            modules: ["some_other_module"],
          });
          await expectDenied(await call(), 403, "Insufficient permissions");
        });

        for (const mod of moduleList) {
          it(`allows "${role}" with module "${mod}"`, async () => {
            mockAuthorizedUser({ userType: role, modules: [mod] });
            expectAllowed(await call());
          });
        }
      }

      if (roles.includes("master-admin")) {
        it("allows master-admin without any module flags", async () => {
          mockAuthorizedUser({ userType: "master-admin", modules: [] });
          expectAllowed(await call());
        });
      }
    } else {
      for (const role of roles) {
        it(`allows role "${role}"`, async () => {
          mockAuthorizedUser({ userType: role });
          expectAllowed(await call());
        });
      }
    }

    it("treats the user type case-insensitively", async () => {
      mockAuthorizedUser({
        userType: roles[0].toUpperCase(),
        modules: moduleList,
      });
      expectAllowed(await call());
    });
  });
}
