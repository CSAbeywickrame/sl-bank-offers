import { describe, expect, it } from "vitest";
import {
  buildAnalyticsPath,
  consumeReturnVisitSignal,
  shouldTrackReturnVisit
} from "@/lib/analytics/vercel";

function createMemoryStorage(initialValue: string | null = null) {
  let value = initialValue;

  return {
    getItem(key: string) {
      return key === "cardcompass:last-visit-at" ? value : null;
    },
    setItem(key: string, nextValue: string) {
      if (key === "cardcompass:last-visit-at") {
        value = nextValue;
      }
    }
  };
}

describe("Vercel analytics helpers", () => {
  it("maps search result pageviews to a synthetic analytics path", () => {
    expect(buildAnalyticsPath(new URL("https://cardcompass.lk/?search=cargills"))).toBe("/__analytics/search");
    expect(buildAnalyticsPath(new URL("https://cardcompass.lk/?bank=ntb&category=dining"))).toBe("/__analytics/filter");
  });

  it("marks returning visits separately from new sessions", () => {
    expect(buildAnalyticsPath(new URL("https://cardcompass.lk/"), { isReturnVisit: true })).toBe("/__analytics/return-visit");
    expect(buildAnalyticsPath(new URL("https://cardcompass.lk/?search=travel"), { isReturnVisit: true })).toBe(
      "/__analytics/return-visit/search"
    );
  });

  it("requires a gap before counting another return visit", () => {
    const now = new Date("2026-06-09T10:00:00.000Z");

    expect(shouldTrackReturnVisit(null, now)).toBe(false);
    expect(shouldTrackReturnVisit("invalid-date", now)).toBe(false);
    expect(shouldTrackReturnVisit("2026-06-09T09:45:01.000Z", now)).toBe(false);
    expect(shouldTrackReturnVisit("2026-06-09T09:29:59.000Z", now)).toBe(true);
  });

  it("updates the stored visit timestamp whenever the visitor loads the app", () => {
    const storage = createMemoryStorage("2026-06-09T09:00:00.000Z");
    const now = new Date("2026-06-09T10:00:00.000Z");

    expect(consumeReturnVisitSignal(storage, now)).toBe(true);
    expect(storage.getItem("cardcompass:last-visit-at")).toBe(now.toISOString());
  });
});
