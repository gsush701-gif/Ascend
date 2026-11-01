import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { PublicShell } from "../layout/PublicShell";

/** Shared look for the terms and refund pages, matching the privacy policy. */
export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <PublicShell>
      <article className="mx-auto max-w-3xl pt-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-1 text-xs text-slate-500">Last updated {updated}</p>
        {intro && <p className="mt-5 text-sm leading-relaxed text-slate-600">{intro}</p>}
        {children}
        <p className="mt-10 text-xs text-slate-400">
          <Link to="/" className="underline hover:text-slate-600">
            Back to Ascend
          </Link>
        </p>
      </article>
    </PublicShell>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

export function LegalBullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
