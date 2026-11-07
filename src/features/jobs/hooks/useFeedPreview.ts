import { useEffect, useState } from "react";
import { searchJobs } from "../api";
import { EMPTY_JOB_SEARCH_FILTERS, type Job } from "../../../types/jobs";

export type FeedPreview = {
  /** How many early-career roles are open right now. */
  count: number;
  /** The newest few. */
  jobs: Job[];
};

// One request per page load, shared by every component that asks (the landing
// page and the public internships page both want the count). A failed request is
// forgotten so the next visit tries again.
let inflight: Promise<FeedPreview> | null = null;

function loadFeedPreview(): Promise<FeedPreview> {
  if (!inflight) {
    inflight = searchJobs(EMPTY_JOB_SEARCH_FILTERS, 1, 3)
      .then((result) => {
        if (!result.providerConfigured) throw new Error("job feed unavailable");
        return { count: result.totalCount, jobs: result.jobs };
      })
      .catch((err) => {
        inflight = null;
        throw err;
      });
  }
  return inflight;
}

/**
 * The live size of the job feed and its newest roles, for the logged-out pages.
 * `failed` is true when the feed could not be reached; callers should then show
 * nothing rather than a made-up number.
 */
export function useFeedPreview() {
  const [preview, setPreview] = useState<FeedPreview | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadFeedPreview()
      .then((p) => {
        if (!cancelled) setPreview(p);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { preview, loading: !preview && !failed, failed };
}
