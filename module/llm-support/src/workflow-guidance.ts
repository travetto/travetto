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
    id: 'project-bootstrap',
    title: 'Bootstrap a new project',
    intent: 'Create a project baseline using guided prompts for model backend, quality, and initial web stack.',
    recommendedModules: ['@travetto/web', '@travetto/web-http', '@travetto/openapi', '@travetto/runtime', '@travetto/config'],
    optionalModules: ['@travetto/schema', '@travetto/di', '@travetto/model', '@travetto/test', '@travetto/eslint'],
    commandDiscoveryRule: 'Validate command signatures with npx trv cli:schema before suggesting starter commands.',
    verification: [
      'Ensure generated project includes selected web and model modules from prompt answers.',
      'Ensure generated package scripts include startup, test, and lint commands when selected.'
    ]
  },
  {
    id: 'create-web-route',
    title: 'Create route/controller/service',
    intent: 'Generate web route handlers with controller and service separation, aligned with schema and DI conventions.',
    recommendedModules: ['@travetto/web', '@travetto/schema', '@travetto/di'],
    optionalModules: ['@travetto/auth', '@travetto/auth-web', '@travetto/model-query'],
    commandDiscoveryRule: 'Validate web and schema command references with npx trv cli:schema before publishing examples.',
    verification: [
      'Ensure route methods use controller decorators and typed parameter bindings.',
      'Ensure service wiring uses @Injectable and @Inject patterns.'
    ]
  },
  {
    id: 'enable-auth-session',
    title: 'Enable auth with sessions',
    intent: 'Configure login/self/logout with session-backed identity in local memory.',
    recommendedModules: ['@travetto/auth', '@travetto/auth-web', '@travetto/auth-session', '@travetto/auth-web-session', '@travetto/model-memory'],
    optionalModules: ['@travetto/model', '@travetto/model-indexed', '@travetto/web'],
    commandDiscoveryRule: 'Validate auth-web decorators and auth command references with npx trv cli:schema before publishing examples.',
    verification: [
      'Ensure auth config exposes authenticator, authorizer, and session store factories.',
      'Ensure /auth/login, /auth/self, and /auth/logout routes are registered and session-aware.'
    ]
  },
  {
    id: 'generate-web-model-crud',
    title: 'Generate web-model CRUD API',
    intent: 'Generate web + model CRUD patterns from curated templates and adapt to domain classes.',
    recommendedModules: ['@travetto/web', '@travetto/model', '@travetto/model-query', '@travetto/schema', '@travetto/di'],
    optionalModules: ['@travetto/auth', '@travetto/auth-web', '@travetto/model-indexed'],
    commandDiscoveryRule: 'Validate web/controller command references and generated route assumptions with npx trv cli:schema.',
    verification: [
      'Ensure controller CRUD methods bind to a model-query capable source.',
      'Ensure principal-scoped filtering is applied when auth-web integration is enabled.'
    ]
  },
  {
    id: 'model-backend-selection',
    title: 'Model backend selection',
    intent: 'Choose one supported datastore adapter and align model service/config classes.',
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
      'Ensure selected adapter is supported and matches deployment datastore target.',
      'Ensure SQL-family selections include shared SQL runtime package requirements.'
    ]
  },
  {
    id: 'quality-lint-and-test',
    title: 'Enable lint and test quality checks',
    intent: 'Enable quality features so generated projects have immediate test and lint feedback loops.',
    recommendedModules: ['@travetto/test', '@travetto/eslint'],
    optionalModules: [],
    commandDiscoveryRule: 'Validate test and lint command examples with npx trv cli:schema or generated package scripts before suggesting execution.',
    verification: [
      'Ensure generated package scripts include test and lint commands when selected.',
      'Run test and lint once after generation to catch template/config drift early.'
    ]
  },
  {
    id: 'add-email-generation',
    title: 'Add email generation and delivery',
    intent: 'Generate template, schema contract, compiler pipeline, provider wiring, and send integration for email flows.',
    recommendedModules: ['@travetto/email'],
    optionalModules: ['@travetto/email-compiler', '@travetto/email-inky', '@travetto/email-nodemailer', '@travetto/worker'],
    commandDiscoveryRule: 'Validate command signatures with npx trv cli:schema before recommending email generation commands.',
    verification: [
      'Ensure generated template context has a typed schema contract.',
      'Ensure renderer and transport wiring are both validated by tests or snapshots.',
      'Ensure send integration supports direct and worker-based execution paths.'
    ]
  },
  {
    id: 'openapi-spec-pipeline',
    title: 'Add OpenAPI spec pipeline',
    intent: 'Generate and persist OpenAPI specs as build artifacts and optionally commit outputs.',
    recommendedModules: ['@travetto/openapi', '@travetto/web', '@travetto/schema'],
    optionalModules: ['@travetto/cli'],
    commandDiscoveryRule: 'Validate OpenAPI command signatures with npx trv cli:schema before recommending command invocations.',
    verification: [
      'Ensure openapi:spec output path and format match repository conventions.',
      'Ensure generated spec is available as CI artifact for downstream use.'
    ]
  },
  {
    id: 'openapi-client-generation',
    title: 'Add OpenAPI client generation workflow',
    intent: 'Generate API clients from OpenAPI artifacts and keep them synchronized with endpoint changes.',
    recommendedModules: ['@travetto/openapi'],
    optionalModules: ['@travetto/web-rpc', '@travetto/web'],
    commandDiscoveryRule: 'Validate openapi:client command signatures with npx trv cli:schema before recommending formats or arguments.',
    verification: [
      'Ensure generated client output location is stable and committed when required.',
      'Ensure workflow runs after spec generation and fails fast on generator errors.'
    ]
  },
  {
    id: 'aws-lambda-package-and-deploy',
    title: 'Add AWS Lambda package and deploy workflow',
    intent: 'Package web entrypoint for AWS Lambda and deploy artifacts through CI.',
    recommendedModules: ['@travetto/web-aws-lambda', '@travetto/pack'],
    optionalModules: ['@travetto/web', '@travetto/config'],
    commandDiscoveryRule: 'Validate pack:lambda command signatures with npx trv cli:schema before recommending packaging flags.',
    verification: [
      'Ensure lambda package artifact is produced and published by CI.',
      'Ensure workflow includes environment-specific deploy step stubs.'
    ]
  },
  {
    id: 'pack-docker-release',
    title: 'Add Docker pack release workflow',
    intent: 'Build and publish container images from Travetto pack:docker in CI.',
    recommendedModules: ['@travetto/pack'],
    optionalModules: ['@travetto/runtime', '@travetto/config'],
    commandDiscoveryRule: 'Validate pack:docker command signatures with npx trv cli:schema before recommending image/tag flags.',
    verification: [
      'Ensure image tags, registry targets, and build platform inputs are explicit.',
      'Ensure workflow supports dry runs or stage-only builds for PR validation.'
    ]
  },
  {
    id: 'repo-version-release',
    title: 'Add repo version release flow',
    intent: 'Automate monorepo versioning with change-aware release mode and optional tagging.',
    recommendedModules: ['@travetto/repo'],
    optionalModules: ['@travetto/registry', '@travetto/pack'],
    commandDiscoveryRule: 'Validate repo:version and repo:publish command signatures with npx trv cli:schema before suggesting release automation.',
    verification: [
      'Ensure release mode and semver level are explicit and reviewed in CI inputs.',
      'Ensure release commits and tags align with repository policy.'
    ]
  }
];
