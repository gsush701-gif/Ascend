import { BackgroundFX } from "./BackgroundFX";
import { PublicNav } from "./PublicNav";

type PublicShellProps = {
  children: React.ReactNode;
};

export function PublicShell({ children }: PublicShellProps) {
  return (
    <div className="min-h-screen bg-[#07090D] text-white">
      <BackgroundFX />
      <PublicNav />
      <main className="relative mx-auto w-full max-w-6xl px-5 pb-20 pt-24">
        {children}
      </main>
    </div>
  );
}
