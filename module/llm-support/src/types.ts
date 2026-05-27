export interface InstallGuidance {
  id: string;
  title: string;
  required: string[];
  optional: string[];
  notes: string[];
}

export interface DependencyGraphNode {
  package: string;
  requires: string[];
  optionalAdapters: string[];
}

export interface WorkflowGuidance {
  id: string;
  title: string;
  intent: string;
  recommendedModules: string[];
  optionalModules: string[];
  commandDiscoveryRule: string;
  verification: string[];
}

export type AdapterNeed = 'blob' | 'query' | 'indexed' | 'expiry';

export type LlmOperationCategory =
  | 'project'
  | 'web'
  | 'auth'
  | 'model'
  | 'upload'
  | 'workflow'
  | 'quality'
  | 'email'
  | 'test'
  | 'config'
  | 'cache';

export interface LlmOperation {
  id: string;
  category: LlmOperationCategory;
  title: string;
  summary: string;
  requiredModules: string[];
  optionalModules: string[];
  excluded?: boolean;
}

export interface SnippetSource {
  sourceId: string;
  repositoryId: string;
  filePath: string;
  capabilityTags: string[];
  operationIds?: string[];
  applicability?: string[];
  notes: string[];
}

export interface RecommendationQuery {
  bundles?: string[];
  workflows?: string[];
  operations?: string[];
  categories?: LlmOperationCategory[];
  snippetTags?: string[];
  includeExcluded?: boolean;
}

export interface RecommendationResponse {
  bundles: InstallGuidance[];
  workflows: WorkflowGuidance[];
  operations: LlmOperation[];
  snippets: SnippetSource[];
}

export interface PlannedChange {
  step: string;
  files: string[];
  rationale: string;
}

export interface OperationPlan {
  operationId: string;
  title: string;
  requiredModules: string[];
  optionalModules: string[];
  changes: PlannedChange[];
}

export interface PlanResponse {
  plans: OperationPlan[];
  snippets: SnippetSource[];
}

export interface ExecutionRequest {
  operations: string[];
  targetDir: string;
  dryRun?: boolean;
  overwrite?: boolean;
  monorepo?: boolean;
  workspacePath?: string;
  workspaceName?: string;
  routePath?: string;
  controllerName?: string;
  serviceName?: string;
  modelName?: string;
  projectName?: string;
  emailName?: string;
  sendRoutePath?: string;
}

export interface ExecutionArtifact {
  operationId: string;
  file: string;
  status: 'planned' | 'created' | 'skipped';
  reason?: string;
}

export interface ExecutionResponse {
  dryRun: boolean;
  targetDir: string;
  artifacts: ExecutionArtifact[];
  warnings: string[];
}
