import { useEffect, useRef } from "react";

export type AvatarState = "idle" | "thinking" | "speaking" | "listening";

const RING_COLOR: Record<AvatarState, string> = {
  idle: "#cbd5e1",
  thinking: "#a78bfa",
  speaking: "#22d3ee",
  listening: "#34d399",
};

/**
 * Animated interviewer for the voice interview: a friendly, deliberately
 * non-photographic face that blinks, breathes, raises its brows while the AI
 * is thinking, and moves its mouth while it's speaking — so the call feels
 * like talking to someone instead of a speaker icon.
 *
 * The mouth is driven by the interviewer's *status*, not the audio signal: it
 * moves in a speech-like rhythm for as long as the voice is speaking. Routing
 * the audio through the Web Audio API to measure real loudness would mean the
 * sound only plays if that graph is running, and a suspended AudioContext
 * would silence the interviewer — not worth the risk for the effect. True
 * lip-sync belongs with the realistic video avatar, if that's added later.
 *
 * Animation writes straight to SVG attributes from a requestAnimationFrame
 * loop (no React re-render per frame), and is skipped for users who prefer
 * reduced motion.
 */
export function InterviewerAvatar({ state, size = 136 }: { state: AvatarState; size?: number }) {
  const bodyRef = useRef<SVGGElement>(null);
  const eyesRef = useRef<SVGGElement>(null);
  const browsRef = useRef<SVGGElement>(null);
  const mouthRef = useRef<SVGPathElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const stateRef = useRef<AvatarState>(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const reduceMotion =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let level = 0;
    let nextBlinkAt = performance.now() + 2500;
    let blinkUntil = 0;

    const tick = (now: number) => {
      const s = stateRef.current;
      const t = now / 1000;

      // Mouth openness 0..1 — a few out-of-phase sines read as syllables.
      let target = 0;
      if (s === "speaking") {
        target = reduceMotion
          ? 0.35
          : Math.min(1, 0.12 + 0.8 * Math.abs(Math.sin(t * 9.1) * Math.sin(t * 4.3 + 1)) + 0.08 * Math.sin(t * 23));
      }
      level += (target - level) * 0.35;

      if (now >= nextBlinkAt) {
        blinkUntil = now + 130;
        nextBlinkAt = now + 2500 + Math.random() * 3500;
      }
      const eyeScale = now < blinkUntil ? 0.1 : 1;

      const breathe = reduceMotion ? 0 : Math.sin(t * 1.3) * 1.2;
      const tilt = reduceMotion ? 0 : s === "listening" ? Math.sin(t * 0.9) * 2.2 : 0;
      const browLift = s === "thinking" ? -4 : s === "listening" ? -1.5 : 0;

      // Closed mouth is a gentle smile; open height grows with `level`.
      const open = 1.5 + level * 15;
      mouthRef.current?.setAttribute(
        "d",
        `M 58 99 Q 80 ${96 + 5 * (1 - level)} 102 99 Q 80 ${99 + open * 1.4 + 3 * (1 - level)} 58 99 Z`,
      );
      eyesRef.current?.setAttribute("transform", `translate(0 70) scale(1 ${eyeScale}) translate(0 -70)`);
      browsRef.current?.setAttribute("transform", `translate(0 ${browLift})`);
      bodyRef.current?.setAttribute("transform", `translate(0 ${breathe}) rotate(${tilt} 80 80)`);
      if (ringRef.current) {
        ringRef.current.setAttribute("stroke", RING_COLOR[s]);
        ringRef.current.setAttribute("stroke-width", String(3 + (s === "speaking" ? level * 5 : 0)));
        ringRef.current.setAttribute("opacity", s === "idle" ? "0.6" : "1");
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      role="img"
      aria-label={`AI interviewer, ${state === "idle" ? "waiting" : state}`}
    >
      <defs>
        <linearGradient id="avatar-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ecfeff" />
          <stop offset="1" stopColor="#ede9fe" />
        </linearGradient>
        <linearGradient id="avatar-face" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f1f5f9" />
          <stop offset="1" stopColor="#e2e8f0" />
        </linearGradient>
      </defs>
      <circle cx="80" cy="80" r="74" fill="url(#avatar-bg)" />
      <circle ref={ringRef} cx="80" cy="80" r="74" fill="none" stroke={RING_COLOR.idle} strokeWidth="3" />
      <g ref={bodyRef}>
        {/* shoulders */}
        <path d="M 22 150 Q 30 124 80 122 Q 130 124 138 150 Z" fill="#0f172a" opacity="0.88" />
        {/* neck */}
        <rect x="68" y="108" width="24" height="18" rx="8" fill="#cbd5e1" />
        {/* head */}
        <rect x="42" y="36" width="76" height="78" rx="34" fill="url(#avatar-face)" stroke="#cbd5e1" strokeWidth="1.5" />
        {/* hair */}
        <path d="M 42 70 Q 40 34 80 32 Q 120 34 118 70 Q 108 52 80 50 Q 52 52 42 70 Z" fill="#334155" />
        <g ref={browsRef} stroke="#475569" strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M 55 60 Q 63 56 71 60" />
          <path d="M 89 60 Q 97 56 105 60" />
        </g>
        <g ref={eyesRef} fill="#0f172a">
          <ellipse cx="63" cy="70" rx="4.6" ry="5.4" />
          <ellipse cx="97" cy="70" rx="4.6" ry="5.4" />
        </g>
        <path d="M 78 76 Q 80 84 83 85" stroke="#94a3b8" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path ref={mouthRef} d="M 58 99 Q 80 101 102 99 Q 80 103 58 99 Z" fill="#9f1239" stroke="#9f1239" strokeWidth="1.5" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
