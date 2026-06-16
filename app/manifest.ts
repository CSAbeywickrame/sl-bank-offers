import type { MetadataRoute } from "next";
import { siteDescription, siteName } from "@/lib/site-config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteName,
    short_name: "SL Offers",
    description: siteDescription,
    start_url: "/",
    display: "browser",
    background_color: "#0f172a",
    theme_color: "#0d9488",
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
