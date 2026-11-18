import type { ReactNode } from "react";

/** Renders `**bold**` runs of a content string in the bold weight, and the rest as it is. */
export function RichText({ text }: { text: string }): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/).map((run, i) =>
    run.startsWith("**") ? (
      <strong className="font-bold" key={i}>
        {run.slice(2, -2)}
      </strong>
    ) : (
      run
    ),
  );
}
