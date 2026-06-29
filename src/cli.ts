import { access, readFile, readdir } from "node:fs/promises";
import { AccessibilityReviewerAgent } from "./agents/accessibilityReviewer.js";
import { loadConfig } from "./config.js";
import {
  createGitHubClient,
  getChangedFilesFromPullRequest,
  parsePullRequestContextFromEnv
} from "./github/pullRequestFiles.js";
import { createGitHubModelsAccessibilityClient } from "./llm/githubModelsAccessibilityClient.js";
import { JsxA11yLayer } from "./layers/deterministic/jsxA11yLayer.js";
import { AccessibilityReviewPipeline } from "./pipeline/accessibilityReviewPipeline.js";
import { printJsonReport } from "./report/jsonReporter.js";
import type { ChangedFile } from "./types.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const files = await loadInputFiles(config.githubToken);
  const reviewer = new AccessibilityReviewerAgent(createLlmClient(config));
  const pipeline = new AccessibilityReviewPipeline(new JsxA11yLayer(), reviewer);

  const report = await pipeline.run(files);
  printJsonReport(report);
}

function createLlmClient(config: ReturnType<typeof loadConfig>) {
  return createGitHubModelsAccessibilityClient({
    token: config.githubModelsToken ?? "",
    model: config.githubModelsModel
  });
}

async function loadInputFiles(githubToken?: string): Promise<ChangedFile[]> {
  const localFilesArg = getArgValue("--files");

  if (localFilesArg) {
    const paths = await Promise.all(
      localFilesArg
        .split(",")
        .filter((path) => path.length > 0)
        .map(resolveLocalFilePath)
    );

    return Promise.all(
      paths.map(async (path) => ({
        path,
        status: "modified" as const,
        content: await readFile(path, "utf8")
      }))
    );
  }

  if (!githubToken) {
    throw new Error("GITHUB_TOKEN is required unless --files is provided.");
  }

  return getChangedFilesFromPullRequest({
    octokit: createGitHubClient(githubToken),
    context: parsePullRequestContextFromEnv()
  });
}

async function resolveLocalFilePath(path: string): Promise<string> {
  try {
    await access(path);
    return path;
  } catch {
    const trimmedPath = path.trim();
    const whitespaceVariant = await findWhitespaceVariant(trimmedPath);
    return whitespaceVariant ?? trimmedPath;
  }
}

async function findWhitespaceVariant(path: string): Promise<string | undefined> {
  const entries = await readdir(process.cwd());
  return entries.find((entry) => entry.trim() === path);
}

function getArgValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`a11y review failed: ${message}\n`);
  process.exitCode = 1;
});
