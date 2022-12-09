import { node } from './nodes';

const MAPPING = {
  App: {
    name: '@travetto/app', folder: 'module/app', displayName: 'Application',
    description: 'Application registration/management and run support.'
  },
  Asset: {
    name: '@travetto/asset', folder: 'module/asset', displayName: 'Asset',
    description: 'Modular library for storing and retrieving binary assets'
  },
  AssetRest: {
    name: '@travetto/asset-rest', folder: 'module/asset-rest', displayName: 'Asset Rest Support',
    description: 'Provides integration between the travetto asset and rest module.'
  },
  Auth: {
    name: '@travetto/auth', folder: 'module/auth', displayName: 'Authentication',
    description: 'Authentication scaffolding for the travetto framework'
  },
  AuthModel: {
    name: '@travetto/auth-model', folder: 'module/auth-model', displayName: 'Authentication Model',
    description: 'Authentication model support for the travetto framework'
  },
  AuthRest: {
    name: '@travetto/auth-rest', folder: 'module/auth-rest', displayName: 'Rest Auth',
    description: 'Rest authentication integration support for the travetto framework'
  },
  AuthRestContext: {
    name: '@travetto/auth-rest-context', folder: 'module/auth-rest-context', displayName: 'Rest Auth Context',
    description: 'Rest authentication context integration support for the travetto framework'
  },
  AuthRestJwt: {
    name: '@travetto/auth-rest-jwt', folder: 'module/auth-rest-jwt', displayName: 'Rest Auth JWT',
    description: 'Rest authentication JWT integration support for the travetto framework'
  },
  AuthRestPassport: {
    name: '@travetto/auth-rest-passport', folder: 'module/auth-rest-passport', displayName: 'Rest Auth Passport',
    description: 'Rest authentication integration support for the travetto framework'
  },
  AuthRestSession: {
    name: '@travetto/auth-rest-session', folder: 'module/auth-rest-session', displayName: 'Rest Auth Session',
    description: 'Rest authentication session integration support for the travetto framework'
  },
  Base: {
    name: '@travetto/base', folder: 'module/base', displayName: 'Base',
    description: 'Environment config and common utilities for travetto applications.'
  },
  Cache: {
    name: '@travetto/cache', folder: 'module/cache', displayName: 'Caching',
    description: 'Caching functionality with decorators for declarative use.'
  },
  Cli: {
    name: '@travetto/cli', folder: 'module/cli', displayName: 'Command Line Interface',
    description: 'CLI infrastructure for travetto framework'
  },
  Command: {
    name: '@travetto/command', folder: 'module/command', displayName: 'Command',
    description: 'Support for executing complex commands at runtime.'
  },
  Compiler: {
    name: '@travetto/compiler', folder: 'module/compiler', displayName: 'Compiler',
    description: 'Compiler'
  },
  Config: {
    name: '@travetto/config', folder: 'module/config', displayName: 'Configuration',
    description: 'Configuration support'
  },
  Context: {
    name: '@travetto/context', folder: 'module/context', displayName: 'Async Context',
    description: 'Async-aware state management, maintaining context across asynchronous calls.'
  },
  Di: {
    name: '@travetto/di', folder: 'module/di', displayName: 'Dependency Injection',
    description: 'Dependency registration/management and injection support.'
  },
  Doc: {
    name: '@travetto/doc', folder: 'module/doc', displayName: 'Documentation',
    description: 'Documentation support for the travetto framework'
  },
  Email: {
    name: '@travetto/email', folder: 'module/email', displayName: 'Email',
    description: 'Email transmission module.'
  },
  EmailNodemailer: {
    name: '@travetto/email-nodemailer', folder: 'module/email-nodemailer', displayName: 'Email Nodemailer Support',
    description: 'Email transmission module.'
  },
  EmailTemplate: {
    name: '@travetto/email-template', folder: 'module/email-template', displayName: 'Email Templating',
    description: 'Email templating module'
  },
  Image: {
    name: '@travetto/image', folder: 'module/image', displayName: 'Image',
    description: 'Image support, resizing, and optimization'
  },
  Jwt: {
    name: '@travetto/jwt', folder: 'module/jwt', displayName: 'JWT',
    description: 'JSON Web Token implementation'
  },
  Log: {
    name: '@travetto/log', folder: 'module/log', displayName: 'Logging',
    description: 'Logging framework that integrates at the console.log level.'
  },
  Manifest: {
    name: '@travetto/manifest', folder: 'module/manifest', displayName: 'Manifest',
    description: 'Manifest support'
  },
  Model: {
    name: '@travetto/model', folder: 'module/model', displayName: 'Data Modeling Support',
    description: 'Datastore abstraction for core operations.'
  },
  ModelDynamodb: {
    name: '@travetto/model-dynamodb', folder: 'module/model-dynamodb', displayName: 'DynamoDB Model Support',
    description: 'DynamoDB backing for the travetto model module.'
  },
  ModelElasticsearch: {
    name: '@travetto/model-elasticsearch', folder: 'module/model-elasticsearch', displayName: 'Elasticsearch Model Source',
    description: 'Elasticsearch backing for the travetto model module, with real-time modeling support for Elasticsearch mappings.'
  },
  ModelFirestore: {
    name: '@travetto/model-firestore', folder: 'module/model-firestore', displayName: 'Firestore Model Support',
    description: 'Firestore backing for the travetto model module.'
  },
  ModelMongo: {
    name: '@travetto/model-mongo', folder: 'module/model-mongo', displayName: 'MongoDB Model Support',
    description: 'Mongo backing for the travetto model module.'
  },
  ModelMysql: {
    name: '@travetto/model-mysql', folder: 'module/model-mysql', displayName: 'MySQL Model Service',
    description: 'MySQL backing for the travetto model module, with real-time modeling support for SQL schemas.'
  },
  ModelPostgres: {
    name: '@travetto/model-postgres', folder: 'module/model-postgres', displayName: 'PostgreSQL Model Service',
    description: 'PostgreSQL backing for the travetto model module, with real-time modeling support for SQL schemas.'
  },
  ModelQuery: {
    name: '@travetto/model-query', folder: 'module/model-query', displayName: 'Data Model Querying',
    description: 'Datastore abstraction for advanced query support.'
  },
  ModelRedis: {
    name: '@travetto/model-redis', folder: 'module/model-redis', displayName: 'Redis Model Support',
    description: 'Redis backing for the travetto model module.'
  },
  ModelS3: {
    name: '@travetto/model-s3', folder: 'module/model-s3', displayName: 'S3 Model Support',
    description: 'S3 backing for the travetto model module.'
  },
  ModelSql: {
    name: '@travetto/model-sql', folder: 'module/model-sql', displayName: 'SQL Model Service',
    description: 'SQL backing for the travetto model module, with real-time modeling support for SQL schemas.'
  },
  ModelSqlite: {
    name: '@travetto/model-sqlite', folder: 'module/model-sqlite', displayName: 'SQLite Model Service',
    description: 'SQLite backing for the travetto model module, with real-time modeling support for SQL schemas.'
  },
  Openapi: {
    name: '@travetto/openapi', folder: 'module/openapi', displayName: 'OpenAPI Specification',
    description: 'OpenAPI integration support for the travetto framework'
  },
  Pack: {
    name: '@travetto/pack', folder: 'module/pack', displayName: 'Pack',
    description: 'Code packing utilities'
  },
  Registry: {
    name: '@travetto/registry', folder: 'module/registry', displayName: 'Registry',
    description: 'Patterns and utilities for handling registration of metadata and functionality for run-time use'
  },
  Repo: {
    name: '@travetto/repo', folder: 'module/repo', displayName: 'Repo',
    description: 'Monorepo utilities'
  },
  Rest: {
    name: '@travetto/rest', folder: 'module/rest', displayName: 'RESTful API',
    description: 'Declarative api for RESTful APIs with support for the dependency injection module.'
  },
  RestAwsLambda: {
    name: '@travetto/rest-aws-lambda', folder: 'module/rest-aws-lambda', displayName: 'RESTful AWS Lambda',
    description: 'RESTful APIs entry point support for AWS Lambdas.'
  },
  RestExpress: {
    name: '@travetto/rest-express', folder: 'module/rest-express', displayName: 'Express REST Source',
    description: 'Express provider for the travetto rest module.'
  },
  RestExpressLambda: {
    name: '@travetto/rest-express-lambda', folder: 'module/rest-express-lambda', displayName: 'Express REST AWS Lambda Source',
    description: 'Express AWS Lambda provider for the travetto rest module.'
  },
  RestFastify: {
    name: '@travetto/rest-fastify', folder: 'module/rest-fastify', displayName: 'Fastify REST Source',
    description: 'Fastify provider for the travetto rest module.'
  },
  RestFastifyLambda: {
    name: '@travetto/rest-fastify-lambda', folder: 'module/rest-fastify-lambda', displayName: 'Fastify REST AWS Lambda Source',
    description: 'Fastify AWS Lambda provider for the travetto rest module.'
  },
  RestKoa: {
    name: '@travetto/rest-koa', folder: 'module/rest-koa', displayName: 'Koa REST Source',
    description: 'Koa provider for the travetto rest module.'
  },
  RestKoaLambda: {
    name: '@travetto/rest-koa-lambda', folder: 'module/rest-koa-lambda', displayName: 'Koa REST AWS Lambda Source',
    description: 'Koa provider for the travetto rest module.'
  },
  RestModel: {
    name: '@travetto/rest-model', folder: 'module/rest-model', displayName: 'RESTful Model Routes',
    description: 'RESTful support for generating APIs from Model classes.'
  },
  RestModelQuery: {
    name: '@travetto/rest-model-query', folder: 'module/rest-model-query', displayName: 'RESTful Model Query Routes',
    description: 'RESTful support for generating query APIs from Model classes.'
  },
  RestSession: {
    name: '@travetto/rest-session', folder: 'module/rest-session', displayName: 'REST Session',
    description: 'Session provider for the travetto rest module.'
  },
  Scaffold: {
    name: '@travetto/scaffold', folder: 'module/scaffold', displayName: 'App Scaffold',
    description: 'App Scaffold for the Travetto framework'
  },
  Schema: {
    name: '@travetto/schema', folder: 'module/schema', displayName: 'Schema',
    description: 'Data type registry for runtime validation, reflection and binding.'
  },
  SchemaFaker: {
    name: '@travetto/schema-faker', folder: 'module/schema-faker', displayName: 'Schema Faker',
    description: 'Data generation for schema-registered objects.'
  },
  Test: {
    name: '@travetto/test', folder: 'module/test', displayName: 'Testing',
    description: 'Declarative test framework'
  },
  TodoApp: {
    name: '@travetto/todo-app', folder: 'related/todo-app', displayName: 'Todo Application',
    description: ''
  },
  Transformer: {
    name: '@travetto/transformer', folder: 'module/transformer', displayName: 'Transformation',
    description: 'Functionality for AST transformations, with transformer registration, and general utils'
  },
  Worker: {
    name: '@travetto/worker', folder: 'module/worker', displayName: 'Worker',
    description: 'Process management utilities, with a focus on inter-process communication'
  },
  Yaml: {
    name: '@travetto/yaml', folder: 'module/yaml', displayName: 'YAML',
    description: 'Simple YAML support, provides only clean subset of yaml'
  }
};

export const mod = Object.fromEntries(
  Object.entries(MAPPING).map(([k, v]) => [k, node.Mod(v.name, v)])
);