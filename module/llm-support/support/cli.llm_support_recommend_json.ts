import { CliCommand, type CliCommandShape } from '@travetto/cli';

import { resolveRecommendationJsonV1 } from '../src/recommendation.ts';

@CliCommand()
export class LlmSupportRecommendJsonCommand implements CliCommandShape {

  /** Workflow id (for example: build-api-service) */
  workflow?: string;

  /** Install bundle id (for example: web-api-baseline) */
  bundle?: string;

  /** Free-text intent matcher against workflow title/intent */
  intent?: string;

  /** Capability needs for non-SQL adapter selection (blob, query, indexed, expiry). Can be repeated or comma-separated. */
  needs?: string[];

  async main(): Promise<void> {
    const result = resolveRecommendationJsonV1({
      workflow: this.workflow,
      bundle: this.bundle,
      intent: this.intent,
      needs: this.needs
    });

    console.log(JSON.stringify(result, null, 2));
  }
}
