/**
 * Backend error responses (server/lib/errors.js) have the shape:
 *   { error: { code: string, message: string, requestId: string | null } }
 *
 * This extracts a displayable message from that shape, while staying
 * tolerant of a plain-string `error` field (e.g. a proxy/host-level error
 * page, or a response that never reached our JSON error handler at all) so
 * a shape mismatch degrades to the fallback instead of showing
 * "[object Object]" to the user.
 */
export function getApiErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "error" in data) {
    const err = (data as { error?: unknown }).error;
    if (typeof err === "string" && err.trim()) return err;
    if (err && typeof err === "object" && "message" in err) {
      const message = (err as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) return message;
    }
  }
  return fallback;
}
