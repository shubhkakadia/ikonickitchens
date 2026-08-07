# API Versioning Migration Guide

## Purpose

This guide describes how to migrate the Ikoniq Kitchens API from unversioned routes such as:

```text
/api/v1/client/all
/api/v1/project/123
/api/v1/signin
```

to explicit, URL-based API versions:

```text
/api/v1/client/all
/api/v1/project/123
/api/v1/signin
```

The goal is to let the existing Next.js admin website and a new mobile app use the same backend contract without forcing both clients to upgrade at the same time.

The recommended approach is a staged migration:

1. Freeze and document the current API contract as `v1`.
2. Extract route logic into reusable server handlers.
3. Expose the handlers at `/api/v1/...`.
4. Keep temporary legacy `/api/v1/...` compatibility routes.
5. Move the web frontend to a centralized API client configured for `v1`.
6. Build the mobile client against `v1` from the beginning.
7. Monitor legacy traffic, announce a removal date, and then remove the old routes.

This is an API routing change. It does **not** require a Prisma schema or database migration.

---

## Migration status — 6 August 2026

The routing and web-call migration is complete:

- [x] All 88 current API route files are now under `src/app/api`.
- [x] The frontend application calls have been updated to use the `/api/v1/...` prefix.
- [x] A repository scan found 212 frontend references to `/api/v1/` and no remaining direct unversioned `/api/v1/...` application calls outside API route implementations.
- [x] Added shared API version and JSON response helpers in `src/lib/api/v1/`.
- [x] Extracted the `health`, `signin`, `signout`, and `signup` v1 operations into server-only handlers; their App Router files are now thin adapters.

The unversioned route entry points are no longer present in the repository. This means deployed clients must use `/api`; add temporary legacy adapters before release if an older web deployment or another installed client still needs `/api/v1/...` URLs. The following work is still required before the migration can be considered fully complete:

- [ ] Decide whether legacy compatibility routes are required and, if so, add thin adapters that delegate to the v1 implementation.
- [ ] Document the remaining public v1 endpoints in `docs/openapi/v1.yaml` (health and authentication are complete).
- [ ] Add and run v1/legacy contract tests, including upload and range-request coverage.
- [ ] Run `npm run lint`, `npm run build`, and staging smoke tests for `MASTER`, `ADMIN`, and `MANAGER` users.
- [ ] Configure mobile environments, secure token storage, and v1-only mobile services.
- [ ] Add version/client observability and publish a legacy-route deprecation and sunset policy.

This guide now serves as the completion checklist for the remaining validation, mobile, and release work.

---

## 1. Versioning rules

### 1.1 Use URL path versioning

Use a major version in the URL:

```text
https://api.example.com/api/v1/projects
```

Do not put minor or patch versions in the URL. Compatible additions remain in `v1`; breaking changes create `v2`.

### 1.2 What counts as a breaking change?

Create a new major API version when a change can break an already-released client, for example:

- Removing or renaming a response field.
- Changing a field's type or meaning.
- Making an optional request field required.
- Changing authentication behavior.
- Changing status codes relied on by clients.
- Changing pagination, filtering, sorting, or error formats incompatibly.
- Replacing an endpoint or changing its HTTP method.

The following are normally safe within the same version:

- Adding an optional request field.
- Adding a response field.
- Adding a new endpoint.
- Fixing a bug so the implementation matches the documented contract.

Mobile releases can remain installed for months, so old API versions must continue working for a documented support window.

### 1.3 Keep v1 behavior stable during this migration

The existing API uses action-oriented paths such as `/all`, `/create`, and `/upsert`. Do not combine versioning with a full REST redesign. First preserve the existing paths and payloads under `/api`. A later `v2` can introduce resource-oriented routes if the benefit justifies the client migration.

---

## 2. Current repository assessment

The backend has 88 Next.js App Router route files, all under `src/app/api`. Frontend application calls have been migrated to `/api/v1/...`.

Authentication is already suitable for native mobile clients:

```http
Authorization: Bearer <session-token>
```

`POST /api/v1/signin` returns the token in `data.token`, and protected endpoints validate it against the `sessions` table. The token currently expires after 30 days.

