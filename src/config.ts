import "dotenv/config";

export type AppConfig = {
  openAiApiKey?: string;
  openAiModel: string;
  openAiBaseUrl: string;
  githubToken?: string;
};

export function loadConfig(): AppConfig {
  const explicitOpenAiKey = process.env.OPENAI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const gitHubModelsToken = process.env.GITHUB_MODELS_TOKEN || process.env.GITHUB_TOKEN;
  const openAiApiKey = explicitOpenAiKey || groqKey || gitHubModelsToken;

  if (!openAiApiKey) {
    throw new Error(
      "Missing API key. Set GROQ_API_KEY (free) or OPENAI_API_KEY or GITHUB_MODELS_TOKEN."
    );
  }

  // Pick the provider based on which key is present. Groq and GitHub Models are free;
  // all three speak the OpenAI-compatible chat/completions API.
  const useGroq = !explicitOpenAiKey && Boolean(groqKey);
  const useGitHubModels = !explicitOpenAiKey && !groqKey && Boolean(gitHubModelsToken);

  const defaultBaseUrl = useGroq
    ? "https://api.groq.com/openai/v1"
    : useGitHubModels
      ? "https://models.github.ai/inference"
      : "https://api.openai.com/v1";

  const defaultModel = useGroq
    ? "llama-3.3-70b-versatile"
    : useGitHubModels
      ? "openai/gpt-4o-mini"
      : "gpt-4.1-mini";

  return {
    openAiApiKey,
    openAiModel: process.env.OPENAI_MODEL ?? defaultModel,
    openAiBaseUrl: process.env.OPENAI_BASE_URL ?? defaultBaseUrl,
    githubToken: process.env.GITHUB_TOKEN
  };
}
