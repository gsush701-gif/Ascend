import { BackgroundFX } from "./BackgroundFX";
import { PublicNav } from "./PublicNav";
import { pageContainer } from "../../lib/ui";

type PublicShellProps = {
  children: React.ReactNode;
};

export function PublicShell({ children }: PublicShellProps) {
  return (
    <div className="min-h-screen bg-[#07090D] text-white">
      <BackgroundFX />
      <PublicNav />
      <main className={`relative pb-20 pt-16 ${pageContainer}`}>
        {children}
      </main>
    </div>
  );
}
