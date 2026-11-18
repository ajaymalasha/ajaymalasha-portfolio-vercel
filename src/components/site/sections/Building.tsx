import { chapters } from "@/content/sections";

/** Placeholder: replaced by the real section. */
export function Building() {
  return (
    <section id="building" data-theme="dark" data-chapter={chapters.building} style={{ minHeight: "100vh", padding: "var(--section-y) var(--gutter)" }}>
      <p className="section-label">Building</p>
    </section>
  );
}
