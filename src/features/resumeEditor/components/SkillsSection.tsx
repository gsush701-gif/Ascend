import { Panel } from "../../../components/ui/Panel";
import { StringListEditor } from "./StringListEditor";

type SkillsSectionProps = {
  skills: string[];
  onChange: (next: string[]) => void;
};

export function SkillsSection({ skills, onChange }: SkillsSectionProps) {
  return (
    <Panel title="Skills">
      <StringListEditor items={skills} onChange={onChange} placeholder="e.g. Python" />
    </Panel>
  );
}
