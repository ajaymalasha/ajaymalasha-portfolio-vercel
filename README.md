# Ajay Malasha — portfolio

Personal site of Ajay Malasha, founding software engineer for AI commerce and Shopify Plus.

One page, seen two ways: **the site**, a long scrolling page where a single cloud of tens of
thousands of dots draws the portrait, the work and the name; and **the story**, the same career
told as chapters in 3D, with a soundtrack synthesised in the browser.

## Quick start

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Open <http://localhost:3200>. The entry screen asks which way in; `?v=site` or `?v=story` goes
straight there.

## Commands

| Command                   | What it does                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm run dev`             | Development server with hot reload, on port 3200                                                      |
| `npm run build`           | Production build                                                                                      |
| `npm run start`           | Serves the production build, on port 3200                                                             |
| `npm run typecheck`       | TypeScript, no output                                                                                 |
| `npm run lint`            | ESLint                                                                                                |
| `npm run format`          | Prettier, writes changes                                                                              |
| `npm run assets:portrait` | Turns one portrait photo into every rendition the site uses (macOS only)                              |
| `npm run assets:work`     | Prepares the storefront captures shown in the work section                                            |
| `npm run assets:snippets` | Cuts the source excerpts the "Show the code" panel displays (runs by itself before `dev` and `build`) |
| `npm run assets:og`       | Photographs the running site's first screen for the link-sharing card (see below)                     |

## Changing the content

All copy and data live in `src/content/`. Nothing is written inside components.

| File                | Holds                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------- |
| `site.ts`           | Name, role, company, home and work cities (the globe and both clocks), contact details |
| `sections.ts`       | Every section of the site view, in page order, plus the menu, entry screen and dock    |
| `story.ts`          | The story's chapters and the labels on its shapes                                      |
| `source-panel.json` | For each section, the file and excerpt the "Show the code" panel shows, and its note   |

The role shown everywhere is `site.role`. To switch the 3D story and the entry screen off
entirely, set `STORY_ENABLED` to `false` in `site.ts`: visitors then go straight to the site.

### Replacing the portrait

Put a photo anywhere outside the repository and run:

```bash
npm run assets:portrait -- path/to/photo.png
```

The person is cut out with macOS Vision, and four files are written to `public/portrait/`: the
cut-out in colour and in black and white, a square avatar, and their sizes. A half-length
portrait with the head near the top needs no options (`--head` and `--zoom` adjust the avatar).
The dots are sampled from the cut-out, with the darkest tones lifted so that dark clothing still
reads (`liftShadows` in `src/lib/particle-kit.ts`).

### Changing the featured storefronts

Edit `work.projects` in `sections.ts`, then give `assets:work` a folder holding one capture per
slug (`<slug>.png`, `.jpg` or `.webp`):

```bash
npm run assets:work -- path/to/captures
```

Each is cropped to 16:10 and written to `public/work/<slug>.webp`. See `docs/ASSETS.md` before
publishing captures of other people's storefronts.

### The link-sharing card

`src/app/opengraph-image.png` (and `twitter-image.png`) is a photograph of the site's own first
screen at 1200×630. After changing the portrait or the headline, take it again with the site
running:

```bash
npm run dev          # in one terminal
npm run assets:og    # in another
```

It uses headless Chromium through Playwright, a dev dependency. The first time, fetch the
browser with `npx playwright install chromium-headless-shell`.

## The contact section

There is no backend. The contact card composes a message from the chosen needs and the typed
text, and opens it in the visitor's own email app or WhatsApp. Nothing is sent from the page,
and the page says so. No analytics, no cookies and no third-party requests are made.

## Deploying

Any host that runs Next.js works; Vercel needs no configuration. Set `NEXT_PUBLIC_SITE_URL` to
the production address (default `https://ajaymalasha.online`) so canonical URLs, the sitemap and
sharing cards point at it: in the host's environment settings, or locally by copying
`.env.example` to `.env.local`. It is the only setting, and it is not a secret.

## How it is built

| Layer       | Choice                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------ |
| Framework   | Next.js 16 (App Router), React 19, TypeScript in strict mode                               |
| Styling     | Plain CSS: design tokens in `src/app/globals.css`, a CSS Module beside each component      |
| Motion      | No animation library: one shared frame loop, CSS transitions, and attribute-driven helpers |
| 3D and dots | three.js with hand-written shaders; several 2D canvases                                    |
| Scrolling   | Lenis                                                                                      |
| Sound       | Web Audio API, synthesised: there are no audio files                                       |
| Fonts       | Geist and Geist Mono, self-hosted                                                          |

```
src/
  app/            layout (fonts, metadata, the script that picks the first frame), page, global styles
  content/        all copy and data
  lib/            the frame loop, smooth scrolling, small stores, device checks, shared motion, audio
  morph/          the particle shapes, the shaders, and the drawings the dot stage samples
  components/
    app/          the shell: entry screen, dock, cursor, the transition between site and story
    site/         the site view: sections/, chrome/ (menu, scroll progress, chapter label), parts/
    story/        the 3D story
    fx/           canvas layers of the site view: particle cloud, dot stage, "Break it", "Show the code"
    ui/           shared pieces: section header, split headings, the hover lens, arrows
scripts/          asset pipeline
docs/             asset sources and licences
```

### How the page hangs together

- **One frame loop** (`src/lib/ticker.ts`). Smooth scrolling runs first, then everything that
  draws. Nothing starts its own `requestAnimationFrame`.
- **Sections are declarative.** A section says what it is with attributes: `data-theme` (the
  page turns ink or sand as it passes), `data-chapter` (the label in the corner), `data-reveal`,
  `data-slot` (where a particle shape goes). `src/lib/motion.ts` and the canvas layers act on them.
- **The particle cloud** (`components/fx/ParticleMorph.tsx`) holds one set of dots and morphs it
  between two shapes at a time; scroll position alone decides which two and how far, so every
  morph reverses on the way back up.
- **The dot stage** (`components/fx/DotStage.tsx`) is a second, flat swarm for the pinned
  sections on laptops and up. Its pictures are painted on a hidden canvas and sampled
  (`src/morph/drawings.ts`), or read from the storefront captures.
- **The server renders the site's content**, so it is in the HTML without JavaScript. The entry
  screen's first frame is in the HTML too, and a few lines of inline script choose which first
  frame stays before anything paints.

### Fallbacks

- **No WebGL, or a software renderer:** the photo stands in for the dotted portrait, pinned
  sections become plain lists, and the name lines are dotted text. `?gl=force` runs the canvases
  anyway, for checking them on such a machine.
- **Reduced motion:** no pinned sections, no entrance animations, shapes hold still.
- **Phones and tablets:** list versions of Services, Work and Now building; the cloud draws the
  portrait and the names only.
- **No JavaScript:** the site's text, links and photo are all there and readable (the server
  renders them, and a `<noscript>` rule shows what would otherwise wait to animate in). The
  entry screen, the story and the menu need scripts.

## Assets and licences

`docs/ASSETS.md` lists every asset with its source and licence, what was done to it, and the
things to confirm before publishing. It also credits the site this one's structure follows.

`AGENTS.md` is written by `next dev` for AI coding tools. It is safe to keep or delete.
