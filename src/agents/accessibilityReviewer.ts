import type { AccessibilityFinding, ChangedFile } from "../types.js";
import type { AccessibilityLlmClient } from "../llm/accessibilityLlmClient.js";

const MAX_FILE_CHARS = 12_000;

export class AccessibilityReviewerAgent {
  constructor(private readonly llm: AccessibilityLlmClient) {}

  async reviewChangedFiles(files: ChangedFile[]): Promise<AccessibilityFinding[]> {
    const reviewableFiles = files.filter((file) => file.status !== "removed" && isReviewablePath(file.path));

    if (reviewableFiles.length === 0) {
      return [];
    }

    const prompt = buildPrompt(reviewableFiles);
    const review = await this.llm.review(prompt);

    return review.findings.map((finding, index) => ({
      ...finding,
      id: finding.id || `A11Y-${String(index + 1).padStart(3, "0")}`
    }));
  }
}

function buildPrompt(files: ChangedFile[]): string {
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

  return `You are a read-only accessibility reviewer for GitHub pull requests.

Goal:
Find likely WCAG accessibility issues introduced or touched by the changed files.

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
- description
- suggestedFix
- confidence between 0 and 1

Review focus:
- Semantic HTML
- Accessible names for controls and images
- Keyboard operability and focus management
- ARIA correctness
- Form labels, errors, and instructions
- Color and contrast risks visible from code
- Reduced motion support

Changed files:

${fileBlocks}`;
}

function isReviewablePath(path: string): boolean {
  return /\.(tsx?|jsx?|vue|svelte|html|css|scss|mdx?)$/i.test(path);
}
