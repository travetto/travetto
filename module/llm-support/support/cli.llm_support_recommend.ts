import { CliCommand, type CliCommandShape } from '@travetto/cli';

import { renderRecommendationText, resolveRecommendation } from '../src/recommendation.ts';

@CliCommand()
export class LlmSupportRecommendCommand implements CliCommandShape {

  /** Workflow id (for example: build-api-service) */
  workflow?: string;

  /** Install bundle id (for example: web-api-baseline) */
  bundle?: string;

  /** Free-text intent matcher against workflow title/intent */
  intent?: string;

  /** Capability needs for non-SQL adapter selection (blob, query, indexed, expiry). Can be repeated or comma-separated. */
  needs?: string[];

  /** Output format */
  format: 'json' | 'text' = 'text';

  async main(): Promise<void> {
    const output = resolveRecommendation({
      workflow: this.workflow,
      bundle: this.bundle,
      intent: this.intent,
      needs: this.needs
    });

    if (this.format === 'text') {
      console.log(renderRecommendationText(output));
    } else {
      console.log(JSON.stringify(output, null, 2));
    }
  }
}
