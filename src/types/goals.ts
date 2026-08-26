/** A user-defined career goal (e.g. "Get a SWE internship") with optional
 * numeric targets. Progress against these targets is never stored here —
 * it's always computed live from the user's real `roles` data (see
 * src/features/goals/progress.ts), so it can never drift out of sync. */
export type CareerGoal = {
  id: string;
  title: string;
  /** ISO date (YYYY-MM-DD), optional. */
  targetDate?: string;
  applicationsTarget?: number;
  interviewsTarget?: number;
  offersTarget?: number;
  createdAt: string;
  updatedAt: string;
};

export type CareerGoalInput = {
  title: string;
  targetDate?: string;
  applicationsTarget?: number;
  interviewsTarget?: number;
  offersTarget?: number;
};
