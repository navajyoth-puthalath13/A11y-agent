import { z } from "zod";

export const severitySchema = z.enum(["low", "medium", "high", "critical"]);
export const eslintSeveritySchema = z.enum(["warning", "error"]);

export const accessibilityFindingSchema = z.object({
  id: z.string().regex(/^A11Y-\d{3,}$/),
  severity: severitySchema,
  wcagReference: z.string().min(1),
  filePath: z.string().min(1),
  lineNumber: z.number().int().positive().nullable(),
  relatedRuleIds: z.array(z.string()).default([]),
  componentName: z.string().nullable(),
  description: z.string().min(1),
  impact: z.string().min(1),
  suggestedFix: z.string().min(1),
  confidence: z.number().min(0).max(1)
});

export const accessibilityReviewSchema = z.object({
  findings: z.array(accessibilityFindingSchema)
});

export type Severity = z.infer<typeof severitySchema>;
export type EslintSeverity = z.infer<typeof eslintSeveritySchema>;
export type AccessibilityFinding = z.infer<typeof accessibilityFindingSchema>;
export type AccessibilityReview = z.infer<typeof accessibilityReviewSchema>;

export const deterministicFindingSchema = z.object({
  id: z.string().regex(/^ESLINT-A11Y-\d{3,}$/),
  source: z.literal("eslint-plugin-jsx-a11y"),
  ruleId: z.string().min(1),
  severity: eslintSeveritySchema,
  filePath: z.string().min(1),
  lineNumber: z.number().int().positive().nullable(),
  column: z.number().int().positive().nullable(),
  message: z.string().min(1)
});

export const structuredAccessibilityReportSchema = z.object({
  summary: z.object({
    deterministicFindingCount: z.number().int().nonnegative(),
    aiFindingCount: z.number().int().nonnegative()
  }),
  deterministicFindings: z.array(deterministicFindingSchema),
  aiFindings: z.array(accessibilityFindingSchema)
});

export type DeterministicFinding = z.infer<typeof deterministicFindingSchema>;
export type StructuredAccessibilityReport = z.infer<typeof structuredAccessibilityReportSchema>;

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
