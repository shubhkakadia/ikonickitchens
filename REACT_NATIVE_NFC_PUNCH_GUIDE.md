# React Native NFC Clock Punch Integration

This guide connects a React Native employee app to the Ikoniq Kitchen NFC
clock-punch endpoint.

## User flow

1. The employee selects **Start shift**, **Start break**, **End break**, or
   **End shift** in the app.
2. The app starts an NFC reader session.
3. The employee taps an authorised factory NFC coin.
4. The app reads the opaque token stored in the coin's NDEF text record.
5. The app sends the selected action, tag token, and an idempotency key to the
   API using the employee's existing session token.
6. The server validates the user, employee, tag, action sequence, and minimum
   break, then records the server time.

The NFC token identifies an authorised factory tag. It must not contain an
employee ID, password, API credential, or login session.

## Backend preparation

Apply the migration and regenerate the Prisma client:

```bash
npx prisma migrate deploy
npx prisma generate
```

The migration creates `nfc_punch_tag`, adds `NFC` to `ClockPunchType`, adds the
NFC tag relation and idempotency key to `clock_punch`, and supports pending token
provisioning. The backend generates every 256-bit token; administrators do not
create or type tokens manually.

## Admin-only tag management

The mobile app should expose a tag-management screen only when the authenticated
user is an administrator. The backend independently enforces the same rule, so
hiding the screen is not the security boundary.

The screen should provide:

- **Create coin**: enter its name and location, prepare a token, write it, read
  it back, then confirm it.
- **Read coin**: scan the token and ask the server which station it belongs to.
- **Update coin**: read or select an existing station, prepare a replacement
  token, write/read it, then confirm it.
- **Erase coin**: erase the NDEF message, verify that no valid token remains,
  then soft-delete its backend record.
- **Enable/disable coin**: update `is_active` without rewriting the coin.

Use factory coins that are already NDEF formatted and writable. In particular,
iOS cannot format a completely unformatted NFC tag through the normal NDEF
write operation. Do not make a coin permanently read-only because updating and
erasing are required by this workflow.

### Safe create/update sequence

Creating or updating a coin is deliberately a two-phase operation:

1. Call the provisioning endpoint. The server creates a random token, stores
   only its pending SHA-256 hash, and returns the raw token once.
2. Write that token to the coin as the first NDEF Text record.
3. Read the coin back during the same NFC session and compare the exact token.
4. Call the confirmation endpoint with the tag ID and read-back token.
5. The server atomically promotes the pending hash to the current token and
   activates the coin.

For an update, the previous token remains valid until step 5. If writing fails,
employees can continue using the old coin value. There is a short interval
between a successful physical write and server confirmation in which the new
value is still pending, so confirmation should run immediately.

Prepared tokens expire after 15 minutes. A pending token physically read from a
coin can be identified using the inspect endpoint and then confirmed while it
is still valid. Preparing another update replaces the previous pending token.

### Admin API endpoints

All endpoints require `Authorization: Bearer <admin-session-token>`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/clock_punch/nfc/tags` | List non-deleted coins |
| `POST` | `/api/v1/clock_punch/nfc/tags/provision` | Prepare a create/update token |
| `POST` | `/api/v1/clock_punch/nfc/tags/confirm` | Promote a verified pending token |
| `POST` | `/api/v1/clock_punch/nfc/tags/inspect` | Identify a current or pending token |
| `PATCH` | `/api/v1/clock_punch/nfc/tags/:id` | Rename, relocate, enable/disable, or cancel provisioning |
| `DELETE` | `/api/v1/clock_punch/nfc/tags/:id` | Soft-delete after physical erase |

Prepare a new coin:

```json
POST /api/v1/clock_punch/nfc/tags/provision

{
  "name": "Front entrance coin",
  "location": "Factory front entrance"
}
```

Prepare an update. `name` and `location` are optional for updates:

```json
POST /api/v1/clock_punch/nfc/tags/provision

{
  "tag_id": "existing-tag-id",
  "name": "Front entrance coin",
  "location": "New mounting position"
}
```

The response contains `data.tag.id`, `data.tag_token`, and `data.expires_at`.
Never log or persist `tag_token`; hold it in memory only until write and
confirmation finish.

After writing and reading the same token back, confirm it:

```json
POST /api/v1/clock_punch/nfc/tags/confirm

