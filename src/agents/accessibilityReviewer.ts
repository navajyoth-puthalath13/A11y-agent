import type { AccessibilityFinding, ChangedFile, DeterministicFinding } from "../types.js";
import type { AccessibilityLlmClient } from "../llm/accessibilityLlmClient.js";

const MAX_FILE_CHARS = 12_000;

export class AccessibilityReviewerAgent {
  constructor(private readonly llm: AccessibilityLlmClient) {}

  async reviewChangedFiles(
    files: ChangedFile[],
    deterministicFindings: DeterministicFinding[]
  ): Promise<AccessibilityFinding[]> {
    const reviewableFiles = files.filter((file) => file.status !== "removed" && isReviewablePath(file.path));

    if (reviewableFiles.length === 0) {
      return [];
    }

    const prompt = buildPrompt(reviewableFiles, deterministicFindings);
    const review = await this.llm.review(prompt);

    return review.findings.map((finding, index) => ({
      ...finding,
      id: finding.id || `A11Y-${String(index + 1).padStart(3, "0")}`
    }));
  }
}

function buildPrompt(files: ChangedFile[], deterministicFindings: DeterministicFinding[]): string {
  const fileBlocks = files
    .map((file) => {
      const content = file.content?.slice(0, MAX_FILE_CHARS) ?? "";
      const patch = file.patch?.slice(0, MAX_FILE_CHARS) ?? "";

      return [
        `FILE: ${file.path}`,
        `STATUS: ${file.status}`,
        patch ? `PATCH:\n${patch}` : "PATCH: unavailable",
        content ? `CONTENT:\n${content}` : "CONTENT: unavailable"
      ].join("\n");
    })
    .join("\n\n---\n\n");

  const deterministicBlock =
    deterministicFindings.length > 0
      ? JSON.stringify(deterministicFindings, null, 2)
      : "[]";

  return `You are a read-only accessibility reviewer and mentor for GitHub pull requests.

Goal:
Review accessibility issues introduced or touched by the changed files.

Architecture:
- Layer 1 already ran eslint-plugin-jsx-a11y and produced deterministic findings.
- Your job is Layer 2: add accessibility reasoning and context that static analysis cannot provide.
- Do not duplicate eslint-plugin-jsx-a11y findings as another linter.
- When expanding on an ESLint finding, reference its rule ID in relatedRuleIds.

Rules:
- Do not suggest unrelated refactors.
- Prefer findings tied to changed lines when possible.
- If a line number is not clear, use null.
- Only report issues you can explain concretely from the provided code.
- Return JSON only. Do not return markdown or prose outside JSON.
- The top-level JSON value must be an object with a "findings" array.
- Use stable finding IDs in order: A11Y-001, A11Y-002, A11Y-003.

Each finding must include:
- id
- severity: low, medium, high, or critical
- wcagReference, such as "WCAG 2.2 1.1.1 Non-text Content"
- filePath
- lineNumber
- relatedRuleIds: array of eslint-plugin-jsx-a11y rule IDs that this finding explains or extends
- componentName: responsible React component name, or null if unclear
- description
- impact: explain why this matters for users who rely on assistive technologies
- suggestedFix
- confidence between 0 and 1

Review focus:
- Explain why deterministic findings matter.
- Link issues to the relevant WCAG guideline.
- Identify the responsible React component.
- Trace issues through component composition when possible.
- Suggest fixes that match the existing code style.
- Add only contextual issues static analysis is unlikely to catch.

Deterministic eslint-plugin-jsx-a11y findings:

${deterministicBlock}

Changed files:

${fileBlocks}`;
}

function isReviewablePath(path: string): boolean {
  return /\.(tsx?|jsx?|vue|svelte|html|css|scss|mdx?)$/i.test(path);
}
