import type {
  InstallGuidance,
  LlmOperation,
  RecommendationQuery,
  RecommendationResponse,
  WorkflowGuidance
} from './types.ts';
import { INSTALL_BUNDLES } from './install-guidance.ts';
import { recommendSnippets } from './snippet-catalog.ts';
import { WORKFLOWS } from './workflow-guidance.ts';

const OPERATIONS: LlmOperation[] = [
  {
    id: 'project-bootstrap',
    category: 'project',
    title: 'Project bootstrap',
    summary: 'Create a project with guided module and backend selection.',
    requiredModules: ['@travetto/runtime', '@travetto/config'],
    optionalModules: ['@travetto/web', '@travetto/model', '@travetto/test', '@travetto/eslint']
  },
  {
    id: 'create-web-route',
    category: 'web',
    title: 'Create route/controller/service',
    summary: 'Generate a web route with controller and service separation.',
    requiredModules: ['@travetto/web', '@travetto/schema', '@travetto/di'],
    optionalModules: ['@travetto/auth-web', '@travetto/model-query']
  },
  {
    id: 'enable-file-upload',
    category: 'upload',
    title: 'Enable file upload',
    summary: 'Support direct upload and presigned URL upload flows.',
    requiredModules: ['@travetto/web-upload'],
    optionalModules: ['@travetto/model-s3', '@travetto/model-firestore']
  },
  {
    id: 'enable-auth-session',
    category: 'auth',
    title: 'Enable auth/session',
    summary: 'Add login, self, and logout flows with session support.',
    requiredModules: ['@travetto/auth', '@travetto/auth-web'],
    optionalModules: ['@travetto/auth-session', '@travetto/auth-web-session', '@travetto/model-memory']
  },
  {
    id: 'rest-rpc-client',
    category: 'web',
    title: 'Create rest-rpc client',
    summary: 'Generate UI-focused rest-rpc client integration.',
    requiredModules: ['@travetto/web-rpc'],
    optionalModules: ['@travetto/openapi']
  },
  {
    id: 'model-indexed-assistant',
    category: 'model',
    title: 'Model indexed support',
    summary: 'Add indexes and index-aware query helpers.',
    requiredModules: ['@travetto/model-indexed'],
    optionalModules: ['@travetto/model-query']
  },
  {
    id: 'model-query-assistant',
    category: 'model',
    title: 'Model query support',
    summary: 'Craft query expressions from natural language intent.',
    requiredModules: ['@travetto/model-query'],
    optionalModules: ['@travetto/model-query-language']
  },
  {
    id: 'workflow-gcp-deploy',
    category: 'workflow',
    title: 'Generate GCP deploy workflow',
    summary: 'Create GitHub workflows for GCP deploy pipelines.',
    requiredModules: [],
    optionalModules: []
  },
  {
    id: 'workflow-cloudfront-deploy',
    category: 'workflow',
    title: 'Generate CloudFront deploy workflow',
    summary: 'Create GitHub workflows for S3 + CloudFront UI deploy pipelines.',
    requiredModules: [],
    optionalModules: []
  },
  {
    id: 'enable-linting',
    category: 'quality',
    title: 'Enable linting and fix',
    summary: 'Configure linting support and fix workflows for generated code.',
    requiredModules: ['@travetto/eslint'],
    optionalModules: ['@travetto/test']
  },
  {
    id: 'generate-config',
    category: 'config',
    title: 'Create configuration classes/files',
    summary: 'Generate config schema classes and profile-aware config files.',
    requiredModules: ['@travetto/config'],
    optionalModules: []
  },
  {
    id: 'generate-test-suite',
    category: 'test',
    title: 'Create test suite',
    summary: 'Generate unit/integration tests and fixture setup.',
    requiredModules: ['@travetto/test'],
    optionalModules: []
  },
  {
    id: 'create-web-interceptor',
    category: 'web',
    title: 'Create web interceptor',
    summary: 'Generate web interceptor for cross-cutting concerns.',
    requiredModules: ['@travetto/web'],
    optionalModules: ['@travetto/auth-web', '@travetto/cache']
  },
  {
    id: 'email-create-template',
    category: 'email',
    title: 'Create email template',
    summary: 'Generate template files for transactional email.',
    requiredModules: ['@travetto/email'],
    optionalModules: ['@travetto/email-compiler', '@travetto/email-inky']
  },
  {
    id: 'email-context-schema',
    category: 'email',
    title: 'Generate email context schema',
    summary: 'Create typed context contracts for template rendering.',
    requiredModules: ['@travetto/email', '@travetto/schema'],
    optionalModules: []
  },
  {
    id: 'email-render-pipeline',
    category: 'email',
    title: 'Add email render pipeline',
    summary: 'Wire template compiler and renderer integration.',
    requiredModules: ['@travetto/email'],
    optionalModules: ['@travetto/email-compiler', '@travetto/email-inky']
  },
  {
    id: 'email-transport-provider',
    category: 'email',
    title: 'Add email transport/provider',
    summary: 'Configure provider wiring for runtime delivery.',
    requiredModules: ['@travetto/email'],
    optionalModules: ['@travetto/email-nodemailer']
  },
  {
    id: 'email-preview-snapshot',
    category: 'email',
    title: 'Add email preview/snapshot',
    summary: 'Generate preview and snapshot validation support.',
    requiredModules: ['@travetto/email', '@travetto/test'],
    optionalModules: []
  },
  {
    id: 'email-send-flow',
    category: 'email',
    title: 'Add email send integration',
    summary: 'Integrate send operations with endpoint or worker execution.',
    requiredModules: ['@travetto/email'],
    optionalModules: ['@travetto/worker', '@travetto/web']
  },
  {
    id: 'email-test-fixtures',
    category: 'email',
    title: 'Add email test fixtures',
    summary: 'Generate fixture data and tests for email generation flows.',
    requiredModules: ['@travetto/email', '@travetto/test'],
    optionalModules: []
  },
  {
    id: 'cache-enhancements',
    category: 'cache',
    title: 'Add cache enhancements',
    summary: 'Generate cache decorators and eviction workflows.',
    requiredModules: ['@travetto/cache'],
    optionalModules: ['@travetto/model']
  },
  {
    id: 'openapi-spec-pipeline',
    category: 'web',
    title: 'Add OpenAPI spec pipeline',
    summary: 'Generate OpenAPI specification workflow and persistence settings.',
    requiredModules: ['@travetto/openapi'],
    optionalModules: ['@travetto/web', '@travetto/schema']
  },
  {
    id: 'openapi-client-generation',
    category: 'web',
    title: 'Add OpenAPI client generation',
    summary: 'Generate client workflow from OpenAPI spec artifacts.',
    requiredModules: ['@travetto/openapi'],
    optionalModules: ['@travetto/web-rpc', '@travetto/web']
  },
  {
    id: 'aws-lambda-package-and-deploy',
    category: 'workflow',
    title: 'Add AWS Lambda package/deploy',
    summary: 'Generate packaging and deployment workflow for web AWS Lambda targets.',
    requiredModules: ['@travetto/web-aws-lambda', '@travetto/pack'],
    optionalModules: ['@travetto/web', '@travetto/config']
  },
  {
    id: 'pack-docker-release',
    category: 'workflow',
    title: 'Add Docker pack release',
    summary: 'Generate workflow for container image build and publish via pack:docker.',
    requiredModules: ['@travetto/pack'],
    optionalModules: ['@travetto/config', '@travetto/runtime']
  },
  {
    id: 'repo-version-release',
    category: 'workflow',
    title: 'Add repo version release flow',
    summary: 'Generate monorepo versioning workflow using repo:version.',
    requiredModules: ['@travetto/repo'],
    optionalModules: ['@travetto/pack', '@travetto/registry']
  },
  {
    id: 'excluded-log-config',
    category: 'quality',
    title: 'Log configuration (excluded)',
    summary: 'Excluded by scope decision.',
    requiredModules: ['@travetto/log'],
    optionalModules: [],
    excluded: true
  },
  {
    id: 'excluded-log-instrumentation',
    category: 'quality',
    title: 'Log instrumentation (excluded)',
    summary: 'Excluded by scope decision.',
    requiredModules: ['@travetto/log'],
    optionalModules: [],
    excluded: true
  },
  {
    id: 'excluded-eslint-profile',
    category: 'quality',
    title: 'ESLint profile generation (excluded)',
    summary: 'Excluded by scope decision.',
    requiredModules: ['@travetto/eslint'],
    optionalModules: [],
    excluded: true
  },
  {
    id: 'excluded-test-mock-service',
    category: 'test',
    title: 'Test mock service generation (excluded)',
    summary: 'Excluded by scope decision.',
    requiredModules: ['@travetto/test'],
    optionalModules: [],
    excluded: true
  }
];

