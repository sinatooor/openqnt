/**
 * OpenQntMark — the bare "Q" glyph (orange ring + diagonal handle) without the
 * dark square backdrop. Inherits color from `currentColor` so it sits cleanly
 * on any background and recolors on hover/focus.
 */

interface Props {
  size?: number;
  className?: string;
}

export function OpenQntMark({ size = 24, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={className}
      aria-hidden="true"
    >
      <circle
        cx="50"
        cy="50"
        r="32"
        fill="none"
        stroke="currentColor"
        strokeWidth={20}
      />
      <line
        x1="62"
        y1="62"
        x2="90"
        y2="90"
        stroke="currentColor"
        strokeWidth={20}
        strokeLinecap="square"
      />
    </svg>
  );
}
