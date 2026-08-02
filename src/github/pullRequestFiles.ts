import { readFile } from "node:fs/promises";
import { Octokit } from "@octokit/rest";
import type { ChangedFile, PullRequestContext } from "../types.js";

const MAX_LOCAL_FILE_BYTES = 128_000;

export function createGitHubClient(token: string): Octokit {
  return new Octokit({ auth: token });
}

export async function getChangedFilesFromPullRequest(params: {
  octokit: Octokit;
  context: PullRequestContext;
  workspacePath?: string;
}): Promise<ChangedFile[]> {
  const { octokit, context, workspacePath = process.cwd() } = params;

  const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner: context.owner,
    repo: context.repo,
    pull_number: context.pullNumber,
    per_page: 100
  });

  return Promise.all(
    files.map(async (file) => ({
      path: file.filename,
      status: normalizeStatus(file.status),
      patch: file.patch,
      content: file.status === "removed" ? undefined : await readWorkspaceFile(workspacePath, file.filename)
    }))
  );
}

export function parsePullRequestContext(params: {
  repository?: string;
  pullNumber?: string;
}): PullRequestContext {
  const { repository, pullNumber } = params;

  if (!repository || !repository.includes("/")) {
    throw new Error("Repository must be set as owner/repo.");
  }

  if (!pullNumber || Number.isNaN(Number(pullNumber))) {
    throw new Error("Pull request number must be set.");
  }

  const [owner, repo] = repository.split("/");

  return {
    owner,
    repo,
    pullNumber: Number(pullNumber)
  };
}

export function parsePullRequestContextFromEnv(): PullRequestContext {
  return parsePullRequestContext({
    repository: process.env.GITHUB_REPOSITORY,
    pullNumber: process.env.PR_NUMBER ?? process.env.GITHUB_PR_NUMBER
  });
}

async function readWorkspaceFile(workspacePath: string, relativePath: string): Promise<string | undefined> {
  try {
    const file = await readFile(new URL(relativePath, `file://${workspacePath.replace(/\/$/, "")}/`));
    if (file.byteLength > MAX_LOCAL_FILE_BYTES) {
      return file.subarray(0, MAX_LOCAL_FILE_BYTES).toString("utf8");
    }

    return file.toString("utf8");
  } catch {
    return undefined;
  }
}

function normalizeStatus(status: string): ChangedFile["status"] {
  switch (status) {
    case "added":
    case "modified":
    case "removed":
    case "renamed":
    case "copied":
    case "changed":
    case "unchanged":
      return status;
    default:
      return "modified";
  }
}
