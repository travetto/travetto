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
  { title: 'Logging', package: '@travetto/log', required: true },
  {
    title: 'Web Framework',
    package: '@travetto/web',
    addons: [
      { title: 'Web Http Server', package: '@travetto/web-http', required: true },
      { title: 'OpenAPI', package: '@travetto/openapi', required: true },
      {
        title: 'Web Authentication',
        package: ['@travetto/auth-web', '@travetto/auth'],
        addons: [
          { title: 'Session Support', package: ['@travetto/auth-session', '@travetto/auth-web-session', '@travetto/model-memory'] },
        ]
      },
    ]
  },
  { title: 'Test Framework', package: '@travetto/test' },
  { title: 'ESLint Support', package: '@travetto/eslint' },
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