function matchesIds<T extends { id: string }>(items: T[], ids?: string[]): T[] {
  if (!ids || ids.length === 0) {
    return items;
  }
  const wanted = new Set(ids);
  return items.filter(item => wanted.has(item.id));
}

export function recommendBundles(ids?: string[]): InstallGuidance[] {
  return matchesIds(INSTALL_BUNDLES, ids);
}

export function recommendWorkflows(ids?: string[]): WorkflowGuidance[] {
  return matchesIds(WORKFLOWS, ids);
}

export function recommendOperations(query: RecommendationQuery = {}): LlmOperation[] {
  const { categories, includeExcluded = false } = query;
  const selected = categories && categories.length ?
    OPERATIONS.filter(item => categories.includes(item.category)) :
    OPERATIONS;
  return selected.filter(item => includeExcluded || !item.excluded);
}

export const LLM_OPERATION_CATEGORIES = [...new Set(OPERATIONS.map(item => item.category))].sort();

export function getValidOperationIds(includeExcluded = false): string[] {
  return recommendOperations({ includeExcluded }).map(item => item.id);
}

export async function recommend(query: RecommendationQuery = {}): Promise<RecommendationResponse> {
  const operations = recommendOperations(query);
  return {
    bundles: recommendBundles(query.bundles),
    workflows: recommendWorkflows(query.workflows),
    operations,
    snippets: await recommendSnippets({
      ...query,
      operations: operations.map(item => item.id)
    })
  };
}

export const EXCLUDED_OPERATION_IDS = OPERATIONS
  .filter(item => item.excluded)
  .map(item => item.id);

export const LLM_OPERATIONS = OPERATIONS;
