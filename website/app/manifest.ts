import type { MetadataRoute } from "next";
import { siteName } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteName,
    short_name: siteName,
    description: "Book nail appointments and browse portfolio at Emmas Envy",
    start_url: "/",
    display: "standalone",
    background_color: "#1f0614",
    theme_color: "#e91e8c",
    icons: [{ src: "/logo.png", sizes: "512x512", type: "image/png" }],
  };
}
