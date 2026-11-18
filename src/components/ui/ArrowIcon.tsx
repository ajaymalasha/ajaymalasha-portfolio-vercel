const ROTATION = { ne: 0, e: 45, se: 90, s: 135, sw: 180, w: 225, nw: 270, n: 315 } as const;

export type ArrowDirection = keyof typeof ROTATION;

/**
 * The site's one arrow, drawn pointing up and to the right and turned to any of eight
 * directions. It takes its size from the text around it (1em) and its colour from `color`.
 */
export function ArrowIcon({ dir = "ne", className }: { dir?: ArrowDirection; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      aria-hidden="true"
      focusable="false"
      style={{ display: "inline-block", flexShrink: 0, overflow: "visible", verticalAlign: "-0.125em" }}
    >
      <path
        d="M6.5 17.5 17.5 6.5M8.5 6.5h9v9"
        transform={`rotate(${ROTATION[dir]} 12 12)`}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
