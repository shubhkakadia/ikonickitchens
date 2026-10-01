import { serveMediaFile } from "@/lib/serveMedia";

function ensureArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export async function GET(request, { params }) {
  try {
    const resolvedParams = await params;
    return await serveMediaFile(request, ensureArray(resolvedParams?.path));
  } catch (error) {
    console.error("Error in GET /mediauploads/[...path]:", error);
    return Response.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
