// The probe must hit the database on every request, never a prerendered result.
export const dynamic = "force-dynamic"

export { getHealth as GET } from "@/server/api/v1/health"
