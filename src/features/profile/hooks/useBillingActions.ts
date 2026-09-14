import { useState } from "react";
import { toast } from "../../../components/ui/toast";
import { API_BASE } from "../../../config/api";
import { getApiErrorMessage } from "../../../lib/apiError";

/**
 * Stripe checkout/portal redirect handlers, shared by the Profile page's
 * Plan panel (src/routes/Profile.tsx) and the account menu's Plan & billing
 * modal (src/components/layout/TopNav.tsx).
 */
export function useBillingActions(session: { access_token?: string } | null | undefined) {
  const [billingBusy, setBillingBusy] = useState(false);

  const handleUpgrade = async () => {
    if (!session?.access_token) return;
    setBillingBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/billing/create-checkout-session`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(getApiErrorMessage(data, "Failed to start checkout"));
      }
      if (typeof data.url !== "string") {
        throw new Error("Failed to start checkout");
      }
      window.location.href = data.url;
    } catch (e) {
      toast.error({
        title: "Couldn't start checkout",
        description: e instanceof Error ? e.message : "Please try again.",
      });
      setBillingBusy(false);
    }
  };

  const handleManageBilling = async () => {
    if (!session?.access_token) return;
    setBillingBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/billing/create-portal-session`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(getApiErrorMessage(data, "Failed to open billing portal"));
      }
      if (typeof data.url !== "string") {
        throw new Error("Failed to open billing portal");
      }
      window.location.href = data.url;
    } catch (e) {
      toast.error({
        title: "Couldn't open billing portal",
        description: e instanceof Error ? e.message : "Please try again.",
      });
      setBillingBusy(false);
    }
  };

  return { billingBusy, handleUpgrade, handleManageBilling };
}
