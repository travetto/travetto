export const MOD_MAPPING = {
  Auth: {
    name: '@travetto/auth', folder: '@travetto/auth', displayName: 'Authentication',
    description: 'Authentication scaffolding for the Travetto framework'
  },
  AuthModel: {
    name: '@travetto/auth-model', folder: '@travetto/auth-model', displayName: 'Authentication Model',
    description: 'Authentication model support for the Travetto framework'
  },
  AuthRest: {
    name: '@travetto/auth-rest', folder: '@travetto/auth-rest', displayName: 'Rest Auth',
    description: 'Rest authentication integration support for the Travetto framework'
  },
  AuthRestPassport: {
    name: '@travetto/auth-rest-passport', folder: '@travetto/auth-rest-passport', displayName: 'Rest Auth Passport',
    description: 'Rest authentication integration support for the Travetto framework'
  },
  AuthRestSession: {
    name: '@travetto/auth-rest-session', folder: '@travetto/auth-rest-session', displayName: 'Rest Auth Session',
    description: 'Rest authentication session integration support for the Travetto framework'
  },
  AuthSession: {
    name: '@travetto/auth-session', folder: '@travetto/auth-session', displayName: 'Auth Session',
    description: 'Session provider for the travetto auth module.'
  },
  Cache: {
    name: '@travetto/cache', folder: '@travetto/cache', displayName: 'Caching',
    description: 'Caching functionality with decorators for declarative use.'
  },
  Cli: {
    name: '@travetto/cli', folder: '@travetto/cli', displayName: 'Command Line Interface',
    description: 'CLI infrastructure for Travetto framework'
  },
  Compiler: {
    name: '@travetto/compiler', folder: '@travetto/compiler', displayName: 'Compiler',
    description: 'The compiler infrastructure for the Travetto framework'
  },
  Config: {
    name: '@travetto/config', folder: '@travetto/config', displayName: 'Configuration',
    description: 'Configuration support'
  },
  Context: {
    name: '@travetto/context', folder: '@travetto/context', displayName: 'Async Context',
    description: 'Async-aware state management, maintaining context across asynchronous calls.'
  },
  Di: {
    name: '@travetto/di', folder: '@travetto/di', displayName: 'Dependency Injection',
    description: 'Dependency registration/management and injection support.'
  },
  Doc: {
    name: '@travetto/doc', folder: '@travetto/doc', displayName: 'Documentation',
    description: 'Documentation support for the Travetto framework'
  },
  Email: {
    name: '@travetto/email', folder: '@travetto/email', displayName: 'Email',
    description: 'Email transmission module.'
  },
  EmailCompiler: {
    name: '@travetto/email-compiler', folder: '@travetto/email-compiler', displayName: 'Email Compilation Support',
    description: 'Email compiling module'
  },
  EmailInky: {
    name: '@travetto/email-inky', folder: '@travetto/email-inky', displayName: 'Email Inky Templates',
    description: 'Email Inky templating module'
  },
  EmailNodemailer: {
    name: '@travetto/email-nodemailer', folder: '@travetto/email-nodemailer', displayName: 'Email Nodemailer Support',
    description: 'Email transmission module.'
  },
  Eslint: {
    name: '@travetto/eslint', folder: '@travetto/eslint', displayName: 'ES Linting Rules',
    description: 'ES Linting Rules'
  },
  Image: {
    name: '@travetto/image', folder: '@travetto/image', displayName: 'Image',
    description: 'Image support, resizing, and optimization'
  },
  Log: {
    name: '@travetto/log', folder: '@travetto/log', displayName: 'Logging',
    description: 'Logging framework that integrates at the console.log level.'
  },
  Manifest: {
    name: '@travetto/manifest', folder: '@travetto/manifest', displayName: 'Manifest',
    description: 'Support for project indexing, manifesting, along with file watching'
  },
  Model: {
    name: '@travetto/model', folder: '@travetto/model', displayName: 'Data Modeling Support',
    description: 'Datastore abstraction for core operations.'
  },
  ModelDynamodb: {
    name: '@travetto/model-dynamodb', folder: '@travetto/model-dynamodb', displayName: 'DynamoDB Model Support',
    description: 'DynamoDB backing for the travetto model module.'
  },
  ModelElasticsearch: {
    name: '@travetto/model-elasticsearch', folder: '@travetto/model-elasticsearch', displayName: 'Elasticsearch Model Source',
    description: 'Elasticsearch backing for the travetto model module, with real-time modeling support for Elasticsearch mappings.'
  },
  ModelFile: {
    name: '@travetto/model-file', folder: '@travetto/model-file', displayName: 'File Model Support',
    description: 'File system backing for the travetto model module.'
  },
  ModelFirestore: {
    name: '@travetto/model-firestore', folder: '@travetto/model-firestore', displayName: 'Firestore Model Support',
    description: 'Firestore backing for the travetto model module.'
  },
  ModelMemory: {
    name: '@travetto/model-memory', folder: '@travetto/model-memory', displayName: 'Memory Model Support',
    description: 'Memory backing for the travetto model module.'
  },
  ModelMongo: {
    name: '@travetto/model-mongo', folder: '@travetto/model-mongo', displayName: 'MongoDB Model Support',
    description: 'Mongo backing for the travetto model module.'
  },
  ModelMysql: {
    name: '@travetto/model-mysql', folder: '@travetto/model-mysql', displayName: 'MySQL Model Service',
    description: 'MySQL backing for the travetto model module, with real-time modeling support for SQL schemas.'
  },
  ModelPostgres: {
    name: '@travetto/model-postgres', folder: '@travetto/model-postgres', displayName: 'PostgreSQL Model Service',
    description: 'PostgreSQL backing for the travetto model module, with real-time modeling support for SQL schemas.'
  },
  ModelQuery: {
    name: '@travetto/model-query', folder: '@travetto/model-query', displayName: 'Data Model Querying',
    description: 'Datastore abstraction for advanced query support.'
  },
  ModelQueryLanguage: {
    name: '@travetto/model-query-language', folder: '@travetto/model-query-language', displayName: 'Data Model Query Language',
    description: 'Datastore query language.'
  },
  ModelRedis: {
    name: '@travetto/model-redis', folder: '@travetto/model-redis', displayName: 'Redis Model Support',
    description: 'Redis backing for the travetto model module.'
  },
  ModelS3: {
    name: '@travetto/model-s3', folder: '@travetto/model-s3', displayName: 'S3 Model Support',
    description: 'S3 backing for the travetto model module.'
  },
  ModelSql: {
    name: '@travetto/model-sql', folder: '@travetto/model-sql', displayName: 'SQL Model Service',
    description: 'SQL backing for the travetto model module, with real-time modeling support for SQL schemas.'
  },
  ModelSqlite: {
    name: '@travetto/model-sqlite', folder: '@travetto/model-sqlite', displayName: 'SQLite Model Service',
    description: 'SQLite backing for the travetto model module, with real-time modeling support for SQL schemas.'
  },
  Openapi: {
    name: '@travetto/openapi', folder: '@travetto/openapi', displayName: 'OpenAPI Specification',
    description: 'OpenAPI integration support for the Travetto framework'
  },
  Pack: {
    name: '@travetto/pack', folder: '@travetto/pack', displayName: 'Pack',
    description: 'Code packing utilities'
  },
  Registry: {
    name: '@travetto/registry', folder: '@travetto/registry', displayName: 'Registry',
    description: 'Patterns and utilities for handling registration of metadata and functionality for run-time use'
  },
  Repo: {
    name: '@travetto/repo', folder: '@travetto/repo', displayName: 'Repo',
    description: 'Monorepo utilities'
  },
  Rest: {
    name: '@travetto/rest', folder: '@travetto/rest', displayName: 'RESTful API',
    description: 'Declarative api for RESTful APIs with support for the dependency injection module.'
  },
  RestAwsLambda: {
    name: '@travetto/rest-aws-lambda', folder: '@travetto/rest-aws-lambda', displayName: 'RESTful AWS Lambda',
    description: 'RESTful APIs entry point support for AWS Lambdas.'
  },
  RestClient: {
    name: '@travetto/rest-client', folder: '@travetto/rest-client', displayName: 'RESTful Client Support',
    description: 'RESTful support for generating clients for controller endpoints'
  },
  RestExpress: {
    name: '@travetto/rest-express', folder: '@travetto/rest-express', displayName: 'Express REST Source',
    description: 'Express provider for the travetto rest module.'
  },
  RestExpressLambda: {
    name: '@travetto/rest-express-lambda', folder: '@travetto/rest-express-lambda', displayName: 'Express REST AWS Lambda Source',
    description: 'Express AWS Lambda provider for the travetto rest module.'
  },
  RestFastify: {
    name: '@travetto/rest-fastify', folder: '@travetto/rest-fastify', displayName: 'Fastify REST Source',
    description: 'Fastify provider for the travetto rest module.'
  },
  RestFastifyLambda: {
    name: '@travetto/rest-fastify-lambda', folder: '@travetto/rest-fastify-lambda', displayName: 'Fastify REST AWS Lambda Source',
    description: 'Fastify AWS Lambda provider for the travetto rest module.'
  },
  RestKoa: {
    name: '@travetto/rest-koa', folder: '@travetto/rest-koa', displayName: 'Koa REST Source',
    description: 'Koa provider for the travetto rest module.'
  },
  RestKoaLambda: {
    name: '@travetto/rest-koa-lambda', folder: '@travetto/rest-koa-lambda', displayName: 'Koa REST AWS Lambda Source',
    description: 'Koa provider for the travetto rest module.'
  },
  RestRpc: {
    name: '@travetto/rest-rpc', folder: '@travetto/rest-rpc', displayName: 'RESTful RPC Support',
    description: 'RESTful RPC support for a module'
  },
  RestUpload: {
    name: '@travetto/rest-upload', folder: '@travetto/rest-upload', displayName: 'Rest Upload Support',
    description: 'Provides integration between the travetto asset and rest module.'
  },
  Runtime: {
    name: '@travetto/runtime', folder: '@travetto/runtime', displayName: 'Runtime',
    description: 'Runtime for travetto applications.'
  },
  Scaffold: {
    name: '@travetto/scaffold', folder: '@travetto/scaffold', displayName: 'App Scaffold',
    description: 'App Scaffold for the Travetto framework'
  },
  Schema: {
    name: '@travetto/schema', folder: '@travetto/schema', displayName: 'Schema',
    description: 'Data type registry for runtime validation, reflection and binding.'
  },
  SchemaFaker: {
    name: '@travetto/schema-faker', folder: '@travetto/schema-faker', displayName: 'Schema Faker',
    description: 'Data generation for schema-registered objects.'
  },
  Terminal: {
    name: '@travetto/terminal', folder: '@travetto/terminal', displayName: 'Terminal',
    description: 'General terminal support'
  },
  Test: {
    name: '@travetto/test', folder: '@travetto/test', displayName: 'Testing',
    description: 'Declarative test framework'
  },
  TodoApp: {
    name: '@travetto/todo-app', folder: '@travetto/todo-app', displayName: 'Todo Application',
    description: ''
  },
  Transformer: {
    name: '@travetto/transformer', folder: '@travetto/transformer', displayName: 'Transformation',
    description: 'Functionality for AST transformations, with transformer registration, and general utils'
  },
  Worker: {
    name: '@travetto/worker', folder: '@travetto/worker', displayName: 'Worker',
    description: 'Process management utilities, with a focus on inter-process communication'
  }
};
