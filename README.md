# AI Accessibility Review Agent

This project is a learning-first implementation of a read-only AI agent that reviews GitHub pull requests for WCAG accessibility issues.

## Current Architecture

The current version uses a layered review pipeline:

```text
React component changes
  -> eslint-plugin-jsx-a11y
  -> normalized deterministic findings
  -> AI accessibility reviewer
  -> structured accessibility report
```

Layer 1 is deterministic. It runs the standard `eslint-plugin-jsx-a11y` recommended rules and normalizes the ESLint output into baseline accessibility findings.

Layer 2 is currently a single AI accessibility reviewer. It receives the source code plus the deterministic findings and adds accessibility reasoning, WCAG context, assistive technology impact, responsible component names, and developer-friendly suggested fixes.

It does not modify files, create commits, push code, or apply automatic fixes.

This repository is designed to grow into a parent/sub-agent architecture, but the current implementation has not split the AI review into multiple specialist sub-agents yet. Today, `AccessibilityReviewPipeline` acts as the coordinator and calls one reviewer class, `AccessibilityReviewerAgent`.

## Core Concepts

### What is an AI agent?

An AI agent is a program that combines normal application code with an LLM. The application code handles reliable tasks like reading files, calling APIs, validating JSON, and printing reports. The LLM handles judgment-heavy tasks like deciding whether a JSX button has an accessible name or whether a focus trap is likely broken.

### How is an agent different from a script?

A normal script follows fixed rules. If you write a script that searches for `<img>` without `alt`, it can find that exact pattern, but it may miss framework-specific components or produce false positives.

An agent can review broader context and explain why something is likely a problem. The tradeoff is that model output must be constrained, validated, and treated as advisory rather than blindly trusted.

### What is an orchestrator?

An orchestrator, or parent agent, coordinates work. In later phases it will read the pull request, decide which specialist agents should run, pass each one the relevant files and context, collect their findings, remove duplicates, and generate the final report.

The parent agent should not perform accessibility analysis itself. Its job is coordination.

### What is a sub-agent?

A sub-agent is a specialized reviewer with a narrow responsibility. For example, a Keyboard Navigation Agent only reviews keyboard access and focus behavior. A Forms Agent only reviews labels, errors, required fields, and instructions.

Sub-agents can receive shared context from the parent agent. That context can include product-specific guidance, such as custom accessibility rules for Care or another product area, component library conventions, design-system constraints, or review preferences. The important rule is that custom guidance should be passed as review context, while the sub-agent still returns the same structured JSON finding format.

### Why multiple specialized agents?

One large prompt becomes hard to test, hard to improve, and more likely to mix unrelated concerns. Smaller agents have clearer instructions and can be run only when relevant files change. This also makes the system easier to debug because each finding has a source reviewer.

## Planned Sub-Agent Shape

The intended architecture is:

```text
Pull request files
  -> parent accessibility orchestrator
  -> deterministic checks
  -> specialist sub-agents
       -> keyboard navigation reviewer
       -> forms reviewer
       -> semantics reviewer
       -> media and content reviewer
       -> product/custom guide reviewer
  -> finding merge and de-duplication
  -> structured accessibility report
```

The custom guide reviewer is where product-specific instructions should fit. For example, if Care has a custom guide for required field messaging, focus behavior, or approved component patterns, the parent agent can pass that guide into the relevant sub-agent along with the changed files. The guide should influence findings, but it should not replace WCAG references or the common output schema.

### How do GitHub Actions fit?

GitHub Actions provide the automation trigger. When a pull request is opened or updated, a workflow checks out the code, installs dependencies, runs this reviewer, and eventually posts results back to the PR.

### How does an LLM communicate with tools?

The LLM does not directly read GitHub. Our TypeScript code uses tools like Octokit and the filesystem, then passes selected context into the model. The model returns structured output, and our code validates it before anything else consumes it.

### Why structured JSON?

Plain text is useful for humans but fragile for software. JSON lets us validate every finding, attach comments to exact files and lines, merge duplicate issues, and track stable issues across commits in future phases.

## Run Locally

Install dependencies:

```bash
npm install
```

Create `.env`:

```bash
cp .env.example .env
```

Set `OPENAI_API_KEY` and `OPENAI_MODEL`, then review local files:

```bash
npm run dev -- --files src/example.tsx
```

Review a pull request from a checked-out repository:

```bash
OPENAI_API_KEY=... GITHUB_TOKEN=... npm run dev -- --repo owner/repo --pr 123
```

You can also set `GITHUB_REPOSITORY` and `PR_NUMBER` in `.env` instead of passing `--repo` and `--pr`.

## Run In GitHub

The complete setup behaves like this:

```text
PR opened / updated
  -> GitHub Actions workflow (in your portfolio repo)
  -> checks out the A11y-agent worker
  -> installs dev deps, typechecks, builds
  -> runs the review agent (ESLint + AI) against the PR diff
  -> writes a JSON report
  -> posts/updates a comment on the PR, adds a step summary
  -> fails the PR check if any accessibility issue was found
```

### Current vs. Updated workflow

