"use client";

import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { ArrowIcon } from "@/components/ui/ArrowIcon";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Split } from "@/components/ui/Split";
import { chapters, contact } from "@/content/sections";
import { site } from "@/content/site";
import { DotAvatar } from "../parts/DotAvatar";
import styles from "./ContactBrief.module.css";

type Need = (typeof contact.needs)[number];
type Message = { id: number; from: "visitor" | "site"; text: string };

const [linkedin, whatsapp] = site.socials;
const mailto = `mailto:${site.email}`;

/** The message a visitor's choices add up to: greeting, what they need, then their own words. */
function compose(needs: readonly Need[], note: string): string {
  const parts: string[] = [contact.draftIntro];
  if (needs.length) parts.push(contact.draftNeeds.replace("{needs}", needs.join(", ")));
  if (note) parts.push(note);
  return parts.join("\n\n");
}

/**
 * (08) Contact: looks like a chat, but nothing is sent from the page. The visitor picks what
 * they need, adds a line, and the finished message opens in their own email app or in WhatsApp.
 */
export function ContactBrief() {
  const [picked, setPicked] = useState<readonly Need[]>([]);
  const [note, setNote] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);

  const trimmed = note.trim();
  const ready = picked.length > 0 || trimmed.length > 0;
  // Kept in the order the list shows them, whatever order they were picked in.
  const needs = contact.needs.filter((need) => picked.includes(need));
  const draft = compose(needs, trimmed);
  const whatsappHref = `${site.whatsapp}?text=${encodeURIComponent(draft)}`;

  // Bring the newest message into view, as a chat would.
  useEffect(() => {
    const area = scroller.current;
    if (area && messages.length) area.scrollTop = area.scrollHeight;
  }, [messages]);

  const toggle = (need: Need) =>
    setPicked((current) => (current.includes(need) ? current.filter((entry) => entry !== need) : [...current, need]));

  /** Shows the message as sent, says where it went, and clears the builder, ready for another. */
  const record = (reply: string) => {
    const id = nextId.current;
    nextId.current += 2;
    setMessages((current) => [
      ...current,
      { id, from: "visitor", text: draft },
      { id: id + 1, from: "site", text: reply.replace("{email}", site.email) },
    ]);
    setPicked([]);
    setNote("");
  };

  const openEmail = () => {
    if (!ready) return;
    // Email clients expect CRLF line endings in a mailto body.
    const body = encodeURIComponent(draft.replace(/\n/g, "\r\n"));
    record(contact.sent);
    window.open(`${mailto}?subject=${encodeURIComponent(contact.draftSubject)}&body=${body}`, "_self");
  };

  const openWhatsApp = (event: MouseEvent) => {
    // Opened by hand: recording the message clears the builder, which takes this link away
    // before the browser would follow it.
    event.preventDefault();
    window.open(whatsappHref, "_blank", "noopener,noreferrer");
    record(contact.sentWhatsapp);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    openEmail();
  };

  return (
    <section id="brief" className={styles.section} data-theme="light" data-chapter={chapters.contact}>
      <SectionHeader index="08" label={contact.label}>
        {contact.aside}
      </SectionHeader>

      <div className={`${styles.wrap} grid-12`}>
        <div className={styles.intro}>
          <Split parts={contact.title} as="h2" className={`${styles.title} font-bold`} proximity />
          <p className={`${styles.sub} font-regular`}>
            {contact.sub[0]}{" "}
            <a href={mailto} className="u-link">
              {contact.sub[1]}
            </a>{" "}
            {contact.sub[2]}
          </p>
          <p className={`${styles.note} font-regular`}>
            <span className={styles.noteDot} aria-hidden="true" />
            {contact.note}
          </p>
          <div className={styles.slot} data-slot="form" aria-hidden="true" />
        </div>

        <div className={styles.card}>
          {/* Lenis leaves the wheel to this area only once there is something in it to scroll. */}
          <div ref={scroller} className={styles.scroll} data-lenis-prevent={messages.length ? "" : undefined}>
            <div className={styles.greeting}>
              <DotAvatar className={styles.avatar} />
              <p className={`${styles.greetingBubble} font-regular`}>{contact.greeting}</p>
            </div>

            <div className={styles.conversation} role="log" aria-live="polite">
              {messages.map((message) => (
                <div key={message.id} className={styles.message} data-from={message.from}>
                  <p className={`${styles.bubble} font-regular`}>{message.text}</p>
                </div>
              ))}
            </div>

            <ul className={styles.needs} data-compact={messages.length > 0}>
              {contact.needs.map((need) => (
                <li key={need}>
                  <button
                    type="button"
                    className={`${styles.need} fill font-regular`}
                    aria-pressed={picked.includes(need)}
                    onClick={() => toggle(need)}
                  >
                    {need}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* The send button ends up in the corner the menu button floats over: it is asked to stay clear. */}
          <form className={styles.bar} onSubmit={onSubmit} data-menu-clear="">
            <a
              href={linkedin.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.icon} btn-icon`}
              aria-label={linkedin.label}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="2.5" y="9" width="4" height="12.5" />
                <circle cx="4.5" cy="4.5" r="2.2" />
                <path d="M9.5 9h3.8v1.9c.7-1.3 2.1-2.2 4-2.2 3 0 4.2 2 4.2 5.2v7.6h-4v-6.8c0-1.6-.6-2.5-1.9-2.5-1.4 0-2.1 1-2.1 2.6v6.7h-4z" />
              </svg>
            </a>
            <a href={mailto} className={`${styles.icon} btn-icon`} aria-label={contact.email}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
                <path d="m3.5 7.5 8.5 6 8.5-6" />
              </svg>
            </a>
            <a
              href={site.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.icon} btn-icon`}
              aria-label={whatsapp.label}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 21l1.4-4.9A9 9 0 1 1 8 19.7z" />
                <path
                  d="M9 8.6c0 3.4 2.9 6.3 6.3 6.3l1-1.7-2-1-.9.9c-1-.4-2.2-1.6-2.6-2.6l.9-.9-1-2z"
                  fill="currentColor"
                  stroke="none"
                />
              </svg>
            </a>

            <span className={styles.divider} aria-hidden="true" />

            <input
              className={`${styles.input} font-regular`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={contact.placeholder}
              aria-label={contact.placeholder}
              maxLength={600}
              enterKeyHint="send"
              autoComplete="off"
            />

            {ready ? (
              <span className={styles.actions}>
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.alt} t-link font-regular`}
                  onClick={openWhatsApp}
                >
                  {contact.whatsapp}
                </a>
                <button type="submit" className={`${styles.send} btn-primary`} aria-label={contact.send}>
                  <ArrowIcon className={styles.sendIcon} dir="n" />
                </button>
              </span>
            ) : null}
          </form>
        </div>
      </div>
    </section>
  );
}
