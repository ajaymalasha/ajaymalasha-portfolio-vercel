import type { CSSProperties, ElementType, ReactNode } from "react";
import type { HeadingPart } from "@/content/sections";

type Props = {
  /** Lines as strings (each starts a new line), or the pieces of a heading with accents and breaks. */
  parts: readonly HeadingPart[] | readonly string[] | string;
  /** Treat a string[] as lines, with a break between them. Default true. */
  lines?: boolean;
  as?: ElementType;
  className?: string;
  /** Milliseconds before the first word rises. */
  delay?: number;
  /** "seen" (default): when scrolled into view. "load": as soon as the page is ready. */
  on?: "seen" | "load";
  /** Letters also lift in a wave as the cursor passes over the heading. */
  proximity?: boolean;
  id?: string;
};

/**
 * A heading whose words rise out of masks one after another. The words are real text in real
 * spans, read as one sentence by assistive technology through `aria-label`. lib/motion flips
 * `data-split` to "in" at the right moment; the CSS is in globals.css.
 */
export function Split({ parts, lines = true, as: Tag = "h2", className, delay, on = "seen", proximity, id }: Props) {
  const pieces: HeadingPart[] =
    typeof parts === "string"
      ? [parts]
      : lines && parts.every((part) => typeof part === "string")
        ? (parts as readonly string[]).flatMap((line, i) => (i ? [{ br: true as const }, line] : [line]))
        : [...(parts as readonly HeadingPart[])];

  const label = pieces
    .map((piece) => (typeof piece === "string" ? piece : "accent" in piece ? piece.accent : " "))
    .join("")
    .replace(/\s+/g, " ")
    .trim();

  let index = 0;
  const words = (text: string, keyPrefix: string): ReactNode[] =>
    text.split(/(\s+)/).map((token, i) => {
      if (!token) return null;
      if (/^\s+$/.test(token)) return " ";
      const w = index++;
      return (
        <span className="split-mask" key={`${keyPrefix}-${i}`}>
          <span className="split-word" style={{ "--w": w } as CSSProperties}>
            {proximity
              ? [...token].map((char, c) => (
                  <span className="prox-char" key={c}>
                    {char}
                  </span>
                ))
              : token}
          </span>
        </span>
      );
    });

  return (
    <Tag
      id={id}
      className={className}
      aria-label={label}
      data-split=""
      data-split-on={on === "load" ? "load" : undefined}
      data-proximity={proximity ? "" : undefined}
      style={delay ? ({ "--split-delay": `${delay}ms` } as CSSProperties) : undefined}
    >
      {pieces.map((piece, i) => {
        if (typeof piece === "string")
          return (
            <span key={i} aria-hidden="true">
              {words(piece, `p${i}`)}
            </span>
          );
        if ("br" in piece) return <br key={i} />;
        return (
          <span className="accent" key={i} aria-hidden="true">
            {words(piece.accent, `a${i}`)}
          </span>
        );
      })}
    </Tag>
  );
}
