/**
 * The page background: a flat, very light surface with one soft glow at the top.
 * Deliberately quiet, so the content (white cards, clear type) carries the page.
 */
export function BackgroundFX() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#F7F8FB]">
      <div className="absolute left-1/2 top-[-18rem] h-[28rem] w-[60rem] -translate-x-1/2 rounded-full bg-cyan-400/[0.07] blur-[120px]" />
    </div>
  );
}
