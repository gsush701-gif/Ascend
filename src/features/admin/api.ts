import { API_BASE } from "../../config/api";
import { getApiErrorMessage } from "../../lib/apiError";

// --- Admin Dashboard API client (Phase 7 Task 6) ---
//
// Every function here is a thin fetch wrapper around one GET /api/admin/*
// route (server/index.js). The real access-control boundary is entirely
// server-side (server/middleware/requireAdmin.js, checked independently on
// every request) — a 403 here is not a bug, it's the expected response for
// a logged-in user who isn't in the server's ADMIN_EMAILS list, and callers
// must treat it as a normal "not authorized" outcome, not an error to retry.

export class AdminApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
  }
}

async function adminGet<T>(path: string, accessToken: string | undefined): Promise<T> {
  if (!accessToken) {
    throw new AdminApiError(401, "Login required");
  }
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new AdminApiError(res.status, getApiErrorMessage(data, "Request failed"));
  }
  return data as T;
}

export type PageResult<T> = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: T[];
};

export type AdminOverview = {
  totalUsers: number;
  activeUsers: number;
  activeUserWindowDays: number;
  recentSignups: { id: string; email: string | null; createdAt: string }[];
  subscriptions: {
    totalRowsWithSubscription: number;
    byPlan: Record<string, number>;
    byStatus: Record<string, number>;
  };
};

export type AdminApplicationRow = {
  id: string;
  user_id: string;
  company: string;
  role: string;
  status: string;
  alignment: number;
  created_at: string;
  updated_at: string;
};

export type AdminApplications = {
  total: number;
  byStatus: Record<string, number>;
  recent: PageResult<AdminApplicationRow>;
};

export type AdminEventTypeStat = {
  requestCount: number;
  successCount: number;
  failureCount: number;
  errorRatePct: number | null;
};

export type AdminAiUsage = {
  windowDays: number;
  totalAiRequests: number;
  byEventType: Record<string, AdminEventTypeStat>;
  errorRateReliable: { note: string };
  topUsers: { userId: string; email: string | null; requestCount: number }[];
};

export type AdminSubscriptionRow = {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  stripe_customer_id: string | null;
  current_period_end: string | null;
  updated_at: string;
};

export type AdminBilling = {
  totalSubscriptionRows: number;
  activeByPlan: Record<string, number>;
  byPlanStatus: Record<string, number>;
  isLiveStripeData: boolean;
  recent: PageResult<AdminSubscriptionRow>;
};

export type AdminErrorLogRow = {
  id: string;
  request_id: string | null;
  route: string | null;
  status_code: number;
  error_code: string | null;
  message: string | null;
  user_id: string | null;
  created_at: string;
};

export type AdminSystem = {
  errorsLast24h: number;
  errorsLast7d: number;
  byStatusCode7d: Record<string, number>;
  topRoutes7d: { key: string; count: number }[];
  sentryConfigured: boolean;
  recent: PageResult<AdminErrorLogRow>;
};

export function fetchAdminWhoAmI(accessToken: string | undefined) {
  return adminGet<{ isAdmin: true; email: string }>("/api/admin/whoami", accessToken);
}

export function fetchAdminOverview(accessToken: string | undefined) {
  return adminGet<AdminOverview>("/api/admin/overview", accessToken);
}

export function fetchAdminApplications(accessToken: string | undefined, page: number, pageSize: number) {
  return adminGet<AdminApplications>(
    `/api/admin/applications?page=${page}&pageSize=${pageSize}`,
    accessToken,
  );
}

export function fetchAdminAiUsage(accessToken: string | undefined, days = 30) {
  return adminGet<AdminAiUsage>(`/api/admin/ai-usage?days=${days}`, accessToken);
}

export function fetchAdminBilling(accessToken: string | undefined, page: number, pageSize: number) {
  return adminGet<AdminBilling>(`/api/admin/billing?page=${page}&pageSize=${pageSize}`, accessToken);
}

export function fetchAdminSystem(accessToken: string | undefined, page: number, pageSize: number) {
  return adminGet<AdminSystem>(`/api/admin/system?page=${page}&pageSize=${pageSize}`, accessToken);
}
