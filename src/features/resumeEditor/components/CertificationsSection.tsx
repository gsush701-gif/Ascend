import { Plus } from "lucide-react";
import { Panel } from "../../../components/ui/Panel";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { EntryCard } from "./EntryCard";
import { Field } from "./Field";
import { moveArrayItem, removeArrayItem, updateArrayItem } from "../arrayHelpers";
import type { ResumeCertificationEntry } from "../../../types/resume";

type CertificationsSectionProps = {
  certifications: ResumeCertificationEntry[];
  onChange: (next: ResumeCertificationEntry[]) => void;
};

const EMPTY_ENTRY: ResumeCertificationEntry = { name: "", issuer: "", date: "" };

export function CertificationsSection({ certifications, onChange }: CertificationsSectionProps) {
  return (
    <Panel
      title="Certifications"
      right={
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onChange([...certifications, { ...EMPTY_ENTRY }])}
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      }
    >
      {certifications.length === 0 ? (
        <p className="text-sm text-slate-400">No certifications yet.</p>
      ) : (
        <div className="space-y-3">
          {certifications.map((entry, index) => (
            <EntryCard
              key={index}
              index={index}
              count={certifications.length}
              onMoveUp={() => onChange(moveArrayItem(certifications, index, -1))}
              onMoveDown={() => onChange(moveArrayItem(certifications, index, 1))}
              onRemove={() => onChange(removeArrayItem(certifications, index))}
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Name">
                  <Input
                    value={entry.name}
                    onChange={(e) => onChange(updateArrayItem(certifications, index, { ...entry, name: e.target.value }))}
                  />
                </Field>
                <Field label="Issuer">
                  <Input
                    value={entry.issuer}
                    onChange={(e) => onChange(updateArrayItem(certifications, index, { ...entry, issuer: e.target.value }))}
                  />
                </Field>
                <Field label="Date">
                  <Input
                    value={entry.date}
                    onChange={(e) => onChange(updateArrayItem(certifications, index, { ...entry, date: e.target.value }))}
                  />
                </Field>
              </div>
            </EntryCard>
          ))}
        </div>
      )}
    </Panel>
  );
}
