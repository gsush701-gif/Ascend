/**
 * Keeps sign-in secrets and typed text out of the error reports the browser
 * sends to the error tracker.
 *
 * After a Google or email-link sign-in, the address bar briefly holds the
 * session itself (`#access_token=...&refresh_token=...`) or a one-time code
 * (`?code=...`). An error report records the page address and the addresses
 * visited just before it, so those have to be cut off before a report leaves.
 */

/** The address without its query string or fragment: origin and path only. */
export function scrubUrl(url: unknown): unknown {
  if (typeof url !== "string") return url;
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

type Breadcrumb = {
  category?: string;
  message?: string;
  data?: Record<string, unknown>;
};

/**
 * Cleans one breadcrumb (a note of something that happened before an error).
 * Addresses lose their query and fragment. Console output is dropped, because
 * the app logs database errors there and those can quote what a student typed.
 * Returns null to drop the breadcrumb.
 */
export function scrubBreadcrumb<T extends Breadcrumb>(crumb: T): T | null {
  if (crumb.category === "console") return null;
  if (crumb.data) {
    for (const key of ["url", "from", "to"]) {
      if (key in crumb.data) crumb.data[key] = scrubUrl(crumb.data[key]);
    }
  }
  return crumb;
}

type ReportEvent = {
  request?: { url?: string; query_string?: unknown; cookies?: unknown; headers?: Record<string, string> };
  user?: { id?: string | number } & Record<string, unknown>;
  breadcrumbs?: Breadcrumb[];
};

/** Cleans a whole error report before it is sent. */
export function scrubEvent<T extends ReportEvent>(event: T): T {
  if (event.request) {
    if (event.request.url) event.request.url = scrubUrl(event.request.url) as string;
    delete event.request.query_string;
    delete event.request.cookies;
    if (event.request.headers) {
      for (const name of Object.keys(event.request.headers)) {
        if (/^referer$/i.test(name)) event.request.headers[name] = scrubUrl(event.request.headers[name]) as string;
      }
    }
  }
  if (event.user) {
    event.user = event.user.id !== undefined ? { id: event.user.id } : undefined;
  }
  if (Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs = event.breadcrumbs
      .map((c) => scrubBreadcrumb(c))
      .filter((c): c is Breadcrumb => c !== null);
  }
  return event;
}
