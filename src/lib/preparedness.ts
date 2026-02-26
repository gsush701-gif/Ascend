export type Preparedness = "Low" | "Medium" | "High";

export function alignmentToPreparedness(alignment: number): Preparedness {
  if (alignment >= 70) return "High";
  if (alignment >= 40) return "Medium";
  return "Low";
}
