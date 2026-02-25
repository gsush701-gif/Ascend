export function BackgroundFX() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.08) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(60% 55% at 50% 15%, black 0%, transparent 70%)",
        }}
      />

      {/* glow blobs */}
      <div className="absolute -top-44 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-white/10 blur-[95px]" />
      <div className="absolute top-52 -left-40 h-[460px] w-[460px] rounded-full bg-white/5 blur-[85px]" />
      <div className="absolute -bottom-44 right-0 h-[560px] w-[560px] rounded-full bg-white/5 blur-[95px]" />

      {/* vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/35 to-black/75" />
    </div>
  );
}
