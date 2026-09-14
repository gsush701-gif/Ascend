import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  CircleUser,
  Pencil,
  KeyRound,
  ShieldCheck,
  Bell,
  CreditCard,
  Trash2,
  LogOut,
} from "lucide-react";
import { AscendLogo } from "./AscendLogo";
import { NotificationsBell } from "./NotificationsBell";
import { Modal } from "../ui/Modal";
import { useAuth } from "../../context/AuthContext";
import { useProfile } from "../../lib/profile";
import { cn } from "../../lib/cn";
import {
  PlanPanelBody,
  ChangePasswordForm,
  OnboardingForm,
  NotificationPreferencesForm,
} from "../../features/profile/components/ProfileSharedForms";
import { usePlanUsage } from "../../features/profile/hooks/usePlanUsage";
import { useBillingActions } from "../../features/profile/hooks/useBillingActions";
import { MfaSettingsPanel } from "../../features/mfa/components/MfaSettingsPanel";

type NavItem = { to: string; label: string };

/**
 * Shown as pills in the bar on md+ screens. Also listed inside the profile
 * menu on smaller screens (where the pill row is hidden) so every primary
 * destination stays reachable. Routes are unchanged.
 */
const PRIMARY_LINKS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/roles", label: "Roles" },
  { to: "/analyzer", label: "Analyze" },
  { to: "/grok", label: "Grok AI" },
  { to: "/resume-lab", label: "Resume Lab" },
  // TEMPORARILY DISABLED — the Profile page itself is turned off for now
  // (see the /profile route in src/App.tsx); restore by uncommenting this
  // entry. The independent account menu below (Edit profile, Change
  // password, etc.) is unaffected and does not use this list.
  // { to: "/profile", label: "Profile" },
];

/**
 * Which account modal is open, if any. Every one of these renders existing
 * form/panel logic (src/features/profile/components/ProfileSharedForms.tsx,
 * src/features/mfa/components/MfaSettingsPanel.tsx) directly inside the
 * dropdown's own Modal — none of them navigate to the Profile page.
 */
type AccountModal = "edit" | "password" | "security" | "notifications" | "plan" | null;

const MODAL_TITLES: Record<Exclude<AccountModal, null>, string> = {
  edit: "Edit profile",
  password: "Change password",
  security: "Two-factor authentication",
  notifications: "Notifications",
  plan: "Plan & billing",
};

function BarLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        [
          "rounded-lg px-3 py-1.5 text-sm font-medium transition",
          isActive
            ? "bg-slate-900 text-white"
            : "text-slate-500 hover:bg-slate-900/[0.04] hover:text-slate-900",
        ].join(" ")
      }
    >
      {item.label}
    </NavLink>
  );
}

function MenuLink({
  item,
  onSelect,
  className = "",
}: {
  item: NavItem;
  onSelect: () => void;
  className?: string;
}) {
  return (
    <NavLink
      to={item.to}
      onClick={onSelect}
      className={({ isActive }) =>
        [
          "rounded-lg px-3 py-2 text-sm transition",
          isActive
            ? "bg-slate-900/[0.06] font-medium text-slate-900"
            : "text-slate-600 hover:bg-slate-900/[0.04] hover:text-slate-900",
          className,
        ].join(" ")
      }
    >
      {item.label}
    </NavLink>
  );
}

/** One row in the account menu — an in-place action (opens a modal, signs
 * out, ...), never a page navigation. `disabled` renders a genuinely inert
 * native <button> (no onClick is ever attached), not just a dimmed style. */
function AccountMenuItem({
  icon: Icon,
  label,
  onClick,
  disabled,
  title,
  danger,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-1",
        disabled
          ? "cursor-not-allowed text-slate-300 opacity-70"
          : danger
            ? "text-rose-600/90 hover:bg-rose-500/10 hover:text-rose-600"
            : "text-slate-600 hover:bg-slate-900/[0.04] hover:text-slate-900"
      )}
    >
      <Icon size={15} />
      {label}
    </button>
  );
}

/** Plan & billing modal body — composes the same hook + presentational
 * component the Profile page's Plan panel uses (ProfileSharedForms.tsx), so
 * usage numbers and the Upgrade/Manage billing actions are identical, not
 * reimplemented. */
function PlanModalContent({
  userId,
  session,
}: {
  userId: string | undefined;
  session: { access_token?: string } | null | undefined;
}) {
  const planInfo = usePlanUsage(userId);
  const { billingBusy, handleUpgrade, handleManageBilling } = useBillingActions(session);
  return (
    <PlanPanelBody
      planInfo={planInfo}
      billingBusy={billingBusy}
      onUpgrade={handleUpgrade}
      onManageBilling={handleManageBilling}
    />
  );
}

