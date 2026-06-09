"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import { consumeReturnVisitSignal, rewriteAnalyticsUrl } from "@/lib/analytics/vercel";

function isPageViewEvent(event: BeforeSendEvent): event is BeforeSendEvent & { url: string } {
  return "url" in event && typeof event.url === "string";
}

export function WebAnalytics() {
  return (
    <Analytics
      beforeSend={(event: BeforeSendEvent) => {
        if (!isPageViewEvent(event) || typeof window === "undefined") {
          return event;
        }

        const isReturnVisit = consumeReturnVisitSignal(window.localStorage, new Date());
        const rewrittenUrl = rewriteAnalyticsUrl(event.url, isReturnVisit);

        if (!rewrittenUrl) {
          return event;
        }

        return {
          ...event,
          url: rewrittenUrl
        };
      }}
    />
  );
}
