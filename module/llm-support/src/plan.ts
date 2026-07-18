import { recommend, recommendOperations } from './recommendation.ts';
import type { LlmOperation, OperationPlan, PlannedChange, PlanResponse, RecommendationQuery } from './types.ts';

function filesFor(op: LlmOperation): string[] {
  switch (op.id) {
    case 'project-bootstrap':
      return ['package.json', 'resources/application.yml', 'src/', 'packages/app/'];
    case 'create-web-route':
      return ['src/web/', 'src/service/'];
    case 'enable-file-upload':
      return ['src/web/', 'src/config/'];
    case 'enable-auth-session':
      return ['src/web/auth.ts', 'src/web/auth.config.ts'];
    case 'rest-rpc-client':
      return ['src/client/', '__index__.ts'];
    case 'model-indexed-assistant':
      return ['src/model/', 'src/service/'];
    case 'model-query-assistant':
      return ['src/model/', 'src/service/'];
    case 'workflow-gcp-deploy':
      return ['.github/workflows/deploy-api.yml'];
    case 'workflow-cloudfront-deploy':
      return ['.github/workflows/deploy-ui.yml'];
    case 'workflow-firebase-deploy':
      return ['.github/workflows/firebase-hosting-merge.yml'];
    case 'enable-linting':
      return ['package.json'];
    case 'generate-config':
      return ['src/config/', 'resources/'];
    case 'generate-test-suite':
      return ['test/'];
    case 'create-web-interceptor':
      return ['src/interceptor/'];
    case 'email-create-template':
      return ['src/email/templates/'];
    case 'email-context-schema':
      return ['src/email/schema.ts'];
    case 'email-render-pipeline':
      return ['src/email/service.ts'];
    case 'email-transport-provider':
      return ['src/email/provider.ts', 'src/config/'];
    case 'email-preview-snapshot':
      return ['test/email/'];
    case 'email-send-flow':
      return ['src/web/', 'src/worker/'];
    case 'email-test-fixtures':
      return ['test/email/fixtures/'];
    case 'cache-enhancements':
      return ['src/service/', 'src/config/'];
    default:
      return ['src/'];
  }
}

function changesFor(op: LlmOperation): PlannedChange[] {
  return [
    {
      stepId: 'validate-assumptions',
      step: 'Validate command and module assumptions',
      files: [],
      rationale: 'Use cli schema and module metadata to avoid stale command signatures.'
    },
    {
      stepId: 'generate-artifacts',
      step: 'Generate core implementation artifacts',
      files: filesFor(op),
      rationale: op.summary
    },
    {
      stepId: 'verify-output',
      step: 'Run verification checks',
      files: [],
      rationale: 'Compile, lint, and test generated code paths before apply confirmation.'
    }
  ];
}

function toPlan(op: LlmOperation): OperationPlan {
  return {
    operationId: op.id,
    title: op.title,
    requiredModules: op.requiredModules,
    optionalModules: op.optionalModules,
    changes: changesFor(op)
  };
}

export async function buildPlans(query: RecommendationQuery = {}): Promise<PlanResponse> {
  const operations =
    query.operations && query.operations.length > 0
      ? recommendOperations({
          categories: query.categories,
          includeExcluded: query.includeExcluded
        }).filter(item => query.operations?.includes(item.id))
      : recommendOperations({
          categories: query.categories,
          includeExcluded: query.includeExcluded
        });

  const plans = operations.map(toPlan);
  const snippets = (
    await recommend({
      ...query,
      operations: plans.map(item => item.operationId)
    })
  ).snippets;

  return { plans, snippets };
}
