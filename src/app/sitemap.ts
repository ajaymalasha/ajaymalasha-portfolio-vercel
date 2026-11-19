import type { MetadataRoute } from "next";
import { site } from "@/content/site";

/** One page: the site and the story are two views of the same address. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${site.url}/`, changeFrequency: "monthly", priority: 1 }];
}
