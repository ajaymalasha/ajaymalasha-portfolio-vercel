/**
 * Who the site is about, and how to reach him. Every fact here is on the 2026 résumé or on the
 * earlier portfolio; nothing is inferred. All copy lives in src/content/: edit text there, not in
 * components.
 */

export const site = {
  name: "Ajay Malasha",
  shortName: "Ajay",
  /** The title on the résumé. Change it here and it changes everywhere, including the story. */
  role: "Founding Software Engineer",
  roleLine: "Founding Software Engineer · AI Commerce & Shopify Plus",
  /** Used for canonical URLs, the sitemap and social cards. Override with NEXT_PUBLIC_SITE_URL. */
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://ajaymalasha.online").replace(/\/+$/, ""),
  title: "Ajay Malasha | Founding Software Engineer for AI Commerce & Shopify Plus",
  description:
    "Ajay Malasha is a founding software engineer at Kinect AI (YC-backed) who builds AI commerce features end to end, and a Shopify Plus developer who has worked on storefronts for 45+ brands, including Jones Road Beauty, JD Sports Canada and Malbon Golf.",
  ogDescription:
    "AI commerce features built end to end, and Shopify Plus storefronts for 45+ brands. Explore the site, or take the story in 3D.",
  availability: "Open to projects and roles",

  company: {
    name: "Kinect AI",
    url: "https://trykinect.ai/",
    backing: "YC-backed",
    city: "San Francisco",
  },

  /** Where he works from: the dot on the globe, and the clock. */
  home: {
    city: "Jaipur",
    country: "India",
    label: "Jaipur, India",
    lat: 26.9124,
    lon: 75.7873,
    timeZone: "Asia/Kolkata",
    zone: "IST",
    locale: "en-IN",
  },
  /** Where the team he works with is: the far end of the globe's arc, and the second clock. */
  away: {
    city: "San Francisco",
    country: "USA",
    lat: 37.7749,
    lon: -122.4194,
    timeZone: "America/Los_Angeles",
    zone: "PT",
  },

  email: "ajaymalasharbt@gmail.com",
  phone: "+917733972226",
  phoneDisplay: "+91 77339 72226",
  whatsapp: "https://wa.me/917733972226",
  linkedin: "https://www.linkedin.com/in/ajay-malasha-340766147/",
  socials: [
    { label: "LinkedIn", url: "https://www.linkedin.com/in/ajay-malasha-340766147/" },
    { label: "WhatsApp", url: "https://wa.me/917733972226" },
  ],

  /** First year on the timeline (design engineering); the experience counter starts here. */
  since: 2020,
  edition: "2026 Edition",
} as const;

/** The email a visitor's app opens from the big call to action. */
export const brief = {
  subject: "New project",
  body: `Hi Ajay,

What I need:
Current site or product (if any):
Timeline:
Budget:`,
} as const;

export const briefHref = `mailto:${site.email}?subject=${encodeURIComponent(brief.subject)}&body=${encodeURIComponent(brief.body)}`;

/**
 * The 3D story and the entry screen that offers it. While false, visitors go straight to the
 * site and the dock shows no Site / Story switch.
 */
export const STORY_ENABLED = true;
