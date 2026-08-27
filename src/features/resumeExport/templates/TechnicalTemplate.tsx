import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ResumeStructuredContent } from "../../../types/resume";
import { prepareResumeSections, formatContactLine, formatDateRange } from "../sectionData";
import { pdfColors, PAGE_PADDING } from "./shared";

/**
 * Technical — compact, skills-forward layout for engineering roles. Skills
 * come right after Summary (before Experience) as monospace tag chips with
 * a violet accent, and everything else is deliberately denser (smaller type,
 * tighter spacing) than Classic/Modern so more fits per page.
 */
const styles = StyleSheet.create({
  page: {
    paddingTop: PAGE_PADDING - 10,
    paddingBottom: PAGE_PADDING - 10,
    paddingHorizontal: PAGE_PADDING - 6,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: pdfColors.ink,
    lineHeight: 1.28,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 2,
    borderBottomColor: pdfColors.violetAccent,
    paddingBottom: 6,
    marginBottom: 10,
  },
  name: {
    fontFamily: "Helvetica-Bold",
    fontSize: 17,
  },
  contactLine: {
    fontSize: 8,
    color: pdfColors.muted,
    textAlign: "right",
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: pdfColors.violetAccent,
    marginBottom: 4,
  },
  entry: {
    marginBottom: 5,
  },
  entryHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  entryTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9.5,
  },
  entrySubtitle: {
    fontFamily: "Helvetica-Oblique",
    fontSize: 8.75,
    color: pdfColors.muted,
  },
  dateText: {
    fontSize: 8.5,
    color: pdfColors.muted,
  },
  bulletRow: {
    flexDirection: "row",
    marginTop: 0.5,
    paddingLeft: 3,
  },
  bulletMarker: {
    width: 8,
    fontSize: 9.5,
    color: pdfColors.violetAccent,
  },
  bulletText: {
    flex: 1,
    fontSize: 9.5,
  },
  paragraph: {
    fontSize: 9.5,
  },
  skillsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  skillChip: {
    fontFamily: "Courier",
    backgroundColor: pdfColors.violetTint,
    color: pdfColors.violetAccent,
    fontSize: 8.25,
    borderRadius: 2,
    paddingVertical: 2.5,
    paddingHorizontal: 5,
    marginRight: 4,
    marginBottom: 4,
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

export function TechnicalTemplate({ content }: { content: ResumeStructuredContent }) {
  const s = prepareResumeSections(content);
  const contactLine = formatContactLine(s.contact, "  |  ");

  return (
    <Document title={s.contact.name ? `${s.contact.name} — Resume` : "Resume"}>
      <Page size="LETTER" style={styles.page} wrap>
        {s.hasContact && (
          <View style={styles.headerRow} wrap={false}>
            <Text style={styles.name}>{s.contact.name}</Text>
            <Text style={styles.contactLine}>{contactLine}</Text>
          </View>
        )}

        {s.hasSummary && (
          <View style={styles.section}>
            <SectionHeading>Summary</SectionHeading>
            <Text style={styles.paragraph}>{s.summary}</Text>
          </View>
        )}

        {s.hasSkills && (
          <View style={styles.section} wrap={false}>
            <SectionHeading>Technical Skills</SectionHeading>
            <View style={styles.skillsWrap}>
              {s.skills.map((skill, i) => (
                <Text style={styles.skillChip} key={i}>
                  {skill}
                </Text>
              ))}
            </View>
          </View>
        )}

        {s.hasExperience && (
          <View style={styles.section}>
            <SectionHeading>Experience</SectionHeading>
            {s.experience.map((entry, i) => (
              <View style={styles.entry} key={i}>
                <View style={styles.entryHeaderRow} wrap={false}>
                  <Text style={styles.entryTitle}>
                    {[entry.title, entry.company].filter(Boolean).join(" @ ")}
                  </Text>
                  <Text style={styles.dateText}>{formatDateRange(entry.startDate, entry.endDate)}</Text>
                </View>
                {entry.location && <Text style={styles.entrySubtitle}>{entry.location}</Text>}
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
                  <View style={styles.skillsWrap}>
                    {entry.technologies.map((tech, j) => (
                      <Text style={styles.skillChip} key={j}>
                        {tech}
                      </Text>
                    ))}
                  </View>
                )}
                {entry.description && <Text style={styles.paragraph}>{entry.description}</Text>}
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
      </Page>
    </Document>
  );
}
