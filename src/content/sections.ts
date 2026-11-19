/**
 * The copy and data of every section of the site view, in page order. Facts come from the 2026
 * résumé and the earlier portfolio; nothing is inferred. Where a heading has an accented word, it
 * is split into `before`, `accent` and `after`.
 */

import { site } from "./site";

/** A heading in pieces: plain strings, an accented run, or a line break. */
export type HeadingPart = string | { accent: string } | { br: true };

/** The label in the corner of the page as each section passes: "(01) About me". */
export const chapters = {
  about: "(01) About me",
  services: "(02) What I do",
  work: "(03) Selected work",
  building: "(04) Now building",
  experience: "(05) Experience",
  motto: "The standard",
  method: "(06) How I work",
  off: "(07) Off the clock",
  contact: "(08) Contact",
} as const;

export const nav = {
  label: "Main",
  links: [
    { label: "About", href: "#about" },
    { label: "Work", href: "#work" },
    { label: "Contact", href: "#contact" },
  ],
  menu: "Menu",
  home: `${site.name}, back to the top`,
} as const;

/* ── Hero ─────────────────────────────────────────────────────────────────────────────────── */

export const hero = {
  title: ["What shoppers see,", "and the AI behind it."],
  lead: "Founding engineer at Kinect AI (YC-backed), shipping AI commerce features end to end. Since 2022, Shopify and Shopify Plus storefronts for 45+ brands.",
  primary: { label: "Let's talk", href: "#contact" },
  secondary: { label: "See the work", href: "#work" },
  /** Under the globe: "{n} ahead of San Francisco", worked out live from the two time zones. */
  ahead: "{n} ahead of {city}",
  behind: "{n} behind {city}",
  same: "Same time as {city}",
} as const;

/* ── (01) About ───────────────────────────────────────────────────────────────────────────── */

export const about = {
  label: "About me",
  aside: "Jaipur, on US Pacific hours",
  /** The statement that darkens word by word on scroll; the middle run is set bold. */
  text: [
    { text: "I build AI product features end to end: " },
    { text: "the data model, the APIs, the background jobs, the interface and the tests.", strong: true },
    { text: " Behind that are four years of Shopify storefronts, built from Figma to production, pixel for pixel." },
  ],
  /** Shown inside the lens when the statement is hovered. */
  hidden:
    "I trained as a mechanical engineer and spent my first year designing cranes and gearboxes. A part either fits when it reaches the shop floor or it doesn't. That standard came with me to software.",
  /** The ring of text around the particle medal. Entries marked `strong` are set in the accent. */
  seal: {
    href: site.company.url,
    label: "Founding engineer at Kinect AI, backed by Y Combinator, since 2026 (opens Kinect AI in a new tab)",
    ring: [
      { text: "Founding engineer", strong: true },
      { text: "Kinect AI" },
      { text: "Since 2026" },
      { text: "Backed by", strong: true },
      { text: "Y Combinator" },
      { text: "San Francisco" },
    ],
  },
  stats: [
    { num: "5+", unit: "years", label: "of software engineering experience" },
    { num: "45+", unit: "brands", label: "with storefronts I have worked on" },
    { num: "40%", unit: "faster", label: "page loads at best, from speed optimisation" },
    { num: "+30%", unit: "", label: "development efficiency, from reusable code libraries" },
  ],
} as const;

/* ── (02) What I do ───────────────────────────────────────────────────────────────────────── */

export type Service = {
  id: "ai" | "shopify" | "frontend" | "fullstack" | "integrations" | "performance";
  title: string;
  desc: string;
};

export const services = {
  label: "What I do",
  aside: "Often on the same product",
  intro: "From the data model to the last pixel.",
  items: [
    {
      id: "ai",
      title: "AI products",
      desc: "AI features grounded in real catalog data and built to hold up in production: landing pages generated from ads, quiz funnels, storefront assistants and product video.",
    },
    {
      id: "shopify",
      title: "Shopify Plus",
      desc: "Theme rebuilds, migrations, checkout extensibility and custom features for stores that sell at scale. Work I have done across 45+ brand storefronts.",
    },
    {
      id: "frontend",
      title: "Frontend",
      desc: "Designs taken from Figma to production exactly as they were drawn, in React, Next.js, Liquid and Alpine.js. Responsive, interactive and fast.",
    },
    {
      id: "fullstack",
      title: "Full-stack",
      desc: "TypeScript from the interface to the database: Next.js and Remix, Node.js, PostgreSQL and Prisma, background jobs, and the tests that keep it shipping.",
    },
    {
      id: "integrations",
      title: "Integrations",
      desc: "Shopify Admin GraphQL, Meta ad data, Gorgias, NetSuite and Celigo: catalog, order and discount data arriving where it should, and staying in sync.",
    },
    {
      id: "performance",
      title: "Performance",
      desc: "Speed optimisation that has delivered up to 40% faster page loads. Want proof? Press </> and read this page's numbers, measured live in your own browser.",
    },
  ] satisfies Service[],
} as const;

