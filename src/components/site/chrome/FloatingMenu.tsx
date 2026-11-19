"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { ArrowIcon } from "@/components/ui/ArrowIcon";
import { menu, nav } from "@/content/sections";
import { site } from "@/content/site";
import { prefersReducedMotion } from "@/lib/device";
import { menuOpen } from "@/lib/experience";
import { holdScroll, onScroll, releaseScroll, scrollToTarget } from "@/lib/scroll";
import { useStore } from "@/lib/store";
import { ticker } from "@/lib/ticker";
import { HomeGlobe } from "../sections/HomeGlobe";
import styles from "./FloatingMenu.module.css";
import { bridgePath } from "./metaball";

type Phase = "closed" | "enter" | "open" | "leave";

const PORTRAIT = { colour: "/portrait/cutout.webp", mono: "/portrait/cutout-bw.webp", width: 799, height: 1200 };
/** How far the colour portrait's hue is turned for each item, in order. */
const HUES = [0, 40, 80, 120, 200, 240, 280, 320];
const ENTER_MS = 1300;
const LEAVE_MS = 750;
/** The menu starts closing, then the page starts moving under it. */
const SCROLL_AFTER_MS = 350;
const SHOW_AFTER_PX = 150;
/** The button keeps this far (px) from any control it has been asked to stay clear of. */
const CLEARANCE = 12;

/** The button leans towards a pointer that comes this close (px), by this share of the distance. */
const LEAN_REACH = 110;
const LEAN_PULL = 0.45;
/** Stuck to the footer's call to action: how much of its travel the button follows, and how far before it lets go. */
const STICK_FOLLOW = 0.6;
const STICK_LIMIT = 70;

/**
 * The round menu button that appears once the header has scrolled away, and the full-screen
 * menu it opens. The button behaves like a drop of the accent colour: it leans towards the
 * cursor, squashes when it moves, and when it meets the footer's round call to action the two
 * merge, stretch as the page moves on, and snap apart.
 */
