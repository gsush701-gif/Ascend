import { BackgroundFX } from "./BackgroundFX";
import { PublicNav } from "./PublicNav";
import { pageContainer } from "../../lib/ui";

type PublicShellProps = {
  children: React.ReactNode;
};

export function PublicShell({ children }: PublicShellProps) {
  return (
    <div className="min-h-screen bg-[#F4F5FA] text-slate-900">
      <BackgroundFX />
      <PublicNav />
      <main className={`relative pb-20 pt-16 ${pageContainer}`}>
        {children}
      </main>
    </div>
  );
}
