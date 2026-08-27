import { Plus } from "lucide-react";
import { Panel } from "../../../components/ui/Panel";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { EntryCard } from "./EntryCard";
import { Field } from "./Field";
import { moveArrayItem, removeArrayItem, updateArrayItem } from "../arrayHelpers";
import type { ResumeEducationEntry } from "../../../types/resume";

type EducationSectionProps = {
  education: ResumeEducationEntry[];
  onChange: (next: ResumeEducationEntry[]) => void;
};

const EMPTY_ENTRY: ResumeEducationEntry = {
  school: "",
  degree: "",
  field: "",
  startDate: "",
  endDate: "",
  gpa: "",
};

export function EducationSection({ education, onChange }: EducationSectionProps) {
  return (
    <Panel
      title="Education"
      right={
        <Button type="button" variant="secondary" size="sm" onClick={() => onChange([...education, { ...EMPTY_ENTRY }])}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      }
    >
      {education.length === 0 ? (
        <p className="text-sm text-slate-400">No education entries yet.</p>
      ) : (
        <div className="space-y-3">
          {education.map((entry, index) => (
            <EntryCard
              key={index}
              index={index}
              count={education.length}
              onMoveUp={() => onChange(moveArrayItem(education, index, -1))}
              onMoveDown={() => onChange(moveArrayItem(education, index, 1))}
              onRemove={() => onChange(removeArrayItem(education, index))}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="School">
                  <Input
                    value={entry.school}
                    onChange={(e) => onChange(updateArrayItem(education, index, { ...entry, school: e.target.value }))}
                  />
                </Field>
                <Field label="Degree">
                  <Input
                    value={entry.degree}
                    onChange={(e) => onChange(updateArrayItem(education, index, { ...entry, degree: e.target.value }))}
                  />
                </Field>
                <Field label="Field of study">
                  <Input
                    value={entry.field}
                    onChange={(e) => onChange(updateArrayItem(education, index, { ...entry, field: e.target.value }))}
                  />
                </Field>
                <Field label="GPA">
                  <Input
                    value={entry.gpa}
                    onChange={(e) => onChange(updateArrayItem(education, index, { ...entry, gpa: e.target.value }))}
                  />
                </Field>
                <Field label="Start date">
                  <Input
                    value={entry.startDate}
                    onChange={(e) => onChange(updateArrayItem(education, index, { ...entry, startDate: e.target.value }))}
                    placeholder="e.g. Aug 2023"
                  />
                </Field>
                <Field label="End date">
                  <Input
                    value={entry.endDate}
                    onChange={(e) => onChange(updateArrayItem(education, index, { ...entry, endDate: e.target.value }))}
                    placeholder="e.g. May 2027 or Present"
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
