# Code Review

Scope: Reviewed all code files under src/, lib/, and prisma/ (excluding public assets and Prisma migrations). Focus on correctness, security, and performance.

## Findings (Bugs and Risks)

1) High - Secrets exposed via NEXT_PUBLIC env vars
- src/lib/notification.js:7-8 uses NEXT_PUBLIC_* for WhatsApp API URL and access token.
- lib/xero/getAccessToken.js:11-13 uses NEXT_PUBLIC_* for refresh token and client secret.
Impact: These values are bundled into client builds and can be extracted by anyone. Server-only secrets should use non-public env vars and live only in server code.
Recommendation: Move tokens/secrets to server-only env vars (no NEXT_PUBLIC prefix) and ensure these modules are server-only.

2) Medium - Session validation can throw on missing user and returns undefined user data
- src/lib/session.js:35 assumes user exists (user.is_active), but user can be null.
- src/lib/session.js:48 returns session.users, but the query does not include users.
Impact: Null user can cause exceptions (caught and treated as invalid session). Returned sessionData.user is undefined.
Recommendation: Handle user == null, and include user in the session query or return the fetched user explicitly.

3) Medium - Notification status mismatch prevents stage-completed messages
- src/lib/notification.js:234 checks status === "COMPLETED" in determineNotificationTypes.
- src/lib/notification.js:386 checks status === "DONE" in prepareWhatsAppMessage.
Impact: Stage completion notifications may not send, depending on which status is used by the caller.
Recommendation: Normalize stage status values or map both "COMPLETED" and "DONE" consistently.

4) Medium - Wrong parsing of insufficient inventory errors in USED handler
- src/app/api/stock_transaction/create/route.js:146 parses the error string as "[, requested, available]", which swaps item_id and quantity.
Impact: Error message shows incorrect values to users.
Recommendation: Parse with [_, failedItemId, requested, available] or include a structured error object.

5) Medium - Logging path references undefined variable
- src/app/api/uploads/lots/[...path]/route.js:331 references tab.id, but no tab variable exists in scope.
Impact: If logging fails, the error handler throws a ReferenceError, which can mask the real issue.
Recommendation: Use lotTab.id or tabKind in the log message.

6) Medium - Dashboard month-only filter ignored for DateTime fields
- src/app/api/dashboard/route.js:111 returns null when year is "all" but month is specific.
- src/app/api/dashboard/route.js:145 only applies date filters if dateRangeFilter is truthy.
Impact: Month-only filters are silently ignored for date fields, leading to incorrect dashboard data.
Recommendation: Implement month-only filtering for DateTime fields (e.g., OR on month), or return a usable range.

7) Medium - Top-10 item sorting uses _count object, resulting in NaN sort
- src/app/api/dashboard/route.js:446 sorts on b._count - a._count, but _count is an object with _all.
Impact: top10itemsCount is not reliably sorted.
Recommendation: Use b._count._all - a._count._all (or orderBy in the groupBy call).

8) Medium - Conditional hook usage in AdminRoute
- src/components/ProtectedRoute.jsx:296 returns early for /admin/settings before a later useEffect at 309.
Impact: Violates React hook rules and can cause runtime errors when navigating between routes.
Recommendation: Move the /admin/settings branch below all hooks, or refactor into separate components.

9) Medium - Deleted files can still be served via mediauploads route
- src/app/mediauploads/[...path]/route.js:49,88 serves files directly from disk without checking is_deleted.
Impact: Deleted files may still be accessible by direct URL.
Recommendation: Enforce DB checks or remove the route for sensitive uploads.

10) Medium - Over-broad admin authorization
- src/lib/validators/authFromToken.js:36 treats "employee" and "manager" as admin for validateAdminAuth.
Impact: All employees can access admin API routes guarded by validateAdminAuth.
Recommendation: Tighten roles or split checks (admin vs. employee) if this is not intended.

11) Low - Auth token stored in JS-accessible cookie
- src/contexts/auth.js:19 sets httpOnly: false for auth_token.
Impact: XSS could exfiltrate tokens more easily.
Recommendation: Consider httpOnly cookies and a server-side logout endpoint, or short-lived access tokens with refresh flow.

## Performance Improvements

1) Parallelize search queries
- src/app/api/search/route.js:30,45,70,81,153 runs multiple queries sequentially.
Recommendation: Use Promise.all to execute independent queries concurrently.

2) Stream large file responses instead of buffering
- src/app/api/uploads/lots/[...path]/route.js:150 and src/app/mediauploads/[...path]/route.js:88 read entire files into memory.
Recommendation: Stream file responses to reduce memory spikes for large assets.

3) Rate limiting in-memory store is per-instance only
- src/lib/rateLimit.js uses a process-local Map.
Recommendation: Use a shared store (Redis) in production to avoid uneven rate limits and improve scalability.

## Notes
- No tests were run as part of this review.