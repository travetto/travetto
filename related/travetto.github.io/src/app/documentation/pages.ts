import { Type } from '@angular/core';

export const PAGES = [
  {
    path: 'app', title: 'Application', subs: [
      {
        path: 'cache', title: 'Cache',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/cache/cache.component').then(m => m.CacheComponent)
      },
      {
        path: 'image', title: 'Image',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/image/image.component').then(m => m.ImageComponent)
      },
      {
        path: 'log', title: 'Log',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/log/log.component').then(m => m.LogComponent)
      },
      {
        path: 'context', title: 'Context',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/context/context.component').then(m => m.ContextComponent)
      },
      {
        path: 'schema-faker', title: 'Schema Faker',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/schema-faker/schema-faker.component').then(m => m.SchemaFakerComponent)
      },
    ]
  },
  {
    path: 'tools', title: 'Tools', subs: [
      {
        path: 'pack', title: 'Pack',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/pack/pack.component').then(m => m.PackComponent)
      },
      {
        path: 'eslint', title: 'ESLint Support',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/eslint/eslint.component').then(m => m.EslintComponent)
      },
      {
        path: 'scaffold', title: 'App Scaffold',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/scaffold/scaffold.component').then(m => m.ScaffoldComponent)
      },
      {
        path: 'vscode-plugin', title: 'VS Code Plugin',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/vscode-plugin/vscode-plugin.component').then(m => m.VSCodePluginComponent)
      }
    ]
  },
  {
    path: 'model', title: 'Model',
    loadComponent: (): Promise<Type<unknown>> => import('./gen/model/model.component').then(m => m.ModelComponent),
    subs: [
      {
        path: 'model-dynamodb', title: 'DynamoDB',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-dynamodb/model-dynamodb.component').then(m => m.ModelDynamodbComponent)
      },
      {
        path: 'model-elasticsearch', title: 'Elasticsearch',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-elasticsearch/model-elasticsearch.component').then(m => m.ModelElasticsearchComponent)
      },
      {
        path: 'model-file', title: 'File',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-file/model-file.component').then(m => m.ModelFileComponent)
      },
      {
        path: 'model-firestore', title: 'Firestore',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-firestore/model-firestore.component').then(m => m.ModelFirestoreComponent)
      },
      {
        path: 'model-memory', title: 'Memory',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-memory/model-memory.component').then(m => m.ModelMemoryComponent)
      },
      {
        path: 'model-mongo', title: 'Mongo',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-mongo/model-mongo.component').then(m => m.ModelMongoComponent)
      },
      {
        path: 'model-redis', title: 'Redis',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-redis/model-redis.component').then(m => m.ModelRedisComponent)
      },
      {
        path: 'model-s3', title: 'S3',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-s3/model-s3.component').then(m => m.ModelS3Component)
      },
      {
        path: 'model-sql', title: 'SQL',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-sql/model-sql.component').then(m => m.ModelSqlComponent)
      },
      {
        path: 'model-mysql', title: 'Mysql',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-mysql/model-mysql.component').then(m => m.ModelMysqlComponent)
      },
      {
        path: 'model-postgres', title: 'Postgres',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-postgres/model-postgres.component').then(m => m.ModelPostgresComponent)
      },
      {
        path: 'model-sqlite', title: 'Sqlite',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-sqlite/model-sqlite.component').then(m => m.ModelSqliteComponent)
      },
      {
        path: 'model-query', title: 'Query',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-query/model-query.component').then(m => m.ModelQueryComponent)
      },
      {
        path: 'model-query-language', title: 'Query Language',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-query-language/model-query-language.component').then(m => m.ModelQueryLanguageComponent)
      },
    ]
  },
  {
    path: 'rest', title: 'Rest',
    loadComponent: (): Promise<Type<unknown>> => import('./gen/rest/rest.component').then(m => m.RestComponent),
    subs: [
      {
        path: 'rest-express', title: 'Express',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/rest-express/rest-express.component').then(m => m.RestExpressComponent)
      },
      {
        path: 'rest-koa', title: 'Koa',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/rest-koa/rest-koa.component').then(m => m.RestKoaComponent)
      },
      {
        path: 'rest-fastify', title: 'Fastify',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/rest-fastify/rest-fastify.component').then(m => m.RestFastifyComponent)
      },
      {
        path: 'rest-aws-lambda', title: 'AWS Lambda',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/rest-aws-lambda/rest-aws-lambda.component').then(m => m.RestAwsLambdaComponent)
      },
      {
        path: 'rest-express-lambda', title: 'Express Lambda',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/rest-express-lambda/rest-express-lambda.component').then(m => m.RestExpressLambdaComponent)
      },
      {
        path: 'rest-koa-lambda', title: 'Koa Lambda',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/rest-koa-lambda/rest-koa-lambda.component').then(m => m.RestKoaLambdaComponent)
      },
      {
        path: 'rest-fastify-lambda', title: 'Fastify Lambda',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/rest-fastify-lambda/rest-fastify-lambda.component').then(m => m.RestFastifyLambdaComponent)
      },
      {
        path: 'rest-upload', title: 'Upload',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/rest-upload/rest-upload.component').then(m => m.RestUploadComponent)
      },
      {
        path: 'rest-rpc', title: 'Rest RPC',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/rest-rpc/rest-rpc.component').then(m => m.RestRpcComponent)
      },
      {
        path: 'openapi', title: 'OpenAPI',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/openapi/openapi.component').then(m => m.OpenapiComponent)
      },
      {
        path: 'rest-client', title: 'Rest Client',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/rest-client/rest-client.component').then(m => m.RestClientComponent)
      }
    ]
  },
  {
    path: 'auth', title: 'Auth',
    loadComponent: (): Promise<Type<unknown>> => import('./gen/auth/auth.component').then(m => m.AuthComponent),
    subs: [
      {
        path: 'auth-rest', title: 'Rest',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/auth-rest/auth-rest.component').then(m => m.AuthRestComponent)
      },
      {
        path: 'auth-rest-passport', title: 'Rest Passport',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/auth-rest-passport/auth-rest-passport.component').then(m => m.AuthRestPassportComponent)
      },
      {
        path: 'auth-rest-session', title: 'Rest Session',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/auth-rest-session/auth-rest-session.component').then(m => m.AuthRestSessionComponent)
      },
      {
        path: 'auth-session', title: 'Auth Session',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/auth-session/auth-session.component').then(m => m.AuthSessionComponent)
      }
    ]
  },
  {
    path: 'email', title: 'Email',
    loadComponent: (): Promise<Type<unknown>> => import('./gen/email/email.component').then(m => m.EmailComponent),
    subs: [
      {
        path: 'email-compiler', title: 'Compiler',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/email-compiler/email-compiler.component').then(m => m.EmailCompilerComponent)
      },
      {
        path: 'email-nodemailer', title: 'Nodemailer',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/email-nodemailer/email-nodemailer.component').then(m => m.EmailNodemailerComponent)
      },
      {
        path: 'email-inky', title: 'Inky',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/email-inky/email-inky.component').then(m => m.EmailInkyComponent)
      }
    ]
  },
  {
    path: 'core', title: 'Core', subs: [
      {
        path: 'di', title: 'Dependency Injection  ',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/di/di.component').then(m => m.DiComponent)
      },
      {
        path: 'config', title: 'Config ',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/config/config.component').then(m => m.ConfigComponent)
      },
      {
        path: 'cli', title: 'CLI Support',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/cli/cli.component').then(m => m.CliComponent)
      },
      {
        path: 'schema', title: 'Schema',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/schema/schema.component').then(m => m.SchemaComponent)
      },
      {
        path: 'registry', title: 'Registry',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/registry/registry.component').then(m => m.RegistryComponent)
      },
      {
        path: 'test', title: 'Test',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/test/test.component').then(m => m.TestComponent)
      },
      {
        path: 'terminal', title: 'Terminal',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/terminal/terminal.component').then(m => m.TerminalComponent)
      },
      {
        path: 'worker', title: 'Worker',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/worker/worker.component').then(m => m.WorkerComponent)
      },
    ]
  },
  {
    path: 'foundation', title: 'Foundation', subs: [
      {
        path: 'runtime', title: 'Runtime',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/runtime/runtime.component').then(m => m.BaseComponent)
      },
      {
        path: 'compiler', title: 'Compiler',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/compiler/compiler.component').then(m => m.CompilerComponent)
      },
      {
        path: 'transformer', title: 'Transformer',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/transformer/transformer.component').then(m => m.TransformerComponent)
      },
      {
        path: 'manifest', title: 'Manifest',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/manifest/manifest.component').then(m => m.ManifestComponent)
      },
    ]
  }
];
