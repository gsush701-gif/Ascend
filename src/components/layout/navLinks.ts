import type { ComponentType } from "react";
import { Briefcase, Compass, FileText, LayoutDashboard, ScanSearch, Sparkles } from "lucide-react";
import { AI_NAME, AI_PATH } from "../../config/brand";

export type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

/**
 * The app's main destinations. Shown in the left sidebar on large screens, as a
 * row of pills in the top bar on medium screens, and inside the account menu on
 * phones, so every one stays reachable at any width. Routes are unchanged.
 *
 * The Profile page is switched off for now (see the /profile route in
 * src/App.tsx); the account menu covers editing a profile.
 */
export const PRIMARY_LINKS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/roles", label: "Roles", icon: Briefcase },
  { to: "/jobs", label: "Jobs", icon: Compass },
  { to: "/analyzer", label: "Analyze", icon: ScanSearch },
  { to: AI_PATH, label: AI_NAME, icon: Sparkles },
  { to: "/resume-lab", label: "Resume Lab", icon: FileText },
];
