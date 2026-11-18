import { chapters } from "@/content/sections";

/** Placeholder: replaced by the real section. */
export function About() {
  return (
    <section id="about" data-theme="light" data-chapter={chapters.about} style={{ minHeight: "100vh", padding: "var(--section-y) var(--gutter)" }}>
      <p className="section-label">About</p>
    </section>
  );
}
