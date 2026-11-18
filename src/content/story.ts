/**
 * The story: the same career told as chapters, each one a shape the particles take.
 * Facts are the résumé's. The shapes themselves are drawn in src/components/story/.
 */

import { building, experience, motto, work } from "./sections";
import { site } from "./site";

export type ChapterId =
  | "nebula"
  | "globe"
  | "gears"
  | "storefront"
  | "systems"
  | "years"
  | "orbits"
  | "products"
  | "motto"
  | "portrait"
  | "portal";

export type Chapter = {
  id: ChapterId;
  kicker: string;
  title: string;
  body: string;
  /** What to try with the pointer, and with a finger. */
  hint?: { hover: string; tap: string };
};

export const chapters: Chapter[] = [
  {
    id: "nebula",
    kicker: "A story in particles",
    title: "I didn't start in software.",
    body: "Scroll to see where I did.",
  },
  {
    id: "globe",
    kicker: "Jaipur, India",
    title: "It starts in Jaipur.",
    body: "A degree in mechanical engineering, and a habit of taking things apart to see how they fit.",
    hint: { hover: "Hover Jaipur", tap: "Tap Jaipur" },
  },
  {
    id: "gears",
    kicker: `${site.since} · Design engineer`,
    title: "First, I designed machines.",
    body: "Cranes, gearboxes and machine parts, drawn in SolidWorks. A part fits when it reaches the shop floor, or it doesn't.",
  },
  {
    id: "storefront",
    kicker: "2021 to 2026 · The craft",
    title: "Then came storefronts.",
    body: "Shopify and Shopify Plus stores for 45+ brands, taken from Figma to production, pixel for pixel.",
  },
  {
    id: "systems",
    kicker: "Underneath",
    title: "And the systems behind them.",
    body: "APIs, integrations and data flows that keep a store and its tools in sync.",
    hint: { hover: "Hover a system", tap: "Tap a system" },
  },
  {
    id: "years",
    kicker: `${site.since} to today`,
    title: "Five roles. Three countries.",
    body: "From Jaipur, for teams in Bengaluru, Montreal and San Francisco, where I am a founding engineer today.",
    hint: { hover: "Hover a role as it passes", tap: "Tap a role as it passes" },
  },
  {
    id: "orbits",
    kicker: "Selected work",
    title: "Brands I've worked on.",
    body: work.projects.map((project) => project.name).join(" · "),
    hint: { hover: "Hover a planet, click to visit", tap: "Tap a planet, tap again to visit" },
  },
  {
    id: "products",
    kicker: "Now building",
    title: "Now, AI commerce.",
    body: "At Kinect AI I ship AI landing pages, quiz funnels and storefront widgets end to end.",
    hint: { hover: "Hover a feature", tap: "Tap a feature" },
  },
  {
    id: "motto",
    kicker: motto.label,
    title: `${motto.line1} ${motto.accent}`,
    body: motto.honest,
  },
  {
    id: "portrait",
    kicker: "Hello",
    title: `I'm ${site.shortName}.`,
    body: "Founding software engineer for AI commerce and Shopify Plus. Away from the desk: badminton, bikes and a lot of music.",
    hint: { hover: "Hover the portrait", tap: "Tap the portrait" },
  },
  {
    id: "portal",
    kicker: "Your turn",
    title: "Let's build something great.",
    body: "Tell me what you need.",
  },
];

/** The word the particles spell in the motto chapter. */
export const mottoWord = motto.accent;

/** The dot on the globe. */
export const homeLabel = {
  text: site.home.city,
  detail: "Home, and where I work from",
  timeZone: site.home.timeZone,
} as const;

/** The systems chapter: a hub, and the services that talk through it. */
export const systems = {
  hub: { text: "API", detail: "REST and GraphQL: the layer every service talks through" },
  nodes: [
    { text: "Shopify", detail: "Admin GraphQL: catalog, order and discount data" },
    { text: "Meta ads", detail: "Ad data, the brief behind each generated landing page" },
    { text: "Gorgias", detail: "The assistant hands a conversation to the helpdesk" },
    { text: "NetSuite", detail: "Product and catalog data flows, through Celigo" },
    { text: "Postgres", detail: "Data models on Supabase, with Prisma" },
  ],
} as const;

/** The years chapter: one ring per role, newest nearest. */
export const years = [...experience.roles].reverse().map((role) => ({
  text: `${role.year} · ${role.company}`,
  detail: `${role.role} · ${role.place}${role.current ? " · now" : ""}`,
}));

/** The orbits chapter: one planet per featured storefront. */
export const planets = work.projects.map((project) => ({
  text: project.name,
  detail: `${project.sector} · With ${project.team.studio}`,
  href: project.url,
}));

/** The products chapter: one tile per Kinect AI feature. */
export const tiles = building.items.map((item) => ({
  text: item.name,
  detail: item.pitch,
}));

export const storyUi = {
  brand: "a story in particles",
  skip: "Skip to the site",
  cta: "Start a conversation",
  explore: "Explore the site",
  chapters: "Chapters",
  chapter: "Chapter {n}: {title}",
  scroll: "Scroll · drag to turn",
  localTime: "local time",
  clickVisit: "Click to visit",
  tapVisit: "Tap again to visit",
  ring: { drag: "Drag", visit: "Visit", reveal: "Reveal" },
} as const;
