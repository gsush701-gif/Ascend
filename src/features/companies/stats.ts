import type { TrackerItem } from "../../types/tracker";

export type CompanySummary = {
  company: string;
  count: number;
  avgAlignment: number | null;
};

/**
 * List of companies the user has tracked roles at, with their own real
 * aggregate data only — count of tracked roles and average fit score. No
 * third-party company info of any kind (see docs on why: no trustworthy
 * data source is wired up for that, and inventing it would fabricate data).
 */
export function getCompanyList(items: TrackerItem[]): CompanySummary[] {
  const byCompany = new Map<string, TrackerItem[]>();
  for (const item of items) {
    const key = item.company.trim() || "Unknown company";
    const list = byCompany.get(key) ?? [];
    list.push(item);
    byCompany.set(key, list);
  }
  const rows: CompanySummary[] = [...byCompany.entries()].map(([company, list]) => {
    const withAlignment = list.filter((i) => i.reportSnapshot);
    const avgAlignment =
      withAlignment.length > 0
        ? Math.round(
            withAlignment.reduce((sum, i) => sum + (i.reportSnapshot?.alignment ?? i.alignment), 0) /
              withAlignment.length
          )
        : null;
    return { company, count: list.length, avgAlignment };
  });
  return rows.sort((a, b) => b.count - a.count);
}

export type CompanyDetail = {
  company: string;
  count: number;
  avgAlignment: number | null;
  statusCounts: { status: string; count: number }[];
  roles: TrackerItem[];
};

/** Case-insensitive lookup of a single company's own-data history, or null if the user has no roles there. */
export function getCompanyDetail(items: TrackerItem[], companyName: string): CompanyDetail | null {
  const target = companyName.trim().toLowerCase();
  const roles = items.filter((i) => (i.company.trim() || "Unknown company").toLowerCase() === target);
  if (roles.length === 0) return null;

  const withAlignment = roles.filter((i) => i.reportSnapshot);
  const avgAlignment =
    withAlignment.length > 0
      ? Math.round(
          withAlignment.reduce((sum, i) => sum + (i.reportSnapshot?.alignment ?? i.alignment), 0) /
            withAlignment.length
        )
      : null;

  const statusMap = new Map<string, number>();
  roles.forEach((r) => statusMap.set(r.status, (statusMap.get(r.status) ?? 0) + 1));

  return {
    company: roles[0].company.trim() || "Unknown company",
    count: roles.length,
    avgAlignment,
    statusCounts: [...statusMap.entries()].map(([status, count]) => ({ status, count })),
    roles: [...roles].sort(
      (a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
    ),
  };
}
