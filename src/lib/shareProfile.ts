import type { SharedProfileData } from "../types/analyzer";
import { SHARE_PAYLOAD_KEY } from "../types/analyzer";

const SLUG_KEY = "internos_share_slug_v1";

export function getStoredSharePayload(): SharedProfileData | null {
  try {
    const raw = localStorage.getItem(SHARE_PAYLOAD_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SharedProfileData;
    if (
      data &&
      Array.isArray(data.skills) &&
      typeof data.strength === "number" &&
      Array.isArray(data.history)
    )
      return data;
  } catch {}
  return null;
}

export function setStoredSharePayload(payload: SharedProfileData): void {
  try {
    localStorage.setItem(SHARE_PAYLOAD_KEY, JSON.stringify(payload));
  } catch {}
}

export function getStoredShareSlug(): string {
  try {
    const s = localStorage.getItem(SLUG_KEY);
    if (s && typeof s === "string") return s;
  } catch {}
  return "";
}

export function setStoredShareSlug(slug: string): void {
  try {
    localStorage.setItem(SLUG_KEY, slug);
  } catch {}
}

export function buildShareUrl(slug: string, payload: SharedProfileData): string {
  const clean = slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "") || "profile";
  return `${typeof window !== "undefined" ? window.location.origin : ""}/${clean}?d=${btoa(JSON.stringify(payload))}`;
}
