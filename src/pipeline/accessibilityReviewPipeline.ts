import { AccessibilityReviewerAgent } from "../agents/accessibilityReviewer.js";
import { JsxA11yLayer } from "../layers/deterministic/jsxA11yLayer.js";
import type { ChangedFile, StructuredAccessibilityReport } from "../types.js";

export class AccessibilityReviewPipeline {
  constructor(
    private readonly deterministicLayer: JsxA11yLayer,
    private readonly aiReviewer: AccessibilityReviewerAgent
  ) {}

  async run(files: ChangedFile[]): Promise<StructuredAccessibilityReport> {
    const deterministicFindings = await this.deterministicLayer.run(files);
    const aiFindings = await this.aiReviewer.reviewChangedFiles(files, deterministicFindings);

    return {
      summary: {
        deterministicFindingCount: deterministicFindings.length,
        aiFindingCount: aiFindings.length
      },
      deterministicFindings,
      aiFindings
    };
  }
}
