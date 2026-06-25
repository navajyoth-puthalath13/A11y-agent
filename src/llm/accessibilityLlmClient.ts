import type { AccessibilityReview } from "../types.js";

export type AccessibilityLlmClient = {
  review(input: string): Promise<AccessibilityReview>;
};