export type ProcessStep = {
  id: "listen" | "model" | "build" | "review" | "ship" | "watch";
  title: string;
  desc: string;
};

export const process = {
  /** "From merchant feedback / to long after it ships", the last run accented. */
  title: ["From merchant feedback", { br: true }, "to ", { accent: "long after it ships" }] satisfies HeadingPart[],
  steps: [
    { id: "listen", title: "Listen", desc: "Merchant feedback first: what is actually needed, and why." },
    { id: "model", title: "Model", desc: "The data model and the contract, before any interface." },
    { id: "build", title: "Build", desc: "TypeScript end to end, with Cursor, Claude Code and Devin in the loop." },
    { id: "review", title: "Review", desc: "Every change through a pull request: CI, automated review and tests." },
    { id: "ship", title: "Ship", desc: "Out to merchants' stores, with guardrails and fallbacks in place." },
    { id: "watch", title: "Watch", desc: "Delivery-health monitoring, and fixes from what merchants say next." },
  ] satisfies ProcessStep[],
} as const;

/* ── (03) Selected work ───────────────────────────────────────────────────────────────────── */

export type Team = { studio: string; place: string; years: string; url?: string };

export const teams = {
  ecomexperts: { studio: "EcomExperts", place: "Montreal", years: "2023 to 2026" },
  marmeto: { studio: "Marmeto", place: "Bengaluru", years: "2022 to 2023" },
} satisfies Record<string, Team>;

export type Project = {
  /** Also the file name of its capture in public/work/. */
  slug: string;
  name: string;
  /** What the brand sells, as its own site says. Not a description of project scope. */
  sector: string;
  url: string;
  domain: string;
  team: Team;
  /** One line on the part played. Team-level, because per-brand scope is not on record. */
  brief: string;
  /** Wash behind the capture in the hover preview. */
  tint: string;
};

const withEcomExperts = "One of the storefronts I built on and maintained with the EcomExperts team, 2023 to 2026.";
const withMarmeto = "One of the storefronts I customised with the Marmeto team, 2022 to 2023.";

export const work = {
  label: "Selected work",
  aside: "Agency and product teams",
  heading: ["Storefronts for ", { accent: "45+" }, " brands"] satisfies HeadingPart[],
  /** The short form above the big names on the desktop stage. */
  headingPlain: "Storefronts for 45+ brands",
  intro:
    "Theme rebuilds, custom features, checkout extensibility and speed work, mostly with the teams at EcomExperts and Marmeto.",
  visit: "Visit site",
  with: "With {studio}",
  projects: [
    {
      slug: "jones-road-beauty",
      name: "Jones Road Beauty",
      sector: "Clean beauty",
      url: "https://www.jonesroadbeauty.com/",
      domain: "jonesroadbeauty.com",
      team: teams.ecomexperts,
      brief: withEcomExperts,
      tint: "#e9dccb",
    },
    {
      slug: "jd-sports-canada",
      name: "JD Sports Canada",
      sector: "Sneakers and streetwear",
      url: "https://jdsports.ca/",
      domain: "jdsports.ca",
      team: teams.ecomexperts,
      brief: withEcomExperts,
      tint: "#d9d2c2",
    },
    {
      slug: "malbon-golf",
      name: "Malbon Golf",
      sector: "Golf lifestyle apparel",
      url: "https://malbon.com/",
      domain: "malbon.com",
      team: teams.ecomexperts,
      brief: withEcomExperts,
      tint: "#cfd6de",
    },
    {
      slug: "voluspa",
      name: "Voluspa",
      sector: "Candles and home fragrance",
      url: "https://voluspa.com/",
      domain: "voluspa.com",
      team: teams.ecomexperts,
      brief: withEcomExperts,
      tint: "#e6c9c0",
    },
    {
      slug: "boat",
      name: "boAt",
      sector: "Audio and wearables",
      url: "https://www.boat-lifestyle.com/",
      domain: "boat-lifestyle.com",
      team: teams.marmeto,
      brief: withMarmeto,
      tint: "#e8cfc6",
    },
    {
      slug: "kohler-india",
      name: "Kohler India",
      sector: "Kitchen and bath",
      url: "https://www.kohler.co.in/",
      domain: "kohler.co.in",
      team: teams.marmeto,
      brief: withMarmeto,
      tint: "#d8cdbd",
    },
  ] satisfies Project[],
  also: "Also: Darn Tough, ChocZero, Seeking Health, Hatch Collection, U.S. Polo Assn. India, mCaffeine and Borosil, among 45+ in all.",
  disclaimer:
    "Brands and storefronts I have contributed to professionally, as part of agency and product teams. Names and storefronts belong to their owners; listing them here does not imply endorsement.",
  captureNote: "Captured from the live storefronts in November 2026.",
} as const;

