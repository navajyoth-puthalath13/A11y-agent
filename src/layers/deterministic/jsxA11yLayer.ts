import path from "node:path";
import { ESLint, type Linter } from "eslint";
import jsxA11y from "eslint-plugin-jsx-a11y";
import tsParser from "@typescript-eslint/parser";
import type { ChangedFile, DeterministicFinding } from "../../types.js";

type JsxA11yPlugin = {
  configs: {
    recommended: {
      rules: Record<string, unknown>;
    };
  };
};

const REVIEWABLE_EXTENSIONS = /\.(tsx?|jsx?)$/i;

export class JsxA11yLayer {
  private readonly eslint: ESLint;

  constructor() {
    const plugin = jsxA11y as JsxA11yPlugin;

    this.eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: [
        {
          files: ["**/*.{js,jsx,ts,tsx}"],
          languageOptions: {
            parser: tsParser,
            parserOptions: {
              ecmaFeatures: {
                jsx: true
              },
              ecmaVersion: "latest",
              sourceType: "module"
            }
          },
          plugins: {
            "jsx-a11y": jsxA11y as never
          },
          rules: plugin.configs.recommended.rules as Linter.RulesRecord
        }
      ]
    });
  }

  async run(files: ChangedFile[]): Promise<DeterministicFinding[]> {
    const reviewableFiles = files.filter(
      (file) => file.status !== "removed" && file.content && REVIEWABLE_EXTENSIONS.test(file.path)
    );

    const results = await Promise.all(
      reviewableFiles.map((file) =>
        this.eslint.lintText(file.content ?? "", {
          filePath: file.path
        })
      )
    );

    let findingIndex = 0;
    return results.flat().flatMap((result) =>
      result.messages.flatMap((message) => {
        const findings = normalizeEslintMessage(message, result.filePath, findingIndex);
        findingIndex += findings.length;
        return findings;
      })
    );
  }
}

function normalizeEslintMessage(
  message: Awaited<ReturnType<ESLint["lintText"]>>[number]["messages"][number],
  filePath: string,
  index: number
): DeterministicFinding[] {
  if (!message.ruleId?.startsWith("jsx-a11y/")) {
    return [];
  }

  return [
    {
      id: `ESLINT-A11Y-${String(index + 1).padStart(3, "0")}`,
      source: "eslint-plugin-jsx-a11y",
      ruleId: message.ruleId,
      severity: message.severity === 2 ? "error" : "warning",
      filePath: path.relative(process.cwd(), filePath) || filePath,
      lineNumber: message.line ?? null,
      column: message.column ?? null,
      message: message.message
    }
  ];
}
