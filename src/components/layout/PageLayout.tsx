import { TopNav } from "./TopNav";

type PageLayoutProps = {
  children: React.ReactNode;
};

export function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className="min-h-screen text-white">
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-zinc-950 via-zinc-950/95 to-zinc-950" />
      <div className="fixed inset-0 -z-10 opacity-60 [background:radial-gradient(1200px_600px_at_25%_-10%,rgba(255,255,255,0.10),transparent_55%),radial-gradient(900px_500px_at_85%_0%,rgba(59,130,246,0.10),transparent_55%),radial-gradient(700px_400px_at_70%_80%,rgba(16,185,129,0.08),transparent_60%)]" />
      <TopNav />
      <main className="pt-24">{children}</main>
    </div>
  );
}
