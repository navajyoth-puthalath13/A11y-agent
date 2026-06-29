import type { StructuredAccessibilityReport } from "../types.js";

export function printJsonReport(report: StructuredAccessibilityReport): void {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
