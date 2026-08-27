import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, RefreshCw, Save, Sparkles } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { Panel } from "../components/ui/Panel";
import { Button } from "../components/ui/Button";
import { pageHeader, pageSubtitle, pageTitle } from "../lib/ui";
import { useResumeEditor } from "../features/resumeEditor/hooks/useResumeEditor";
import { ContactSection } from "../features/resumeEditor/components/ContactSection";
import { SummarySection } from "../features/resumeEditor/components/SummarySection";
import { EducationSection } from "../features/resumeEditor/components/EducationSection";
import { ExperienceSection } from "../features/resumeEditor/components/ExperienceSection";
import { ProjectsSection } from "../features/resumeEditor/components/ProjectsSection";
import { SkillsSection } from "../features/resumeEditor/components/SkillsSection";
import { CertificationsSection } from "../features/resumeEditor/components/CertificationsSection";
import { AwardsSection } from "../features/resumeEditor/components/AwardsSection";
import { SuggestionsPanel } from "../features/resumeEditor/components/SuggestionsPanel";

export function ResumeEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const editor = useResumeEditor(id);
  const [justSaved, setJustSaved] = useState(false);

  const handleSave = async () => {
    const { error } = await editor.save();
    if (!error) {
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    }
  };

  if (editor.loading) {
    return (
      <AppShell>
        <p className="py-12 text-center text-sm text-slate-400">Loading…</p>
      </AppShell>
    );
  }

  if (editor.notFound) {
    return (
      <AppShell>
        <div className="py-12 text-center">
          <p className="text-slate-500">Resume not found.</p>
          <button
            type="button"
            onClick={() => navigate("/resumes")}
            className="mt-4 text-sm text-slate-700 underline hover:text-slate-900"
          >
            Back to My Resumes
          </button>
        </div>
      </AppShell>
    );
  }

  const showParseEntry = !editor.hasStructuredContent && !editor.dirty;

  return (
    <AppShell>
      <div className="animate-fade-in space-y-8">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate("/resumes")}
            className="btn-press flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-900/[0.04] px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-900/[0.06]"
          >
            <ArrowLeft size={18} />
            My Resumes
          </button>
        </div>

        <div className={pageHeader}>
          <div>
            <h1 className={pageTitle}>{editor.resumeName || "Edit resume"}</h1>
            <p className={pageSubtitle}>Structured, section-by-section editor for this resume.</p>
          </div>
          {!showParseEntry && (
            <div className="flex shrink-0 items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => editor.parseResume()} disabled={editor.parsing}>
                {editor.parsing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                {editor.parsing ? "Re-parsing…" : "Re-parse from resume text"}
              </Button>
              <Button type="button" onClick={handleSave} disabled={editor.saving || !editor.dirty}>
                {editor.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {editor.saving ? "Saving…" : justSaved ? "Saved" : "Save"}
              </Button>
            </div>
          )}
        </div>

        {editor.loadError && <p className="text-sm text-red-600">{editor.loadError}</p>}
        {editor.parseError && <p className="text-sm text-red-600">{editor.parseError}</p>}
        {editor.saveError && <p className="text-sm text-red-600">{editor.saveError}</p>}

        {showParseEntry ? (
          <Panel title="No structured content yet">
            <p className="mb-4 text-sm text-slate-500">
              This resume only has raw extracted text so far. Parse it with AI to get an editable,
              section-by-section breakdown — you&apos;ll be able to review and edit everything before saving.
            </p>
            <Button type="button" onClick={() => editor.parseResume()} disabled={editor.parsing}>
              {editor.parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {editor.parsing ? "Parsing…" : "Parse my resume"}
            </Button>
          </Panel>
        ) : editor.content ? (
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-8">
              <ContactSection contact={editor.content.contact} onChange={(v) => editor.updateSection("contact", v)} />
              <SummarySection summary={editor.content.summary} onChange={(v) => editor.updateSection("summary", v)} />
              <EducationSection
                education={editor.content.education}
                onChange={(v) => editor.updateSection("education", v)}
              />
              <ExperienceSection
                experience={editor.content.experience}
                onChange={(v) => editor.updateSection("experience", v)}
              />
              <ProjectsSection projects={editor.content.projects} onChange={(v) => editor.updateSection("projects", v)} />
              <SkillsSection skills={editor.content.skills} onChange={(v) => editor.updateSection("skills", v)} />
              <CertificationsSection
                certifications={editor.content.certifications}
                onChange={(v) => editor.updateSection("certifications", v)}
              />
              <AwardsSection awards={editor.content.awards} onChange={(v) => editor.updateSection("awards", v)} />
            </div>
            <div className="lg:col-span-4">
              <SuggestionsPanel
                suggestions={editor.suggestions}
                loading={editor.suggestionsLoading}
                generating={editor.generatingSuggestions}
                error={editor.suggestionsError}
                onGenerate={() => editor.generateSuggestions()}
                onAccept={(s, textOverride) => editor.acceptSuggestion(s, textOverride)}
                onReject={(s) => editor.rejectSuggestion(s)}
              />
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
