import "dotenv/config";

export type AppConfig = {
  githubModelsToken?: string;
  githubModelsModel: string;
  githubToken?: string;
};

export function loadConfig(): AppConfig {
  const githubModelsToken = process.env.GITHUB_MODELS_TOKEN ?? process.env.GITHUB_TOKEN;

  if (!githubModelsToken) {
    throw new Error("GITHUB_MODELS_TOKEN or GITHUB_TOKEN is required.");
  }

  return {
    githubModelsToken,
    githubModelsModel: process.env.GITHUB_MODELS_MODEL ?? "openai/gpt-4.1-mini",
    githubToken: process.env.GITHUB_TOKEN
  };
}
