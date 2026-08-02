import "dotenv/config";

export type AppConfig = {
  openAiApiKey?: string;
  openAiModel: string;
  githubToken?: string;
};

export function loadConfig(): AppConfig {
  const openAiApiKey = process.env.OPENAI_API_KEY;

  if (!openAiApiKey) {
    throw new Error("OPENAI_API_KEY is required.");
  }

  return {
    openAiApiKey,
    openAiModel: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    githubToken: process.env.GITHUB_TOKEN
  };
}
