import { chapters } from "@/content/sections";

/** Placeholder: replaced by the real section. */
export function Motto() {
  return (
    <section id="motto" data-theme="dark" data-chapter={chapters.motto} style={{ minHeight: "100vh", padding: "var(--section-y) var(--gutter)" }}>
      <p className="section-label">Motto</p>
    </section>
  );
}
