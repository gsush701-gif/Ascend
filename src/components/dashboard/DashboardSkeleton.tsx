import { Skeleton } from "../ui/Skeleton";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="mt-2 h-4 w-56" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      </header>

      {/* 2-col layout */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          {/* Fit score */}
          <section className="rounded-xl border border-slate-200 bg-dash-card p-6">
            <Skeleton className="h-3 w-20" />
            <div className="mt-3 flex items-end gap-4">
              <Skeleton className="h-14 w-16" />
              <Skeleton className="mb-2 h-4 w-32" />
            </div>
            <Skeleton className="mt-1 h-3 w-52" />
            <Skeleton className="mt-4 h-2 w-full rounded-full" />
          </section>

          {/* Key metrics */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>

          {/* Upcoming deadlines */}
          <section className="rounded-xl border border-slate-200 bg-dash-card p-6">
            <Skeleton className="h-4 w-36" />
            <div className="mt-4 space-y-3">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          </section>
        </div>

        <div className="space-y-6 lg:col-span-5">
          {/* By status */}
          <section className="rounded-xl border border-slate-200 bg-dash-card p-6">
            <Skeleton className="h-4 w-20" />
            <div className="mt-4 space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </section>

          {/* Next actions */}
          <section className="rounded-xl border border-slate-200 bg-dash-card p-6">
            <Skeleton className="h-4 w-24" />
            <div className="mt-4 space-y-3">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          </section>
        </div>
      </div>

      {/* Status bar */}
      <section className="rounded-xl border border-slate-200 bg-dash-card p-5">
        <Skeleton className="mb-2 h-3 w-20" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </section>

      {/* Performance insight */}
      <section className="rounded-xl border border-slate-200 bg-dash-card p-5">
        <Skeleton className="mb-2 h-3 w-24" />
        <Skeleton className="h-12 w-full" />
      </section>

      {/* Outlook card */}
      <section className="rounded-xl border border-slate-200 bg-dash-card p-5">
        <Skeleton className="mb-2 h-4 w-28" />
        <Skeleton className="mb-4 h-3 w-64" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
          <Skeleton className="h-[140px] w-full rounded-lg" />
        </div>
      </section>
    </div>
  );
}
