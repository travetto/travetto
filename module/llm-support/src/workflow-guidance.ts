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
    intent: 'Provide model contracts and adapter-backed persistence with one adapter family choice (SQL or non-SQL).',
    recommendedModules: ['@travetto/model'],
    optionalModules: [
      '@travetto/model-query',
      '@travetto/model-indexed',
      '@travetto/model-sql',
      '@travetto/model-postgres',
      '@travetto/model-mysql',
      '@travetto/model-sqlite',
      '@travetto/model-memory',
      '@travetto/model-mongo',
      '@travetto/model-dynamodb',
      '@travetto/model-file',
      '@travetto/model-firestore',
      '@travetto/model-redis',
      '@travetto/model-s3',
      '@travetto/model-elasticsearch'
    ],
    commandDiscoveryRule: 'Use npx trv cli:schema before proposing model:install or model:export argument forms.',
    verification: [
      'Ensure selected adapter family and module match datastore target and install bundle guidance.',
      'Ensure required capability needs (blob/query/indexed/expiry) align with selected adapter support.'
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
  },
  {
    id: 'enable-google-oauth-passport',
    title: 'Enable Google OAuth with Passport',
    intent: 'Configure auth-web-passport with Google OAuth strategy and map provider profile to application principal.',
    recommendedModules: ['@travetto/web', '@travetto/auth', '@travetto/auth-web', '@travetto/auth-web-passport', '@travetto/config'],
    optionalModules: ['@travetto/model', '@travetto/model-indexed', '@travetto/model-firestore', '@travetto/auth-model'],
    commandDiscoveryRule: 'Validate auth and web command signatures with npx trv cli:schema before recommending CLI invocations.',
    verification: [
      'Ensure google.auth config includes clientID, clientSecret, and callbackUrl.',
      'Ensure a PassportAuthenticator is registered with Google OAuth strategy and stable principal mapping.',
      'If user persistence is required, ensure external-id lookup/index and one model adapter are configured.'
    ]
  },
  {
    id: 'scaffold-web-openapi-service',
    title: 'Scaffold a web OpenAPI service',
    intent: 'Compose scaffold web feature defaults into a runnable HTTP API with OpenAPI output.',
    recommendedModules: ['@travetto/web', '@travetto/web-http', '@travetto/openapi', '@travetto/runtime', '@travetto/config'],
    optionalModules: ['@travetto/log', '@travetto/schema', '@travetto/di'],
    commandDiscoveryRule: 'Validate scaffold and web command signatures with npx trv cli:schema before suggesting starter commands.',
    verification: [
      'Ensure generated project includes web-http runtime support and openapi endpoint wiring.',
      'Ensure startup command is available for web execution in generated package scripts.'
    ]
  },
  {
    id: 'scaffold-auth-basic-session',
    title: 'Scaffold basic auth with sessions',
    intent: 'Use scaffold auth templates for login/self/logout with session-backed identity in local memory.',
    recommendedModules: ['@travetto/auth', '@travetto/auth-web', '@travetto/auth-session', '@travetto/auth-web-session', '@travetto/model-memory'],
    optionalModules: ['@travetto/model', '@travetto/model-indexed', '@travetto/web'],
    commandDiscoveryRule: 'Validate auth-web decorators and auth command references with npx trv cli:schema before publishing examples.',
    verification: [
      'Ensure auth config exposes authenticator, authorizer, and session store factories.',
      'Ensure /auth/login, /auth/self, and /auth/logout routes are registered and session-aware.'
    ]
  },
  {
    id: 'scaffold-web-model-crud',
    title: 'Scaffold web-model CRUD API',
    intent: 'Generate web + model CRUD patterns from scaffold templates and adapt to domain classes.',
    recommendedModules: ['@travetto/web', '@travetto/model', '@travetto/model-query', '@travetto/schema', '@travetto/di'],
    optionalModules: ['@travetto/auth', '@travetto/auth-web', '@travetto/model-indexed'],
    commandDiscoveryRule: 'Validate web/controller command references and generated route assumptions with npx trv cli:schema.',
    verification: [
      'Ensure controller CRUD methods bind to a model-query capable source.',
      'Ensure principal-scoped filtering is applied when auth-web integration is enabled.'
    ]
  },
  {
    id: 'scaffold-model-backend-selection',
    title: 'Scaffold model backend selection',
    intent: 'Choose one scaffold-supported datastore adapter and align model service/config classes.',
    recommendedModules: ['@travetto/model'],
    optionalModules: [
      '@travetto/model-elasticsearch',
      '@travetto/model-mongo',
      '@travetto/model-sql',
      '@travetto/model-mysql',
      '@travetto/model-postgres',
      '@travetto/model-sqlite'
    ],
    commandDiscoveryRule: 'Validate model command signatures and adapter setup commands with npx trv cli:schema before recommendation output.',
    verification: [
      'Ensure selected adapter is scaffold-supported and matches deployment datastore target.',
      'Ensure SQL-family selections include shared SQL runtime package requirements.'
    ]
  },
  {
    id: 'scaffold-quality-setup',
    title: 'Scaffold test and lint quality checks',
    intent: 'Enable scaffold quality features so generated projects have immediate test and lint feedback loops.',
    recommendedModules: ['@travetto/test', '@travetto/eslint'],
    optionalModules: ['@travetto/log'],
    commandDiscoveryRule: 'Validate test and lint command examples with npx trv cli:schema or generated package scripts before suggesting execution.',
    verification: [
      'Ensure generated package scripts include test and lint commands when selected.',
      'Run test and lint once after generation to catch template/config drift early.'
    ]
  }
];
