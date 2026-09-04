import { useEffect, useState } from "react";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Button } from "../../../components/ui/Button";
import { toast } from "../../../components/ui/toast";
import { useProfile } from "../../../lib/profile";

/**
 * Career preferences (Phase 5, Task 3) — work authorization and location
 * preferences, used only to render an honest textual compatibility note on
 * a role's own sponsorship/location/remote-type fields (RoleDetailDrawer)
 * and to power job-recommendation matching (Jobs page). Never used to
 * fabricate a numeric "match score", and never immigration or legal advice
 * — this is purely pattern-matching against employer-stated fields the user
 * already sees on each tracked role/job.
 *
 * Moved here from src/routes/Profile.tsx so it can be shown on the Jobs
 * page too, right where these preferences actually affect matching.
 */
export function CareerPreferencesForm() {
  const { profile, loading, updateProfile } = useProfile();
  const [workAuthorization, setWorkAuthorization] = useState("");
  const [requiresSponsorship, setRequiresSponsorship] = useState("");
  const [preferredLocations, setPreferredLocations] = useState("");
  const [remotePreference, setRemotePreference] = useState("");
  const [saved, setSaved] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!loading && profile && !initialized) {
      setWorkAuthorization(profile.workAuthorization);
      setRequiresSponsorship(
        profile.requiresSponsorship === true ? "yes" : profile.requiresSponsorship === false ? "no" : ""
      );
      setPreferredLocations(profile.preferredLocations);
      setRemotePreference(profile.remotePreference);
      setInitialized(true);
    }
  }, [loading, profile, initialized]);

  const handleSave = async () => {
    const { error } = await updateProfile({
      workAuthorization: workAuthorization.trim(),
      requiresSponsorship:
        requiresSponsorship === "yes" ? true : requiresSponsorship === "no" ? false : undefined,
      preferredLocations: preferredLocations.trim(),
      remotePreference,
    });
    if (error) {
      toast.error({ title: "Couldn't save preferences", description: error });
      return;
    }
    setSaved(true);
    toast.success({ title: "Preferences saved" });
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-slate-500">Work authorization (optional)</label>
        <Input
          type="text"
          value={workAuthorization}
          onChange={(e) => setWorkAuthorization(e.target.value)}
          placeholder="e.g. US Citizen, F-1 OPT, H-1B"
          className="mt-1"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500">Do you require visa sponsorship?</label>
        <Select
          value={requiresSponsorship}
          onChange={setRequiresSponsorship}
          placeholder="Not specified"
          options={[
            { value: "", label: "Not specified" },
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ]}
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500">Preferred location(s)</label>
        <Input
          type="text"
          value={preferredLocations}
          onChange={(e) => setPreferredLocations(e.target.value)}
          placeholder="e.g. Seattle, WA; New York, NY"
          className="mt-1"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500">Remote preference</label>
        <Select
          value={remotePreference}
          onChange={setRemotePreference}
          placeholder="Not specified"
          options={[
            { value: "", label: "Not specified" },
            { value: "Remote", label: "Remote" },
            { value: "Hybrid", label: "Hybrid" },
            { value: "Onsite", label: "Onsite" },
            { value: "No preference", label: "No preference" },
          ]}
        />
      </div>
      <Button type="button" onClick={handleSave} variant="primary">
        {saved ? "Saved" : "Save preferences"}
      </Button>
    </div>
  );
}