/* ── (04) Now building: Kinect AI ─────────────────────────────────────────────────────────── */

export type Feature = {
  id: "landing" | "figma" | "quiz";
  /** Short enough to stand on end as the spine of a closed panel. */
  name: string;
  pitch: string;
  /** The parts of the feature, as the résumé lists them. */
  parts: string[];
  kind: string;
  status: string;
  /** What the dots draw going in, then coming out. */
  flow: [string, string];
};

export const building = {
  label: "Now building",
  aside: `At ${site.company.name}, ${site.company.city}`,
  heading: ["Shipping at ", { accent: site.company.name }] satisfies HeadingPart[],
  visit: "Kinect AI",
  url: site.company.url,
  partsLabel: "What is in it",
  items: [
    {
      id: "landing",
      name: "Ad to page",
      pitch:
        "Landing pages generated from any Meta ad, with ad-to-page lineage, guardrails against ungrounded price claims, and version history.",
      parts: ["Meta ad data", "Page archetypes", "Guardrails", "Evidence checks", "Version history"],
      kind: "AI landing pages",
      status: "Shipped",
      flow: ["A Meta ad", "A landing page"],
    },
    {
      id: "figma",
      name: "Figma to page",
      pitch: "A Figma design rebuilt as a responsive landing page with live catalog products, without the Figma API.",
      parts: ["Binary clipboard decode", ".fig files", "Server-side", "Responsive rebuild", "Live catalog products"],
      kind: "Figma-to-page import",
      status: "Shipped",
      flow: ["A Figma design", "A responsive page"],
    },
    {
      id: "quiz",
      name: "Quiz funnels",
      pitch:
        "An AI quiz builder: LLM-drafted questions, a deterministic recommendation scorer, and add-to-cart results on the storefront.",
      parts: ["LLM-drafted questions", "Deterministic scorer", "Storefront runtime", "Add to cart", "Response capture"],
      kind: "AI quiz funnels",
      status: "Shipped",
      flow: ["Questions", "A recommendation"],
    },
  ] satisfies Feature[],
  also: "Also shipped: storefront widgets with audience targeting, creator marketing, AI product video, and the assistant-to-Gorgias handoff.",
  stackLine:
    "Stack: TypeScript, Next.js, React, Remix, PostgreSQL (Supabase), Prisma, Shopify Admin GraphQL, Vercel AI SDK, Vercel and Docker.",
  disclaimer: "The drawings show how each flow works. They are not product screenshots.",
} as const;

/* ── (05) Experience ──────────────────────────────────────────────────────────────────────── */

export type Role = {
  year: string;
  role: string;
  company: string;
  place: string;
  current?: boolean;
};

