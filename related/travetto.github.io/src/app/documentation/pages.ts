import { Type } from '@angular/core';

export const PAGES = [
  {
    path: 'app', title: 'Application', subs: [
      {
        path: 'cache', title: 'Cache',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/cache/cache.component').then(mod => mod.CacheComponent)
      },
      {
        path: 'image', title: 'Image',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/image/image.component').then(mod => mod.ImageComponent)
      },
      {
        path: 'log', title: 'Log',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/log/log.component').then(mod => mod.LogComponent)
      },
      {
        path: 'schema-faker', title: 'Schema Faker',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/schema-faker/schema-faker.component').then(mod => mod.SchemaFakerComponent)
      },
    ]
  },
  {
    path: 'tools', title: 'Tools', subs: [
      {
        path: 'pack', title: 'Pack',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/pack/pack.component').then(mod => mod.PackComponent)
      },
      {
        path: 'eslint', title: 'ESLint Support',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/eslint/eslint.component').then(mod => mod.EslintComponent)
      },
      {
        path: 'scaffold', title: 'App Scaffold',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/scaffold/scaffold.component').then(mod => mod.ScaffoldComponent)
      },
      {
        path: 'vscode-plugin', title: 'VS Code Plugin',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/vscode-plugin/vscode-plugin.component').then(mod => mod.VSCodePluginComponent)
      }
    ]
  },
  {
    path: 'model', title: 'Model',
    loadComponent: (): Promise<Type<unknown>> => import('./gen/model/model.component').then(mod => mod.ModelComponent),
    subs: [
      {
        path: 'model-dynamodb', title: 'DynamoDB',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-dynamodb/model-dynamodb.component').then(mod => mod.ModelDynamodbComponent)
      },
      {
        path: 'model-file', title: 'File',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-file/model-file.component').then(mod => mod.ModelFileComponent)
      },
      {
        path: 'model-firestore', title: 'Firestore',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-firestore/model-firestore.component').then(mod => mod.ModelFirestoreComponent)
      },
      {
        path: 'model-memory', title: 'Memory',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-memory/model-memory.component').then(mod => mod.ModelMemoryComponent)
      },
      {
        path: 'model-redis', title: 'Redis',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-redis/model-redis.component').then(mod => mod.ModelRedisComponent)
      },
      {
        path: 'model-s3', title: 'S3',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-s3/model-s3.component').then(mod => mod.ModelS3Component)
      },
    ]
  },
  {
    path: 'model-query', title: 'Model Query',
    loadComponent: (): Promise<Type<unknown>> => import('./gen/model-query/model-query.component').then(mod => mod.ModelQueryComponent),
    subs: [
      {
        path: 'model-elasticsearch', title: 'Elasticsearch',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-elasticsearch/model-elasticsearch.component').then(mod => mod.ModelElasticsearchComponent)
      },
      {
        path: 'model-mongo', title: 'Mongo',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-mongo/model-mongo.component').then(mod => mod.ModelMongoComponent)
      },
      {
        path: 'model-sql', title: 'SQL',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-sql/model-sql.component').then(mod => mod.ModelSqlComponent)
      },
      {
        path: 'model-mysql', title: 'Mysql',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-mysql/model-mysql.component').then(mod => mod.ModelMysqlComponent)
      },
      {
        path: 'model-postgres', title: 'Postgres',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-postgres/model-postgres.component').then(mod => mod.ModelPostgresComponent)
      },
      {
        path: 'model-sqlite', title: 'Sqlite',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-sqlite/model-sqlite.component').then(mod => mod.ModelSqliteComponent)
      },
      {
        path: 'model-query-language', title: 'Query Language',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-query-language/model-query-language.component').then(mod => mod.ModelQueryLanguageComponent)
      },
    ]
  },
  {
    path: 'web', title: 'Web',
    loadComponent: (): Promise<Type<unknown>> => import('./gen/web/web.component').then(mod => mod.WebComponent),
    subs: [
      {
        path: 'web-aws-lambda', title: 'AWS Lambda',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/web-aws-lambda/web-aws-lambda.component').then(mod => mod.WebAwsLambdaComponent)
      },
      {
        path: 'web-upload', title: 'Upload',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/web-upload/web-upload.component').then(mod => mod.WebUploadComponent)
      },
      {
        path: 'web-rpc', title: 'RPC',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/web-rpc/web-rpc.component').then(mod => mod.WebRpcComponent)
      },
      {
        path: 'web-http', title: 'Server',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/web-http/web-http.component').then(mod => mod.WebHttpComponent)
      },
      {
        path: 'openapi', title: 'OpenAPI',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/openapi/openapi.component').then(mod => mod.OpenapiComponent)
      }
    ]
  },
  {
    path: 'auth', title: 'Auth',
    loadComponent: (): Promise<Type<unknown>> => import('./gen/auth/auth.component').then(mod => mod.AuthComponent),
    subs: [
      {
        path: 'auth-web', title: 'Web',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/auth-web/auth-web.component').then(mod => mod.AuthWebComponent)
      },
      {
        path: 'auth-web-passport', title: 'Web Passport',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/auth-web-passport/auth-web-passport.component').then(mod => mod.AuthWebPassportComponent)
      },
      {
        path: 'auth-web-session', title: 'Web Session',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/auth-web-session/auth-web-session.component').then(mod => mod.AuthWebSessionComponent)
      },
      {
        path: 'auth-session', title: 'Session',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/auth-session/auth-session.component').then(mod => mod.AuthSessionComponent)
      },
      {
        path: 'auth-model', title: 'Model',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/auth-model/auth-model.component').then(mod => mod.AuthModelComponent)
      }
    ]
  },
  {
    path: 'email', title: 'Email',
    loadComponent: (): Promise<Type<unknown>> => import('./gen/email/email.component').then(mod => mod.EmailComponent),
    subs: [
      {
        path: 'email-compiler', title: 'Compiler',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/email-compiler/email-compiler.component').then(mod => mod.EmailCompilerComponent)
      },
      {
        path: 'email-nodemailer', title: 'Nodemailer',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/email-nodemailer/email-nodemailer.component').then(mod => mod.EmailNodemailerComponent)
      },
      {
        path: 'email-inky', title: 'Inky',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/email-inky/email-inky.component').then(mod => mod.EmailInkyComponent)
      }
    ]
  },
  {
    path: 'core', title: 'Core', subs: [
      {
        path: 'di', title: 'Dependency Injection  ',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/di/di.component').then(mod => mod.DiComponent)
      },
      {
        path: 'config', title: 'Config ',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/config/config.component').then(mod => mod.ConfigComponent)
      },
      {
        path: 'context', title: 'Context',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/context/context.component').then(mod => mod.ContextComponent)
      },
      {
        path: 'cli', title: 'CLI Support',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/cli/cli.component').then(mod => mod.CliComponent)
      },
      {
        path: 'test', title: 'Test',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/test/test.component').then(mod => mod.TestComponent)
      },
      {
        path: 'terminal', title: 'Terminal',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/terminal/terminal.component').then(mod => mod.TerminalComponent)
      },
      {
        path: 'worker', title: 'Worker',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/worker/worker.component').then(mod => mod.WorkerComponent)
      },
    ]
  },
  {
    path: 'foundation', title: 'Foundation', subs: [
      {
        path: 'runtime', title: 'Runtime',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/runtime/runtime.component').then(mod => mod.BaseComponent)
      },
      {
        path: 'schema', title: 'Schema',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/schema/schema.component').then(mod => mod.SchemaComponent)
      },
      {
        path: 'registry', title: 'Registry',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/registry/registry.component').then(mod => mod.RegistryComponent)
      },
      {
        path: 'compiler', title: 'Compiler',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/compiler/compiler.component').then(mod => mod.CompilerComponent)
      },
      {
        path: 'transformer', title: 'Transformer',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/transformer/transformer.component').then(mod => mod.TransformerComponent)
      },
      {
        path: 'manifest', title: 'Manifest',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/manifest/manifest.component').then(mod => mod.ManifestComponent)
      },
    ]
  }
];
