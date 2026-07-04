import type { Offer, SortKey } from "./types";

// Parses a date string into a millisecond timestamp, or undefined when missing or unparseable
function parseTimestamp(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : timestamp;
}

// Sorts offers by lastSeenAt descending, tie-breaking on firstSeenAt descending
function sortByNewest(offers: Offer[]): Offer[] {
  return offers.sort((a, b) => {
    const lastSeenDiff = Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt);
    return lastSeenDiff !== 0 ? lastSeenDiff : Date.parse(b.firstSeenAt) - Date.parse(a.firstSeenAt);
  });
}

// Sorts offers with a parseable validUntil ascending (soonest first); offers without one keep their relative order, placed last
function sortByExpiringSoon(offers: Offer[]): Offer[] {
  const withDate: { offer: Offer; timestamp: number }[] = [];
  const withoutDate: Offer[] = [];

  for (const offer of offers) {
    const timestamp = parseTimestamp(offer.validUntil);
    if (timestamp === undefined) {
      withoutDate.push(offer);
    } else {
      withDate.push({ offer, timestamp });
    }
  }

  withDate.sort((a, b) => a.timestamp - b.timestamp);
  return [...withDate.map((entry) => entry.offer), ...withoutDate];
}

// Returns a new, sorted array of offers for the given sort key, without mutating the input array
export function sortOffers(offers: Offer[], sortKey: SortKey): Offer[] {
  switch (sortKey) {
    case "newest":
      return sortByNewest([...offers]);
    case "expiring-soon":
      return sortByExpiringSoon(offers);
    case "relevance":
    default:
      return [...offers];
  }
}
