import { Plus } from "lucide-react";
import { Panel } from "../../../components/ui/Panel";
import { Input } from "../../../components/ui/Input";
import { Textarea } from "../../../components/ui/Textarea";
import { Button } from "../../../components/ui/Button";
import { EntryCard } from "./EntryCard";
import { Field } from "./Field";
import { BulletListEditor } from "./BulletListEditor";
import { StringListEditor } from "./StringListEditor";
import { moveArrayItem, removeArrayItem, updateArrayItem } from "../arrayHelpers";
import type { ResumeProjectEntry } from "../../../types/resume";

type ProjectsSectionProps = {
  projects: ResumeProjectEntry[];
  onChange: (next: ResumeProjectEntry[]) => void;
};

const EMPTY_ENTRY: ResumeProjectEntry = {
  name: "",
  description: "",
  technologies: [],
  bullets: [],
};

export function ProjectsSection({ projects, onChange }: ProjectsSectionProps) {
  return (
    <Panel
      title="Projects"
      right={
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onChange([...projects, { ...EMPTY_ENTRY, technologies: [], bullets: [] }])}
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      }
    >
      {projects.length === 0 ? (
        <p className="text-sm text-slate-400">No project entries yet.</p>
      ) : (
        <div className="space-y-3">
          {projects.map((entry, index) => (
            <EntryCard
              key={index}
              index={index}
              count={projects.length}
              onMoveUp={() => onChange(moveArrayItem(projects, index, -1))}
              onMoveDown={() => onChange(moveArrayItem(projects, index, 1))}
              onRemove={() => onChange(removeArrayItem(projects, index))}
            >
              <Field label="Name">
                <Input
                  value={entry.name}
                  onChange={(e) => onChange(updateArrayItem(projects, index, { ...entry, name: e.target.value }))}
                />
              </Field>
              <Field label="Description">
                <Textarea
                  value={entry.description}
                  onChange={(e) => onChange(updateArrayItem(projects, index, { ...entry, description: e.target.value }))}
                  rows={2}
                />
              </Field>
              <div>
                <span className="mb-1 block text-xs font-medium text-slate-500">Technologies</span>
                <StringListEditor
                  items={entry.technologies}
                  onChange={(technologies) => onChange(updateArrayItem(projects, index, { ...entry, technologies }))}
                  placeholder="e.g. React"
                />
              </div>
              <BulletListEditor
                bullets={entry.bullets}
                onChange={(bullets) => onChange(updateArrayItem(projects, index, { ...entry, bullets }))}
              />
            </EntryCard>
          ))}
        </div>
      )}
    </Panel>
  );
}