{
  "tag_id": "tag-id-from-provision-response",
  "tag_token": "exact-token-read-back-from-the-coin"
}
```

Confirmation is idempotent: repeating a completed confirmation returns success.

## Employee punch API contract

### Request

```http
POST /api/v1/clock_punch/nfc
Authorization: Bearer <employee-session-token>
Content-Type: application/json
```

```json
{
  "action": "CLOCK_IN",
  "tag_token": "the-token-read-from-the-ndef-record",
  "idempotency_key": "35d18842-34f9-4cb4-a476-7eb416079ccd"
}
```

Valid actions are:

- `CLOCK_IN`
- `BREAK_IN`
- `BREAK_OUT`
- `CLOCK_OUT`

Create the idempotency key once when the button is pressed. If a network retry
is required, resend the exact same action, tag token, and idempotency key. Do
not generate a new key for the retry.

### Successful response

The first successful request returns HTTP `201`:

```json
{
  "status": true,
  "message": "NFC clock punch recorded successfully",
  "data": {
    "id": "punch-id",
    "action": "CLOCK_IN",
    "punch_type": "NFC",
    "punched_at": "2026-09-04T02:30:00.000Z",
    "nfc_tag": {
      "id": "tag-id",
      "name": "Front entrance coin",
      "location": "Factory front entrance"
    }
  }
}
```

A retry of the same completed request returns HTTP `200` with
`"idempotent_replay": true`. Treat that as success and show the returned punch.

Common errors:

| HTTP status | Meaning                                                        |
| ----------- | -------------------------------------------------------------- |
| `400`       | Invalid action/token/key, or the account has no employee       |
| `401`       | Missing or expired employee session                            |
| `403`       | Unknown/inactive tag or inactive employee                      |
| `409`       | Invalid punch sequence, short break, or reused idempotency key |

## Install NFC support

The examples use
[`react-native-nfc-manager`](https://github.com/revtel/react-native-nfc-manager),
which supports NDEF scanning on Android and iOS.

```bash
npm install react-native-nfc-manager uuid react-native-get-random-values
```

For a bare React Native iOS project, install pods:

```bash
cd ios && pod install && cd ..
```

### Android configuration

Add NFC permission to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.NFC" />
```

It is optional to declare NFC as required. Set it to `true` only if the app
must not be installable on phones without NFC:

```xml
<uses-feature
  android:name="android.hardware.nfc"
  android:required="false" />
```

### iOS configuration

In Xcode, add the **Near Field Communication Tag Reading** capability to the
app target. Add this message to `Info.plist`:

```xml
<key>NFCReaderUsageDescription</key>
<string>Scan a factory tag to confirm your clock punch.</string>
```

### Expo development builds

This native module does not work inside Expo Go. Add its config plugin and make
a new development or production build:

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-nfc-manager",
        {
          "nfcPermission": "Scan a factory tag to confirm your clock punch."
        }
      ]
    ]
  }
}
```

See the library's
[`Expo Go` notes](https://github.com/revtel/react-native-nfc-manager/wiki/Expo-Go)
for the native-build requirement.

## Admin tag-management service

The following service covers reading, creating, updating, and erasing coins.
Replace `getSessionToken()` with the app's secure-storage implementation.

```ts
import { Platform } from "react-native";
import NfcManager, { Ndef, NfcTech } from "react-native-nfc-manager";

const API_BASE_URL = "https://your-api.example.com";

type GetSessionToken = () => Promise<string | null>;

async function adminApi<T>(
  path: string,
  getSessionToken: GetSessionToken,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const sessionToken = await getSessionToken();
  if (!sessionToken) throw new Error("Please sign in again");

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      ...(options.body === undefined
        ? {}
        : { "Content-Type": "application/json" }),
    },
    ...(options.body === undefined
      ? {}
      : { body: JSON.stringify(options.body) }),
  });

  const result = await response.json();
  if (!response.ok || !result.status) {
    throw new Error(result.message || "NFC tag request failed");
  }

  return result;
}

function decodeTextToken(tag: Awaited<ReturnType<typeof NfcManager.getTag>>) {
  const record = tag?.ndefMessage?.[0];
  if (!record?.payload?.length) {
    throw new Error("This coin does not contain a punch token");
  }

  const token = Ndef.text.decodePayload(record.payload).trim();
  if (token.length < 32) throw new Error("The coin token is invalid");
  return token;
}

async function scanCoinToken(message: string) {
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef, {
      alertMessage: message,
    });
    return decodeTextToken(await NfcManager.getTag());
  } finally {
    await NfcManager.cancelTechnologyRequest().catch(() => undefined);
  }
}

async function writeAndVerifyCoinToken(token: string) {
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef, {
      alertMessage: "Hold the phone on the coin until writing finishes",
    });

    const bytes = Ndef.encodeMessage([Ndef.textRecord(token)]);
    await NfcManager.ndefHandler.writeNdefMessage(bytes, {
      reconnectAfterWrite: true,
    });

    const readBack = await NfcManager.ndefHandler.getNdefMessage();
    if (decodeTextToken(readBack) !== token) {
      throw new Error("The coin verification did not match the generated token");
    }

    if (Platform.OS === "ios") {
      await NfcManager.setAlertMessageIOS("Coin written and verified");
    }
  } finally {
    await NfcManager.cancelTechnologyRequest().catch(() => undefined);
  }
}

