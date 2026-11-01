import { useId } from "react";

type Props = {
  /** Pixel size of the square avatar. */
  size?: number;
  /** "thinking" speeds up the orbit and pulses the spark while Kairos works on an answer. */
  state?: "idle" | "thinking";
  className?: string;
};

/**
 * Kairos, the AI career advisor: an emblem rather than a face (the voice
 * interviewer already has one). The name means "the right moment", so the mark
 * is a glowing disc with a spark at its centre and a small dot orbiting like a
 * clock hand. It breathes slowly at rest and quickens while an answer is being
 * prepared. Motion is plain CSS (see kairos-* in src/index.css) and is switched
 * off for people who prefer reduced motion.
 */
export function KairosAvatar({ size = 40, state = "idle", className }: Props) {
  const uid = useId().replace(/:/g, "");
  const thinking = state === "thinking";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={thinking ? "Kairos is thinking" : "Kairos"}
      className={className}
    >
      <defs>
        <linearGradient id={`k-disc-${uid}`} x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
        <radialGradient id={`k-glow-${uid}`} cx="50%" cy="42%" r="55%">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="32" cy="32" r="29" fill={`url(#k-disc-${uid})`} />
      <circle cx="32" cy="32" r="29" fill={`url(#k-glow-${uid})`} />
      <circle cx="32" cy="32" r="29" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.5" />
      {/* faint orbit track */}
      <circle cx="32" cy="32" r="21" fill="none" stroke="#ffffff" strokeOpacity="0.28" strokeWidth="1" strokeDasharray="1.5 3" />

      {/* the orbiting dot */}
      <g className={thinking ? "kairos-orbit kairos-orbit-fast" : "kairos-orbit"} style={{ transformOrigin: "32px 32px" }}>
        <circle cx="32" cy="11" r="3.4" fill="#ffffff" />
      </g>

      {/* the spark: a four-point star */}
      <g className={thinking ? "kairos-spark kairos-spark-fast" : "kairos-spark"} style={{ transformOrigin: "32px 32px" }}>
        <path
          d="M32 17 C33.2 25.5 38.5 30.8 47 32 C38.5 33.2 33.2 38.5 32 47 C30.8 38.5 25.5 33.2 17 32 C25.5 30.8 30.8 25.5 32 17 Z"
          fill="#ffffff"
        />
      </g>
    </svg>
  );
}
