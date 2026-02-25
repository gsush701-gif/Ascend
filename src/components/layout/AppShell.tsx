import { BackgroundFX } from "./BackgroundFX";
import { TopNav } from "./TopNav";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[#07090D] text-white">
      <BackgroundFX />
      <TopNav />
      <main className="relative mx-auto w-full max-w-6xl px-5 pb-16 pt-24">
        {children}
      </main>
    </div>
  );
}
