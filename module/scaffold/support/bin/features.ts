export type Feature = {
  title?: string;
  package?: string | string[];
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
    title: 'Web Framework',
    package: '@travetto/web',
    choices: [
      { title: 'Express.js', package: '@travetto/web-express' },
      { title: 'Express.js Lambda', package: '@travetto/web-express-lambda' },
      { title: 'KOA', package: '@travetto/web-koa' },
      { title: 'KOA Lambda', package: '@travetto/web-koa-lambda' },
      { title: 'Fastify', package: '@travetto/web-fastify' },
      { title: 'Fastify Lambda', package: '@travetto/web-fastify-lambda' },
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
    title: 'Web Authentication',
    package: '@travetto/auth-web',
    addons: [
      { title: 'Session Support', package: ['@travetto/auth-session', '@travetto/auth-web-session', '@travetto/model-memory'] },
    ]
  },
  {
    title: 'Data Modelling',
    package: '@travetto/model',
    choices: [
      {
        title: 'Elasticsearch', package: '@travetto/model-elasticsearch',
        context: { modelService: 'ElasticsearchModelService', modelConfig: 'ElasticsearchModelConfig', modelImport: '@travetto/model-elasticsearch' }
      },
      {
        title: 'MongoDB', package: '@travetto/model-mongo',
        context: { modelService: 'MongoModelService', modelConfig: 'MongoModelConfig', modelImport: '@travetto/model-mongo' }
      },
      {
        title: 'MySQL', package: '@travetto/model-mysql',
        context: { modelService: 'SQLModelService', modelConfig: 'SQLModelConfig', modelImport: '@travetto/model-sql' }
      },
      {
        title: 'PostgreSQL', package: '@travetto/model-postgres',
        context: { modelService: 'SQLModelService', modelConfig: 'SQLModelConfig', modelImport: '@travetto/model-sql' }
      },
      {
        title: 'SQLite', package: '@travetto/model-sqlite',
        context: { modelService: 'SQLModelService', modelConfig: 'SQLModelConfig', modelImport: '@travetto/model-sql' }
      }
    ],
    default: 'MongoDB'
  },
];