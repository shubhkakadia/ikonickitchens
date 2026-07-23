export const PROJECT_ID_PREFIX = "IKC";
export const PROJECT_ID_MAX_SEQUENCE = 9999;

export function normalizeProjectSlug(slug = "") {
  return String(slug)
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 4);
}

export function formatProjectId(slug, sequence) {
  const normalizedSlug = normalizeProjectSlug(slug);
  if (!/^[A-Z]{4}$/.test(normalizedSlug)) return "";
  if (
    !Number.isInteger(sequence) ||
    sequence < 1 ||
    sequence > PROJECT_ID_MAX_SEQUENCE
  )
    return "";
  return `${PROJECT_ID_PREFIX}-${normalizedSlug}-${String(sequence).padStart(4, "0")}`;
}

export function parseProjectId(projectId, slug) {
  const normalizedSlug = normalizeProjectSlug(slug);
  const match = String(projectId || "")
    .toUpperCase()
    .match(new RegExp(`^${PROJECT_ID_PREFIX}-${normalizedSlug}-(\\d{4})$`));
  if (!match) return null;
  const sequence = Number(match[1]);
  return sequence >= 1 && sequence <= PROJECT_ID_MAX_SEQUENCE ? sequence : null;
}

export function getNextProjectSequence(projectIds, slug) {
  const highest = projectIds.reduce(
    (max, projectId) => Math.max(max, parseProjectId(projectId, slug) || 0),
    0,
  );
  if (highest >= PROJECT_ID_MAX_SEQUENCE) return null;
  return highest + 1;
}
