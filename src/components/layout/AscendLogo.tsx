/**
 * Ascend logo - Tailwind/SVG replica. Upward arrow, cyan-to-navy gradient.
 */
export function AscendLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Dark navy back shape */}
      <path
        d="M8 28h6v8h-6l-2-4 2-4z"
        className="fill-slate-800"
      />
      {/* Main arrow - cyan gradient */}
      <path
        d="M20 2l14 26h-8v10h-12V28H6L20 2z"
        fill="url(#ascend-grad)"
      />
      <defs>
        <linearGradient id="ascend-grad" x1="20" y1="2" x2="20" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22d3ee" />
          <stop offset="0.6" stopColor="#06b6d4" />
          <stop offset="1" stopColor="#0e7490" />
        </linearGradient>
      </defs>
    </svg>
  );
}