export function FloatingMenu() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const neckRef = useRef<SVGPathElement>(null);
  const portraitRef = useRef<HTMLDivElement>(null);
  // The last control pressed: the menu grows out of it.
  const pressed = useRef<{ element: Element; at: number } | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  const open = useStore(menuOpen, false);
  const [phase, setPhase] = useState<Phase>("closed");
  const [wasOpen, setWasOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [shown, setShown] = useState(false);

  // The menu stays mounted while it animates out, so its phase trails the store.
  if (open !== wasOpen) {
    setWasOpen(open);
    setPhase(open ? "enter" : "leave");
    if (!open) setActive(-1);
  }

  useEffect(() => {
    if (phase !== "enter" && phase !== "leave") return;
    const timer = window.setTimeout(
      () => setPhase(phase === "enter" ? "open" : "closed"),
      phase === "enter" ? ENTER_MS : LEAVE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [phase]);

  // Before the menu is painted: note what was focused, and grow from the control that was pressed.
  useLayoutEffect(() => {
    if (!open) return;
    const focused =
      document.activeElement instanceof HTMLElement && document.activeElement !== document.body
        ? document.activeElement
        : null;
    const recent = pressed.current && performance.now() - pressed.current.at < 1000 ? pressed.current.element : null;
    const origin = (recent ?? focused ?? buttonRef.current)?.getBoundingClientRect();
    if (origin && menuRef.current) {
      menuRef.current.style.setProperty("--ox", `${origin.left + origin.width / 2}px`);
      menuRef.current.style.setProperty("--oy", `${origin.top + origin.height / 2}px`);
    }
    opener.current = focused ?? buttonRef.current;
  }, [open]);

  // Opening freezes the page and moves focus in; closing undoes both. Not a layout effect:
  // React puts focus back where it was after a commit, which would undo the hand-back.
  useEffect(() => {
    if (!open) return;
    const button = buttonRef.current;
    holdScroll();
    document.documentElement.classList.add("menu-open");
    menuRef.current?.querySelector<HTMLElement>("[data-menu-link]")?.focus({ preventScroll: true });

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") return menuOpen.set(false);
      if (event.key !== "Tab" || !menuRef.current || !button) return;
      // Focus stays within the menu and its close button.
      const stops = [button, ...menuRef.current.querySelectorAll<HTMLElement>("a[href], button")];
      const at = stops.indexOf(document.activeElement as HTMLElement);
      const next = event.shiftKey ? at - 1 : at + 1;
      if (at >= 0 && next >= 0 && next < stops.length) return;
      event.preventDefault();
      stops[event.shiftKey ? stops.length - 1 : 0].focus({ preventScroll: true });
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      releaseScroll();
      document.documentElement.classList.remove("menu-open");
      (opener.current?.isConnected ? opener.current : button)?.focus({ preventScroll: true });
      opener.current = null;
    };
  }, [open]);

  useEffect(() => {
    const calm = prefersReducedMotion();
    const narrow = window.matchMedia("(max-width: 1023px)");
    let scrolled = false;
    let scrollingDown = false;
    let inTheWay = false;
    let warmed = false;

    // Controls marked data-menu-clear sit in the corner this button floats over (the contact
    // card's send button): while the page has one of them under it, the button steps aside.
    const covering = () => {
      const wrap = buttonRef.current?.parentElement;
      if (!wrap) return false;
      // Where the button rests, worked out from its CSS offsets: its own box moves as it hides,
      // and measuring that would have it flicker at the edge.
      const style = getComputedStyle(wrap);
      const right = document.documentElement.clientWidth - parseFloat(style.right);
      const bottom = window.innerHeight - parseFloat(style.bottom);
      const own = { left: right - wrap.offsetWidth, right, top: bottom - wrap.offsetHeight, bottom };
      for (const element of document.querySelectorAll("[data-menu-clear]")) {
        const box = element.getBoundingClientRect();
        const apart =
          box.right < own.left - CLEARANCE ||
          box.left > own.right + CLEARANCE ||
          box.bottom < own.top - CLEARANCE ||
          box.top > own.bottom + CLEARANCE;
        if (!apart && box.width > 0) return true;
      }
      return false;
    };

    const stopScroll = onScroll(({ scroll, limit, direction }) => {
      scrolled = scroll > SHOW_AFTER_PX;
      // On phones and tablets the button steps aside while reading down, like the dock.
      scrollingDown = narrow.matches && direction === 1 && scroll < limit - 120;
      inTheWay = scrolled && covering();
      setShown(scrolled && !scrollingDown && !inTheWay);
      if (scrolled && !warmed) {
        warmed = true;
        // So the portraits are there the first time the menu opens.
        for (const src of [PORTRAIT.mono, PORTRAIT.colour]) new Image().src = src;
      }
    });

    const onPress = (event: PointerEvent) => {
      const element = event.target instanceof Element ? event.target.closest("button, a") : null;
      pressed.current = element ? { element, at: performance.now() } : null;
    };

    const lean = { x: 0, y: 0, tx: 0, ty: 0 };
    const drift = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMouseMove = (event: MouseEvent) => {
      drift.tx = (event.clientX / window.innerWidth - 0.5) * -24;
      drift.ty = (event.clientY / window.innerHeight - 0.5) * -16;
      const button = buttonRef.current;
      lean.tx = lean.ty = 0;
      if (!button || !(scrolled || menuOpen.get())) return;
      const box = button.getBoundingClientRect();
      const dx = event.clientX - (box.left + box.width / 2);
      const dy = event.clientY - (box.top + box.height / 2);
      const distance = Math.hypot(dx, dy);
      if (distance >= LEAN_REACH) return;
      const pull = (1 - distance / LEAN_REACH) * LEAN_PULL;
      lean.tx = dx * pull;
      lean.ty = dy * pull;
    };

    // The join with the footer's call to action. `ready` stops it re-sticking until the two have
    // properly parted; `x/y` is how far the button has been dragged, sprung back when released.
    const join = {
      stuck: false,
      ready: true,
      fromX: 0,
      fromY: 0,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      pull: 0,
      neck: 0,
      angle: 0,
    };
    let cta: HTMLElement | null = null;
    let neckPath = "";

    const release = () => {
      join.stuck = false;
      cta?.style.removeProperty("--gx");
      cta?.style.removeProperty("--gy");
    };

    const updateJoin = () => {
      // The footer is someone else's, and may mount after this does.
      if (!cta?.isConnected) cta = document.querySelector<HTMLElement>('[data-fx="cta"]');
      const disc = cta;
      const wrap = buttonRef.current?.parentElement;
      const anchor = disc?.parentElement;
      const possible = scrolled && !scrollingDown && !inTheWay && !menuOpen.get() && !calm;
      let circles: Parameters<typeof bridgePath>[0] | null = null;

      if (disc && anchor && wrap && possible) {
        const own = wrap.getBoundingClientRect();
        // The call to action sits at the right end of its row; measured from the row, so its own
        // movement (hover, and the nudge given below) does not feed back into this.
        const row = anchor.getBoundingClientRect();
        const r1 = own.width / 2;
        const r2 = disc.offsetWidth / 2;
        const x1 = own.left + r1;
        const y1 = own.top + own.height / 2;
        const x2 = row.right - r2;
        const y2 = row.top + row.height / 2;
        const gap = Math.hypot(x2 - x1, y2 - y1) - r1 - r2;

        if (!join.stuck && join.ready && gap < 2 && gap > -r1 * 2) {
          join.stuck = true;
          join.ready = false;
          join.fromX = x2;
          join.fromY = y2;
        }
        if (!join.stuck && gap > 24) join.ready = true;

        if (join.stuck) {
          const dragX = (x2 - join.fromX) * STICK_FOLLOW;
          const dragY = (y2 - join.fromY) * STICK_FOLLOW;
          join.pull = Math.hypot(dragX, dragY) / STICK_LIMIT;
          if (join.pull > 1) {
            release();
          } else {
            join.x += (dragX - join.x) * 0.35;
            join.y += (dragY - join.y) * 0.35;
            join.vx = join.vy = 0;
            join.angle = Math.atan2(y2 - y1 - join.y, x2 - x1 - join.x);
            // The call to action is tugged back towards the button, harder the further it stretches.
            const tug = 6 + 10 * join.pull;
            disc.style.setProperty("--gx", `${(-Math.cos(join.angle) * tug).toFixed(1)}px`);
            disc.style.setProperty("--gy", `${(-Math.sin(join.angle) * tug).toFixed(1)}px`);
          }
        }
        circles = { x1: x1 + join.x + lean.x, y1: y1 + join.y + lean.y, r1, x2, y2, r2 };
      } else if (join.stuck) {
        release();
      }

      if (!join.stuck) {
        join.vx = (join.vx - join.x * 0.1) * 0.8;
        join.vy = (join.vy - join.y * 0.1) * 0.8;
        join.x += join.vx;
        join.y += join.vy;
      }
      join.neck += ((join.stuck ? 1 : 0) - join.neck) * (join.stuck ? 0.25 : 0.4);
      const path = circles && join.neck > 0.02 ? bridgePath(circles, 0.55 * join.neck) : "";
      if (path !== neckPath) neckRef.current?.setAttribute("d", (neckPath = path));
    };

    // Stretched along the pull while stuck, along its own travel while springing back.
    const squash = () => {
      const amount = join.stuck ? 0.16 * join.pull : Math.min(0.2, Math.hypot(join.vx, join.vy) * 0.02);
      if (amount < 0.002) return "";
      const angle = join.stuck ? join.angle : Math.atan2(join.vy, join.vx);
      return ` rotate(${angle.toFixed(3)}rad) scale(${(1 + amount).toFixed(3)}, ${(1 - amount * 0.6).toFixed(3)}) rotate(${(-angle).toFixed(3)}rad)`;
    };

    let lastTransform = "";
    const frame = () => {
      lean.x += (lean.tx - lean.x) * 0.12;
      lean.y += (lean.ty - lean.y) * 0.12;
      const button = buttonRef.current;
      if (button) {
        updateJoin();
        const transform = `translate(${(lean.x + join.x).toFixed(2)}px, ${(lean.y + join.y).toFixed(2)}px)${squash()}`;
        if (transform !== lastTransform) button.style.transform = lastTransform = transform;
      }
      const portrait = portraitRef.current;
      if (portrait && menuOpen.get()) {
        drift.x += (drift.tx - drift.x) * 0.08;
        drift.y += (drift.ty - drift.y) * 0.08;
        portrait.style.transform = `translate(${drift.x.toFixed(2)}px, ${drift.y.toFixed(2)}px)`;
      }
    };

    window.addEventListener("pointerdown", onPress, true);
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    ticker.add(frame);
    return () => {
      stopScroll();
      window.removeEventListener("pointerdown", onPress, true);
      window.removeEventListener("mousemove", onMouseMove);
      ticker.remove(frame);
      release();
    };
  }, []);

  const go = (href: string) => (event: ReactMouseEvent) => {
    event.preventDefault();
    menuOpen.set(false);
    window.setTimeout(() => scrollToTarget(href, { duration: 1.6 }), SCROLL_AFTER_MS);
  };

  const visible = shown || open;
  const marquee = `${site.name} \u2022 `;

  return (
    <>
      <svg className={styles.neck} aria-hidden="true" focusable="false">
        <path ref={neckRef} />
      </svg>

      <div className={styles.wrap} data-visible={visible || undefined} inert={!visible}>
        <button
          ref={buttonRef}
          type="button"
          className={`${styles.hamburger} btn-primary`}
          data-open={open || undefined}
          data-magnet="off"
          aria-label={open ? menu.close : menu.open}
          aria-expanded={open}
          aria-controls="site-menu"
          onClick={() => menuOpen.set(!open)}
        >
          <span className={styles.bar} />
          <span className={styles.bar} />
        </button>
      </div>

      {phase !== "closed" ? (
        <div
          ref={menuRef}
          id="site-menu"
          className={styles.menu}
          role="dialog"
          aria-modal="true"
          aria-label={menu.dialog}
          data-phase={phase}
          style={{ "--hue": `${active >= 0 ? HUES[active % HUES.length] : 0}deg` } as CSSProperties}
        >
          <div className={styles.bg} />

          <div className={`${styles.top} font-regular`}>
            <a href="#top" className={`${styles.quiet} t-link`} aria-label={nav.home} onClick={go("#top")}>
              {site.name}
            </a>
            <a href="#contact" className={`${styles.quiet} t-link`} onClick={go("#contact")}>
              <span className="link-text">{menu.talk}</span>
              <ArrowIcon className="link-arrow link-arrow--out" />
            </a>
          </div>

          <nav className={styles.nav} aria-label={nav.label} onMouseLeave={() => setActive(-1)}>
            <ul className={styles.list} data-has-active={active >= 0 || undefined}>
              {menu.items.map((item, index) => (
                <li key={item.href} className={styles.item} style={{ "--i": index } as CSSProperties}>
                  <a
                    href={item.href}
                    className={styles.link}
                    data-menu-link=""
                    data-active={active === index || undefined}
                    data-cursor="dot"
                    onMouseEnter={() => setActive(index)}
                    onFocus={(event) => {
                      // A click focuses too: only the keyboard should light an item this way.
                      if (event.currentTarget.matches(":focus-visible")) setActive(index);
                    }}
                    onClick={go(item.href)}
                  >
                    <span className={styles.linkInner}>
                      <span className={`${styles.index} font-regular`}>({item.n})</span>
                      <span className={`${styles.label} font-bold`}>{item.label}</span>
                      <span className={`${styles.note} font-regular`}>{item.note}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className={styles.visual} aria-hidden="true">
            <span className={`${styles.number} dot-text`}>{active >= 0 ? menu.items[active].n : ""}</span>
            <div ref={portraitRef} className={styles.portrait}>
              <img
                src={PORTRAIT.mono}
                alt=""
                width={PORTRAIT.width}
                height={PORTRAIT.height}
                className={styles.photo}
              />
              <img
                src={PORTRAIT.colour}
                alt=""
                width={PORTRAIT.width}
                height={PORTRAIT.height}
                className={`${styles.photo} ${styles.photoColour}`}
                data-lit={active >= 0 || undefined}
              />
            </div>
          </div>

          <div className={styles.bottom}>
            <div className={styles.here}>
              <HomeGlobe size={72} />
            </div>
            <div className={`${styles.socials} font-regular`}>
              {site.socials.map((social) => (
                <a
                  key={social.label}
                  href={social.url}
                  target="_blank"
                  rel="noopener"
                  className={`${styles.quiet} t-link`}
                >
                  {social.label}
                </a>
              ))}
            </div>
          </div>

          <div className={styles.marquee} aria-hidden="true">
            <div className={`${styles.marqueeTrack} dot-text`}>
              {[0, 1, 2, 3].map((copy) => (
                <span key={copy}>{marquee}</span>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
