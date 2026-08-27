import { Plus } from "lucide-react";
import { Panel } from "../../../components/ui/Panel";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { EntryCard } from "./EntryCard";
import { Field } from "./Field";
import { BulletListEditor } from "./BulletListEditor";
import { moveArrayItem, removeArrayItem, updateArrayItem } from "../arrayHelpers";
import type { ResumeExperienceEntry } from "../../../types/resume";

type ExperienceSectionProps = {
  experience: ResumeExperienceEntry[];
  onChange: (next: ResumeExperienceEntry[]) => void;
};

const EMPTY_ENTRY: ResumeExperienceEntry = {
  company: "",
  title: "",
  location: "",
  startDate: "",
  endDate: "",
  bullets: [],
};

export function ExperienceSection({ experience, onChange }: ExperienceSectionProps) {
  return (
    <Panel
      title="Experience"
      right={
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onChange([...experience, { ...EMPTY_ENTRY, bullets: [] }])}
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      }
    >
      {experience.length === 0 ? (
        <p className="text-sm text-slate-400">No experience entries yet.</p>
      ) : (
        <div className="space-y-3">
          {experience.map((entry, index) => (
            <EntryCard
              key={index}
              index={index}
              count={experience.length}
              onMoveUp={() => onChange(moveArrayItem(experience, index, -1))}
              onMoveDown={() => onChange(moveArrayItem(experience, index, 1))}
              onRemove={() => onChange(removeArrayItem(experience, index))}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Company">
                  <Input
                    value={entry.company}
                    onChange={(e) => onChange(updateArrayItem(experience, index, { ...entry, company: e.target.value }))}
                  />
                </Field>
                <Field label="Title">
                  <Input
                    value={entry.title}
                    onChange={(e) => onChange(updateArrayItem(experience, index, { ...entry, title: e.target.value }))}
                  />
                </Field>
                <Field label="Location">
                  <Input
                    value={entry.location}
                    onChange={(e) => onChange(updateArrayItem(experience, index, { ...entry, location: e.target.value }))}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start date">
                    <Input
                      value={entry.startDate}
                      onChange={(e) => onChange(updateArrayItem(experience, index, { ...entry, startDate: e.target.value }))}
                    />
                  </Field>
                  <Field label="End date">
                    <Input
                      value={entry.endDate}
                      onChange={(e) => onChange(updateArrayItem(experience, index, { ...entry, endDate: e.target.value }))}
                      placeholder="Present"
                    />
                  </Field>
                </div>
              </div>
              <BulletListEditor
                bullets={entry.bullets}
                onChange={(bullets) => onChange(updateArrayItem(experience, index, { ...entry, bullets }))}
              />
            </EntryCard>
          ))}
        </div>
      )}
    </Panel>
  );
}