Important current characteristics to retain in v1:

- Standard JSON shape is generally `{ status, message, data }`.
- Protected routes use the bearer token rather than a browser-only cookie.
- Mutating routes write audit records through `withLogging`.
- Critical records use soft deletion.
- Upload routes handle multipart bodies, file streaming, range requests, and downloads.
- Sign-in is rate limited.

The route inventory has been migrated. Retain it as a verification checklist for every route returned by:

```bash
find src/app/api -name 'route.js' -o -name 'route.ts' | sort
```

The route groups that need a v1 equivalent are:

| Domain                       | Current route group                                                           |
| ---------------------------- | ----------------------------------------------------------------------------- |
| Authentication               | `signin`, `signout`, `signup`                                                 |
| Access and users             | `user`, `module_access`, `notification_config`                                |
| Core business                | `client`, `contact`, `project`, `lot`, `stage`, `employee`                    |
| Inventory                    | `item`, `stock_tally`, `stock_transaction`, `reserve_item_stock`              |
| Procurement                  | `supplier`, `materials_to_order`, `materials_to_order_item`, `purchase_order` |
| Documents                    | `lot_file`, `lot_tab_notes`, `uploads`, `deletedmedia`, `deletedrecords`      |
| Scheduling and operations    | `meeting`, `maintenance_checklist`, `dashboard`, `search`, `logs`             |
| Configuration and operations | `config`, `health`, `admin/cleanup-sessions`                                  |

---

## 3. Target architecture

Use one implementation per operation and expose it through versioned route entry points.

```text
src/
├── app/
│   └── api/
│       ├── v1/
│       │   ├── signin/route.js
│       │   ├── client/[id]/route.js
│       │   └── ...
│       └── ... temporary legacy routes
├── server/
│   └── api/
│       └── v1/
│           ├── auth/signin.js
│           ├── clients/clientById.js
│           └── ...
└── lib/
    └── api/
        ├── response.js
        └── version.js
```

The files under `src/app/api` should be thin routing adapters. Database queries, validation, authentication, logging, and business rules belong in reusable server-only handler modules. This prevents copying hundreds of route files and later fixing bugs in only one copy.

Add `import "server-only"` to extracted backend modules where appropriate, so client components cannot accidentally import database code.

---

## 4. Backend implementation

### Step 1: Record the v1 contract before moving code

For every endpoint, record:

- Method and path.
- Whether authentication is required.
- Required user type or module permission.
- Path, query, and body fields.
- Content type (`application/json`, `multipart/form-data`, or streamed file).
- Success response shape and status code.
- Expected error codes.
- Whether the endpoint writes an activity log.

Save this contract in an OpenAPI document such as `docs/openapi/v1.yaml`. At minimum, document sign-in and the endpoints needed by the first mobile feature before that feature is implemented.

Do not expose Prisma records indiscriminately. Explicit response selections are the public v1 contract; database fields may change independently.

### Step 2: Add version constants

Create `src/lib/api/v1/version.js`:

```js
export const CURRENT_API_VERSION = "v1";
export const CURRENT_API_PREFIX = `/api/v1/${CURRENT_API_VERSION}`;
```

The server does not need this constant to discover routes, but clients, tests, logs, and deprecation helpers should share it.

### Step 3: Standardize JSON responses

Create `src/lib/api/v1/response.js`:

```js
import { NextResponse } from "next/server";

export function apiSuccess(data, message = "Success", status = 200) {
  return NextResponse.json({ status: true, message, data }, { status });
}

export function apiError(message, status = 500, details) {
  return NextResponse.json(
    {
      status: false,
      message,
      ...(details === undefined ? {} : { details }),
    },
    { status },
  );
}
```

Keep current v1 response keys compatible. Do not replace `status` with another field during this migration. Never send stack traces, Prisma errors, file paths, secrets, or raw validation internals to clients.

Recommended status codes:

