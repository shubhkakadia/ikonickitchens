# Security & Performance Audit — Ikoniq Kitchen and Cabinet

**Date:** 2026-09-25
**Branch audited:** `dev` @ `459c8eb`
**Scope:** All API routes (`src/app/api/v1/**`, `src/server/**`, `src/app/mediauploads/**`), core libraries (`src/lib/**`), Prisma schema, frontend (`src/app/**`, `src/components/**`, `src/state/**`, `src/contexts/**`), `next.config.mjs`, and production dependencies (`npm audit --omit=dev`).
**Method:** Manual read-through of the code. No dynamic testing against a running instance. Items that could not be fully confirmed statically are marked **(Needs verification)**.

---

## Executive Summary

| Severity    | Count  |
| ----------- | ------ |
| 🔴 Critical | 11     |
| 🟠 High     | 24     |
| 🟡 Medium   | 26     |
| 🟢 Low      | 18     |
| **Total**   | **79** |

The biggest risk is **authorization**. The server only checks that a caller is logged in. It never checks _who_ they are or what they are allowed to do:

1. **Anyone on the internet** can create a `master-admin` account, because `/api/v1/signup` has no auth check.
2. **Any logged-in user**, including the lowest `employee` type, can reset any other user's password, promote themselves, grant themselves every module permission, read every employee's TFN and bank details, and read password hashes.
3. **Uploaded files** (supplier statements, invoices, employee photos, lot drawings) are served to **unauthenticated** visitors, with predictable file names.
4. **Next.js 15.5.9** has a known **critical unauthenticated RCE on Windows-hosted servers**, and this app runs on Windows.

The second biggest risk is **inventory data integrity**. Stock quantities are read, computed in JavaScript, and written back as absolute values without locks. Several flows can double-count, lose updates, go negative, or permanently leak reserved stock.

Performance problems come mostly from **unbounded queries** (no pagination anywhere, and the audit log grows forever), **whole-file buffering** for media, **~20 MB of unoptimized hero images** on the public homepage, and **public pages that don't server-render** because of a global `PersistGate`.

### Recommended order of work

1. Upgrade `next` to ≥ 15.5.26 (C6).
2. Lock down signup, module access, and user PATCH, and add server-side role/module checks (C1–C4).
3. Require auth on file serving and sanitise upload paths and types (C5, H5, H6).
4. Stop returning password hashes and PII (H1, H2), and revoke sessions on deactivation (H3).
5. Fix the employee cascade and the stock integrity bugs (C7–C11, H15–H22).
6. Add pagination, indexes, and streaming (H11, H12, M10, M18).
7. Optimize the public site (H13, H14).

---

## Status Update (2026-10-01)

Re-checked every finding against the current working tree (uncommitted changes included). This was a static read of the code; nothing was run.

| Status          | Count | Findings                                                |
| --------------- | ----- | ------------------------------------------------------- |
| ✅ Fixed        | 17    | C1–C6, C8–C11, H1, H8, H11, H23, M2, L5, L18            |
| 🟡 Partly fixed | 13    | C7, H3, H6, H9, H18, H22, M8, M9, M13, M20, M23, L1, L3 |
| ⬜ Open         | 49    | everything else                                         |

Newly confirmed fixed since the last update: **C8** (item PATCH no longer writes `quantity`), **C9** (PO PATCH receive branch refuses and points to `received_items`), **C10** (reservation delete restores only `quantity - used_quantity`), **L18** (one lower-cased `user_type` source). The partly-fixed items are annotated in the checklist below.

---

## Table of Contents

