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

Set `GITHUB_MODELS_TOKEN` and `GITHUB_MODELS_MODEL`, then review local files:

```bash
npm run dev -- --files src/example.tsx
```

Review a pull request from a checked-out repository:

```bash
GITHUB_MODELS_TOKEN=... GITHUB_TOKEN=... GITHUB_REPOSITORY=owner/repo PR_NUMBER=123 npm run dev
```

## Run In GitHub

This project includes a GitHub Actions workflow at `.github/workflows/accessibility-review.yml`.

On every pull request open, update, or reopen, GitHub Actions will:

1. Check out the pull request.
2. Install dependencies.
3. Typecheck and build the TypeScript project.
4. Run the accessibility review agent.
5. Print the JSON report into the workflow job summary.

The workflow is read-only. It uses:

```yaml
permissions:
  contents: read
  pull-requests: read
  models: read
```

The `models: read` permission lets the workflow call GitHub Models through the built-in `GITHUB_TOKEN`.

This first GitHub version does not post PR comments yet. That belongs to the later GitHub integration phase.

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
