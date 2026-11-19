"use client";

import type { CSSProperties, MouseEvent } from "react";
import { menu, nav } from "@/content/sections";
import { site } from "@/content/site";
import { menuOpen } from "@/lib/experience";
import { scrollToTarget } from "@/lib/scroll";
import styles from "./NavBar.module.css";

/** Custom properties used as animation indices: `--i` (letter), `--n` (dot), `--d` (entrance order). */
const vars = (values: Record<string, number>) => values as CSSProperties;

const letters = [...site.name].map((char) => (char === " " ? "\u00a0" : char));

/**
 * The bar across the top of the first screen: name, role, availability, three links and the
 * menu button. It scrolls away with the hero; from there on the floating menu button takes over.
 */
export function NavBar() {
  const glide = (target: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    scrollToTarget(target);
  };

  return (
    <nav className={styles.navbar} aria-label={nav.label}>
      <a href="#top" className={`${styles.anim} ${styles.logo}`} aria-label={nav.home} onClick={glide("#top")}>
        {letters.map((char, i) => (
          // Each letter is stacked on a copy of itself; hovering rolls the copy up into view.
          <span className={styles.roll} style={vars({ "--i": i })} aria-hidden="true" key={i}>
            <span className={styles.rollTrack}>
              <span>{char}</span>
              <span>{char}</span>
            </span>
          </span>
        ))}
        <span className={styles.logoDots} aria-hidden="true">
          <i style={vars({ "--n": 0 })} />
          <i style={vars({ "--n": 1 })} />
        </span>
      </a>

      <p className={`${styles.anim} ${styles.role} font-regular`} style={vars({ "--d": 1 })}>
        {site.roleLine}
      </p>

      <a
        href="#contact"
        className={`${styles.anim} ${styles.avail} t-link font-regular`}
        style={vars({ "--d": 2 })}
        onClick={glide("#contact")}
      >
        <span className={styles.availDot} aria-hidden="true" />
        <span className="link-text">{site.availability}</span>
      </a>

      <ul className={styles.links}>
        {nav.links.map((link, i) => (
          <li className={styles.anim} style={vars({ "--d": i + 3 })} key={link.href}>
            <a href={link.href} className={`${styles.link} t-link`} onClick={glide(link.href)}>
              {link.label}
            </a>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className={`${styles.anim} ${styles.menu} fill font-regular`}
        style={vars({ "--d": 7 })}
        aria-label={menu.open}
        aria-haspopup="dialog"
        onClick={() => menuOpen.set(true)}
      >
        <span>{nav.menu}</span>
        <span className={styles.menuDots} aria-hidden="true">
          <i />
          <i />
        </span>
      </button>
    </nav>
  );
}
