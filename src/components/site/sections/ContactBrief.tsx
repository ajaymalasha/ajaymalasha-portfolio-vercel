import { chapters } from "@/content/sections";

/** Placeholder: replaced by the real section. */
export function ContactBrief() {
  return (
    <section id="brief" data-theme="light" data-chapter={chapters.contact} style={{ minHeight: "100vh", padding: "var(--section-y) var(--gutter)" }}>
      <p className="section-label">ContactBrief</p>
    </section>
  );
}