- [🔴 Critical](#-critical)
- [🟠 High](#-high)
- [🟡 Medium](#-medium)
- [🟢 Low](#-low)
- [✅ Master Checklist](#-master-checklist)

---

## 🔴 Critical

### C1. Unauthenticated signup lets anyone create a `master-admin` account

- **Category:** Security — Broken authentication
- **Location:** `src/server/api/v1/auth/signup.js:9-167` (exported via `src/app/api/v1/signup/route.js`)
- **Cause:** The handler has no `validateAdminAuth` / `withMasterAdminAuth` call and no rate limit. It trusts `user_type`, `is_active`, and the full `module_access` object from the request body.
- **Impact:** `POST /api/v1/signup {"username":"x","password":"y","user_type":"master-admin","is_active":true,"module_access":{...all true}}` creates a full admin account. This is a complete takeover of all business, HR, and financial data.
- **Fix:** Wrap the handler in master-admin auth, validate `user_type` against an enum, and whitelist the boolean `module_access` keys:
  ```js
  export const signup = withMasterAdminAuth(async (request, session) => {
    /* ... */
  });
  const USER_TYPES = ["master-admin", "admin", "manager", "employee"];
  if (!USER_TYPES.includes(user_type))
    return apiError("Invalid user type", 400);
  ```
  Also enforce a password policy (minimum length, and not equal to the username).

### C2. `module_access/create` is unauthenticated and passes the raw body to Prisma

- **Category:** Security — Broken access control / mass assignment
- **Location:** `src/app/api/v1/module_access/create/route.js:4-14`
- **Cause:** There is no auth check, and `prisma.module_access.create({ data: body })` accepts any column.
- **Impact:** An anonymous caller can create permission rows for any `user_id`, for example one pre-provisioned for an account they then obtain through C1.
- **Fix:** Require master-admin auth and build `data` from an explicit whitelist of boolean keys. If the route is unused (signup creates module access itself), delete it.

### C3. There is no server-side authorization: every logged-in user is effectively an admin

- **Category:** Security — Broken access control
- **Location:**
  - `src/lib/validators/authFromToken.js:29-38` (`isAdmin` returns true for `admin`, `master-admin`, `manager` **and `employee`**) and `:57-72` (`validateAdminAuth`)
  - All 82 routes that use it
  - `src/app/api/v1/module_access/[id]/route.js:31-66` (PATCH)
  - `src/components/ProtectedRoute.jsx` (module checks exist only in the browser)
- **Cause:** `validateAdminAuth` only checks that the session exists and has not expired. No API route reads `module_access`. User type is checked only in `lot/installer/[id]` and `notification_config/[user_id]`.
- **Impact:** An `employee` account meant only for site photos can:
  - `PATCH /api/v1/module_access/<own id>` with every flag set to `true`
  - call any API directly (suppliers, purchase orders, statements, employees, deleted-records recovery, deleted-media purge)
- **Fix:**
  1. Add `requireAuth(req, { roles?, module? })`. It does one session lookup (including `user` and `module_access`), checks `is_active`, checks the role, then checks the module flag. `master-admin` bypasses the module check.
  2. Apply it to every route with the matching module flag (e.g. `all_employees`, `purchaseorder`, `statements`, `delete_media`).
  3. Restrict `module_access/*`, `user/*`, and `signup` to `master-admin`.
  4. Restrict the `employee` type to the site-photo and installer endpoints.

### C4. Any user can reset any other user's password, change their role, or activate/deactivate them

- **Category:** Security — Account takeover / privilege escalation
- **Location:** `src/app/api/v1/user/[id]/route.js:43-116` (PATCH)
- **Cause:** `old_password` is verified only _if it is supplied_. There is no check that the caller is the target user or a master-admin. `user_type` and `is_active` come straight from the body.
- **Impact:**
  - `PATCH /api/v1/user/<master-admin-id> {"password":"owned"}` takes over the master account.
  - `{"user_type":"master-admin"}` on your own ID escalates you.
- **Fix:**
  - When `session.user_id === id`, require `old_password` and forbid changing `user_type`, `is_active`, or `module_access`.
  - Otherwise, require `master-admin`.
  - Revoke the target's sessions on password, role, or status change (see H3).

### C5. Uploaded files are served without authentication and are publicly cacheable

- **Category:** Security — Sensitive data exposure
- **Location:**
  - `src/app/mediauploads/[...path]/route.js:49-96` (no auth at all)
  - `src/app/api/v1/uploads/lots/[...path]/route.js:93-194` (GET has no auth; POST and DELETE do)
- **Cause:** Both handlers serve any file under `mediauploads/` and send `Cache-Control: public, max-age=31536000, immutable`.
- **Impact:** File names are predictable and IDs are short and sequential, so these are easy to enumerate without logging in:
  - `/mediauploads/suppliers/<supplier_id>/statements/<supplier_id>_statement_<MonthYear>.pdf`
  - `/mediauploads/purchase_order/<order_no>.pdf`
  - `/mediauploads/employees/<employee_id>.webp`
  - lot drawings and photos

  Shared proxies and CDNs may also cache these private documents for a year.

- **Fix:**
  - Authenticate the GET handlers. `<img>` tags can't send a Bearer header, so use an `HttpOnly` session cookie (see H4) or short-lived HMAC-signed URLs.
  - Change the cache header to `Cache-Control: private, no-store` (or `private, max-age=300`).
  - Look up the requested path in `lot_file`, `media`, or `supplier_file`, and return 404 when the file is unknown or `is_deleted` (this also fixes M2).

### C6. Critical vulnerabilities in production dependencies (Next.js RCE, jsPDF)

- **Category:** Security — Vulnerable components
- **Location:** `package.json`. Installed: `next@15.5.9`, `jspdf@3.0.4`. `npm audit --omit=dev` reports **17 vulnerabilities (2 critical, 11 high, 4 moderate)**.
- **Cause / Impact:**
  - **next 15.5.9** has about 30 advisories, including _unauthenticated RCE on Windows-hosted servers_ (GHSA-p293-qw3h-jr36, fixed in 15.5.24), _RCE in Image Optimization via AVIF_ (GHSA-2xp9-vwfh-vxw4), middleware bypass, cache poisoning, SSRF, and DoS. The server runs on Windows and uses `next/image`.
  - **jspdf 3.0.4** has local file inclusion / path traversal (GHSA-f8cm-6447-x5h2), PDF JavaScript injection, and DoS. It is used in `MaterialSelection.jsx`.
- **Fix:**
  - `npm i next@^15.5.26 eslint-config-next@^15.5.26`. This is non-breaking and the **top priority**.
  - `npm i jspdf@^4.2.1`. This is a major version; re-test PDF export.
  - Re-run `npm audit` afterwards.

### C7. Purging an employee's photo hard-deletes the employee (schema cascade)

- **Category:** Data integrity — Data loss
- **Location:**
  - `prisma/schema.prisma:114`: `image media? @relation(fields: [image_id], references: [id], onDelete: Cascade)`
  - `src/app/api/v1/deletedmedia/[filename]/route.js:84` and `deletedmedia/all/route.js:140` (`prisma.media.delete`)
- **Cause:** The foreign key is on `employees.image_id` with `onDelete: Cascade`. Deleting the media row therefore deletes the employee that references it.
- **Impact:**
  1. An admin soft-deletes an employee, which also soft-deletes the photo.
  2. Someone later empties "Deleted media".
  3. MySQL cascades and permanently deletes the employee row (HR, bank, and TFN data), their `stage_employee` rows, and nulls `users.employee_id` and `lot.installer_id`.
  4. "Recover employee" then has nothing to recover.
- **Fix:**
  - Change the relation to `onDelete: SetNull` and create a migration.
  - Clear `image_id` when an employee is soft-deleted.
  - Make `deletedrecords/recover` un-delete the employee's media too.

### C8. Editing an item overwrites stock quantity with a stale value

- **Category:** Data integrity — Lost update
- **Location:**
  - `src/app/api/v1/item/[id]/route.js:152, 244-253`
  - Client: `src/app/admin/inventory/[id]/page.jsx:1023, 1094-1101` always sends `quantity: item.quantity` as loaded
- **Cause:** `updateData.quantity = parseFloat(quantity)` is an absolute write. It creates no `stock_transaction` and takes no lock.
- **Impact:**
  1. User A opens an item page (stock 20).
  2. 10 units are received (stock 30).
  3. User A fixes a typo and saves. Stock goes back to 20 and the ledger no longer matches.

  Any user can also set arbitrary, negative, or `NaN` stock with no audit trail.

- **Fix:** Remove `quantity` from item PATCH. Change stock only through `stock_transaction` or `stock_tally`, using atomic `increment` / `decrement`.

### C9. The PurchaseOrder PATCH "receive" branch can corrupt other POs and drive stock negative

- **Category:** Data integrity / Security
- **Location:** `src/app/api/v1/purchase_order/[id]/route.js:200-392`
- **Cause:**
  - The line-item lookup `findMany({ where: { id: { in: itemIds } } })` is **not scoped to `order_id`**.
  - `newDelivery = newTotalReceived - currentReceived` can be negative and is applied as `increment`.
  - The writes run in `Promise.all` with no `$transaction`.
  - No `stock_transaction` row is written, and there is no over-receive or CANCELLED check.
- **Impact:**
  - Sending `{received_items:[{id:<line on another PO>, quantity_received:0}]}` rewrites another PO and decrements stock without limit.
  - A double-submit doubles the stock increment.
  - A partial failure leaves the writes half-applied.

  The UI now uses `/purchase_order/received_items`, but this branch is still reachable.

- **Fix:** Delete this branch, or delegate it to the `received_items` logic, which locks correctly. If it stays:
  - scope the lookup with `order_id: id`
  - reject negative deltas
  - run everything in `$transaction` with the PO row locked
  - write a ledger row

### C10. Deleting a partially used reservation puts consumed stock back

- **Category:** Data integrity
- **Location:** `src/app/api/v1/reserve_item_stock/[id]/route.js:244-259`, together with `stock_transaction/create/route.js:110-119`
- **Cause:** DELETE restores `increment: existingReservation.quantity` (the full amount) instead of `quantity - used_quantity`.
- **Impact:**
  1. Reserve 10 (stock 100 → 90).
  2. Use 6 against the reservation.
  3. Delete the reservation. Stock becomes 100, although only 94 units physically exist.
- **Fix:** Restore only `quantity - used_quantity`, or refuse the delete when `used_quantity > 0`.

### C11. Hard-deleting or rebuilding an MTO cascade-deletes reservations without returning the reserved stock

- **Category:** Data integrity / soft-delete policy violation
- **Location:**
  - `src/app/api/v1/materials_to_order/[id]/route.js:97-107` (PATCH: `items: { deleteMany: {}, create: ... }`)
  - `src/app/api/v1/materials_to_order/[id]/route.js:366-380` (DELETE)
  - Schema cascades at `prisma/schema.prisma:644, 796`
- **Cause:** Reservations cascade-delete, but the units they deducted from `item.quantity` are never added back. The recreated items also reset `quantity_ordered_po` and `quantity_used` to 0.
- **Impact:** Stock is permanently understated, the MTO can be ordered or consumed a second time, and `purchase_order_item.mto_item_id` becomes NULL.
- **Fix:**
  - Soft-delete MTOs.
  - Update MTO items by diffing and upserting by ID instead of delete-and-recreate.
  - In the same transaction, restore `quantity - used_quantity` for any reservation being removed.
  - Block edits once `used_material_completed` is set.

---

## 🟠 High

### Security

#### H1. Password hashes are returned by several endpoints

- **Location:**
  - `src/app/api/v1/user/[id]/route.js`: GET `:12-21` (full `users` row), PATCH response `:149-176`, DELETE response `:196`
  - `src/app/api/v1/employee/[id]/route.js:50-63` (`user: { include: { module_access: true } }`)
  - `src/app/api/v1/purchase_order/by-supplier/[id]/route.js:38-48` (`orderedBy: { include: ... }`)
  - `src/lib/notification.js:342-360` (loads hashes into memory unnecessarily)
- **Cause:** `include` on a `users` relation returns every scalar field, including `password`.
- **Impact:** Any logged-in user (see C3) can collect bcrypt hashes and crack them offline.
- **Fix:** Always use `select` on `users`, e.g. `{ id, username, user_type, is_active }`. Consider a Prisma client extension that omits `password` globally (`omit: { users: { password: true } }`).

#### H2. Employee TFN, bank, super, DOB, and address are exposed to every user

- **Location:**
  - `src/app/api/v1/employee/all/route.js:9-17` and `employee/all_inactive/route.js:9-17`
  - `employee/[id]` GET, PATCH, and DELETE responses
  - `employee/create` response
  - `deletedrecords/recover`
- **Cause:** `findMany({ include: { image: true } })` returns every column.
- **Impact:** An `employee` account can harvest every staff member's TFN and bank account in one request. This is also a privacy-law exposure (Australian Privacy Act, TFN Rule).
- **Fix:**
  - Use a shared `EMPLOYEE_PUBLIC_SELECT` that excludes the financial fields.
  - Serve financials only from a dedicated master-admin endpoint, masked (`***1234`).
  - Encrypt `tfn_number` and `bank_account_number` at rest.

#### H3. Sessions survive deactivation, password change, and role change for 30 days

- **Location:**
  - `src/lib/validators/authFromToken.js:4-38` (never checks `users.is_active`; trusts `session.user_type` copied at signin)
  - `src/server/api/v1/auth/signin.js:80-81` (30-day expiry)
  - `src/app/api/v1/user/[id]/route.js:109-116` (no session revocation)
- **Impact:** A dismissed employee, or an attacker holding a stolen token, keeps full access with the old role for up to 30 days after being deactivated or having the password reset.
- **Fix:**
  - Look up the session with `include: { user: { select: { is_active, user_type } } }` and reject when `!user.is_active`.
  - Use the live `user.user_type`, not the copied one.
  - `tx.sessions.deleteMany({ where: { user_id } })` whenever the password, `is_active`, or `user_type` changes.
  - Shorten sessions to about 7 days with sliding renewal.

#### H4. The session token is readable by JavaScript (a non-HttpOnly cookie plus localStorage)

- **Location:**
  - `src/contexts/auth.js:14-20` (`httpOnly: false`, `maxAge: 30 days`)
  - `src/state/action/loggedInUser.js:27-33` (token stored in Redux)
  - `src/state/store/index.js:23-30` (`persistConfig` with no whitelist, so the token ends up in `localStorage["persist:root"]`)
- **Impact:** Any XSS (see H6 and the dependency CVEs) can steal a 30-day bearer token that keeps working after the tab closes.
- **Fix:**
  - Have signin set an `HttpOnly; Secure; SameSite=Lax` cookie and stop returning the token in the JSON body.
  - Read the cookie on the server.
  - Whitelist only UI slices in redux-persist (`tabs`, `sidebar`, `tableFilters`, ...).
  - Delete the unused `xero` slice (`src/state/reducer/xeroCredentials.js`).

#### H5. Arbitrary file write through path traversal in upload file names

- **Location:**
  - `src/lib/fileHandler.js:161-163, 176` (`baseName = idPrefix`, then `path.join(targetDir, targetName)` with no sanitising)
  - Callers: `employee/create/route.js:28, 135-140` (`employee_id`), `purchase_order/create/route.js:19, 120-125` (`order_no`)
- **Impact:** `employee_id=../../public/x` with an uploaded file writes to `<cwd>/public/x.<ext>`. `mkdir({recursive:true})` creates any missing directories, so a new file can be planted anywhere the Node process can write. The bad path is also saved as the DB `url`, and the purge endpoints later `unlink` it (see M3).
- **Fix:** Sanitise inside `uploadFile` so every caller is covered, and validate `employee_id` and `order_no` with a strict regex at the API layer:
  ```js
  const safe = (s) =>
    String(s)
      .replace(/[^A-Za-z0-9_-]/g, "_")
      .slice(0, 100);
  const root = path.resolve(process.cwd(), uploadDir) + path.sep;
  const target = path.resolve(targetDir, targetName);
  if (!target.startsWith(root)) throw new Error("Invalid path");
  ```

#### H6. No file-type allowlist, and SVG is served inline (stored XSS leading to token theft)

- **Location:**
  - `src/lib/fileHandler.js:116-118` (`allowedTypes` and `allowedExtensions` default to `null`, and no caller sets them) and `:48` (SVG kept as-is)
  - Served inline as `image/svg+xml` by `mediauploads/[...path]/route.js:23-24, 93` and `uploads/lots/[...path]/route.js:67-68`
- **Impact:** A user uploads `plan.svg` containing `<script>`. When an admin opens it on the app origin, the script reads `document.cookie` and `localStorage` (see H4) and takes over the account.
- **Fix:**
  - Pass per-route allowlists (images only for employee and item uploads; a document and media list for lots).
  - Verify magic bytes with `file-type` instead of trusting the client `file.type`.
  - When serving, add `X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'none'; sandbox`, and send anything outside a safe inline list as `Content-Disposition: attachment`.

#### H7. Lot upload does not validate the `projectId` path segment (Needs verification)

- **Location:** `src/app/api/v1/uploads/lots/[...path]/route.js:213, 311-315` (`subDir: \`${projectId}/${lotId}/${tabKind}\``)
- **Cause:** `tabKind` is whitelisted and `lotId` must exist in the DB, but `projectId` is never validated or compared with `lot.project.project_id`. POST has no containment check.
- **Impact:** Files can be filed under the wrong project folder. If Next decodes `%2F` or `..` inside catch-all segments, this is also a path traversal write.
- **Fix:** Take `project_id` from the DB lot record rather than the URL, and apply the containment check from H5.

#### H8. IDOR: any installer can read another installer's lots

- **Location:** `src/app/api/v1/lot/installer/[id]/route.js:24-39`
- **Cause:** For non-admins, the route filters by `installer_id: id` from the URL instead of the caller's own `employee_id`.
- **Fix:** For non-admins, derive `employee_id` from the session user and ignore the path parameter.

#### H9. High-severity vulnerable dependencies

- **Location:** `package.json`
- **Details and fixes:**

| Package                                                                                | Issue                                                                                 | Fix                                                                             |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `xlsx@0.18.5`                                                                          | Prototype pollution and ReDoS. Uploaded files are parsed in `StockTally.jsx:119,207`. | `npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (no npm fix exists) |
| `@tiptap/*` ≤ 3.30.4                                                                   | `__proto__` in `mergeAttributes`, ReDoS                                               | Upgrade to ≥ 3.30.5                                                             |
| `sharp`                                                                                | libvips CVEs, reachable through image uploads                                         | Upgrade to ≥ 0.35.4                                                             |
| `mariadb` 3.4.0–3.4.5 (via `@prisma/adapter-mariadb`)                                  | Cleartext password under MitM; multibyte SQL edge case                                | Add `"overrides": { "mariadb": "^3.4.6" }` and confirm with `npm ls mariadb`    |
| `postcss`, `fast-uri`, `nanoid`, `qs`, `dompurify`, `fflate`, `mysql2`, `deepmerge-ts` | Various                                                                               | Fixed by the `next` upgrade plus `npm audit fix`                                |

### Performance

#### H10. Uploads have no size limit, and whole bodies are buffered in memory (DoS)

- **Location:**
  - `src/lib/fileHandler.js:282` (`request.formData()`) and `:16-17, 181-183` (`arrayBuffer()`, `Buffer.from`, plus sharp output)
  - `uploads/lots` POST `:244-248` (any number of files per request)
- **Impact:** A single 2 GB upload, or several concurrent video uploads from site staff, can exhaust Node memory and crash the server for everyone. A small PNG decompression bomb can make sharp allocate gigabytes, because the default `limitInputPixels` is about 268 MP.
- **Fix:**
  - Check `Content-Length` before calling `formData()`.
  - Pass `maxSize` at every call site and cap the number of files per request.
  - Use `sharp(buf, { limitInputPixels: 50e6 })`.
  - Stream large media to disk (busboy piped into `fs.createWriteStream`).
  - Enforce `client_max_body_size` at the reverse proxy.

#### H11. `/mediauploads` reads whole files into memory and has no Range support

- **Location:** `src/app/mediauploads/[...path]/route.js:88` (`await fs.promises.readFile(normalized)`)
- **Impact:** Every request loads the entire file (videos included) into the heap, and seeking a video re-downloads it in full. A few concurrent views of a large video can cause an OOM.
- **Fix:** Stream with `fs.createReadStream` plus `Readable.toWeb`, and support `Range` requests (reuse the logic in `uploads/lots` GET). Better still, merge the two routes into one hardened handler.

#### H12. `GET /logs` returns the entire, ever-growing audit table

- **Location:** `src/app/api/v1/logs/route.js:9-16` (`findMany` with no `take`)
- **Impact:** Every mutation writes a log row. The logs page gets slower until it times out and can spike server memory.
- **Fix:** Cursor pagination (`take: Math.min(limit, 200)`, `cursor`, `skip: 1`), plus filters on `entity_type`, `user_id`, and date range. Indexes for these already exist.

#### H13. About 20 MB of unoptimized hero images on the public homepage

- **Location:**
  - `public/Gallery/3.png` (7.4 MB), `1.png` (6.3 MB), `2.png` (6.1 MB), and `public/logo2.png` (5.4 MB)
  - Rendered as a CSS `backgroundImage` in `src/app/page.jsx:23-26, 275`, which bypasses `next/image`
- **Impact:** Very slow first paint and LCP, especially on mobile. The 5.4 MB logo is also fetched on every PDF export (`MaterialSelection.jsx:1400`).
- **Fix:**
  - Convert the gallery images to WebP or AVIF at about 1920 px (200–400 KB each).
  - Render the hero with `<Image fill priority sizes="100vw">`.
  - Shrink the logo to under 50 KB.

#### H14. Public marketing pages don't server-render (a global `PersistGate` plus `"use client"` everywhere)

- **Location:** `src/app/providers.jsx:24` (`<PersistGate loading={<Loader/>}>` wraps every route via `src/app/layout.jsx:29`). All public pages start with `"use client"`.
- **Impact:** The SSR HTML for the homepage, kitchens, bathrooms, portfolio, and other public pages is just a loader. That hurts SEO and LCP, and the admin Redux and auth bundle ships to every marketing visitor.
- **Fix:** Move `Providers` and `AuthProvider` into `src/app/admin/layout.jsx`. Make public pages Server Components with small client islands for the carousels and accordions.

### Data integrity / correctness

#### H15. Stock tally is broken (dropped column), and it would lose updates once fixed

- **Location:** `src/app/api/v1/stock_tally/route.js:72-162`
- **Cause:**
  - It selects `supplier_reference` on `item`, but that column now lives on `item_suppliers` (dropped in migration `20260211054711`). Every row errors, yet the endpoint still returns `status: true`, and `:159` leaks the Prisma error text.
  - Once that is fixed, the "lock" comment is still wrong: `findUnique` takes no lock under REPEATABLE READ. The write is an absolute `quantity: newQty`, and `Math.floor` truncates `Decimal(10,2)` values.
- **Fix:**
  - Remove the stale field.
  - Use an optimistic write, `updateMany({ where: { item_id, quantity: current_quantity } })`, and return a conflict when `count === 0`. Alternatively use `SELECT … FOR UPDATE`.
  - Batch the rows into fewer transactions.

#### H16. `materials_to_order_item` PATCH always returns 500 (dropped relation)

- **Location:** `src/app/api/v1/materials_to_order_item/[id]/route.js:49, 73, 123, 148, 220` (`item.supplier`). Also latent in `item/[id]/route.js:242-243` (`price`).
- **Impact:** `quantity_ordered` can never be updated.
- **Fix:** Take supplier data from `itemSuppliers`, and remove `price`.

#### H17. Reservations can over-reserve and push stock negative (check-then-act race)

- **Location:** `src/app/api/v1/reserve_item_stock/create/route.js:46-112`, `reserve_item_stock/[id]/route.js:108-155`
- **Cause:**
  - The availability check runs outside the transaction, then an unconditional `decrement` follows.
  - Nothing checks `item_id === mtoItem.item_id`, that total reservations stay within the MTO quantity, or that the item isn't deleted.
  - `parseInt` truncates fractional quantities.
- **Impact:** Two users reserving the last 10 units at the same time leave stock at −10.
- **Fix:** Do a conditional atomic update inside the transaction, and validate the item match and MTO total there too:
  ```js
  const r = await tx.item.updateMany({
    where: { item_id, quantity: { gte: qty } },
    data: { quantity: { decrement: qty } },
  });
  if (r.count === 0) throw new Error("INSUFFICIENT_STOCK");
  ```

#### H18. USED stock transactions: `quantity_used` loses updates and allows over-use

- **Location:** `src/app/api/v1/stock_transaction/create/route.js:50-62, 150-153` (and a mislabelled error split at `:205`)
- **Cause:** The value is read outside the transaction and written back as an absolute.
- **Fix:** Use a conditional `updateMany` with `{ quantity_used: { lte: max - qty } }` and `increment` inside the transaction. Fix the `split(":")` indices.

#### H19. Receiving goods can over-receive, receive a CANCELLED PO, and bypass guards

- **Location:**
  - `src/app/api/v1/stock_transaction/create/route.js:234-339` (the ADDED path has no over-receive check and an absolute `quantity_received` write)
  - `src/app/api/v1/purchase_order/received_items/route.js:99-130, 184-193` (the PO line map is keyed by `item_id`; duplicate lines in one request bypass the over-receive check; no status guard)
- **Impact:** Sending `[{item_id:A,quantity:10},{item_id:A,quantity:10}]` against a line of 10 records 20 received and adds 20 to stock. A CANCELLED PO can still add stock.
- **Fix:**
  - Aggregate the request by line before checking, and key the map by PO line ID.
  - Reject CANCELLED and DRAFT POs.
  - Make ADDED go through the same locked logic as `received_items`.

#### H20. PO create: lost update on `quantity_ordered_po`, and the client controls status, totals, and `orderedBy`

- **Location:** `src/app/api/v1/purchase_order/create/route.js:17-21, 45, 142-191, 199-224`
- **Cause:**
  - The absolute write `alreadyOrdered + orderedThisPO` loses concurrent increments, and two lines for the same item keep only the last quantity.
  - `status`, `orderedBy_id`, and `total_amount` all come from the form.
  - Quantities are not validated.
  - The invoice file is created before the transaction, so a failure orphans it.
- **Fix:**
  - Use `quantity_ordered_po: { increment }`.
  - Force `status: "DRAFT"` and `orderedBy_id = session.user_id`.
  - Compute totals on the server with Decimal.
  - Validate quantities as positive numbers.
  - Create the file record inside the transaction.

#### H21. PO PATCH and DELETE are hard deletes that desynchronise MTOs and received stock

- **Location:** `src/app/api/v1/purchase_order/[id]/route.js:442-521` (`deleteMany` on lines that may already be received) and `:601` (`purchase_order.delete`)
- **Impact:**
  - `quantity_ordered_po` is never recalculated, so MTOs look ordered forever.
  - Received quantities can move to a different `item_id`.
  - `quantity` can be set below `quantity_received`.
  - Status can be set to FULLY_RECEIVED by hand.
- **Fix:**
  - Soft-delete (or CANCEL) POs.
  - Recompute `quantity_ordered_po` in the same transaction.
  - Lock line edits once anything has been received, and disallow manual receive statuses.

#### H22. Marking an MTO "used material completed" can run twice (double stock decrement)

- **Location:** `src/app/api/v1/materials_to_order/[id]/route.js:155-241`
- **Cause:** A snapshot read of `used_material_completed` means a double-click runs the decrement twice. `status` is also mass-assigned with no enum check.
- **Fix:** Claim the transition atomically, then validate `status` against the enum:
  ```js
  const r = await tx.materials_to_order.updateMany({
    where: { id, used_material_completed: false },
    data: { used_material_completed: true },
  });
  if (r.count === 0) return; // already done
  ```

#### H23. User PATCH is not atomic, crashes on a password-only update, and returns 404 after committing

- **Location:** `src/app/api/v1/user/[id]/route.js:73-159`
- **Cause:**
  - `users.update` commits first.
  - `module_access.update` then reads `updateData.module_access.all_clients`, which throws a TypeError when `module_access` is absent. The route returns 404 "User not updated" although the password was already changed.
  - `existingUser.password` crashes when the user doesn't exist.
  - An `is_active` value of `"false"` from FormData is a string, and Prisma rejects it.
- **Fix:** Wrap the update in `$transaction`, update `module_access` only when it is provided, coerce booleans, and return 404 early when the user is missing.

#### H24. Hard deletes break the soft-delete policy and erase audit attribution

- **Location:**
  - `user/[id]/route.js:196` (`users.delete`; the `logs.user` relation is `onDelete: SetNull` at `schema.prisma:736`, so every log entry loses its author)
  - `contact/[id]:95`, `stage/[id]:197`, `meeting/[id]:254`, `config/[id]:132`
  - `supplier/[id]/statements/[statementId]:512` (a financial record)
  - `item/[id]:260` (`item_suppliers` delete-and-recreate loses price history), `item/[id]:297,350`, `employee/[id]:37` (media)
  - `stock_transaction/create:91,107` (fully consumed reservations)
- **Fix:**
  - Add `is_deleted` to these models and filter reads on it.
  - Deactivate users instead of deleting them.
  - Set `logs.user` to `onDelete: Restrict`.
  - For photo replacement, upload the new file first, then swap, then soft-delete the old one.

---

## 🟡 Medium

### Security

#### M1. ClamAV fails open on timeouts and scans files that are already servable

- **Location:** `src/lib/scanFile.js:5-16`, `src/lib/fileHandler.js:179-200`
- **Cause:** `clamscan` resolves with `isInfected: null` on a timeout or an unknown response. `null` is falsy, so the file is treated as clean. The file is also written into the public `mediauploads/` directory _before_ the scan runs. The socket path is hardcoded to a Linux path.
- **Fix:**
  - Treat anything other than `isInfected === false` as infected.
  - Write to a quarantine directory, scan, then `rename` into place.
  - Read the socket path from an environment variable.

#### M2. Soft-deleted files are still served, and `immutable` caching keeps stale images

- **Location:** `mediauploads/[...path]/route.js` (no `is_deleted` check); `uploads/lots/[...path]/route.js:135-147` (checks `lot_file` only)
- **Impact:** Deleted material-selection, MTO, and PO media stay reachable. A replaced employee photo keeps its file name, so browsers show the old photo for up to a year.
- **Fix:** Return 404 when the DB record is deleted or unknown (deny by default). Use `private` caching, and use content-hashed or random file names.

#### M3. The deleted-media purge picks records by non-unique filename and unlinks without a path check

- **Location:** `src/app/api/v1/deletedmedia/[filename]/route.js:24-67`, `deletedmedia/all/route.js:76-120`
- **Cause:**
  - `findFirst({ where: { filename } })` matches on the original client file name (e.g. `image.jpg`), so it can pick the wrong record.
  - The name is run through `decodeURIComponent` twice.
  - Nothing checks that the path stays inside `mediauploads/`, which combines badly with H5.
- **Fix:** Purge by `{ table, id }`, check containment before unlinking, and remove the second decode.

#### M4. No security headers; deprecated `images.domains` with a hardcoded LAN IP

- **Location:** `next.config.mjs:3-5`
- **Impact:**
  - Clickjacking is possible (no `X-Frame-Options`).
  - There is no CSP to limit XSS.
  - There is no HSTS.
  - `X-Powered-By` is sent.
  - The image optimizer will fetch from `192.168.1.200`.
- **Fix:**
  - Set `poweredByHeader: false`.
  - Switch to `images.remotePatterns` and read the host from an environment variable.
  - Add `async headers()` with `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security: max-age=63072000; includeSubDomains`, `Permissions-Policy`, and a CSP. Start the CSP in Report-Only mode.

#### M5. The WhatsApp token uses a `NEXT_PUBLIC_` variable, and its errors are logged

- **Location:** `src/lib/notification.js:6-13, 63`
- **Cause:**
  - `process.env.NEXT_PUBLIC_WHATSAPP_ACCESS_TOKEN`: any client import would inline the token into public JS. None exists today (Needs verification: grep `.next/static` for `EAA`).
  - `console.error(error)` logs the axios config, including the `Authorization` header.
  - A Graph phone-number ID is hardcoded, and a real-looking mobile number appears in a comment.
  - The commented-out `NEXT_PUBLIC_XERO_CLIENT_SECRET` in `.env` has the same prefix problem.
- **Fix:**
  - Rename to `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_API_URL`.
  - Add `import "server-only"` to `notification.js`.
  - Log only `error.response?.status` and `data`.
  - Rotate the token.

#### M6. The PDF.js worker is loaded from unpkg without integrity checking

- **Location:** `deletefiles/page.jsx:47`, `projects/components/ViewMedia.jsx:18`, `projects/[id]/page.jsx:46`, `suppliers/components/PurchaseOrderForm.jsx:20`, `suppliers/purchaseorder/page.jsx:46`
- **Impact:** This is a supply-chain risk. If unpkg is unavailable, PDF preview breaks.
- **Fix:** Self-host the worker with `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)`, configured once in a shared module.

#### M7. No 401 handling on the client and no route middleware

- **Location:** No axios instance or interceptor exists. `src/state/action/loggedInUser.js:103-115` trusts the persisted `isAuthenticated` flag. There is no `middleware.js`.
- **Impact:** When a session expires, the UI stays "logged in" and every call fails. `/admin/*` pages are gated only in React.
- **Fix:** Create a shared `axios.create()` with a 401 interceptor that clears the user and redirects to login. Validate the session on app start (e.g. `/api/v1/me`). Optionally add a `middleware.js` cookie check for `/admin/*`.

#### M8. The rate limiter is spoofable, in-memory only, and applied only to signin

- **Location:** `src/lib/rateLimit.js:20-27`; used only in `src/server/api/v1/auth/signin.js`
- **Cause:**
  - The key is the first `X-Forwarded-For` value, which the client controls unless the proxy overwrites it, so a new header per attempt bypasses the limit.
  - The in-memory `Map` resets on restart and isn't shared between instances.
  - Signup, password change, and upload endpoints are not limited.
  - Signin also returns 403 "not active" before rejecting the password, which reveals which accounts are deactivated.
- **Fix:**
  - Derive the IP from a trusted proxy hop (or the platform's request IP).
  - Also rate-limit per username.
  - Move the store to Redis or the database if there is more than one instance.
  - Check the password before revealing account status.

### Correctness / reliability

#### M9. `validateSession` rejects every session; cleanup logs the caller out; expired sessions are never purged

- **Location:** `src/lib/session.js:35` (`!user.is_verified`, a column that doesn't exist on `users`), `src/app/api/v1/admin/cleanup-sessions/route.js`
- **Impact:**
  - Calling `admin/cleanup-sessions` deletes the caller's own session and returns 401.
  - Nothing ever calls `cleanupExpiredSessions`, so the `sessions` table grows without bound.
  - A missing user also causes a null dereference.
- **Fix:**
  - Remove the `is_verified` check (or add the column) and guard `if (!user)`.
  - Schedule `cleanupExpiredSessions` in `src/lib/cron-jobs.js`.
  - Consolidate the two auth systems (`session.js` / `auth-middleware.js` and `authFromToken.js`) into one.

#### M10. Partial PATCH updates wipe data

- **Location:**
  - `stage/[id]/route.js:73-100`: omitting dates nulls them, and omitting `assigned_to` removes every assignee.
  - `meeting/[id]/route.js:28-29, 92-97`: participant and lot arrays default to `[]` and are applied with `set`.
  - `contact/[id]/route.js:53-54`: omitting them detaches the contact from its client or supplier.
- **Fix:** Include a field only when it is `!== undefined` (the `buildPartialUpdate` pattern in `employee/[id]`). Touch relations only when the array was actually sent.

#### M11. Invalid dates are silently stored as NULL or crash with a 500

- **Location:**
  - `processDateTimeField` (`authFromToken.js:41-48`), used in `lot/create`, `lot/[id]`, `stage/create`, `stage/[id]`, `project/create`, `employee/create`, and `employee/[id]`
  - `meeting/create` and `meeting/[id]` call `.replace` on non-strings
- **Impact:** Invalid Dates also pass the stage-within-lot range checks, because every comparison with `NaN` is false.
- **Fix:** Use a shared `parseDateOrThrow` that returns 400 on invalid input, and validate request bodies with zod (already a dependency).

#### M12. Quantity types don't match: `item.quantity` is Decimal but ledger quantities are Int

- **Location:** `prisma/schema.prisma:462` vs `:634-638, 684-685, 705, 792-793`
- **Impact:** Any fractional use, waste, or tally (e.g. edging tape in metres) makes the ledger insert fail and returns a generic 500. Elsewhere, `Math.floor` and `parseInt` silently truncate.
- **Fix:** Use `Decimal(10,2)` everywhere and validate with `z.number().positive().multipleOf(0.01)`.

#### M13. Numeric input validation is weak across write endpoints

- **Location:** `stock_transaction/create:600-618`, `received_items:49-73`, `materials_to_order/create:39-42`, `materials_to_order/[id]:101-105`, `supplier/[id]/statements:156`, `statements/[statementId]:337-339`, `purchase_order/[id]:419-437`
- **Impact:**
  - Zero, NaN, string, and negative values reach Prisma and come back as 500s.
  - Zero-quantity transactions are accepted, and **each one triggers paid WhatsApp sends** to every subscriber.
  - Negative statement amounts are accepted.
- **Fix:** A zod schema per route, and pass money values as strings to Decimal.

#### M14. `reserve_item_stock/[id]` GET and PATCH always return 500

- **Location:** `src/app/api/v1/reserve_item_stock/[id]/route.js:10-13, 56-59`
- **Cause:** The code reads `authResult.authenticated`, but `validateAdminAuth` returns `null` on success, so this throws a TypeError.
- **Fix:** `const authError = await validateAdminAuth(request); if (authError) return authError;`

#### M15. ReferenceErrors after a successful commit cause duplicate retries

- **Location:**
  - `reserve_item_stock/create/route.js:121-125` (undefined `employee` in the log-failure branch)
  - `uploads/lots/[...path]/route.js:359` (undefined `tab.id`)
  - `maintenance_checklist/upsert/route.js:45-53` (returns 500 when only the log write failed)
- **Impact:** The client sees a 500 for a change that was saved, retries, and creates a second reservation (another stock decrement) or duplicate files.
- **Fix:** Fix the variable names. Never fail the request because logging failed. Call `checkAndUpdateMTOStatus(tx, …)` inside the transaction.

#### M16. Meeting overlap check is global, misses open-ended meetings, and races

- **Location:** `meeting/create/route.js:51-76`, `meeting/[id]/route.js:61-81`
- **Cause:**
  - The check blocks any two meetings at the same time company-wide, regardless of who attends.
  - Meetings with a NULL `date_time_end` are never matched.
  - There is no transaction around the check.
  - The 409 response includes the other meeting's notes.
- **Fix:**
  - Scope the check to shared participants.
  - Treat a NULL end as equal to the start time.
  - Return only the conflicting meeting's ID, title, and times.

#### M17. Orphaned files and records across upload flows

- **Location:**
  - `purchase_order/[id]:151-176, 438-439` (the old invoice is never soft-deleted)
  - `purchase_order/create:117-139` (file saved before the transaction)
  - `supplier/[id]/statements/[statementId]:96-150` (no cleanup when the transaction fails)
  - `uploads/lots` POST `:309-342` (files 1..N-1 are kept when file N fails)
  - `item/create:195-248` (item committed, then the image fails, so the route returns 500 and a retry creates a duplicate)
- **Fix:** Put the DB work in a transaction, clean up files in `catch`, and soft-delete replaced files.

#### M18. Notifications block requests, have no timeout, repeat, and go to non-participants

- **Location:**
  - `lot/[id]:187-207`, `stage/create:124-146`, `stage/[id]:144-167`, `meeting/create:136-229`, `meeting/[id]:125-218`
  - `stock_transaction/create:755`, `materials_to_order/create:124`, `materials_to_order/[id]:278`, `supplier/[id]/statements:208`, `materials_to_order_item/[id]:228`
  - `src/lib/notification.js:54, 223`
- **Cause:**
  - `await sendNotification` runs in the request path, and axios has no timeout.
  - The installer notification fires on _every_ edit of a lot that has an installer.
  - "Stage completed" repeats on every edit while the stage is DONE.
  - Meeting details go to every user with meeting notifications on, not just the participants.
- **Fix:**
  - Fire and forget with `after()` from `next/server` (or use a queue), and set `timeout: 10000`.
  - Notify only on transitions.
  - Limit meeting recipients to the participants.

### Performance

#### M19. Unbounded list endpoints with deep nested includes (and the client filters them in JS)

- **Location (server):**
  - `purchase_order/all:9-53` (four levels of include)
  - `materials_to_order/all:9-67`
  - `materials_to_order/used_material_list:12-61`
  - `materials_to_order/cumulative:12-50`
  - `stock_transaction/used:11-38`
  - `stock_transaction/by-item/[id]:12-25`
  - `item/[id]:69-105, 509-540` (every transaction, fetched on both GET and PATCH)
  - `item/all/[category]`, `purchase_order/by-supplier`, `supplier/statements:9-19`
  - `client/all:10-32`, `project/all:9-26` (full lot rows including LongText)
  - `project/[id]:11-48`, `lot/active:10-57`, `lot/sitemeasurements:11-58`, `lot/[id]:15-66`
  - `meeting/all:10-34` (every meeting ever), `contact/all`, `client/allnames`, `employee/all`, `deletedrecords/all`
- **Location (client):**
  - `suppliers/purchaseorder/page.jsx:187`, `suppliers/materialstoorder/page.jsx:420`, `inventory/page.jsx:248, 261-264, 323-570`
  - `/supplier/all` is fetched separately by 6 components
- **Fix:**
  - Server-side `take`/`skip` or cursor pagination, with filtering and sorting via query parameters.
  - Use `select` instead of `include: true`.
  - Use `_count` or `groupBy` for summary figures.
  - Add date windows (e.g. meetings from the last 30 days onward).
  - Cache shared lookups (suppliers, employees) with SWR or Redux.

#### M20. The dashboard aggregates in JS and ignores soft deletes

- **Location:** `src/app/api/v1/dashboard/route.js`: `:342-353` (sums statements in JS), `:369-373, 528-530` (`groupBy` over all items, then sort and slice in JS), `:374-391` (unbounded `topstagesDue`), `:393-406, 485-525` (average duration in JS), `:108-141` (`year` not validated), `:291` (server-local timezone)
- **Impact:** The dashboard is slow, and **every KPI includes soft-deleted projects and lots**.
- **Fix:**
  - Use `aggregate({ _sum })`, `groupBy` with `orderBy: { _count }` and `take: 10`, and `$queryRaw AVG(DATEDIFF(...))` for durations.
  - Add `is_deleted: false` to every filter.
  - Validate `year` with `/^\d{4}$/`.
  - Use the Australia/Adelaide timezone.

#### M21. Search: no limits, sequential queries, and soft-deleted results

- **Location:** `src/app/api/v1/search/route.js:37-208`
- **Cause:** Five sequential `findMany` calls, with items matching on 15 OR'd `LIKE %x%` conditions across joins. There is no `take` and no minimum length, so searching "a" returns nearly everything. Soft-deleted records are not filtered out.
- **Fix:** Require a term length between 2 and 100, set `take: 10` per entity, run the queries with `Promise.all`, and add `is_deleted: false`. Consider FULLTEXT indexes.

#### M22. Missing indexes and missing uniqueness constraints

- **Location:** `prisma/schema.prisma`
- **Add indexes:**
  - `lot @@index([status, is_deleted])` and `@@index([installer_id, status, is_deleted])`
  - `meeting @@index([date_time])` and `@@index([date_time_end])`. The model has **no** indexes today.
  - `project @@index([is_deleted, client_id])`, `client @@index([is_deleted, client_name])`, `employees @@index([is_deleted, is_active])`
  - `purchase_order @@index([status, createdAt])` and `@@index([supplier_id, createdAt])`
  - `materials_to_order @@index([createdAt])`, `supplier_statement @@index([month_year])`, `stage @@index([status, endDate])`
  - `stock_transaction @@index([type, createdAt])`, `@@index([item_id, createdAt])`, `@@index([project_id, type])`
  - `item @@index([category, is_deleted])`
- **Add uniqueness:** `item_suppliers @@unique([item_id, supplier_id])`, `purchase_order_item @@unique([order_id, item_id])`, `materials_to_order_item @@unique([mto_id, item_id])`. The code already assumes these (H19, H20, H18).
- **Remove redundant indexes:** `@@index` on PK or unique columns (`client_id`, `project_id`, `stage_id`, `supplier_id`, `material_selection.id`), and `employees @@unique([employee_id, is_deleted])`.
- **Other:** make `users.user_type` a Prisma enum.

#### M23. Each request runs the same session lookup 2–4 times

- **Location:** `authFromToken.js:57-72` (`isAdmin` and `isSessionExpired` each query), plus per-route `getUserFromToken` calls and `withLogging.js:12`. `material_selection/create:7-24` re-implements the check.
- **Fix:** Have one `requireAuth` call return the session (see C3), and pass it into `withLogging(session, …)`.

#### M24. The admin auth gate remounts on every page and breaks the Rules of Hooks

- **Location:** Every admin page wraps itself in `<AdminRoute>` and there is no `admin/layout.jsx`. `ProtectedRoute.jsx:258` refetches module access on every navigation. `:315-320` has a `useEffect` after the early returns at `:299` and `:303`. The `setTimeout` at 10 s is never cleaned up.
- **Fix:**
  - Create `src/app/admin/layout.jsx` containing the guard.
  - Fetch module access once and cache it.
  - Move all hooks above the early returns and clear the timer.

#### M25. Unstable auth callbacks retrigger fetch effects

- **Location:** `src/contexts/AuthContext.jsx:46-95` (functions and `value` are recreated on every render). They are used as dependencies in about 22 effects, e.g. `inventory/additem/page.jsx:294,334,374,407`, `inventory/[id]/page.jsx:314-427`, `employees/[id]/page.jsx:224`, `MaterialsToOrder.jsx:488`.
- **Fix:** Wrap the functions in `useCallback` and `value` in `useMemo`, or depend on `userData?.token` instead.

#### M26. Heavy libraries imported eagerly into very large client components

- **Location:**
  - `projects/[id]/page.jsx` (3,113 lines) imports `MaterialSelection.jsx` (3,327 lines), which eagerly imports `jspdf` and `xlsx`, plus `react-pdf`.
  - `react-pdf` is also eager in 4 other files.
  - `heic2any` and `browser-image-compression` in `site_photos/page.jsx:8,10`, `jszip` in `deletefiles/page.jsx:17`, `chart.js` in `dashboard/page.jsx:38` and `UsedMaterials.jsx:13`.
  - 11 files exceed 2,400 lines (`inventory/[id]` 3,383, `suppliers/materialstoorder` 3,233, `suppliers/purchaseorder` 3,110, `MaterialsToOrder.jsx` 3,036, …).
  - `next/dynamic` is not used anywhere.
- **Fix:** `await import("jspdf")` and `await import("xlsx")` inside the export handlers. Use `next/dynamic(..., { ssr: false })` for tabs and PDF viewers. Split the large pages into per-tab and per-modal components.

---

## 🟢 Low

#### L1. `error.message` is leaked in API responses

- **Location:** `project/create:186`, `auth-middleware.js:27`, `session-cleanup.js:91`, `received_items:297`, `materials_to_order/cumulative:223`, `used_material_list:405`, `item/[id]:143,382`, `item/create:244`, `stock_tally:159`
- **Fix:** Log the detail on the server and return a generic message.

#### L2. Session tokens are stored in plaintext in the database

- **Location:** `sessions.token`
- **Impact:** Anyone with DB read access (backups, a leaked dump) gets live 30-day bearer tokens.
- **Fix:** Store `sha256(token)` and look it up by hash.

#### L3. Range and Content-Disposition handling in `uploads/lots` GET

- **Location:** `uploads/lots/[...path]/route.js:158-183`
- **Cause:** `bytes=-500` produces `NaN` and a 500. There is no 416 response. File names are not escaped, so a name with `"` or non-Latin-1 characters breaks the header.
- **Fix:** Validate and clamp the range, return 416 when invalid, and use `filename*=UTF-8''…`.

#### L4. Concurrent uploads can overwrite each other through a file-name race

- **Location:** `fileHandler.js:51-59` (check-then-write) with `writeFile` using the default `w` flag
- **Fix:** Write with `{ flag: "wx" }` and retry on `EEXIST`, or add a random suffix.

#### L5. The traversal check uses a bare `startsWith` with no separator

- **Location:** `mediauploads/[...path]/route.js:62-64`, `uploads/lots/[...path]/route.js:106-108, 402-406`
- **Impact:** A sibling folder such as `mediauploads_old` would pass the check.
- **Fix:** Compare against `path.resolve(root) + path.sep`, and reject segments containing `..`, `\`, or NUL.

#### L6. MIME type is taken from the client, and failed WebP conversion stores the original bytes

- **Location:** `fileHandler.js:77, 188-192`; `uploads/lots:317`
- **Impact:** The stored MIME type can be spoofed. When conversion fails, the original bytes (with EXIF/GPS data) are kept but labelled `image/webp`.
- **Fix:** Reject the upload when conversion fails, and derive the MIME type from magic bytes.

#### L7. `lot/create` accepts `"undefined"` as an ID; unique-constraint races return 500 instead of 409

- **Location:** `lot/create/route.js:15-30`, `client/create:30-51`, `client/[id]:105-131`, `lot_tab_notes/create:11` (always fails for an existing tab; use `upsert`), `notification_config/[user_id]` GET, `material_selection/create:203-214` (version number = max + 1), `purchase_order/create` (`order_no`)
- **Fix:** Validate required fields, map Prisma `P2002` to 409 (or retry), and use `upsert` where appropriate.

#### L8. Client slugs may contain digits, but project IDs require letters

- **Location:** `src/lib/clientSlug.js:39-47` vs `src/lib/projectId.js:4-13`
- **Impact:** A client with a slug such as `AB12` can never have a project created.
- **Fix:** Make `isValidClientSlug` use `/^[A-Z]{4}$/` and migrate existing slugs.

#### L9. User-supplied URLs are rendered as links without validation

- **Location:** `admin/clients/[id]/page.jsx:999`, `admin/suppliers/[id]/page.jsx:631`, `admin/inventory/[id]/page.jsx:3060`
- **Note:** React 19 blocks `javascript:` URLs, so this is low risk.
- **Fix:** Validate `^https?://` on the server.

#### L10. Soft-delete is not respected on writes and recovery

- **Location:**
  - PATCH on `client/[id]`, `lot/[id]`, `project/[id]`, `employee/[id]`, `supplier/[id]`, and `item/[id]` edits deleted records.
  - `deletedrecords/recover` doesn't check `is_deleted`, and recovers a lot while its project is still deleted.
  - A deleted or inactive employee can be assigned as installer.
  - Statements can be added to deleted suppliers, and deleted items can be reserved.
- **Fix:** Add `is_deleted: false` to lookups, and return 404 or 409.

#### L11. `used_material_list` and `cumulative` logic is broken

- **Location:** `used_material_list:83` (`status === "RECEIVED"` is not a valid enum value), `:118-119` (`item.supplier` was dropped); `cumulative:83` drops any line that has a reservation
- **Fix:** Use the `PurchaseOrderStatus` values, take suppliers from `itemSuppliers`, and apply the `mtoStatusHelper` logic.

#### L12. N+1 queries and sequential awaits

- **Location:**
  - `received_items:104-169` (one query per item)
  - `stock_tally:65-162` (one transaction per row; about 1,500 round trips for 500 rows)
  - `item/[id]:266-277`, `supplier/create:72-113`, `purchase_order/create:212-224`
  - `client/create:125-133` and `project/create:140-148` (log writes in loops)
  - `item/by-supplier:71-127` (runs the same query twice)
  - `supplier/all:336-343` (sums in JS)
  - `deletedrecords/all` (6 sequential queries)
  - `stock_tally:118-133` (runs `Promise.all` on a single interactive-transaction connection)
- **Fix:** Use `findMany({ in })`, `createMany`, `groupBy` with `_sum`, and `Promise.all` outside transactions.

#### L13. Unused or duplicate dependencies

- **Location:** `package.json`: `recharts` and `framer-motion` (no imports), `emailjs` (duplicates `@emailjs/browser`), `@prisma/adapter-pg` and `pg` (this is a MySQL project), `dayjs` alongside `date-fns`, `jsonwebtoken`, `express-rate-limit`, `react-dnd` (Needs verification)
- **Fix:** Remove unused packages to shrink install size and audit surface.

#### L14. The dashboard clock re-renders the whole page every second

- **Location:** `admin/dashboard/page.jsx:416-421`; there are also 3 carousel intervals in `src/app/page.jsx:166,177,231`
- **Fix:** Move the clock into its own small component.

#### L15. Stale one-off script at the repo root

- **Location:** `migrate_suppliers.js`
- **Cause:** It uses `new PrismaClient()` without the driver adapter, which likely no longer runs on Prisma 7.
- **Fix:** Delete it, or move it to `scripts/` and use the configured client.

#### L16. `params` is not awaited in `meeting/[id]` DELETE

- **Location:** `meeting/[id]/route.js:226, 239, 272`
- **Impact:** Next 15 only warns today, but this breaks in later versions.
- **Fix:** `const { id } = await params`.

#### L17. `materials_to_order/create` reassigns lots without checking them

- **Location:** `materials_to_order/create/route.js:50-55`
- **Impact:** It can take lots that are already linked to another MTO.
- **Fix:** Reject lots that already have an MTO.

#### L18. Inconsistent `user_type` comparisons

- **Location:** `notification_config/[user_id]:12` lowercases the value; `lot/installer/[id]:37,79` compares case-sensitively.
- **Fix:** Use a single enum and helper (see M22 and C3).

---

## ✅ Master Checklist

Tick each box when its fix is merged and verified.

### 🔴 Critical

- [x] **C1** — Unauthenticated signup lets anyone create a master-admin
- [x] **C2** — `module_access/create` is unauthenticated and mass-assigns
- [x] **C3** — No server-side role/module authorization (employee = admin)
- [x] **C4** — Any user can reset any password or change any role
- [x] **C5** — Uploaded files served without auth and publicly cached
- [x] **C6** — Next.js 15.5.9 (Windows RCE and others) and jsPDF critical CVEs
- [ ] **C7** — Media purge cascade hard-deletes employees _(Partial: schema is now `SetNull`, and recover restores the photo, but no migration exists yet, so the DB still has the cascade FK.)_
- [x] **C8** — Item edit overwrites stock with a stale quantity
- [x] **C9** — PO PATCH receive branch corrupts other POs and allows negative stock
- [x] **C10** — Deleting a partially used reservation inflates stock
- [x] **C11** — MTO hard delete/rebuild leaks reserved stock

### 🟠 High

- [x] **H1** — Password hashes returned by user, employee, and PO endpoints
- [ ] **H2** — Employee TFN, bank, and personal data exposed to all users
- [ ] **H3** — Sessions survive deactivation, password change, and role change _(Partial: live `is_active`/role check and session revocation are done; sessions are still 30 days with no sliding renewal.)_
- [ ] **H4** — Session token readable by JS (cookie and localStorage)
- [ ] **H5** — Path traversal file write via `employee_id` / `order_no`
- [ ] **H6** — No file-type allowlist; SVG stored XSS _(Partial: `nosniff` and attachment downloads added; SVG is still served inline, with no allowlist, magic-byte check, or CSP sandbox.)_
- [ ] **H7** — Lot upload `projectId` not validated (needs verification)
- [x] **H8** — Installer lots IDOR
- [ ] **H9** — High-severity dependency CVEs (xlsx, tiptap, sharp, mariadb, …) _(Partial: `next`, `jspdf`, postcss, etc. upgraded; `xlsx`, `@tiptap/*`, `sharp`, and `mariadb` (no override) are still vulnerable.)_
- [ ] **H10** — No upload size limit; full in-memory buffering (DoS)
- [x] **H11** — `/mediauploads` buffers whole files; no Range support
- [ ] **H12** — `/logs` returns the entire audit table
- [ ] **H13** — About 20 MB of unoptimized homepage images
- [ ] **H14** — Public pages don't SSR (global PersistGate)
- [ ] **H15** — Stock tally broken, with lost update
- [ ] **H16** — `materials_to_order_item` PATCH always 500s
- [ ] **H17** — Reservation over-reserve / negative stock race
- [ ] **H18** — USED transaction `quantity_used` lost update _(Partial: item stock decrement is now conditional; `quantity_used` is still an absolute write and the error split is still wrong.)_
- [ ] **H19** — Over-receive via duplicates/ADDED path; CANCELLED POs receivable
- [ ] **H20** — PO create lost update; client-controlled status, totals, orderedBy
- [ ] **H21** — PO PATCH/DELETE hard deletes desync MTOs
- [ ] **H22** — MTO "used material completed" can run twice _(Partial: item decrement is guarded, but the completed flag is still not claimed atomically and `status` is not validated.)_
- [x] **H23** — User PATCH non-atomic and crashes after commit
- [ ] **H24** — Hard deletes break soft-delete policy and audit attribution

### 🟡 Medium

- [ ] **M1** — ClamAV fails open; scan happens after the file is servable
- [x] **M2** — Soft-deleted files still served; stale immutable cache
- [ ] **M3** — Deleted-media purge by non-unique filename, no path check
- [ ] **M4** — No security headers; `images.domains` with LAN IP
- [ ] **M5** — WhatsApp token uses `NEXT_PUBLIC_` and is logged
- [ ] **M6** — PDF.js worker loaded from unpkg
- [ ] **M7** — No client 401 handling or route middleware
- [ ] **M8** — Rate limiter spoofable, in-memory, signin-only; account status leak _(Partial: password is now checked before account status; the IP key is still spoofable, the store is in-memory, and only signin is limited.)_
- [ ] **M9** — `validateSession` `is_verified` bug; sessions never purged _(Partial: `is_verified` bug fixed and cleanup no longer kills the caller; cleanup is still not scheduled.)_
- [ ] **M10** — Partial PATCH wipes stage, meeting, and contact data
- [ ] **M11** — Invalid dates stored as NULL or cause 500s
- [ ] **M12** — Decimal vs Int quantity mismatch
- [ ] **M13** — Weak numeric validation (and WhatsApp spam) _(Partial: MTO quantity validation added; other routes still accept zero, NaN, and negative values.)_
- [ ] **M14** — `reserve_item_stock/[id]` GET/PATCH always 500
- [ ] **M15** — ReferenceErrors after commit cause duplicate retries
- [ ] **M16** — Meeting overlap check global, racy, leaky
- [ ] **M17** — Orphaned files and records in upload flows
- [ ] **M18** — Notifications block requests, repeat, and reach non-participants
- [ ] **M19** — Unbounded list endpoints and client-side filtering
- [ ] **M20** — Dashboard JS aggregation; ignores soft deletes _(Partial: soft-delete filters added to two queries; aggregation is still in JS.)_
- [ ] **M21** — Search unbounded, sequential, includes deleted records
- [ ] **M22** — Missing indexes and uniqueness constraints
- [ ] **M23** — Duplicate session lookups per request _(Partial: `authorizeRequest` does one lookup, but `withLogging` still does a second.)_
- [ ] **M24** — Admin auth gate remount and Rules of Hooks violation
- [ ] **M25** — Unstable auth callbacks retrigger fetches
- [ ] **M26** — Eager heavy imports; very large client components

### 🟢 Low

- [ ] **L1** — `error.message` leaked in responses _(Partial: `received_items` and `stock_tally` fixed; other routes still leak `error.message`.)_
- [ ] **L2** — Plaintext session tokens in the DB
- [ ] **L3** — Range and Content-Disposition header bugs _(Partial: range handling fixed with 416; `Content-Disposition` still lacks `filename*=`.)_
- [ ] **L4** — Upload file-name collision race
- [x] **L5** — Traversal check without path separator
- [ ] **L6** — Client-supplied MIME type; WebP fallback keeps the original
- [ ] **L7** — `"undefined"` IDs; P2002 races return 500
- [ ] **L8** — Client slug digits vs project ID letters
- [ ] **L9** — Unvalidated website hrefs
- [ ] **L10** — Soft-delete not respected on writes and recovery
- [ ] **L11** — `used_material_list` / `cumulative` logic broken
- [ ] **L12** — N+1 queries and sequential awaits
- [ ] **L13** — Unused or duplicate dependencies
- [ ] **L14** — Dashboard clock re-renders the whole page
- [ ] **L15** — Stale `migrate_suppliers.js`
- [ ] **L16** — `params` not awaited in `meeting/[id]`
- [ ] **L17** — MTO create reassigns lots without checking
- [x] **L18** — Inconsistent `user_type` comparisons