export const experience = {
  label: "Experience",
  aside: `Since ${site.since}`,
  /** `**bold**` marks the runs set in the bold weight. */
  statement:
    "I started in **2020** designing cranes and gearboxes. Today I build **AI commerce** for Shopify brands at a YC-backed startup.",
  /** Shown inside the lens; {years} is filled in from `site.since`. */
  hidden: "{years} years in, the standard is the same: the part fits, or it doesn't.",
  cv: "Full CV on LinkedIn",
  cvUrl: site.linkedin,
  history: "History",
  now: "Now",
  yearN: "Year {n}",
  toolkitLabel: "Toolkit",
  /** Oldest first: the order the timeline is read in. */
  roles: [
    { year: "2020", role: "Design Engineer", company: "Hiking Engineers", place: "Ahmedabad, India" },
    { year: "2021", role: "Frontend Developer", company: "A3logics", place: "Jaipur, India" },
    { year: "2022", role: "Shopify Frontend Developer", company: "Marmeto", place: "Bengaluru, India" },
    { year: "2023", role: "Senior Shopify Developer", company: "EcomExperts", place: "Montreal, Canada · Remote" },
    { year: "2026", role: site.role, company: "Kinect AI", place: "San Francisco, USA · Remote", current: true },
  ] satisfies Role[],
  toolkit: [
    "TypeScript",
    "React",
    "Next.js",
    "Remix",
    "Node.js",
    "PostgreSQL",
    "Prisma",
    "GraphQL",
    "Shopify Plus",
    "Liquid",
    "Tailwind CSS",
    "Alpine.js",
    "Vercel AI SDK",
    "Claude",
    "Gemini",
    "Docker",
    "Vitest",
    "Figma",
    "Cursor",
    "Claude Code",
  ],
} as const;

/* ── The standard (motto) ─────────────────────────────────────────────────────────────────── */

export const motto = {
  label: "The standard",
  /** "Built to / tolerance." with the second line accented. */
  line1: "Built to",
  accent: "tolerance.",
  /** The other half, read through the lens on hover and printed underneath on touch screens. */
  hidden: ["Tested to", "failure."],
  honest: "Tested to failure.",
  hint: "Hover to read the other half",
  breakIt: "Break it",
  fixIt: "Fix it",
  fixed: "Fixed. Back within tolerance.",
  showCode: "Show the code",
  hideCode: "Hide the code",
  /** What the page's console "says" while it lies in pieces. */
  errors: [
    "TypeError: Cannot read properties of undefined (reading 'tolerance')",
    "RangeError: gravity exceeded its design load",
    "Warning: this fitted perfectly on my machine",
    "AssertionError: expected page to stay where it was put",
  ],
  /** The patch that puts it back, as a diff. */
  patchFile: "layout.ts",
  patch: [
    "- const tolerance = undefined",
    "+ const tolerance = measure(section)",
    "- gravity = 9.81",
    "+ gravity = 0",
    "- // TODO: hold the page together",
    "+ assertFits(page)",
  ],
} as const;

/* ── (06) How I work ──────────────────────────────────────────────────────────────────────── */

export type Principle = { tab: string; pull: string; body: string; caption: string; note: string };

export const method = {
  label: "How I work",
  aside: "The same way on every team",
  items: [
    {
      tab: "01",
      pull: "AI-native, every day",
      body: "I build daily with Cursor, Claude Code and Devin, for development, prototyping and refactoring. Agent-driven workflows are part of how the work gets done, not an experiment on the side.",
      caption: "Tools",
      note: "Cursor · Claude Code · Devin · GitHub Copilot",
    },
    {
      tab: "02",
      pull: "Reviewed and tested",
      body: "Every change ships through a pull request with CI, automated code review and tests: unit, component and Postgres integration.",
      caption: "Process",
      note: "Pull requests · CI · Vitest",
    },
    {
      tab: "03",
      pull: "Pixel for pixel",
      body: "Designs go from Figma to production exactly as they were drawn. It is a mechanical engineer's habit: a drawing is a promise that the part will fit.",
      caption: "Craft",
      note: "Figma to production",
    },
    {
      tab: "04",
      pull: "Remote, with overlap",
      body: "I work from Jaipur, India, with hours that overlap US Pacific time, and have worked directly with clients in US time zones since 2023.",
      caption: "Hours",
      note: "Jaipur, IST · US Pacific overlap",
    },
  ] satisfies Principle[],
} as const;

/* ── (07) Off the clock ───────────────────────────────────────────────────────────────────── */

export const offClock = {
  label: "Off the clock",
  aside: "Badminton, bikes and music",
  heading: ["Away from the ", { accent: "desk" }] satisfies HeadingPart[],
  clocksLabel: "On two clocks",
  clocks: [
    { city: site.home.city, note: "Home", timeZone: site.home.timeZone },
    { city: site.away.city, note: site.company.name, timeZone: site.away.timeZone },
  ],
  clocksNote: "My working hours overlap US Pacific time.",
  listLabel: "Away from the desk",
  /** As the résumé lists them; the notes say no more than it does. */
  pursuits: [
    { title: "Badminton", tag: "Pro", note: "I play professionally." },
    { title: "Fitness", note: "I train." },
    { title: "Bike rides", note: "I ride." },
    { title: "Travel", note: "I travel." },
    { title: "Music", note: "A lot of it." },
  ],
} as const;

