const VOWELS = new Set(["A", "E", "I", "U"]);

/**
 * Returns the deterministic four-character client abbreviation used in IDs.
 * The first name word contributes its consonants followed by its final letter.
 * If that is not enough, consonants from the remaining words and then all
 * remaining name characters are used. This means the whole name participates
 * in the result while preserving the requested examples: Bettio Construction
 * -> BTTO and Brickline Homes -> BRCK.
 */
export function generateClientSlug(clientName = "") {
  const words = String(clientName)
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const letters = words.join("");
  if (!letters) return "";

  const firstWord = words[0];
  const firstWordConsonants = [...firstWord].filter(
    (character) => !VOWELS.has(character),
  );
  const remainingConsonants = [...words.slice(1).join("")].filter(
    (character) => !VOWELS.has(character),
  );
  const preferred = [
    ...firstWordConsonants,
    firstWord[firstWord.length - 1],
    ...remainingConsonants,
    ...letters,
  ];

  return preferred.slice(0, 4).join("").padEnd(4, "X");
}

export function normalizeClientSlug(slug = "") {
  return String(slug)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4);
}

export function isValidClientSlug(slug = "") {
  return /^[A-Z0-9]{4}$/.test(normalizeClientSlug(slug));
}
