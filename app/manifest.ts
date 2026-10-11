import type { MetadataRoute } from "next";
import { getBanks } from "@/lib/offers/banks";
import { buildSiteDescription } from "@/lib/seo-copy";
import { siteName } from "@/lib/site-config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteName,
    short_name: "SL Offers",
    description: buildSiteDescription(getBanks().length),
    start_url: "/",
    display: "browser",
    background_color: "#0b1f33",
    theme_color: "#047857",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
