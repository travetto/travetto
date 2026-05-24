import { type WorkflowGuidance } from './types.ts';

export const WORKFLOWS: WorkflowGuidance[] = [
  {
    id: 'build-api-service',
    title: 'Build a REST API service',
    intent: 'Expose schema-backed endpoints with DI-managed services.',
    recommendedModules: ['@travetto/web', '@travetto/schema', '@travetto/di', '@travetto/config'],
    optionalModules: ['@travetto/openapi', '@travetto/auth', '@travetto/auth-web'],
    commandDiscoveryRule: 'If CLI command shape is uncertain, validate with npx trv cli:schema before recommending command arguments.',
    verification: [
      'Confirm endpoint decorators and schema decorators are documented in module LLM consumer docs.',
      'Confirm generated guidance is consistent with current CLI schema output.'
    ]
  },
  {
    id: 'enable-persistence',
    title: 'Enable persistent model storage',
    intent: 'Provide model contracts and adapter-backed persistence.',
    recommendedModules: ['@travetto/model', '@travetto/model-query'],
    optionalModules: ['@travetto/model-sql', '@travetto/model-mongo', '@travetto/model-memory'],
    commandDiscoveryRule: 'Use npx trv cli:schema before proposing model:install or model:export argument forms.',
    verification: [
      'Ensure selected adapter module matches datastore target and install bundle guidance.',
      'Ensure required index decorators and non-internal model utilities are covered in docs.'
    ]
  },
  {
    id: 'run-background-jobs',
    title: 'Run worker-based background jobs',
    intent: 'Process asynchronous or scheduled work safely across shutdown boundaries.',
    recommendedModules: ['@travetto/worker', '@travetto/runtime', '@travetto/config'],
    optionalModules: ['@travetto/model', '@travetto/context', '@travetto/log'],
    commandDiscoveryRule: 'Validate worker command patterns with npx trv cli:schema whenever command signatures are referenced.',
    verification: [
      'Ensure shutdown behavior and lifecycle guidance references runtime abstractions.',
      'Confirm job storage guidance aligns with selected model adapter.'
    ]
  }
];
