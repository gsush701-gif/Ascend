// Groups an analysis's skills the way both the Analyzer and a role's page show
// them: what the posting asks for that the resume lacks (required first), and
// what's already covered. Pure so the ordering is tested.

export type SkillLike = { name: string; status: "hit" | "miss"; importance?: string };

export type SkillGroups = {
  missingRequired: string[];
  missingPreferred: string[];
  matched: string[];
};

export function groupSkills(skills: SkillLike[] | null | undefined): SkillGroups {
  const groups: SkillGroups = { missingRequired: [], missingPreferred: [], matched: [] };
  for (const s of skills ?? []) {
    if (!s || typeof s.name !== "string") continue;
    if (s.status === "hit") groups.matched.push(s.name);
    else if ((s.importance ?? "required") === "required") groups.missingRequired.push(s.name);
    else groups.missingPreferred.push(s.name);
  }
  return groups;
}
