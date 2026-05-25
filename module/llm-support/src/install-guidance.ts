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
    id: 'auth-google-passport-web',
    title: 'Google OAuth with Passport (Web)',
    required: [
      '@travetto/web',
      '@travetto/auth',
      '@travetto/auth-web',
      '@travetto/auth-web-passport',
      '@travetto/config',
      'passport',
      'passport-google-oauth20'
    ],
    optional: ['@travetto/model', '@travetto/model-indexed', '@travetto/model-firestore', '@travetto/auth-model'],
    notes: [
      'Define google.auth config fields (clientID, clientSecret, callbackUrl) and bind with @Config.',
      'Register a PassportAuthenticator using OAuth2Strategy and map profile -> principal details.',
      'If persisting principals by external id, add one model adapter (for example @travetto/model-firestore) and an indexed lookup.'
    ]
  },
  {
    id: 'model-persistence-stack',
    title: 'Model Persistence Stack',
    required: ['@travetto/model'],
    optional: [
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
      '@travetto/model-elasticsearch',
      '@travetto/model-query-language'
    ],
    notes: [
      'Pick one adapter family first (SQL or non-SQL), then select one primary adapter package for your datastore target.',
      'Use needs-driven adapter selection (blob/query/indexed/expiry) to narrow non-SQL options before finalizing a package.',
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
  },
  {
    id: 'quality-lint-and-test',
    title: 'Quality Setup (Lint + Test)',
    required: ['@travetto/test', '@travetto/eslint'],
    optional: ['@travetto/log'],
    notes: [
      'Use this bundle for project quality guardrails and lint-fix workflows.',
      'Pair with generated operation plans so every new feature ships with test and lint coverage.'
    ]
  },
  {
    id: 'web-auth-session-stack',
    title: 'Web Auth + Session Stack',
    required: [
      '@travetto/web',
      '@travetto/auth',
      '@travetto/auth-web',
      '@travetto/auth-session',
      '@travetto/auth-web-session',
      '@travetto/model-memory'
    ],
    optional: ['@travetto/model', '@travetto/model-indexed'],
    notes: [
      'Use this bundle for login/self/logout flows with session-backed identity.',
      'Use model-memory for local session storage unless a persistent session store is required.'
    ]
  },
  {
    id: 'web-model-crud',
    title: 'Web + Model CRUD',
    required: ['@travetto/web', '@travetto/model', '@travetto/model-query', '@travetto/schema', '@travetto/di'],
    optional: ['@travetto/auth', '@travetto/auth-web', '@travetto/model-indexed'],
    notes: [
      'Use this bundle when creating route/controller/service flows backed by model-query.',
      'Add auth/auth-web when CRUD endpoints should be principal-scoped.'
    ]
  },
  {
    id: 'model-backend-selection',
    title: 'Model Backend Selection',
    required: ['@travetto/model'],
    optional: [
      '@travetto/model-elasticsearch',
      '@travetto/model-mongo',
      '@travetto/model-sql',
      '@travetto/model-mysql',
      '@travetto/model-postgres',
      '@travetto/model-sqlite'
    ],
    notes: [
      'Use this bundle to drive backend selection prompts for datastore adapters.',
      'Choose exactly one backend adapter for active datastore target.'
    ]
  },
  {
    id: 'email-generation-stack',
    title: 'Email Generation + Delivery',
    required: ['@travetto/email'],
    optional: ['@travetto/email-compiler', '@travetto/email-inky', '@travetto/email-nodemailer', '@travetto/worker'],
    notes: [
      'Use this bundle when generating templates, compiler pipelines, and transport wiring.',
      'Add worker when routing send operations through async background execution.'
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
