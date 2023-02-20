export type Feature = {
  title?: string;
  package?: string;
  field?: string;
  value?: string;
  required?: boolean;
  version?: string;
  addons?: Feature[];
  choices?: Feature[];
  external?: boolean;
  context?: Record<string, unknown>;
  default?: string;
};

export const FEATURES: Feature[] = [
  {
    title: 'Package Manager',
    choices: [
      { title: 'NPM', field: 'packageManager', value: 'npm' },
      { title: 'Yarn', field: 'packageManager', value: 'yarn' }
    ],
    required: true,
    default: 'npm'
  },
  {
    title: 'Rest Framework',
    package: '@travetto/rest',
    choices: [
      { title: 'Express.js', package: '@travetto/rest-express' },
      { title: 'Express.js Lambda', package: '@travetto/rest-express-lambda' },
      { title: 'KOA', package: '@travetto/rest-koa' },
      { title: 'KOA Lambda', package: '@travetto/rest-koa-lambda' },
      { title: 'Fastify', package: '@travetto/rest-fastify' },
      { title: 'Fastify Lambda', package: '@travetto/rest-fastify-lambda' },
    ],
    addons: [
      { title: 'OpenAPI', package: '@travetto/openapi' },
      { title: 'Logging', package: '@travetto/log' }
    ],
    default: 'Express.js'
  },
  { title: 'Test Framework', package: '@travetto/test' },
  { title: 'ESLint Support', package: '@travetto/eslint' },
  {
    title: 'Rest Authentication',
    package: '@travetto/auth-rest',
    addons: [
      { title: 'Rest Session', package: '@travetto/rest-session', addons: [{ package: '@travetto/auth-rest-session' }] },
      { title: 'Context', package: '@travetto/auth-rest-session' }
    ]
  },
  {
    title: 'Data Modelling',
    package: '@travetto/model',
    choices: [
      { title: 'Elasticsearch', package: '@travetto/model-elasticsearch' },
      { title: 'MongoDB', package: '@travetto/model-mongo' },
      { title: 'MySQL', package: '@travetto/model-mysql' },
      { title: 'PostgreSQL', package: '@travetto/model-postgres' },
      { title: 'SQLite', package: '@travetto/model-sqlite' }
    ],
    default: 'MongoDB'
  },
];