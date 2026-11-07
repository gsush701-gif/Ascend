import { useEffect } from "react";
import { warmBackend } from "../../lib/warmBackend";
import { BackgroundFX } from "./BackgroundFX";
import { TopNav } from "./TopNav";
import { AssistantLauncher } from "./AssistantLauncher";
import { FeedbackButton } from "../feedback/FeedbackButton";
import { pageContainer } from "../../lib/ui";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  useEffect(() => {
    warmBackend();
  }, []);

  return (
    <div className="min-h-screen overflow-x-clip bg-[#F7F8FB] text-slate-900">
      <BackgroundFX />
      <TopNav />
      <main className={`relative pb-32 pt-24 ${pageContainer}`}>
        {children}
      </main>
      <AssistantLauncher />
      <FeedbackButton />
    </div>
  );
}
