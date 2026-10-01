import { Prisma } from "../../generated/prisma/client";

// Money is Decimal(10,2) in the database, so amounts are handled as Decimals
// and rounded half-up to cents instead of going through floating point.
export const Decimal = Prisma.Decimal;

const MAX_MONEY = new Decimal("99999999.99");

/**
 * Parses a client-supplied amount.
 * @returns {undefined} when the value is blank (not supplied)
 * @returns {null} when it is not a valid non-negative amount that fits Decimal(10,2)
 * @returns {Decimal} otherwise (not yet rounded, so line totals keep full precision)
 */
export function parseMoney(value) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "number" && typeof value !== "string") return null;
  try {
    const amount = new Decimal(value);
    if (!amount.isFinite() || amount.isNegative() || amount.gt(MAX_MONEY)) {
      return null;
    }
    return amount;
  } catch {
    return null;
  }
}

export function toCents(amount) {
  return amount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}
