import { Plus } from "lucide-react";
import { Panel } from "../../../components/ui/Panel";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { EntryCard } from "./EntryCard";
import { Field } from "./Field";
import { moveArrayItem, removeArrayItem, updateArrayItem } from "../arrayHelpers";
import type { ResumeAwardEntry } from "../../../types/resume";

type AwardsSectionProps = {
  awards: ResumeAwardEntry[];
  onChange: (next: ResumeAwardEntry[]) => void;
};

const EMPTY_ENTRY: ResumeAwardEntry = { name: "", issuer: "", date: "" };

export function AwardsSection({ awards, onChange }: AwardsSectionProps) {
  return (
    <Panel
      title="Awards"
      right={
        <Button type="button" variant="secondary" size="sm" onClick={() => onChange([...awards, { ...EMPTY_ENTRY }])}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      }
    >
      {awards.length === 0 ? (
        <p className="text-sm text-slate-400">No awards yet.</p>
      ) : (
        <div className="space-y-3">
          {awards.map((entry, index) => (
            <EntryCard
              key={index}
              index={index}
              count={awards.length}
              onMoveUp={() => onChange(moveArrayItem(awards, index, -1))}
              onMoveDown={() => onChange(moveArrayItem(awards, index, 1))}
              onRemove={() => onChange(removeArrayItem(awards, index))}
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Name">
                  <Input
                    value={entry.name}
                    onChange={(e) => onChange(updateArrayItem(awards, index, { ...entry, name: e.target.value }))}
                  />
                </Field>
                <Field label="Issuer">
                  <Input
                    value={entry.issuer}
                    onChange={(e) => onChange(updateArrayItem(awards, index, { ...entry, issuer: e.target.value }))}
                  />
                </Field>
                <Field label="Date">
                  <Input
                    value={entry.date}
                    onChange={(e) => onChange(updateArrayItem(awards, index, { ...entry, date: e.target.value }))}
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
