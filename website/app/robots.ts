import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/portfolio", "/book", "/policies/", "/rewards"],
      disallow: [
        "/account",
        "/appointments",
        "/settings",
        "/staff/",
        "/support/guest-",
        "/login",
        "/signup",
        "/verify-2fa",
        "/complete-profile",
        "/forgot-password",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
