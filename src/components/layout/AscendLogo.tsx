/**
 * Ascend logo — an ascending trend line with a cyan-to-violet gradient.
 * Literal "career, elevated" mark: a growth line that lifts off into an arrowhead.
 */
export function AscendLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M5 31 L15.5 18.5 L21.5 23.5 L33 9"
        stroke="url(#ascend-grad)"
        strokeWidth="4.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M33 9 L23.5 9 M33 9 L33 18.5"
        stroke="url(#ascend-grad)"
        strokeWidth="4.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <defs>
        <linearGradient
          id="ascend-grad"
          x1="5"
          y1="31"
          x2="33"
          y2="9"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#22d3ee" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
    </svg>
  );
}
