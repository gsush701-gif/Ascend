export function BackgroundFX() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#F4F5FA]">
      {/* subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(15,23,42,.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,.05) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(60% 55% at 50% 15%, black 0%, transparent 70%)",
        }}
      />

      {/* glow blobs */}
      <div className="absolute -top-44 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-cyan-400/[0.12] blur-[110px]" />
      <div className="absolute top-52 -left-40 h-[460px] w-[460px] rounded-full bg-violet-400/[0.10] blur-[100px]" />
      <div className="absolute -bottom-44 right-0 h-[560px] w-[560px] rounded-full bg-cyan-300/[0.10] blur-[110px]" />
    </div>
  );
}
