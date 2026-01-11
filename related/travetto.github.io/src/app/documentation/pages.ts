import { Type } from '@angular/core';

export const PAGES = [
  {
    path: 'app', title: 'Application', subs: [
      {
        path: 'cache', title: 'Cache',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/cache/cache.component').then(item => item.CacheComponent)
      },
      {
        path: 'image', title: 'Image',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/image/image.component').then(item => item.ImageComponent)
      },
      {
        path: 'log', title: 'Log',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/log/log.component').then(item => item.LogComponent)
      },
      {
        path: 'schema-faker', title: 'Schema Faker',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/schema-faker/schema-faker.component').then(item => item.SchemaFakerComponent)
      },
    ]
  },
  {
    path: 'tools', title: 'Tools', subs: [
      {
        path: 'pack', title: 'Pack',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/pack/pack.component').then(item => item.PackComponent)
      },
      {
        path: 'eslint', title: 'ESLint Support',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/eslint/eslint.component').then(item => item.EslintComponent)
      },
      {
        path: 'scaffold', title: 'App Scaffold',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/scaffold/scaffold.component').then(item => item.ScaffoldComponent)
      },
      {
        path: 'vscode-plugin', title: 'VS Code Plugin',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/vscode-plugin/vscode-plugin.component').then(item => item.VSCodePluginComponent)
      }
    ]
  },
  {
    path: 'model', title: 'Model',
    loadComponent: (): Promise<Type<unknown>> => import('./gen/model/model.component').then(item => item.ModelComponent),
    subs: [
      {
        path: 'model-dynamodb', title: 'DynamoDB',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-dynamodb/model-dynamodb.component').then(item => item.ModelDynamodbComponent)
      },
      {
        path: 'model-file', title: 'File',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-file/model-file.component').then(item => item.ModelFileComponent)
      },
      {
        path: 'model-firestore', title: 'Firestore',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-firestore/model-firestore.component').then(item => item.ModelFirestoreComponent)
      },
      {
        path: 'model-memory', title: 'Memory',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-memory/model-memory.component').then(item => item.ModelMemoryComponent)
      },
      {
        path: 'model-redis', title: 'Redis',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-redis/model-redis.component').then(item => item.ModelRedisComponent)
      },
      {
        path: 'model-s3', title: 'S3',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-s3/model-s3.component').then(item => item.ModelS3Component)
      },
    ]
  },
  {
    path: 'model-query', title: 'Model Query',
    loadComponent: (): Promise<Type<unknown>> => import('./gen/model-query/model-query.component').then(item => item.ModelQueryComponent),
    subs: [
      {
        path: 'model-elasticsearch', title: 'Elasticsearch',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-elasticsearch/model-elasticsearch.component').then(item => item.ModelElasticsearchComponent)
      },
      {
        path: 'model-mongo', title: 'Mongo',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-mongo/model-mongo.component').then(item => item.ModelMongoComponent)
      },
      {
        path: 'model-sql', title: 'SQL',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-sql/model-sql.component').then(item => item.ModelSqlComponent)
      },
      {
        path: 'model-mysql', title: 'Mysql',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-mysql/model-mysql.component').then(item => item.ModelMysqlComponent)
      },
      {
        path: 'model-postgres', title: 'Postgres',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-postgres/model-postgres.component').then(item => item.ModelPostgresComponent)
      },
      {
        path: 'model-sqlite', title: 'Sqlite',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-sqlite/model-sqlite.component').then(item => item.ModelSqliteComponent)
      },
      {
        path: 'model-query-language', title: 'Query Language',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-query-language/model-query-language.component').then(item => item.ModelQueryLanguageComponent)
      },
    ]
  },
  {
    path: 'web', title: 'Web',
    loadComponent: (): Promise<Type<unknown>> => import('./gen/web/web.component').then(item => item.WebComponent),
    subs: [
      {
        path: 'web-aws-lambda', title: 'AWS Lambda',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/web-aws-lambda/web-aws-lambda.component').then(item => item.WebAwsLambdaComponent)
      },
      {
        path: 'web-upload', title: 'Upload',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/web-upload/web-upload.component').then(item => item.WebUploadComponent)
      },
      {
        path: 'web-rpc', title: 'RPC',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/web-rpc/web-rpc.component').then(item => item.WebRpcComponent)
      },
      {
        path: 'web-http', title: 'Server',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/web-http/web-http.component').then(item => item.WebHttpComponent)
      },
      {
        path: 'openapi', title: 'OpenAPI',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/openapi/openapi.component').then(item => item.OpenapiComponent)
      }
    ]
  },
  {
    path: 'auth', title: 'Auth',
    loadComponent: (): Promise<Type<unknown>> => import('./gen/auth/auth.component').then(item => item.AuthComponent),
    subs: [
      {
        path: 'auth-web', title: 'Web',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/auth-web/auth-web.component').then(item => item.AuthWebComponent)
      },
      {
        path: 'auth-web-passport', title: 'Web Passport',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/auth-web-passport/auth-web-passport.component').then(item => item.AuthWebPassportComponent)
      },
      {
        path: 'auth-web-session', title: 'Web Session',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/auth-web-session/auth-web-session.component').then(item => item.AuthWebSessionComponent)
      },
      {
        path: 'auth-session', title: 'Session',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/auth-session/auth-session.component').then(item => item.AuthSessionComponent)
      },
      {
        path: 'auth-model', title: 'Model',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/auth-model/auth-model.component').then(item => item.AuthModelComponent)
      }
    ]
  },
  {
    path: 'email', title: 'Email',
    loadComponent: (): Promise<Type<unknown>> => import('./gen/email/email.component').then(item => item.EmailComponent),
    subs: [
      {
        path: 'email-compiler', title: 'Compiler',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/email-compiler/email-compiler.component').then(item => item.EmailCompilerComponent)
      },
      {
        path: 'email-nodemailer', title: 'Nodemailer',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/email-nodemailer/email-nodemailer.component').then(item => item.EmailNodemailerComponent)
      },
      {
        path: 'email-inky', title: 'Inky',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/email-inky/email-inky.component').then(item => item.EmailInkyComponent)
      }
    ]
  },
  {
    path: 'core', title: 'Core', subs: [
      {
        path: 'di', title: 'Dependency Injection  ',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/di/di.component').then(item => item.DiComponent)
      },
      {
        path: 'config', title: 'Config ',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/config/config.component').then(item => item.ConfigComponent)
      },
      {
        path: 'context', title: 'Context',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/context/context.component').then(item => item.ContextComponent)
      },
      {
        path: 'cli', title: 'CLI Support',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/cli/cli.component').then(item => item.CliComponent)
      },
      {
        path: 'test', title: 'Test',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/test/test.component').then(item => item.TestComponent)
      },
      {
        path: 'terminal', title: 'Terminal',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/terminal/terminal.component').then(item => item.TerminalComponent)
      },
      {
        path: 'worker', title: 'Worker',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/worker/worker.component').then(item => item.WorkerComponent)
      },
    ]
  },
  {
    path: 'foundation', title: 'Foundation', subs: [
      {
        path: 'runtime', title: 'Runtime',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/runtime/runtime.component').then(item => item.BaseComponent)
      },
      {
        path: 'schema', title: 'Schema',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/schema/schema.component').then(item => item.SchemaComponent)
      },
      {
        path: 'registry', title: 'Registry',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/registry/registry.component').then(item => item.RegistryComponent)
      },
      {
        path: 'compiler', title: 'Compiler',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/compiler/compiler.component').then(item => item.CompilerComponent)
      },
      {
        path: 'transformer', title: 'Transformer',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/transformer/transformer.component').then(item => item.TransformerComponent)
      },
      {
        path: 'manifest', title: 'Manifest',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/manifest/manifest.component').then(item => item.ManifestComponent)
      },
    ]
  }
];
