import { prismaMock } from "./prismaMock";

export const VALID_TOKEN = "valid-session-token";

// For routes using withAuth/withAdminAuth (src/lib/session.js):
// makes validateSession() succeed for VALID_TOKEN as a user of the given type.
export function mockAuthenticatedUser(userType = "admin", overrides = {}) {
  const session = {
    id: "session-1",
    user_id: "user-1",
    token: VALID_TOKEN,
    expires_at: new Date(Date.now() + 60 * 60 * 1000),
  };
  const user = {
    id: "user-1",
    username: "test.user",
    user_type: userType,
    is_active: true,
    employee_id: "employee-1",
    ...overrides,
  };
  prismaMock.sessions.findFirst.mockResolvedValue(session);
  prismaMock.users.findUnique.mockResolvedValue(user);
  return { session, user };
}

// For routes using requireAuth/authorizeRequest
// (src/lib/validators/authFromToken.js). withLogging reuses the same session
// lookup, so logs are attributed to "user-1".
export function mockAuthorizedUser({
  userType = "manager",
  modules = [],
  isActive = true,
  expired = false,
  employeeId = "employee-1",
} = {}) {
  const session = {
    id: "session-1",
    user_id: "user-1",
    token: VALID_TOKEN,
    expires_at: new Date(Date.now() + (expired ? -1 : 1) * 60 * 60 * 1000),
    user: {
      id: "user-1",
      username: "test.user",
      user_type: userType,
      is_active: isActive,
      employee_id: employeeId,
      module_access: Object.fromEntries(modules.map((key) => [key, true])),
    },
  };
  prismaMock.sessions.findUnique.mockResolvedValue(session);
  return session;
}

// A master-admin passes every role and module check.
export const mockMasterAdmin = () =>
  mockAuthorizedUser({ userType: "master-admin" });