export async function listPunchCoins(getSessionToken: GetSessionToken) {
  return adminApi<{ status: true; data: unknown[] }>(
    "/api/v1/clock_punch/nfc/tags",
    getSessionToken,
  );
}

export async function inspectPunchCoin(getSessionToken: GetSessionToken) {
  const token = await scanCoinToken("Hold the phone near the coin to read it");
  const result = await adminApi<{
    status: true;
    data: { id: string; token_state: string };
  }>(
    "/api/v1/clock_punch/nfc/tags/inspect",
    getSessionToken,
    { method: "POST", body: { tag_token: token } },
  );

  // Keep scannedToken in screen memory only; never persist or log it.
  return { ...result, scannedToken: token };
}

export async function confirmPendingPunchCoin(
  tagId: string,
  scannedToken: string,
  getSessionToken: GetSessionToken,
) {
  return adminApi(
    "/api/v1/clock_punch/nfc/tags/confirm",
    getSessionToken,
    {
      method: "POST",
      body: { tag_id: tagId, tag_token: scannedToken },
    },
  );
}

export async function provisionPunchCoin(
  input: { tagId?: string; name?: string; location?: string },
  getSessionToken: GetSessionToken,
) {
  const prepared = await adminApi<{
    status: true;
    data: {
      tag: { id: string };
      tag_token: string;
      expires_at: string;
    };
  }>("/api/v1/clock_punch/nfc/tags/provision", getSessionToken, {
    method: "POST",
    body: {
      ...(input.tagId ? { tag_id: input.tagId } : {}),
      ...(input.name ? { name: input.name } : {}),
      ...(input.location ? { location: input.location } : {}),
    },
  });

  const { tag, tag_token: token } = prepared.data;
  await writeAndVerifyCoinToken(token);

  return adminApi(
    "/api/v1/clock_punch/nfc/tags/confirm",
    getSessionToken,
    {
      method: "POST",
      body: { tag_id: tag.id, tag_token: token },
    },
  );
}

export async function erasePunchCoin(
  tagId: string,
  getSessionToken: GetSessionToken,
) {
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef, {
      alertMessage: "Keep the phone on the coin until erase finishes",
    });

    const currentToken = decodeTextToken(await NfcManager.getTag());
    const inspected = await adminApi<{
      status: true;
      data: { id: string };
    }>("/api/v1/clock_punch/nfc/tags/inspect", getSessionToken, {
      method: "POST",
      body: { tag_token: currentToken },
    });
    if (inspected.data.id !== tagId) {
      throw new Error("The scanned coin is not the coin selected for removal");
    }

    const emptyMessage = Ndef.encodeMessage([
      Ndef.record(Ndef.TNF_EMPTY, "", [], []),
    ]);
    await NfcManager.ndefHandler.writeNdefMessage(emptyMessage, {
      reconnectAfterWrite: true,
    });

    const readBack = await NfcManager.ndefHandler.getNdefMessage();
    const records = readBack?.ndefMessage;
    if (
      !records ||
      records.length !== 1 ||
      records[0].tnf !== Ndef.TNF_EMPTY ||
      records[0].payload?.length
    ) {
      throw new Error("The coin still contains data and was not removed");
    }

    if (Platform.OS === "ios") {
      await NfcManager.setAlertMessageIOS("Coin erased");
    }
  } finally {
    await NfcManager.cancelTechnologyRequest().catch(() => undefined);
  }

  // Change the backend only after physical erase and read-back verification.
  return adminApi(
    `/api/v1/clock_punch/nfc/tags/${tagId}`,
    getSessionToken,
    { method: "DELETE" },
  );
}
```

For **Create**, call `provisionPunchCoin({ name, location }, ...)`. For
**Update**, first select or inspect a coin, then call
`provisionPunchCoin({ tagId, name, location }, ...)`.

Do not automatically cancel provisioning after an uncertain write or network
timeout: the new token may already be on the coin. Scan it with **Read coin**;
if its state is `PENDING_CONFIRMATION`, call the confirmation endpoint with the
read token and returned tag ID. Cancel only when the app knows the write never
happened:

```json
PATCH /api/v1/clock_punch/nfc/tags/:id

{
  "cancel_provisioning": true
}
```

Disabling a coin does not erase it:

```json
PATCH /api/v1/clock_punch/nfc/tags/:id

{
  "is_active": false
}
```

The app should still guard the screen using its authenticated user type, for
example by excluding the route and menu entry for non-admin users. Always rely
on the API's `403` response as the final authorisation check.

## NFC punch service

The following example assumes that `getSessionToken()` retrieves the existing
login token from secure mobile storage. Keep the API base URL in the app's
environment configuration.

```ts
import "react-native-get-random-values";

