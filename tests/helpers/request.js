import { NextRequest } from "next/server";
import { VALID_TOKEN } from "./auth";

// Builds a NextRequest. Pass token: null to omit the Authorization header.
// Pass rawBody to send an unencoded string (e.g. malformed JSON).
export function buildRequest(
  url,
  { method = "GET", token = VALID_TOKEN, headers = {}, body, rawBody } = {},
) {
  const allHeaders = { ...headers };
  if (token !== null) allHeaders.authorization = `Bearer ${token}`;
  if (body !== undefined && !(body instanceof FormData)) {
    allHeaders["content-type"] ??= "application/json";
  }
  let payload = rawBody;
  if (body !== undefined) {
    payload = body instanceof FormData ? body : JSON.stringify(body);
  }
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method,
    headers: allHeaders,
    body: payload,
  });
}

// Builds FormData from a plain object. undefined values are skipped;
// File/Blob values are appended as files.
export function formBody(fields = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) form.append(key, value);
  }
  return form;
}

// A small in-memory file for upload tests.
export const testFile = (name = "photo.jpg", type = "image/jpeg") =>
  new File(["fake image bytes"], name, { type });

// Second argument Next.js 15 passes to dynamic route handlers.
export const routeContext = (params = {}) => ({
  params: Promise.resolve(params),
});