| Situation                   | Status |
| --------------------------- | -----: |
| Successful read/update      |    200 |
| Successful creation         |    201 |
| Invalid input               |    400 |
| Missing/expired token       |    401 |
| Authenticated but forbidden |    403 |
| Missing record              |    404 |
| Duplicate/conflict          |    409 |
| Validation failure          |    422 |
| Rate limited                |    429 |
| Unexpected server failure   |    500 |

If an existing endpoint returns a different success code and clients depend on it, retain that behavior in v1 and normalize it only in a future major version.

### Step 4: Extract one endpoint as the migration pattern

Start with a low-risk read endpoint, then sign-in, then one complete CRUD domain. For example, move the implementation of `src/app/api/v1/client/[id]/route.js` to:

```js
// src/server/api/v1/clients/clientById.js
import "server-only";

import { prisma } from "@/lib/db";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";
import { apiError, apiSuccess } from "@/lib/api/v1/response";

export async function getClient(request, { params }) {
  const authError = await validateAdminAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const client = await prisma.client.findFirst({
    where: { client_id: id, is_deleted: false },
    // Keep the existing explicit select here.
  });

  if (!client) return apiError("Client not found", 404);
  return apiSuccess(client, "Client fetched successfully");
}

export async function updateClient(request, { params }) {
  // Move the existing PATCH implementation here unchanged first.
}

export async function deleteClient(request, { params }) {
  // Move the existing soft-delete implementation here unchanged first.
}
```

Then create the versioned route:

```js
// src/app/api/v1/client/[id]/route.js
export {
  getClient as GET,
  updateClient as PATCH,
  deleteClient as DELETE,
} from "@/server/api/v1/clients/clientById";
```

During the compatibility period, replace the old route implementation with another thin adapter:

```js
// src/app/api/v1/client/[id]/route.js
export {
  getClient as GET,
  updateClient as PATCH,
  deleteClient as DELETE,
} from "@/server/api/v1/clients/clientById";
```

Both URLs now execute exactly the same code. Repeat this extraction pattern; do not copy the original route into both directories.

### Step 5: Migrate routes in domain batches

Use this order so dependencies are migrated before higher-level screens:

1. `health`.
2. `signin`, `signout`, `signup`.
3. `user`, `module_access`, `notification_config`.
4. `config`, `employee`, `client`, `contact`, `supplier`.
5. `project`, `lot`, `stage`, `meeting`.
6. `item`, stock and reservation routes.
7. materials-to-order and purchase-order routes.
8. uploads, file metadata, deletion/recovery routes.
9. dashboard, logs, search, and maintenance operations.

For each route:

- Preserve every supported HTTP method.
- Preserve dynamic segment names because handler code reads them from `params`.
- Preserve query parameter names and response shapes.
- Retain `validateAdminAuth`/other authorization checks.
- Retain `withLogging` on mutations.
- Retain soft-delete filters and behavior.
- Add route-level tests for both the v1 path and temporary legacy alias.
- Mark the endpoint complete in the route inventory.

Example mappings:

| Old                                         | Versioned v1                                |
| ------------------------------------------- | ------------------------------------------- |
| `POST /api/v1/signin`                       | `POST /api/v1/signin`                       |
| `POST /api/v1/signout`                      | `POST /api/v1/signout`                      |
| `GET /api/v1/client/all`                    | `GET /api/v1/client/all`                    |
| `GET/PATCH/DELETE /api/v1/client/:id`       | `GET/PATCH/DELETE /api/v1/client/:id`       |
| `GET /api/v1/project/:id/used-materials`    | `GET /api/v1/project/:id/used-materials`    |
| `POST /api/v1/maintenance_checklist/upsert` | `POST /api/v1/maintenance_checklist/upsert` |
| `POST /api/v1/uploads/lots/:path*`          | `POST /api/v1/uploads/lots/:path*`          |

### Step 6: Treat authentication as a public mobile contract

Keep v1 authentication behavior:

```http
POST /api/v1/signin
Content-Type: application/json

{
  "username": "...",
  "password": "..."
}
```

Successful response:

```json
{
  "status": true,
  "message": "Login successful",
  "data": {
    "user": {},
    "token": "...",
    "sessionId": "..."
  }
}
```

Authenticated request:

```http
Authorization: Bearer <token>
```

