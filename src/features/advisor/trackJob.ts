import type { TrackerItem } from "../../types/tracker";
import type { AdvisorJob } from "./useAdvisorPlan";

type TrackerActions = {
  addManualTrackerItem: (
    onAdded: (newItemId: string) => void,
    reportSnapshot?: undefined,
    options?: {
      company?: string;
      role?: string;
      status?: TrackerItem["status"];
      nextStep?: string;
      jobDescription?: string;
    },
  ) => Promise<{ id: string | null; error: string | null }>;
  updateRoleFields: (id: string, fields: Partial<TrackerItem>) => void;
};

/**
 * Adds a posting from the job feed to the student's roles as a Wishlist role,
 * with the full posting text saved so it can be analyzed straight away, and a
 * link back to the company's own posting page. The role is created first and its
 * details filled in once it exists, because the details are saved by id.
 */
export async function trackAdvisorJob(
  tracker: TrackerActions,
  job: AdvisorJob,
): Promise<{ ok: boolean; error?: string }> {
  const created = await tracker.addManualTrackerItem(() => {}, undefined, {
    company: job.company,
    role: job.title,
    status: "Wishlist",
    nextStep: "Analyze it and apply",
    jobDescription: job.description ?? undefined,
  });
  if (!created.id) return { ok: false, error: created.error ?? "Couldn't add the role" };

  tracker.updateRoleFields(created.id, {
    jobId: job.id,
    jobUrl: job.url ?? undefined,
    source: "Ascend job feed",
    location: job.location ?? undefined,
    remoteType: job.remoteType ?? undefined,
    employmentType: job.employmentType ?? undefined,
    deadlineAt: job.deadline ?? undefined,
  });
  return { ok: true };
}
