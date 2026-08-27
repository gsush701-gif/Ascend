import { Panel } from "../../../components/ui/Panel";
import { Input } from "../../../components/ui/Input";
import { Field } from "./Field";
import type { ResumeContact } from "../../../types/resume";

type ContactSectionProps = {
  contact: ResumeContact;
  onChange: (next: ResumeContact) => void;
};

const FIELDS: { key: keyof ResumeContact; label: string }[] = [
  { key: "name", label: "Full name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "location", label: "Location" },
  { key: "linkedin", label: "LinkedIn URL" },
  { key: "portfolio", label: "Portfolio / website" },
];

export function ContactSection({ contact, onChange }: ContactSectionProps) {
  return (
    <Panel title="Contact">
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <Field key={f.key} label={f.label}>
            <Input value={contact[f.key]} onChange={(e) => onChange({ ...contact, [f.key]: e.target.value })} />
          </Field>
        ))}
      </div>
    </Panel>
  );
}
