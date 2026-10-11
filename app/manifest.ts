import type { MetadataRoute } from "next";
import { getSiteDescription } from "@/lib/site-description";
import { siteName } from "@/lib/site-config";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  return {
    name: siteName,
    short_name: "SL Offers",
    description: await getSiteDescription(),
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
