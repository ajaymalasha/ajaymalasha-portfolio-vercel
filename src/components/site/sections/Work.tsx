import { chapters } from "@/content/sections";

/** Placeholder: replaced by the real section. */
export function Work() {
  return (
    <section id="work" data-theme="dark" data-chapter={chapters.work} style={{ minHeight: "100vh", padding: "var(--section-y) var(--gutter)" }}>
      <p className="section-label">Work</p>
    </section>
  );
}
