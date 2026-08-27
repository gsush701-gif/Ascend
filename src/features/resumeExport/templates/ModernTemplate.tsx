import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ResumeStructuredContent } from "../../../types/resume";
import { prepareResumeSections, formatContactLine, formatDateRange } from "../sectionData";
import { pdfColors, PAGE_PADDING } from "./shared";

/**
 * Modern — clean sans-serif with a cyan accent (matches the app's own
 * cyan-on-slate palette, darkened for print contrast — see shared.ts).
 * Deliberately single-column: a full-height two-column sidebar layout is
 * the one shape react-pdf's pagination handles worst for long content (a
 * sidebar can't "continue" cleanly onto a second page), so distinctiveness
 * here comes from a colored header band, accent-striped section headings,
 * and pill-style skill tags instead of a column split.
 */
const styles = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: PAGE_PADDING,
    paddingHorizontal: 0,
    fontFamily: "Helvetica",
    fontSize: 10.5,
    color: pdfColors.ink,
    lineHeight: 1.4,
  },
  headerBand: {
    backgroundColor: pdfColors.cyanAccent,
    paddingHorizontal: PAGE_PADDING,
    paddingVertical: 20,
    marginBottom: 16,
  },
  name: {
    fontFamily: "Helvetica-Bold",
    fontSize: 22,
    color: "#ffffff",
    marginBottom: 4,
  },
  contactLine: {
    fontSize: 9,
    color: "#e6fbff",
  },
  body: {
    paddingHorizontal: PAGE_PADDING,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 7,
  },
  sectionTitleBar: {
    width: 4,
    height: 11,
    backgroundColor: pdfColors.cyanAccent,
    marginRight: 6,
  },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.75,
    color: pdfColors.cyanAccent,
  },
  entry: {
    marginBottom: 8,
  },
  entryHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  entryTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10.5,
  },
  entrySubtitle: {
    fontFamily: "Helvetica-Oblique",
    fontSize: 9.5,
    color: pdfColors.muted,
    marginBottom: 2,
  },
  dateText: {
    fontSize: 9,
    color: pdfColors.muted,
  },
  bulletRow: {
    flexDirection: "row",
    marginTop: 1,
    paddingLeft: 4,
  },
  bulletMarker: {
    width: 10,
    fontSize: 10,
    color: pdfColors.cyanAccent,
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
  },
  paragraph: {
    fontSize: 10,
  },
  skillsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  skillChip: {
    backgroundColor: pdfColors.cyanTint,
    color: pdfColors.cyanAccent,
    fontSize: 9,
    borderRadius: 3,
    paddingVertical: 3,
    paddingHorizontal: 7,
    marginRight: 5,
    marginBottom: 5,
  },
});

function SectionHeading({ children }: { children: string }) {
  return (
    <View style={styles.sectionTitleRow} wrap={false}>
      <View style={styles.sectionTitleBar} />
      <Text style={styles.sectionTitle}>{children}</Text>
    </View>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <View>
      {items.map((text, i) => (
        <View style={styles.bulletRow} key={i} wrap={false}>
          <Text style={styles.bulletMarker}>•</Text>
          <Text style={styles.bulletText}>{text}</Text>
        </View>
      ))}
    </View>
  );
}

export function ModernTemplate({ content }: { content: ResumeStructuredContent }) {
  const s = prepareResumeSections(content);
  const contactLine = formatContactLine(s.contact, "   |   ");

  return (
    <Document title={s.contact.name ? `${s.contact.name} — Resume` : "Resume"}>
      <Page size="LETTER" style={styles.page} wrap>
        {s.hasContact && (
          <View style={styles.headerBand}>
            {s.contact.name && <Text style={styles.name}>{s.contact.name}</Text>}
            {contactLine && <Text style={styles.contactLine}>{contactLine}</Text>}
          </View>
        )}

        <View style={styles.body}>
          {s.hasSummary && (
            <View style={styles.section}>
              <SectionHeading>Summary</SectionHeading>
              <Text style={styles.paragraph}>{s.summary}</Text>
            </View>
          )}

          {s.hasExperience && (
            <View style={styles.section}>
              <SectionHeading>Experience</SectionHeading>
              {s.experience.map((entry, i) => (
                <View style={styles.entry} key={i}>
                  <View style={styles.entryHeaderRow} wrap={false}>
                    <Text style={styles.entryTitle}>{entry.title}</Text>
                    <Text style={styles.dateText}>{formatDateRange(entry.startDate, entry.endDate)}</Text>
                  </View>
                  <Text style={styles.entrySubtitle}>
                    {[entry.company, entry.location].filter(Boolean).join("  •  ")}
                  </Text>
                  <Bullets items={entry.bullets} />
                </View>
              ))}
            </View>
          )}

          {s.hasProjects && (
            <View style={styles.section}>
              <SectionHeading>Projects</SectionHeading>
              {s.projects.map((entry, i) => (
                <View style={styles.entry} key={i}>
                  <Text style={styles.entryTitle}>{entry.name}</Text>
                  {entry.technologies.length > 0 && (
                    <Text style={styles.entrySubtitle}>{entry.technologies.join("  •  ")}</Text>
                  )}
                  {entry.description && <Text style={styles.paragraph}>{entry.description}</Text>}
                  <Bullets items={entry.bullets} />
                </View>
              ))}
            </View>
          )}

          {s.hasSkills && (
            <View style={styles.section} wrap={false}>
              <SectionHeading>Skills</SectionHeading>
              <View style={styles.skillsWrap}>
                {s.skills.map((skill, i) => (
                  <Text style={styles.skillChip} key={i}>
                    {skill}
                  </Text>
                ))}
              </View>
            </View>
          )}

          {s.hasEducation && (
            <View style={styles.section}>
              <SectionHeading>Education</SectionHeading>
              {s.education.map((entry, i) => (
                <View style={styles.entry} key={i} wrap={false}>
                  <View style={styles.entryHeaderRow}>
                    <Text style={styles.entryTitle}>{[entry.degree, entry.field].filter(Boolean).join(", ")}</Text>
                    <Text style={styles.dateText}>{formatDateRange(entry.startDate, entry.endDate)}</Text>
                  </View>
                  <Text style={styles.entrySubtitle}>
                    {[entry.school, entry.gpa ? `GPA: ${entry.gpa}` : ""].filter(Boolean).join("  •  ")}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {s.hasCertifications && (
            <View style={styles.section}>
              <SectionHeading>Certifications</SectionHeading>
              {s.certifications.map((entry, i) => (
                <View style={styles.entryHeaderRow} key={i} wrap={false}>
                  <Text style={styles.paragraph}>{[entry.name, entry.issuer].filter(Boolean).join(" — ")}</Text>
                  <Text style={styles.dateText}>{entry.date}</Text>
                </View>
              ))}
            </View>
          )}

          {s.hasAwards && (
            <View style={styles.section}>
              <SectionHeading>Awards</SectionHeading>
              {s.awards.map((entry, i) => (
                <View style={styles.entryHeaderRow} key={i} wrap={false}>
                  <Text style={styles.paragraph}>{[entry.name, entry.issuer].filter(Boolean).join(" — ")}</Text>
                  <Text style={styles.dateText}>{entry.date}</Text>
                </View>
              ))}
            </View>
          )}

          {s.isEmpty && <Text style={styles.paragraph}>This resume doesn&apos;t have any content yet.</Text>}
        </View>
      </Page>
    </Document>
  );
}
