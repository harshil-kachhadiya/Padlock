import type { MetadataRoute } from "next";
import { absoluteUrl, NOINDEX_PATHS } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Everything behind auth, plus OAuth and dev routes. These are also
        // noindex via per-segment metadata; disallowing them here keeps them
        // out of the crawl entirely.
        disallow: NOINDEX_PATHS.map((path) => `${path}/`),
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