Security requirements:

- Serve production requests only over HTTPS.
- Keep the generic invalid-credentials response to prevent username discovery.
- Keep or strengthen sign-in rate limiting. The current in-memory limiter is per-process; use a shared store such as Redis when the backend runs on multiple instances.
- Store only a hash of newly-issued session tokens in the database when that security improvement can be rolled out safely. Raw tokens in the current schema should be treated as secrets.
- Provide explicit session expiry handling. A `401` must cause clients to clear credentials and return to sign-in.
- Decide separately whether v1 needs refresh tokens. Do not silently extend the current contract during the routing move.
- Ensure module authorization is enforced on the server. Client-side `ProtectedRoute` checks are user experience controls, not security boundaries.

### Step 7: Handle uploads and media carefully

Move upload routes only after JSON routes are stable. Preserve:

- `multipart/form-data` field names.
- File size and MIME validation.
- Malware scanning behavior.
- Path traversal protection.
- Range requests and `206 Partial Content` for media playback.
- `Content-Type`, `Content-Length`, `Content-Disposition`, `Accept-Ranges`, and cache headers.

Do not manually set the multipart `Content-Type` in Axios; the runtime must add its boundary.

Database `url` values may currently contain paths such as `mediauploads/...` or old API URLs. Separate storage identity from the public API URL. Prefer returning a versioned download URL from a serializer rather than rewriting every stored row. If stored API URLs must be migrated, make that a separately tested data migration.

For large mobile uploads, consider a later resumable/direct-to-object-storage design. That is not required for API versioning.

### Step 8: Decide browser CORS policy

Native iOS and Android networking is not governed by browser CORS. CORS matters if the web frontend is hosted on a different origin from the API, or if Expo web/browser clients access it.

If cross-origin web access is needed, allow only configured origins, methods, and headers. Do not use `Access-Control-Allow-Origin: *` together with credentials. At minimum allow `Authorization` and `Content-Type`, and implement `OPTIONS` responses. Keep the policy in one middleware/helper rather than duplicating it in 78 routes.

### Step 9: Add version and deprecation observability

Add structured request logs containing:

- API version.
- Route template and method.
- Status code and duration.
- Request/correlation ID.
- User ID when authenticated, but never the token.
- Client platform and app version from headers such as `X-Client-Platform` and `X-Client-Version`.

For temporary legacy responses, add headers such as:

```http
Deprecation: true
Sunset: Wed, 31 Dec 2026 23:59:59 GMT
Link: </api/v1/client/all>; rel="successor-version"
```

Choose a real removal date only after deployed clients are migrated. Track legacy traffic by path and client version before removal.

---

## 5. Web frontend migration

### Step 1: Centralize the Axios client

The current web app embeds `/api/v1/...` strings throughout components. Create `src/lib/api/v1/client.js`:

```js
import axios from "axios";
import { CURRENT_API_PREFIX } from "@/lib/api/v1/version";

export const apiClient = axios.create({
  baseURL: CURRENT_API_PREFIX,
  timeout: 30_000,
});

apiClient.interceptors.request.use((config) => {
  // Read the token from the existing auth state/storage abstraction.
  const token = getStoredSessionToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  config.headers["X-Client-Platform"] = "web";
  config.headers["X-Client-Version"] =
    process.env.NEXT_PUBLIC_APP_VERSION || "development";

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearStoredSession();
      // Notify the auth layer or redirect from a client-safe location.
    }
    return Promise.reject(error);
  },
);
```

Import the real token getter and clear-session functions used by this project; do not create competing authentication storage.

For browser requests on the same origin, `baseURL: "/api"` is correct. If the web frontend and API become separate deployments, use a validated environment value:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.example.com/api
```

Do not include secrets in any `NEXT_PUBLIC_*` variable.

### Step 2: Create domain-level API functions

Components should not construct endpoint paths. Add modules such as `src/lib/api/v1/clients.js`:

```js
import { apiClient } from "./client";

export async function listClients(params) {
  const response = await apiClient.get("/client/all", { params });
  return response.data;
}

