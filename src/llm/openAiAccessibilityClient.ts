import { accessibilityReviewSchema, type AccessibilityReview } from "../types.js";
import type { AccessibilityLlmClient } from "./accessibilityLlmClient.js";

type OpenAiChatCompletionsResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export function createOpenAiAccessibilityClient(params: {
  apiKey: string;
  model: string;
  baseUrl?: string;
}): AccessibilityLlmClient {
  const baseUrl = (params.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");

  return {
    async review(input: string): Promise<AccessibilityReview> {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${params.apiKey}`,
          "Content-Type": "application/json"
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
          response_format: { type: "json_object" },
          temperature: 0
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
      }

      const body = (await response.json()) as OpenAiChatCompletionsResponse;
      const outputText = body.choices?.[0]?.message?.content;

      if (!outputText) {
        throw new Error("OpenAI response did not include message content.");
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