/* ── (08) Contact ─────────────────────────────────────────────────────────────────────────── */

export const contact = {
  label: "Contact",
  aside: `${site.home.city}, ${site.home.zone} (UTC+5:30)`,
  title: ["Tell me what", "you're building."],
  /** Text before the link, the link's label, and text after it. */
  sub: [
    "Pick what you need, add a line or two, and it opens in your own email or WhatsApp, addressed to me. Nothing is sent from this page. Prefer to write it yourself?",
    "Email me",
    "directly.",
  ],
  note: "No backend, no tracking",
  greeting: "Hi! What can I help you build?",
  needs: [
    "AI product feature",
    "Shopify Plus build or rebuild",
    "Checkout extensibility",
    "Speed optimisation",
    "App or integration",
    "Full-stack product work",
    "Full-time or contract role",
  ],
  placeholder: "Add a line about it...",
  send: "Open in email",
  whatsapp: "Open in WhatsApp",
  email: "Email",
  /** Shown once a draft has been handed to the visitor's own app. */
  sent: "Opened in your email app. If nothing happened, write to {email}.",
  /** The message that gets composed: "{needs}" and "{message}" are filled in. */
  draftSubject: "Project enquiry",
  draftIntro: "Hi Ajay,",
  draftNeeds: "I'm looking for: {needs}.",
} as const;

/* ── Footer ───────────────────────────────────────────────────────────────────────────────── */

export const footer = {
  availability: site.availability,
  heading: ["Let's build", "something great."],
  stepsLabel: "How it starts",
  steps: [
    { title: "Tell me what you need", note: "By email, WhatsApp or the form above" },
    { title: "I reply myself", note: "From me, not an auto-reply" },
    { title: "A short call", note: "On hours that overlap US Pacific time" },
  ],
  cta: ["Start a", "conversation"],
  copied: "Copied ✓",
  bar: {
    version: { label: "Version", value: site.edition },
    time: { label: "Local time" },
    now: { label: "Now", value: "Kinect AI · YC-backed", href: site.company.url },
    privacy: { label: "Privacy", value: "No cookies, no trackers" },
    socials: { label: "Socials" },
  },
} as const;

/* ── Menu ─────────────────────────────────────────────────────────────────────────────────── */

export const menu = {
  open: "Open menu",
  close: "Close menu",
  dialog: "Site menu",
  talk: "Let's talk",
  items: [
    { n: "01", label: "About", note: "Who I am", href: "#about" },
    { n: "02", label: "Services", note: "What I do", href: "#services" },
    { n: "03", label: "Work", note: "45+ storefronts", href: "#work" },
    { n: "04", label: "Kinect AI", note: "Now building", href: "#building" },
    { n: "05", label: "Experience", note: `Since ${site.since}`, href: "#experience" },
    { n: "06", label: "Method", note: "How I work", href: "#method" },
    { n: "07", label: "Off the clock", note: "Badminton and bikes", href: "#off-clock" },
    { n: "08", label: "Contact", note: "Say hello", href: "#contact" },
  ],
} as const;

/* ── Entry screen, dock and the layers over the page ──────────────────────────────────────── */

export const gate = {
  welcome: "Welcome",
  kicker: `${site.name} · ${site.role}`,
  title: ["Two ways in.", "Which one?"],
  loading: "Loading",
  choose: "How to explore",
  soundOn: "Sound on",
  soundOff: "Sound off",
  soundHint: "Switch the sound on to hear it, and watch the dots move with it.",
  versions: {
    site: { label: "Site", title: "The site", desc: "Read it at your own pace, in silence" },
    story: { label: "Story", title: "The story", desc: "A journey in 3D, better with sound" },
  },
} as const;

export const dock = {
  label: "Experience",
  experience: "Experience",
  soundOn: "Turn sound on",
  soundOff: "Turn sound off",
  track: "Soundtrack: {current}. Switch to {next}",
  tracks: { drift: "Drift", pulse: "Pulse" },
  sourceOn: motto.showCode,
  sourceOff: motto.hideCode,
} as const;

export const stage = {
  skip: "Skip to the next section",
} as const;

export const common = {
  skip: "Skip to content",
} as const;
