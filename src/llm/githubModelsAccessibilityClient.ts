import { accessibilityReviewSchema, type AccessibilityReview } from "../types.js";
import type { AccessibilityLlmClient } from "./accessibilityLlmClient.js";

type GitHubModelsResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export function createGitHubModelsAccessibilityClient(params: {
  token: string;
  model: string;
}): AccessibilityLlmClient {
  return {
    async review(input: string): Promise<AccessibilityReview> {
      const response = await fetch("https://models.github.ai/inference/chat/completions", {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${params.token}`,
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28"
        },
        body: JSON.stringify({
          model: params.model,
          messages: [
            {
              role: "system",
              content: "Return only valid JSON. Do not wrap JSON in markdown."
            },
            {
              role: "user",
              content: input
            }
          ],
          temperature: 0
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub Models request failed: ${response.status} ${errorText}`);
      }

      const body = (await response.json()) as GitHubModelsResponse;
      const outputText = body.choices?.[0]?.message?.content;

      if (!outputText) {
        throw new Error("GitHub Models response did not include message content.");
      }

      const parsed = JSON.parse(stripMarkdownCodeFence(outputText)) as unknown;
      const normalized = Array.isArray(parsed) ? { findings: parsed } : parsed;

      return accessibilityReviewSchema.parse(normalized);
    }
  };
}

function stripMarkdownCodeFence(value: string): string {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
}
