import { describe, expect, it } from "vitest";
import { EXPIRING_SOON_DAYS, isExpiringSoon } from "@/lib/offers/expiry";

const now = Date.parse("2026-07-03T00:00:00.000Z");

describe("isExpiringSoon", () => {
  it("returns true when validUntil is 5 days away", () => {
    expect(isExpiringSoon("2026-07-08T00:00:00.000Z", now)).toBe(true);
  });

  it("returns false when validUntil is 30 days away", () => {
    expect(isExpiringSoon("2026-08-02T00:00:00.000Z", now)).toBe(false);
  });

  it("returns false when validUntil is in the past", () => {
    expect(isExpiringSoon("2026-06-01T00:00:00.000Z", now)).toBe(false);
  });

  it("returns false when validUntil is undefined", () => {
    expect(isExpiringSoon(undefined, now)).toBe(false);
  });

  it("normalizes a date-only string to end-of-day before comparing", () => {
    // "2026-07-10" normalizes to "2026-07-10T23:59:59.999Z", ~7.9999 days after `now`, so it is within the window
    expect(isExpiringSoon("2026-07-10", now)).toBe(true);
  });

  it("returns true at the exact EXPIRING_SOON_DAYS boundary", () => {
    // daysRemaining is exactly EXPIRING_SOON_DAYS (14); the inclusive `<=` boundary makes this true
    expect(isExpiringSoon("2026-07-17T00:00:00.000Z", now)).toBe(true);
    expect(EXPIRING_SOON_DAYS).toBe(14);
  });

  it("returns false for an unparseable date string", () => {
    expect(isExpiringSoon("not-a-date", now)).toBe(false);
  });
});
