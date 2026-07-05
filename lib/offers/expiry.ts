export const EXPIRING_SOON_DAYS = 14;

// Returns true if validUntil falls within EXPIRING_SOON_DAYS days from now (inclusive), given an injectable `now` for deterministic testing
export function isExpiringSoon(validUntil: string | undefined, now: number = Date.now()): boolean {
  if (!validUntil) return false;
  const normalized = validUntil.includes("T") ? validUntil : `${validUntil}T23:59:59.999Z`;
  const date = new Date(normalized);
  if (!Number.isFinite(date.getTime())) return false;
  const daysRemaining = (date.getTime() - now) / (1000 * 60 * 60 * 24);
  return daysRemaining >= 0 && daysRemaining <= EXPIRING_SOON_DAYS;
}
