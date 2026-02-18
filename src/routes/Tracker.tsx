import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import type { TrackerItem } from "../types/tracker";
import { PageLayout } from "../components/layout/PageLayout";
import { Card } from "../components/ui/Card";
import { Container } from "../components/ui/Container";
import { SectionHeader } from "../components/ui/SectionHeader";
import { useTracker } from "../features/tracker/hooks/useTracker";
import { TrackerTable } from "../features/tracker/components/TrackerTable";
import { TrackerSummaryCards } from "../features/tracker/components/TrackerSummaryCards";
import { SavedReportModal } from "../features/tracker/components/SavedReportModal";

export function Tracker() {
  const navigate = useNavigate();
  const tracker = useTracker(undefined);
  const [reportViewingItem, setReportViewingItem] = useState<TrackerItem | null>(
    null
  );

  return (
    <PageLayout>
      <Container>
        <div className="space-y-6">
          <Card>
            <SectionHeader
              title="Internship Tracker"
              subtitle="Track companies, alignment, status, and next step."
              right={
                <button
                  onClick={() => navigate("/analyzer")}
                  className="inline-flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm hover:bg-zinc-900"
                >
                  <Plus size={16} />
                  Add via Analyzer
                </button>
              }
            />

            <TrackerTable
              tracker={tracker.tracker}
              filter={tracker.trackerFilter}
              onFilterChange={tracker.setTrackerFilter}
              onStatusChange={tracker.updateStatus}
              onNextStepChange={tracker.updateNextStep}
              onRemove={tracker.removeItem}
              onSeeReport={setReportViewingItem}
            />
          </Card>

          {reportViewingItem && (
            <SavedReportModal
              item={reportViewingItem}
              onClose={() => setReportViewingItem(null)}
            />
          )}

          <TrackerSummaryCards tracker={tracker.tracker} />
        </div>

        <footer className="mt-10 text-center text-xs text-zinc-600">
          InternOS V1 • Next: smarter extraction + saving to database
        </footer>
      </Container>
    </PageLayout>
  );
}
