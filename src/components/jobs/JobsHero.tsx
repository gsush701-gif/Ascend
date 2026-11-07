const fmt = (n: number) => n.toLocaleString();

/**
 * The big headline at the top of the job pages: a small "open roles" badge, a
 * display-size title and one line of explanation. Shared by the public
 * internships page and the signed-in Jobs page so the two look the same.
 */
export function JobsHero({
  count,
  title,
  subtitle,
}: {
  /** Open roles right now; the badge is hidden until it is known. */
  count?: number | null;
  title: string;
  subtitle: string;
}) {
  return (
    <header className="space-y-3 text-center sm:text-left">
      {typeof count === "number" && count > 0 && (
        <div className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
          {fmt(count)} open roles right now
        </div>
      )}
      <h1 className="font-display text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
      <p className="max-w-2xl text-sm text-slate-600 sm:text-base">{subtitle}</p>
    </header>
  );
}