export async function getClient(id) {
  const response = await apiClient.get(`/client/${encodeURIComponent(id)}`);
  return response.data;
}

export async function updateClient(id, payload) {
  const response = await apiClient.patch(
    `/client/${encodeURIComponent(id)}`,
    payload,
  );
  return response.data;
}
```

This produces `/api/v1/client/...` because the Axios instance owns the prefix.

### Step 3: Replace direct calls domain by domain

Replace:

```js
axios.get("/api/v1/client/all", {
  headers: { Authorization: `Bearer ${token}` },
});
```

with:

```js
listClients();
```

Start with authentication and shared components (`SearchBar`, `ProtectedRoute`, `ContactSection`, `StockTally`), then migrate admin pages in the same domain order as the backend.

Use searches as completion gates:

```bash
rg -n '["`]/api/v1/' src --glob '!src/app/api/v1/**'
rg -n 'axios\.(get|post|put|patch|delete)|axios\.request|fetch\(' src --glob '!src/app/api/v1/**'
```

Review every remaining match. Some file URLs and external integrations are intentionally different, but ordinary application requests should go through the centralized client.

### Step 4: Keep uploads separate but centralized

Create upload helpers that use `apiClient` and accept `FormData`. Do not serialize `FormData` as JSON. For progress reporting, retain the existing Axios `onUploadProgress` configuration.

When the API returns media URLs, treat them as opaque URLs. Do not make UI components insert or remove `/v1` themselves.

---

## 6. Mobile app integration

The mobile app should never use the temporary unversioned endpoints.

### Step 1: Configure environments

Use a complete absolute base URL because native apps have no same-origin `/api` host:

```text
development: http://<LAN-IP>:3000/api
staging:     https://staging-api.example.com/api
production:  https://api.example.com/api
```

`localhost` from a physical phone refers to the phone, not the development computer. Use the computer's reachable LAN address for local device testing. Android emulators commonly use `10.0.2.2` for the host; iOS Simulator can usually reach the Mac through `localhost`, but an explicit environment configuration is clearer.

Production must use HTTPS. Do not disable iOS App Transport Security or Android cleartext restrictions for production.

### Step 2: Create one mobile API client

Example Axios setup for React Native/Expo:

```js
import axios from "axios";
import * as SecureStore from "expo-secure-store";

export const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_BASE_URL,
  timeout: 30_000,
});

apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync("session_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  config.headers["X-Client-Platform"] = "mobile";
  config.headers["X-Client-Version"] = getApplicationVersion();
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync("session_token");
      notifySignedOut();
    }
    return Promise.reject(error);
  },
);
```

Use the platform's secure credential storage (Keychain/Keystore through a library such as Expo SecureStore). Do not store the bearer token in AsyncStorage, Redux persistence, logs, analytics, crash reports, or source code.

### Step 3: Implement sign-in and sign-out

On sign-in:

1. Send credentials to `POST /signin` through the v1 client.
2. Save `data.token` in secure storage.
3. Keep non-sensitive user profile data in application state.
4. Fetch permissions/profile if the screen requires them.

On sign-out:

1. Call `POST /signout` so the server session is revoked.
2. Clear the local token even if the network request fails.
3. Clear cached private data and return to the sign-in flow.

On `401`, clear the session and require sign-in. On `403`, keep the session and show a permissions message. Do not treat those cases as equivalent.

### Step 4: Build typed domain services

If the mobile app uses TypeScript, define request and response types from the v1 OpenAPI contract. Prefer generated types/client code once the contract is stable. Keep UI screens dependent on service functions such as `getProject(id)`, not raw URLs.

### Step 5: Design for mobile network conditions

- Show explicit loading, empty, offline, and retry states.
- Retry idempotent reads only, with exponential backoff and jitter.
- Do not automatically retry creates, stock movements, purchase orders, or uploads unless the API supports idempotency keys.
- Add an `Idempotency-Key` contract before retrying financial or inventory mutations.
- Cancel obsolete requests when screens unmount or search terms change.
- Paginate large lists and logs; do not download the complete database to the device.
- Cache only data appropriate for the user's permissions, and clear it on sign-out.

---

## 7. Testing strategy

### 7.1 Contract tests

For every handler, test:

- Valid authenticated request.
- Missing, invalid, and expired token (`401`).
- Insufficient permission (`403`).
- Validation failure.
- Missing record (`404`).
- Conflict where applicable (`409`).
- Successful mutation and its audit log.
- Soft-deleted records remain unavailable.

Run the same contract cases against `/api/v1/...` and the legacy alias during the compatibility period. Responses should be equivalent except for deprecation headers.

### 7.2 File route tests

Test upload success and rejection, path traversal attempts, deleted files, download disposition, correct MIME types, and byte-range requests. Test on a physical phone for camera images, large files, interrupted networks, and media playback.

### 7.3 Client tests

Verify:

- The base URL contains exactly one `/api` prefix.
- The bearer token is attached once.
- `401` clears the session.
- `403` does not sign the user out.
- Query values and dynamic IDs are encoded.
- Upload bodies remain multipart.
- Error messages work when the response has no body or the device is offline.

### 7.4 Repository verification

After each batch:

```bash
npm run lint
npm run build
```

Then manually test sign-in, permissions, representative CRUD flows, soft deletion/recovery, stock changes, purchase orders, file upload/download, and sign-out as `MASTER`, `ADMIN`, and `MANAGER` users.

Use a staging database and upload directory for destructive integration tests. Never run deletion tests against production data.

---

## 8. Deployment and rollback

Deploy in this order:

1. Deploy shared handlers plus `/api` routes while keeping legacy routes.
2. Smoke-test v1 in staging.
3. Deploy backend v1 to production.
4. Confirm monitoring, authorization, logging, and uploads.
5. Release the web frontend configured for v1.
6. Confirm legacy traffic drops for the web client.
7. Release the mobile app using v1.
8. Track traffic by API version and mobile app version.
9. Publish the legacy sunset date.
10. Remove legacy routes only after the support window and usage threshold are satisfied.

Because the legacy and versioned routes initially share handlers, rollback is straightforward: point the web client back to the legacy prefix while investigating. Do not roll the mobile app back to unversioned routes; mobile releases cannot be recalled reliably.

For a future `v2`, keep `v1` handlers intact and add new `v2` handlers only where behavior differs. Shared, version-neutral domain services can be used by both versions, but each version needs its own request validation and response serialization contract.

---

## 9. Definition of done

The migration is complete when:

- [x] Every current endpoint has an inventoried `/api` equivalent.
- [ ] One server handler owns each v1 operation; route files do not duplicate business logic.
- [ ] Authentication, authorization, rate limits, activity logging, and soft deletion still work.
- [ ] Upload, download, and range-request behavior is preserved.
- [ ] The v1 contract is documented in OpenAPI.
- [ ] The web app uses a centralized v1 client and domain service modules.
- [x] No unintended direct unversioned application calls remain in frontend code.
- [ ] The mobile app uses an absolute v1 base URL and secure token storage.
- [ ] Automated tests cover v1 and temporary legacy aliases.
- [ ] Staging smoke tests pass for all user types.
- [ ] Production dashboards show traffic by API version and client version.
- [ ] A deprecation and sunset policy is published before legacy routes are removed.
- [ ] `npm run lint` and `npm run build` pass.

---

## 10. Recommended first implementation slice

Use this small vertical slice to prove the design before migrating all 78 files:

1. Add version and response helpers.
2. Extract and expose `GET /api/v1/health`.
3. Extract and expose `POST /api/v1/signin` and `POST /api/v1/signout`.
4. Extract the client routes: `all`, `allnames`, `slug-availability`, `create`, and `[id]`.
5. Add legacy adapters pointing to the same handlers.
6. Add web `apiClient`, authentication service, and client service.
7. Migrate the login and clients screens.
8. Add contract tests and run lint/build.
9. Test the same flow from a physical mobile device.
10. Review the pattern, then migrate the remaining domains batch by batch.

This slice exercises public authentication, protected reads and mutations, dynamic paths, query strings, authorization, logging, soft deletion, web usage, and mobile usage without beginning with the highest-risk upload and procurement routes.
