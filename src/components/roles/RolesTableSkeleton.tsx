import { Skeleton } from "../ui/Skeleton";

export function RolesTableSkeleton() {
  return (
    <div className="space-y-6">
      {/* Toolbar skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Skeleton className="h-6 w-20" />
          <Skeleton className="mt-2 h-4 w-48" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-10 w-44 rounded-lg" />
          <Skeleton className="h-10 w-[120px] rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      </div>

      {/* Table skeleton */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-dash-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-[#F4F5FA]/95">
              <tr>
                <th className="py-3 pl-4 pr-3">
                  <Skeleton className="h-4 w-12" />
                </th>
                <th className="py-3 px-3">
                  <Skeleton className="h-4 w-16" />
                </th>
                <th className="hidden py-3 px-3 md:table-cell">
                  <Skeleton className="h-4 w-14" />
                </th>
                <th className="py-3 px-3">
                  <Skeleton className="h-4 w-12" />
                </th>
                <th className="hidden py-3 px-3 md:table-cell">
                  <Skeleton className="h-4 w-16" />
                </th>
                <th className="hidden py-3 px-3 lg:table-cell">
                  <Skeleton className="h-4 w-12" />
                </th>
                <th className="hidden py-3 px-3 xl:table-cell">
                  <Skeleton className="h-4 w-10" />
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <tr
                  key={i}
                  className={`border-b border-slate-200 ${
                    i % 2 === 1 ? "bg-white/[0.02]" : ""
                  }`}
                >
                  <td className="py-2.5 pl-4 pr-3">
                    <Skeleton className="h-4 w-28" />
                  </td>
                  <td className="py-2.5 px-3">
                    <Skeleton className="h-4 w-20" />
                  </td>
                  <td className="hidden py-2.5 px-3 md:table-cell">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-2 w-10 rounded-full" />
                      <Skeleton className="h-4 w-8" />
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <Skeleton className="h-6 w-16 rounded-md" />
                  </td>
                  <td className="hidden py-2.5 px-3 md:table-cell">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-2 w-10 rounded-full" />
                      <Skeleton className="h-4 w-8" />
                    </div>
                  </td>
                  <td className="hidden py-2.5 px-3 lg:table-cell">
                    <Skeleton className="h-4 w-14" />
                  </td>
                  <td className="hidden py-2.5 px-3 xl:table-cell">
                    <Skeleton className="h-4 w-24" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
