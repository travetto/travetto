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
      { title: 'KOA', npm: '@travetto/rest-koa' },
      { title: 'Fastify', npm: '@travetto/rest-fastify' },
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
    addons: [{ title: 'Rest Session', npm: '@travetto/rest-session' }]
  },
  {
    title: 'Data Modelling',
    npm: '@travetto/model',
    choices: [
      { title: 'Elasticsearch', npm: '@travetto/model-elasticsearch' },
      { title: 'MongoDB', npm: '@travetto/model-mongo' },
      { title: 'MySQL', npm: '@travetto/model-sql', addons: [{ npm: 'mysql' }] },
      { title: 'PostgreSQL', npm: '@travetto/model-sql', addons: [{ npm: 'pg' }] }
    ],
    default: 'MongoDB'
  },
];