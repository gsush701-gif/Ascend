import { BackgroundFX } from "./BackgroundFX";
import { TopNav } from "./TopNav";
import { pageContainer } from "../../lib/ui";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[#07090D] text-white">
      <BackgroundFX />
      <TopNav />
      <main className={`relative pb-16 pt-16 ${pageContainer}`}>
        {children}
      </main>
    </div>
  );
}
