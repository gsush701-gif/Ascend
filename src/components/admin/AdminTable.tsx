import { Button } from "../ui/Button";

export type AdminTableColumn<T> = {
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
};

type AdminTableProps<T> = {
  columns: AdminTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  page: number;
  totalPages: number;
  total: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
  emptyMessage?: string;
};

/** Small, shared paginated table for the admin dashboard's list sections
 * (Applications, Billing, System/Errors) — see src/routes/Admin.tsx. Not a
 * general-purpose data-grid; deliberately minimal (no sorting/filtering) to
 * match the scope of an internal admin tool. */
export function AdminTable<T>({
  columns,
  rows,
  rowKey,
  page,
  totalPages,
  total,
  loading = false,
  onPageChange,
  emptyMessage = "Nothing to show yet.",
}: AdminTableProps<T>) {
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs font-medium uppercase tracking-wide text-slate-500">
              {columns.map((c) => (
                <th key={c.header} className={`py-2 pr-4 ${c.className ?? ""}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-6 text-center text-sm text-slate-500">
                  {loading ? "Loading…" : emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={rowKey(row)} className="border-b border-slate-100 last:border-0">
                  {columns.map((c) => (
                    <td key={c.header} className={`py-2 pr-4 align-top text-slate-700 ${c.className ?? ""}`}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>
          Page {page} of {Math.max(totalPages, 1)} ({total.toLocaleString()} total)
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(page - 1)}
          >
            Prev
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={page >= totalPages || loading}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
