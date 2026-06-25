import { z } from "zod";

export const severitySchema = z.enum(["low", "medium", "high", "critical"]);

export const accessibilityFindingSchema = z.object({
  id: z.string().regex(/^A11Y-\d{3,}$/),
  severity: severitySchema,
  wcagReference: z.string().min(1),
  filePath: z.string().min(1),
  lineNumber: z.number().int().positive().nullable(),
  description: z.string().min(1),
  suggestedFix: z.string().min(1),
  confidence: z.number().min(0).max(1)
});

export const accessibilityReviewSchema = z.object({
  findings: z.array(accessibilityFindingSchema)
});

export type Severity = z.infer<typeof severitySchema>;
export type AccessibilityFinding = z.infer<typeof accessibilityFindingSchema>;
export type AccessibilityReview = z.infer<typeof accessibilityReviewSchema>;

export type ChangedFile = {
  path: string;
  status: "added" | "modified" | "removed" | "renamed" | "copied" | "changed" | "unchanged";
  patch?: string;
  content?: string;
};

export type PullRequestContext = {
  owner: string;
  repo: string;
  pullNumber: number;
};

