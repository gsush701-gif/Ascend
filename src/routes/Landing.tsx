import { useNavigate } from "react-router-dom";
import { FileText, Target, TrendingUp } from "lucide-react";
import { PageLayout } from "../components/layout/PageLayout";
import { Container } from "../components/ui/Container";

function Background() {
  return (
    <>
      {/* Base gradient */}
      <div
        className="absolute inset-0 -z-20"
        style={{
          background:
            "linear-gradient(180deg, #09090b 0%, #0a0a0b 40%, #0c0c0e 100%)",
        }}
      />
      {/* Animated gradient blobs */}
      <div
        className="absolute -z-10 top-[10%] left-[15%] w-[500px] h-[500px] rounded-full opacity-[0.35] blur-[100px] animate-blob-1"
        style={{
          background:
            "radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute -z-10 top-[50%] right-[10%] w-[450px] h-[450px] rounded-full opacity-[0.3] blur-[90px] animate-blob-2"
        style={{
          background:
            "radial-gradient(circle, rgba(16, 185, 129, 0.35) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute -z-10 bottom-[20%] left-[40%] w-[380px] h-[380px] rounded-full opacity-[0.25] blur-[80px] animate-blob-3"
        style={{
          background:
            "radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, transparent 70%)",
        }}
      />
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 -z-10 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)
          `,
          backgroundSize: "64px 64px",
        }}
      />
      {/* Shimmer: very subtle moving gradient */}
      <div
        className="absolute inset-0 -z-10 opacity-30"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(255,255,255,0.08), transparent 50%)",
        }}
      />
      {/* Vignette */}
      <div
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 100% 100% at 50% 50%, transparent 40%, rgba(0,0,0,0.5) 100%)",
        }}
      />
    </>
  );
}

const STEPS = [
  {
    step: 1,
    title: "Upload Resume",
    description:
      "Upload your resume (PDF). We parse skills and signals in seconds.",
    icon: FileText,
  },
  {
    step: 2,
    title: "Compare to JD",
    description:
      "Paste any job description. We measure alignment and missing signals.",
    icon: Target,
  },
  {
    step: 3,
    title: "Get Action Plan + Track Progress",
    description:
      "Get tangible bullets, a 2-week fix plan, and save to your tracker.",
    icon: TrendingUp,
  },
];

export function Landing() {
  const navigate = useNavigate();

  return (
    <PageLayout>
      <div className="relative min-h-screen overflow-hidden">
        <Background />

        {/* Hero */}
        <section className="relative flex min-h-[85vh] flex-col items-center justify-center px-6 pt-20">
          <Container className="flex flex-col items-center justify-center text-center">
            <h1
              className="animate-hero-enter text-6xl font-bold tracking-tight sm:text-7xl"
              style={{ animationDelay: "0ms", animationFillMode: "backwards" }}
            >
              <span
                className="inline-block bg-gradient-to-b from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent drop-shadow-[0_0_60px_rgba(255,255,255,0.2)]"
                style={{
                  textShadow: "0 0 80px rgba(255,255,255,0.15)",
                }}
              >
                InternOS
              </span>
            </h1>
            <p
              className="mt-5 animate-hero-enter text-lg text-zinc-400 sm:text-xl"
              style={{ animationDelay: "150ms", animationFillMode: "backwards" }}
            >
              Internship Performance System
            </p>
            <div
              className="mt-12 flex flex-col gap-4 animate-hero-enter sm:flex-row sm:gap-5"
              style={{ animationDelay: "280ms", animationFillMode: "backwards" }}
            >
              <button
                type="button"
                onClick={() => navigate("/analyzer")}
                className="animate-cta-pulse inline-flex min-w-[200px] items-center justify-center rounded-xl border border-zinc-200 bg-zinc-100 px-6 py-4 text-base font-semibold text-zinc-900 transition-all duration-200 hover:-translate-y-0.5 hover:border-white hover:bg-white hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] focus:outline-none focus:ring-2 focus:ring-zinc-500"
              >
                Analyze Resume
              </button>
              <button
                type="button"
                onClick={() => navigate("/tracker")}
                className="inline-flex min-w-[200px] items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800/80 px-6 py-4 text-base font-semibold text-zinc-200 transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-600 hover:bg-zinc-700/90 hover:shadow-[0_0_24px_rgba(255,255,255,0.08)] focus:outline-none focus:ring-2 focus:ring-zinc-600"
              >
                Open Tracker
              </button>
            </div>
          </Container>
        </section>

        {/* How it works */}
        <section className="relative border-t border-zinc-800/50 py-20">
          <Container>
            <h2 className="mb-14 text-center text-2xl font-semibold text-zinc-100">
              How it works
            </h2>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {STEPS.map((item, i) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.step}
                    className="animate-card-enter rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-8 transition-all duration-300 hover:border-zinc-700/60 hover:bg-zinc-900/50 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_4px_24px_rgba(0,0,0,0.2)]"
                    style={{
                      animationDelay: `${400 + i * 120}ms`,
                      animationFillMode: "backwards",
                    }}
                  >
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-700/60 bg-zinc-800/50 text-zinc-400">
                      <Icon size={20} />
                    </div>
                    <div className="text-2xl font-bold text-zinc-500">
                      {item.step}
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-zinc-200">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </Container>
        </section>

        {/* Value props / Trust strip */}
        <section className="relative border-t border-zinc-800/50 py-12">
          <Container>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-center">
              <span className="text-sm text-zinc-500">
                Built for ambitious internship applicants
              </span>
              <span className="flex items-center gap-1.5 text-zinc-600">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
              </span>
              <span className="text-sm text-zinc-500">
                Job-alignment intelligence
              </span>
            </div>
          </Container>
        </section>

        {/* Footer */}
        <footer className="relative border-t border-zinc-900/60 py-8 text-center text-xs text-zinc-500">
          InternOS V1 • Job-Alignment Intelligence
        </footer>
      </div>
    </PageLayout>
  );
}
