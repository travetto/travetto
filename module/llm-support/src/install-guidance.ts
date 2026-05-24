import { type DependencyGraphNode, type InstallGuidance } from './types.ts';

export const INSTALL_BUNDLES: InstallGuidance[] = [
  {
    id: 'web-api-baseline',
    title: 'Web API Baseline',
    required: ['@travetto/runtime', '@travetto/config', '@travetto/schema', '@travetto/di', '@travetto/web'],
    optional: ['@travetto/openapi', '@travetto/log', '@travetto/test'],
    notes: [
      'Use this baseline for HTTP endpoint development with dependency injection and schema contracts.',
      'Add @travetto/openapi when API contract generation is required.'
    ]
  },
  {
    id: 'auth-enabled-web',
    title: 'Auth Enabled Web',
    required: ['@travetto/web', '@travetto/auth', '@travetto/auth-web'],
    optional: ['@travetto/auth-session', '@travetto/auth-web-session', '@travetto/auth-web-passport'],
    notes: [
      'Start with auth plus auth-web for core identity and permission checks in HTTP flows.',
      'Session and passport adapters are optional and depend on runtime identity needs.'
    ]
  },
  {
    id: 'model-sql-stack',
    title: 'Model SQL Stack',
    required: ['@travetto/model', '@travetto/model-query', '@travetto/model-sql'],
    optional: ['@travetto/model-postgres', '@travetto/model-mysql', '@travetto/model-sqlite'],
    notes: [
      'Pick one SQL adapter package per deployment target.',
      'Add @travetto/model-query-language when exposing user-facing query parsing.'
    ]
  },
  {
    id: 'worker-baseline',
    title: 'Worker Baseline',
    required: ['@travetto/runtime', '@travetto/config', '@travetto/worker'],
    optional: ['@travetto/model', '@travetto/log', '@travetto/context'],
    notes: [
      'Use worker for scheduled or background job execution.',
      'Add model when jobs persist state between runs.'
    ]
  }
];

export const DEPENDENCY_GRAPH: DependencyGraphNode[] = [
  {
    package: '@travetto/auth',
    requires: ['@travetto/runtime', '@travetto/schema', '@travetto/di'],
    optionalAdapters: ['@travetto/auth-model', '@travetto/auth-session']
  },
  {
    package: '@travetto/web',
    requires: ['@travetto/runtime', '@travetto/config', '@travetto/schema', '@travetto/di'],
    optionalAdapters: ['@travetto/web-express', '@travetto/web-fastify', '@travetto/web-koa']
  },
  {
    package: '@travetto/auth-web',
    requires: ['@travetto/auth', '@travetto/web'],
    optionalAdapters: ['@travetto/auth-web-session', '@travetto/auth-web-passport']
  },
  {
    package: '@travetto/model',
    requires: ['@travetto/schema', '@travetto/di', '@travetto/config'],
    optionalAdapters: [
      '@travetto/model-memory',
      '@travetto/model-sql',
      '@travetto/model-mongo',
      '@travetto/model-dynamodb',
      '@travetto/model-file',
      '@travetto/model-firestore',
      '@travetto/model-redis',
      '@travetto/model-s3',
      '@travetto/model-elasticsearch'
    ]
  },
  {
    package: '@travetto/model-query',
    requires: ['@travetto/model'],
    optionalAdapters: ['@travetto/model-query-language']
  },
  {
    package: '@travetto/worker',
    requires: ['@travetto/runtime', '@travetto/config'],
    optionalAdapters: ['@travetto/model', '@travetto/log', '@travetto/context']
  }
];
