const ONBOARDING_DONE_KEY = "internos_onboarding_done_v1";
const ONBOARDING_DATA_KEY = "internos_onboarding_v1";

export type OnboardingData = {
  major: string;
  targetRole: string;
  graduationYear: string;
};

export function isOnboardingDone(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_DONE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setOnboardingDone(): void {
  try {
    localStorage.setItem(ONBOARDING_DONE_KEY, "true");
  } catch {}
}

export function getOnboardingData(): OnboardingData | null {
  try {
    const raw = localStorage.getItem(ONBOARDING_DATA_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as OnboardingData;
    return data && typeof data.major === "string" ? data : null;
  } catch {
    return null;
  }
}

export function saveOnboardingData(data: OnboardingData): void {
  try {
    localStorage.setItem(ONBOARDING_DATA_KEY, JSON.stringify(data));
    setOnboardingDone();
  } catch {}
}
