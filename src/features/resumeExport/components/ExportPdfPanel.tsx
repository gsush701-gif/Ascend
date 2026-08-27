import { useState } from "react";
import { Download, Eye, Loader2 } from "lucide-react";
import { Panel } from "../../../components/ui/Panel";
import { Button } from "../../../components/ui/Button";
import { useToast } from "../../../components/ui/useToast";
import type { ResumeStructuredContent } from "../../../types/resume";
import { TemplatePicker } from "./TemplatePicker";
import { DEFAULT_RESUME_TEMPLATE_ID } from "../templateRegistry";
import type { ResumeTemplateId } from "../templateRegistry";
import { buildResumeExportFilename } from "../filename";
import { generateResumePdfBlob, downloadPdfBlob, previewPdfBlob } from "../generatePdf";

type ExportPdfPanelProps = {
  resumeName: string | null;
  content: ResumeStructuredContent;
};

export function ExportPdfPanel({ resumeName, content }: ExportPdfPanelProps) {
  const toast = useToast();
  const [templateId, setTemplateId] = useState<ResumeTemplateId>(DEFAULT_RESUME_TEMPLATE_ID);
  const [downloading, setDownloading] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const runGenerate = async (mode: "download" | "preview") => {
    const setBusy = mode === "download" ? setDownloading : setPreviewing;
    setBusy(true);
    try {
      const blob = await generateResumePdfBlob(content, templateId);
      if (mode === "download") {
        downloadPdfBlob(blob, buildResumeExportFilename(resumeName, templateId));
      } else {
        previewPdfBlob(blob);
      }
    } catch (e) {
      console.error("[ExportPdfPanel] PDF generation failed:", e);
      toast.error("Couldn't generate the PDF. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Export PDF" subtitle="Pick a template and download this resume as a PDF.">
      <div className="space-y-4">
        <TemplatePicker value={templateId} onChange={setTemplateId} />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => runGenerate("download")} disabled={downloading || previewing}>
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {downloading ? "Generating…" : "Download PDF"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => runGenerate("preview")}
            disabled={downloading || previewing}
          >
            {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            {previewing ? "Opening…" : "Preview"}
          </Button>
        </div>
      </div>
    </Panel>
  );
}