| | Current (in-repo workflow) | Updated (recommended workflow) |
| --- | --- | --- |
| PR trigger | opened, sync, reopened | opened, sync, reopened, **ready_for_review**, skips drafts |
| Resilience | races on new pushes | **`concurrency` cancels stale runs** so the comment always matches the latest commit |
| Report output | raw JSON in the job summary | **Structured PR comment + step summary** |
| Comment handling | none | Creates **and updates** one marker comment |
| Severity | none | Critical / High / **Low badges** + WCAG refs |
| AI findings | raw | Table + collapsible details + next steps |
| PR gating | none (advisory only) | **`exit 1` blocks the PR** when findings exist |
| LLM provider | OpenAI only | **Free Groq or GitHub Models, or OpenAI** (OpenAI-compatible API) |
| Permissions | read-only | `issues/pull-requests: write` (to post comments) |

### Requirements

- Two repositories: a **portfolio/consumer repo** that holds the workflow file, and this **A11y-agent** repo that is checked out and executed as the worker.
- The consumer repo needs the secrets below (see [Set Up Secrets](#set-up-secrets)).
- The workflow checks out `navajyoth-puthalath13/A11y-agent` at `main` into `.github/actions/a11y-agent`, so the worker repo must be public (or accessible to the runner).

> Note: If you already store this workflow inside the A11y-agent repo for testing, it works the same way — the checkout just pulls the same repo into a sub-folder.

### 1. Add the workflow file

Copy the workflow into the consumer repository at:

```text
.github/workflows/accessibility-review.yml
```

The workflow is self-contained: it checks out both the consumer code and the **A11y-agent worker**, sets up Node **24**, runs `npm ci`, `typecheck`, `build`, and finally `npm start`.

```yaml
permissions:
  contents: read
  issues: write
  pull-requests: write
```

`issues: write` and `pull-requests: write` let the workflow post and update the PR comment. `contents: read` keeps it from modifying repository files.

The `concurrency` block cancels any in-flight run for the same PR when a new push arrives, so the comment always reflects the latest commit:

```yaml
concurrency:
  group: a11y-review-${{ github.event.pull_request.number }}
  cancel-in-progress: true
```

### 2. Set up secrets

Open the consumer repo in a browser and create each secret under:

```text
Settings -> Secrets and variables -> Actions -> New repository secret
```

| Secret | Required | What it is |
| --- | --- | --- |
| `GROQ_API_KEY` | Yes (or a model key below) | Free API key from [console.groq.com](https://console.groq.com). Used as the **model provider** key. |
| `OPENAI_API_KEY` | Optional | Paid OpenAI key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys). Overrides Groq if both are set. |
| `GITHUB_MODELS_TOKEN` | Optional | Can use the free **GitHub Models** endpoint instead. |
| `GITHUB_TOKEN` | Automatic | Provided by the Actions runtime (`${{ github.token }}`). No setup needed — used for checkout, PR context, and posting the comment. |

The review agent picks the provider automatically from whichever key is set (see below).

### 3. Configure the model

The workflow passes the model as runner env:

```yaml
env:
  GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
  OPENAI_MODEL: llama-3.3-70b-versatile
```

Provider selection in `src/config.ts` is priority-based:

- If `OPENAI_API_KEY` is set → **OpenAI** (`https://api.openai.com/v1`, default `gpt-4.1-mini`).
- Else if `GROQ_API_KEY` is set → **Groq** (`https://api.groq.com/openai/v1`, default `llama-3.3-70b-versatile`).
- Else if `GITHUB_MODELS_TOKEN`/`GITHUB_TOKEN` is set → **GitHub Models** (`https://models.github.ai/inference`, default `openai/gpt-4o-mini`).

You can override the model and endpoint with `OPENAI_MODEL` and `OPENAI_BASE_URL`, as the workflow does with `OPENAI_MODEL: llama-3.3-70b-versatile`.

### 4. See the results

- The workflow posts **one** comment on the PR (look for the `<!-- a11y-review -->` marker). Re-runs update that same comment instead of adding duplicates.
- A **job summary** is written for the workflow run.
- If any finding is reported, the `Fail PR check` step prints an error and exits `1`, marking the PR as **blocked** until the issues are resolved and the review re-runs.
- If no findings are found, the comment reports **Passed** and the check stays green.

> The workflow never edits files, creates commits, or pushes code. The review is advisory in spirit — only the optional `Fail PR check` step gates the PR, and you can remove that step if you prefer a non-blocking review.

## JSON Output

```json
{
  "summary": {
    "deterministicFindingCount": 1,
    "aiFindingCount": 1
  },
  "deterministicFindings": [
    {
      "id": "ESLINT-A11Y-001",
      "source": "eslint-plugin-jsx-a11y",
      "ruleId": "jsx-a11y/alt-text",
      "severity": "error",
      "filePath": "src/Button.tsx",
      "lineNumber": 42,
      "column": 7,
      "message": "img elements must have an alt prop."
    }
  ],
  "aiFindings": [
    {
      "id": "A11Y-001",
      "severity": "medium",
      "wcagReference": "WCAG 2.2 1.1.1 Non-text Content",
      "filePath": "src/Button.tsx",
      "lineNumber": 42,
      "relatedRuleIds": ["jsx-a11y/alt-text"],
      "componentName": "Button",
      "description": "The image lacks alternative text.",
      "impact": "Screen reader users may miss important visual information.",
      "suggestedFix": "Add meaningful alt text, or alt=\"\" if the image is decorative.",
      "confidence": 0.86
    }
  ]
}
```