export function TopNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<AccountModal>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, session, signOut } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();

  const closeMenu = () => setMenuOpen(false);
  const closeModal = () => setActiveModal(null);
  const openModal = (modal: Exclude<AccountModal, null>) => {
    closeMenu();
    setActiveModal(modal);
  };

  async function handleSignOut() {
    closeMenu();
    await signOut();
    navigate("/login");
  }

  // Dismiss the menu on outside-click or Escape — same interaction pattern as
  // NotificationsBell's dropdown in this folder.
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  // Identity summary shown at the top of the menu — same derivation as the
  // Profile page's identity header (src/routes/Profile.tsx), computed here
  // independently since this menu no longer depends on that page.
  const displayName = profile?.fullName?.trim() || user?.email?.split("@")[0] || "Your account";
  const avatarInitial = (displayName.trim().charAt(0) || "A").toUpperCase();

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-[#F4F5FA]/95 backdrop-blur-md">
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-60"
          style={{ background: "linear-gradient(90deg, transparent, #22d3ee, #a78bfa, transparent)" }}
          aria-hidden
        />
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <NavLink
            to="/dashboard"
            className="flex shrink-0 items-center gap-2.5"
            onClick={closeMenu}
          >
            <AscendLogo className="h-7 w-auto" />
            <span className="font-display text-sm font-semibold tracking-tight text-slate-900">
              Ascend
            </span>
          </NavLink>

          <nav className="hidden items-center gap-1 md:flex">
            {PRIMARY_LINKS.map((item) => (
              <BarLink key={item.to} item={item} />
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-1">
            {user && <NotificationsBell />}

            <span className="mx-0.5 h-5 w-px bg-slate-200" aria-hidden />

            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center rounded-lg p-2 text-slate-600 transition hover:bg-slate-900/[0.04] hover:text-slate-900"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                <CircleUser size={20} />
              </button>

              {menuOpen && (
                <div className="animate-fade-in absolute right-0 top-full z-[200] mt-2 flex max-h-[calc(100vh-5rem)] w-64 max-w-[85vw] flex-col overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                  {user && (
                    <div className="flex items-center gap-3 px-2.5 py-2">
                      <div
                        aria-hidden
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white"
                      >
                        {avatarInitial}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">
                          {displayName}
                        </div>
                        {user.email && (
                          <div className="truncate text-xs text-slate-500">{user.email}</div>
                        )}
                      </div>
                    </div>
                  )}
                  <span className="my-1.5 h-px bg-slate-100" aria-hidden />

                  {/* Primary destinations stay reachable on small screens, where
                      the bar pills are hidden — unchanged from before. */}
                  <nav aria-label="Primary navigation" className="flex flex-col md:hidden">
                    {PRIMARY_LINKS.map((item) => (
                      <MenuLink key={item.to} item={item} onSelect={closeMenu} />
                    ))}
                  </nav>
                  <span className="my-1.5 h-px bg-slate-100 md:hidden" aria-hidden />

                  {/* Independent account actions — each opens its own modal
                      right here, reusing the Profile page's existing forms
                      and logic (ProfileSharedForms.tsx / MfaSettingsPanel)
                      without redirecting to /profile. */}
                  <div className="flex flex-col">
                    <AccountMenuItem
                      icon={Pencil}
                      label="Edit profile"
                      onClick={() => openModal("edit")}
                    />
                    <AccountMenuItem
                      icon={KeyRound}
                      label="Change password"
                      onClick={() => openModal("password")}
                    />
                    <AccountMenuItem
                      icon={ShieldCheck}
                      label="Two-factor authentication"
                      onClick={() => openModal("security")}
                    />
                    <AccountMenuItem
                      icon={Bell}
                      label="Notifications"
                      onClick={() => openModal("notifications")}
                    />
                    <AccountMenuItem
                      icon={CreditCard}
                      label="Plan & billing"
                      onClick={() => openModal("plan")}
                    />
                  </div>

                  <span className="my-1.5 h-px bg-slate-100" aria-hidden />

                  {/* Stays visible but genuinely inert — see AccountMenuItem's
                      disabled handling above. No delete-account logic is
                      wired to this row at all. */}
                  <AccountMenuItem
                    icon={Trash2}
                    label="Delete account"
                    disabled
                    danger
                    title="Temporarily disabled during development"
                  />

                  <span className="my-1.5 h-px bg-slate-100" aria-hidden />

                  <MenuLink
                    item={{ to: "/contacts", label: "Contact" }}
                    onSelect={closeMenu}
                  />
                  <AccountMenuItem icon={LogOut} label="Log out" onClick={handleSignOut} />
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <Modal isOpen={activeModal === "edit"} onClose={closeModal} title={MODAL_TITLES.edit}>
        <OnboardingForm onSaved={closeModal} />
      </Modal>
      <Modal isOpen={activeModal === "password"} onClose={closeModal} title={MODAL_TITLES.password}>
        <ChangePasswordForm onSaved={closeModal} />
      </Modal>
      <Modal isOpen={activeModal === "security"} onClose={closeModal} title={MODAL_TITLES.security}>
        <MfaSettingsPanel />
      </Modal>
      <Modal isOpen={activeModal === "notifications"} onClose={closeModal} title={MODAL_TITLES.notifications}>
        <NotificationPreferencesForm />
      </Modal>
      <Modal isOpen={activeModal === "plan"} onClose={closeModal} title={MODAL_TITLES.plan}>
        <PlanModalContent userId={session?.user?.id} session={session} />
      </Modal>
    </>
  );
}