import NfcManager, { Ndef, NfcTech } from "react-native-nfc-manager";
import { v4 as uuidv4 } from "uuid";

type PunchAction = "CLOCK_IN" | "BREAK_IN" | "BREAK_OUT" | "CLOCK_OUT";

const API_BASE_URL = "https://your-api.example.com";

export async function initialiseNfc() {
  const supported = await NfcManager.isSupported();
  if (!supported) throw new Error("This phone does not support NFC");

  await NfcManager.start();

  const enabled = await NfcManager.isEnabled();
  if (!enabled) throw new Error("NFC is turned off on this phone");
}

function readTextToken(tag: Awaited<ReturnType<typeof NfcManager.getTag>>) {
  const firstRecord = tag?.ndefMessage?.[0];
  if (!firstRecord?.payload) {
    throw new Error("This tag does not contain an NFC punch token");
  }

  const token = Ndef.text.decodePayload(firstRecord.payload).trim();
  if (token.length < 32) {
    throw new Error("This NFC punch token is invalid");
  }

  return token;
}

export async function scanAndSubmitPunch(
  action: PunchAction,
  getSessionToken: () => Promise<string | null>,
) {
  const idempotencyKey = uuidv4();
  let tagToken: string;

  try {
    await NfcManager.requestTechnology(NfcTech.Ndef, {
      alertMessage: "Hold your phone near a factory punch coin",
    });

    const tag = await NfcManager.getTag();
    tagToken = readTextToken(tag);
  } finally {
    await NfcManager.cancelTechnologyRequest().catch(() => undefined);
  }

  const sessionToken = await getSessionToken();
  if (!sessionToken) throw new Error("Please sign in before recording a punch");

  const response = await fetch(`${API_BASE_URL}/api/v1/clock_punch/nfc`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action,
      tag_token: tagToken,
      idempotency_key: idempotencyKey,
    }),
  });

  const result = await response.json();
  if (!response.ok || !result.status) {
    throw new Error(result.message || "The punch could not be recorded");
  }

  return result.data;
}
```

Call `initialiseNfc()` once during application startup. Call
`scanAndSubmitPunch()` only after the employee presses a punch button:

```ts
const punch = await scanAndSubmitPunch("CLOCK_IN", getSessionToken);
```

Disable all punch buttons while scanning/submitting. After success, refresh the
employee's punch state from the server so the available buttons match the
canonical server sequence.

## Required app behaviour

- Do not send phone time; the backend assigns `punched_at`.
- Do not consider a scan successful until the API confirms it.
- Do not queue punches offline. Tell the employee that the punch was not
  recorded and let them retry when connected.
- Never log `tag_token`, include it in analytics, or persist it on the phone.
- Reuse the same idempotency key when retrying a request after a timeout.
- Cancel the NFC reader in `finally` so a failed scan does not leave the reader
  session open.
- Handle an expired session by returning the employee to sign-in, then require
  a fresh NFC scan.
- Never show the tag-management screen to non-admin users. Also handle `403`
  because the server remains the authority.
- Keep a prepared token in memory only. Do not place it in Redux persistence,
  AsyncStorage, crash reports, or analytics.
- Do not automatically cancel or prepare a second token after an uncertain
  write. Inspect the physical coin first.
- After a physical erase, retain the tag ID until the idempotent backend DELETE
  succeeds; otherwise a previously copied value could remain enabled.

## Physical test checklist

- Clock in with an active employee and active tag.
- Start and end a break, including the minimum-break rejection.
- Clock out.
- Try an invalid action sequence.
- Scan an unknown, inactive, and soft-deleted tag.
- Submit the same idempotency key twice and confirm only one row exists.
- Simulate a request timeout and retry with the same key.
- Test cancellation and NFC-disabled behaviour.
- Test on physical Android and iPhone devices; simulators do not provide a real
  NFC scan.
- Verify a non-admin receives `403` from every `/nfc/tags` management endpoint.
- Create a new writable, NDEF-formatted coin and confirm it becomes active only
  after write/read-back confirmation.
- Start an update, fail the write, and confirm the previous token still works.
- Write an update, interrupt before confirmation, then inspect and resume the
  pending confirmation.
- Let a prepared token expire and confirm that it cannot be promoted.
- Erase a coin, verify its NDEF record is empty, and confirm its backend record
  is soft-deleted and no longer punches.

## Static-tag limitation

A normal NDEF coin stores a static value and can be copied by someone with
physical access. The current design is intentionally the simple version. If
clone resistance becomes a requirement, migrate to a cryptographic tag such as
NTAG 424 DNA and verify its per-scan cryptogram and counter on the backend.
