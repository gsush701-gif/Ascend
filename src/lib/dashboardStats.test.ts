import { describe, expect, it } from "vitest";
import { getOverdueCount, getUpcomingDeadlines } from "./dashboardStats";
import type { TrackerItem } from "../types/tracker";

function ymd(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function role(id: string, deadline?: string): TrackerItem {
  return {
    id,
    company: "Acme",
    role: `Role ${id}`,
    status: "Applied",
    alignment: 70,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    nextStep: "",
    deadline,
  } as TrackerItem;
}

describe("deadlines picked from the date input", () => {
  it("counts a deadline due today as today, not overdue", () => {
    const [d] = getUpcomingDeadlines([role("a", ymd(0))]);
    expect(d.daysText).toBe("Today");
    expect(d.isOverdue).toBe(false);
    expect(getOverdueCount([role("a", ymd(0))])).toBe(0);
  });

  it("counts days until a future date exactly", () => {
    const [d] = getUpcomingDeadlines([role("a", ymd(3))]);
    expect(d.daysText).toBe("3 days");
  });

  it("marks yesterday as overdue", () => {
    const [d] = getUpcomingDeadlines([role("a", ymd(-1))]);
    expect(d.isOverdue).toBe(true);
    expect(getOverdueCount([role("a", ymd(-1))])).toBe(1);
  });

  it("ignores roles with no valid deadline", () => {
    expect(getUpcomingDeadlines([role("a"), role("b", "soon")])).toEqual([]);
  });
});
