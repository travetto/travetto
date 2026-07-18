import { MinLength, Required, Schema } from '@travetto/schema';

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

export type ExecutionArtifactStatus = 'planned' | 'created' | 'skipped';
export type PlanStepId = 'validate-assumptions' | 'generate-artifacts' | 'verify-output';

@Schema()
export class DependencyGraphNodeSchema {
  package = '';
  requires: string[] = [];
  optionalAdapters: string[] = [];
}

@Schema()
export class RecommendationQuerySchema {
  @Required(false)
  bundles?: string[];

  @Required(false)
  workflows?: string[];

  @Required(false)
  operations?: string[];

  @Required(false)
  categories?: LlmOperationCategory[];

  @Required(false)
  snippetTags?: string[];

  @Required(false)
  includeExcluded?: boolean;
}

@Schema()
export class LlmSupportRecommendToolInput extends RecommendationQuerySchema {}

@Schema()
export class LlmSupportPlanToolInput extends RecommendationQuerySchema {}

@Schema()
export class LlmSupportExecuteToolInput {
  @MinLength(1)
  operations: string[] = [];

  @MinLength(1)
  targetDir = '.';

  @Required(false)
  apply?: boolean;

  @Required(false)
  overwrite?: boolean;

  @Required(false)
  monorepo?: boolean;

  @Required(false)
  workspacePath?: string;

  @Required(false)
  workspaceName?: string;

  @Required(false)
  routePath?: string;

  @Required(false)
  controllerName?: string;

  @Required(false)
  serviceName?: string;

  @Required(false)
  modelName?: string;

  @Required(false)
  projectName?: string;

  @Required(false)
  emailName?: string;

  @Required(false)
  sendRoutePath?: string;
}

@Schema()
export class InstallGuidanceSchema {
  id = '';
  title = '';
  required: string[] = [];
  optional: string[] = [];
  notes: string[] = [];
}

@Schema()
export class WorkflowGuidanceSchema {
  id = '';
  title = '';
  intent = '';
  recommendedModules: string[] = [];
  optionalModules: string[] = [];
  commandDiscoveryRule = '';
  verification: string[] = [];
}

@Schema()
export class LlmOperationSchema {
  id = '';
  category: LlmOperationCategory = 'project';
  title = '';
  summary = '';
  requiredModules: string[] = [];
  optionalModules: string[] = [];

  @Required(false)
  excluded?: boolean;
}

@Schema()
export class SnippetSourceSchema {
  sourceId = '';
  repositoryId = '';
  filePath = '';
  capabilityTags: string[] = [];

  @Required(false)
  operationIds?: string[];

  @Required(false)
  applicability?: string[];

  notes: string[] = [];
}

@Schema()
export class PlannedChangeSchema {
  stepId: PlanStepId = 'generate-artifacts';
  step = '';
  files: string[] = [];
  rationale = '';
}

@Schema()
export class OperationPlanSchema {
  operationId = '';
  title = '';
  requiredModules: string[] = [];
  optionalModules: string[] = [];
  changes: PlannedChangeSchema[] = [];
}

@Schema()
export class ExecutionArtifactSchema {
  operationId = '';
  file = '';
  status: ExecutionArtifactStatus = 'planned';

  @Required(false)
  stepId?: PlanStepId;

  @Required(false)
  reason?: string;
}

@Schema()
export class RecommendationResponseSchema {
  bundles: InstallGuidanceSchema[] = [];
  workflows: WorkflowGuidanceSchema[] = [];
  operations: LlmOperationSchema[] = [];
  snippets: SnippetSourceSchema[] = [];
}

@Schema()
export class PlanResponseSchema {
  plans: OperationPlanSchema[] = [];
  snippets: SnippetSourceSchema[] = [];
}

@Schema()
export class ExecutionResponseSchema {
  dryRun = true;
  targetDir = '';
  artifacts: ExecutionArtifactSchema[] = [];
  warnings: string[] = [];
}

export type DependencyGraphNode = InstanceType<typeof DependencyGraphNodeSchema>;
export type RecommendationQuery = InstanceType<typeof RecommendationQuerySchema>;
export type InstallGuidance = InstanceType<typeof InstallGuidanceSchema>;
export type WorkflowGuidance = InstanceType<typeof WorkflowGuidanceSchema>;
export type LlmOperation = InstanceType<typeof LlmOperationSchema>;
export type SnippetSource = InstanceType<typeof SnippetSourceSchema>;
export type PlannedChange = InstanceType<typeof PlannedChangeSchema>;
export type OperationPlan = InstanceType<typeof OperationPlanSchema>;
export type RecommendationResponse = InstanceType<typeof RecommendationResponseSchema>;
export type PlanResponse = InstanceType<typeof PlanResponseSchema>;
export type ExecutionArtifact = InstanceType<typeof ExecutionArtifactSchema>;
export type ExecutionResponse = InstanceType<typeof ExecutionResponseSchema>;
export type ExecutionRequest = Omit<InstanceType<typeof LlmSupportExecuteToolInput>, 'apply'> & {
  dryRun?: boolean;
};
