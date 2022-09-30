export type Feature = {
  title?: string;
  npm: string;
  version?: string;
  addons?: Feature[];
  choices?: Feature[];
  external?: boolean;
  context?: Record<string, unknown>;
  default?: string;
};

export const FEATURES: Feature[] = [
  {
    title: 'Rest Framework',
    npm: '@travetto/rest',
    choices: [
      { title: 'Express.js', npm: '@travetto/rest-express' },
      { title: 'Express.js Lambda', npm: '@travetto/rest-express-lambda' },
      { title: 'KOA', npm: '@travetto/rest-koa' },
      { title: 'KOA Lambda', npm: '@travetto/rest-koa-lambda' },
      { title: 'Fastify', npm: '@travetto/rest-fastify' },
      { title: 'Fastify Lambda', npm: '@travetto/rest-fastify-lambda' },
    ],
    addons: [
      { title: 'OpenAPI', npm: '@travetto/openapi' },
      { title: 'Logging', npm: '@travetto/log' }
    ],
    default: 'Express.js'
  },
  { title: 'Test Framework', npm: '@travetto/test' },
  {
    title: 'Rest Authentication',
    npm: '@travetto/auth-rest',
    addons: [
      { title: 'Rest Session', npm: '@travetto/rest-session', addons: [{ npm: '@travetto/auth-rest-session' }] },
      { title: 'Context', npm: '@travetto/auth-rest-session' }
    ]
  },
  {
    title: 'Data Modelling',
    npm: '@travetto/model',
    choices: [
      { title: 'Elasticsearch', npm: '@travetto/model-elasticsearch' },
      { title: 'MongoDB', npm: '@travetto/model-mongo' },
      { title: 'MySQL', npm: '@travetto/model-mysql' },
      { title: 'PostgreSQL', npm: '@travetto/model-postgres' },
      { title: 'SQLite', npm: '@travetto/model-sqlite' }
    ],
    default: 'MongoDB'
  },
];