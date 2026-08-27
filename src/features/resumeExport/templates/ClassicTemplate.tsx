import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ResumeStructuredContent } from "../../../types/resume";
import { prepareResumeSections, formatContactLine, formatDateRange } from "../sectionData";
import { pdfColors, PAGE_PADDING } from "./shared";

/**
 * Classic — traditional serif, single column, centered header. The
 * conservative, safe-default layout: closest to a "plain text resume"
 * visually, which also happens to be the most ATS-parser-friendly shape.
 */
const styles = StyleSheet.create({
  page: {
    paddingTop: PAGE_PADDING,
    paddingBottom: PAGE_PADDING,
    paddingHorizontal: PAGE_PADDING,
    fontFamily: "Times-Roman",
    fontSize: 10.5,
    color: pdfColors.ink,
    lineHeight: 1.35,
  },
  name: {
    fontFamily: "Times-Bold",
    fontSize: 20,
    textAlign: "center",
    marginBottom: 4,
  },
  contactLine: {
    fontSize: 9,
    textAlign: "center",
    color: pdfColors.muted,
    marginBottom: 14,
  },
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: "Times-Bold",
    fontSize: 11.5,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    borderBottomWidth: 1,
    borderBottomColor: pdfColors.ink,
    paddingBottom: 2,
    marginBottom: 6,
  },
  entry: {
    marginBottom: 7,
  },
  entryHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  entryTitle: {
    fontFamily: "Times-Bold",
    fontSize: 10.5,
  },
  entrySubtitle: {
    fontFamily: "Times-Italic",
    fontSize: 10,
    marginBottom: 2,
  },
  dateText: {
    fontSize: 9.5,
    color: pdfColors.muted,
  },
  bulletRow: {
    flexDirection: "row",
    marginTop: 1,
    paddingLeft: 4,
  },
  bulletMarker: {
    width: 10,
    fontSize: 10.5,
  },
  bulletText: {
    flex: 1,
    fontSize: 10.5,
  },
  paragraph: {
    fontSize: 10.5,
  },
  skillsLine: {
    fontSize: 10.5,
  },
});

function SectionHeading({ children }: { children: string }) {
  return (
    <Text style={styles.sectionTitle} wrap={false}>
      {children}
    </Text>
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

export function ClassicTemplate({ content }: { content: ResumeStructuredContent }) {
  const s = prepareResumeSections(content);
  const contactLine = formatContactLine(s.contact);

  return (
    <Document title={s.contact.name ? `${s.contact.name} — Resume` : "Resume"}>
      <Page size="LETTER" style={styles.page} wrap>
        {s.hasContact && (
          <View>
            {s.contact.name && <Text style={styles.name}>{s.contact.name}</Text>}
            {contactLine && <Text style={styles.contactLine}>{contactLine}</Text>}
          </View>
        )}

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
                  <Text style={styles.entryTitle}>
                    {[entry.title, entry.company].filter(Boolean).join(", ")}
                  </Text>
                  <Text style={styles.dateText}>{formatDateRange(entry.startDate, entry.endDate)}</Text>
                </View>
                {entry.location && <Text style={styles.entrySubtitle}>{entry.location}</Text>}
                <Bullets items={entry.bullets} />
              </View>
            ))}
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
                  {[entry.school, entry.gpa ? `GPA: ${entry.gpa}` : ""].filter(Boolean).join("  —  ")}
                </Text>
              </View>
            ))}
          </View>
        )}

        {s.hasProjects && (
          <View style={styles.section}>
            <SectionHeading>Projects</SectionHeading>
            {s.projects.map((entry, i) => (
              <View style={styles.entry} key={i}>
                <Text style={styles.entryTitle}>
                  {entry.name}
                  {entry.technologies.length > 0 ? `  —  ${entry.technologies.join(", ")}` : ""}
                </Text>
                {entry.description && <Text style={styles.paragraph}>{entry.description}</Text>}
                <Bullets items={entry.bullets} />
              </View>
            ))}
          </View>
        )}

        {s.hasSkills && (
          <View style={styles.section} wrap={false}>
            <SectionHeading>Skills</SectionHeading>
            <Text style={styles.skillsLine}>{s.skills.join("  •  ")}</Text>
          </View>
        )}

        {s.hasCertifications && (
          <View style={styles.section}>
            <SectionHeading>Certifications</SectionHeading>
            {s.certifications.map((entry, i) => (
              <View style={styles.entryHeaderRow} key={i} wrap={false}>
                <Text style={styles.paragraph}>
                  {[entry.name, entry.issuer].filter(Boolean).join(" — ")}
                </Text>
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
                <Text style={styles.paragraph}>
                  {[entry.name, entry.issuer].filter(Boolean).join(" — ")}
                </Text>
                <Text style={styles.dateText}>{entry.date}</Text>
              </View>
            ))}
          </View>
        )}

        {s.isEmpty && <Text style={styles.paragraph}>This resume doesn&apos;t have any content yet.</Text>}
      </Page>
    </Document>
  );
}
