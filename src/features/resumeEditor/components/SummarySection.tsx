import { Panel } from "../../../components/ui/Panel";
import { Textarea } from "../../../components/ui/Textarea";

type SummarySectionProps = {
  summary: string;
  onChange: (next: string) => void;
};

export function SummarySection({ summary, onChange }: SummarySectionProps) {
  return (
    <Panel title="Summary">
      <Textarea
        value={summary}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder="A short professional summary…"
      />
    </Panel>
  );
}
