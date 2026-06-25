import type { AccessibilityFinding } from "../types.js";

export function printJsonReport(findings: AccessibilityFinding[]): void {
  process.stdout.write(`${JSON.stringify({ findings }, null, 2)}\n`);
}

