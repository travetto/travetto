export interface Mapping {
  module: string;
  title?: string;
  tag?: string;
  children?: Mapping[];
  component?: string;
  list?: boolean;
}

export const MAPPING: Mapping[] = [
  {
    module: 'overview',
    title: 'Overview',
    component: 'OverviewComponent',
    list: false,
    children: [{
      module: 'module-chart', component: 'ModuleChartComponent', title: ' '
    }]
  },
  { module: 'cli' },
  { module: 'vscode-plugin' },
  { module: 'generator-app' },
  {
    module: 'config',
    children: [{ module: 'yaml', title: 'Simple YAML Parser' }]
  },
  { module: 'app' },
  { module: 'di' },
  { module: 'schema' },
  {
    module: 'model',
    children: [
      { module: 'model-elasticsearch' },
      { module: 'model-mongo' },
      { module: 'model-sql' }
    ]
  },
  {
    module: 'rest',
    children: [
      { module: 'openapi' },
      { module: 'rest-session' },
      { module: 'rest-express' },
      { module: 'rest-koa' },
      { module: 'rest-fastify' },
      { module: 'rest-aws-lambda' },
    ]
  },
  {
    module: 'core',
    title: 'System Components',
    component: 'CoreComponent',
    children: [
      { module: 'boot' },
      { module: 'base' },
      { module: 'compiler' },
      { module: 'context' },
      { module: 'registry' }
    ]
  },
  {
    module: 'test',
    children: []
  },
  {
    module: 'utils',
    title: 'App Utilities',
    component: 'UtilsComponent',
    children: [
      { module: 'log' },
      { module: 'cache' },
      { module: 'command' },
      { module: 'worker' },
      { module: 'net' },
      { module: 'watch' }
    ]
  },
  {
    module: 'asset',
    children: [
      { module: 'asset-mongo' },
      { module: 'asset-s3' },
      { module: 'asset-rest' },
    ]
  },
  {
    module: 'auth',
    children: [
      { module: 'auth-model' },
      { module: 'auth-rest' },
      { module: 'auth-passport' },
      { module: 'jwt' }
    ]
  },
  {
    module: 'email',
    children: [
      { module: 'email-template' }
    ]
  }
];
