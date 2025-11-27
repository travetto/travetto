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
        path: 'model-redis', title: 'Redis',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-redis/model-redis.component').then(m => m.ModelRedisComponent)
      },
      {
        path: 'model-s3', title: 'S3',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-s3/model-s3.component').then(m => m.ModelS3Component)
      },
    ]
  },
  {
    path: 'model-query', title: 'Model Query',
    loadComponent: (): Promise<Type<unknown>> => import('./gen/model-query/model-query.component').then(m => m.ModelQueryComponent),
    subs: [
      {
        path: 'model-elasticsearch', title: 'Elasticsearch',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-elasticsearch/model-elasticsearch.component').then(m => m.ModelElasticsearchComponent)
      },
      {
        path: 'model-mongo', title: 'Mongo',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-mongo/model-mongo.component').then(m => m.ModelMongoComponent)
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
        path: 'model-query-language', title: 'Query Language',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/model-query-language/model-query-language.component').then(m => m.ModelQueryLanguageComponent)
      },
    ]
  },
  {
    path: 'web', title: 'Web',
    loadComponent: (): Promise<Type<unknown>> => import('./gen/web/web.component').then(m => m.WebComponent),
    subs: [
      {
        path: 'web-node', title: 'Node',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/web-node/web-node.component').then(m => m.WebNodeComponent)
      },
      {
        path: 'web-aws-lambda', title: 'AWS Lambda',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/web-aws-lambda/web-aws-lambda.component').then(m => m.WebAwsLambdaComponent)
      },
      {
        path: 'web-upload', title: 'Upload',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/web-upload/web-upload.component').then(m => m.WebUploadComponent)
      },
      {
        path: 'web-rpc', title: 'RPC',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/web-rpc/web-rpc.component').then(m => m.WebRpcComponent)
      },
      {
        path: 'web-http-server', title: 'Server',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/web-http-server/web-http-server.component').then(m => m.WebHttpServerComponent)
      },
      {
        path: 'openapi', title: 'OpenAPI',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/openapi/openapi.component').then(m => m.OpenapiComponent)
      }
    ]
  },
  {
    path: 'auth', title: 'Auth',
    loadComponent: (): Promise<Type<unknown>> => import('./gen/auth/auth.component').then(m => m.AuthComponent),
    subs: [
      {
        path: 'auth-web', title: 'Web',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/auth-web/auth-web.component').then(m => m.AuthWebComponent)
      },
      {
        path: 'auth-web-passport', title: 'Web Passport',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/auth-web-passport/auth-web-passport.component').then(m => m.AuthWebPassportComponent)
      },
      {
        path: 'auth-web-session', title: 'Web Session',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/auth-web-session/auth-web-session.component').then(m => m.AuthWebSessionComponent)
      },
      {
        path: 'auth-session', title: 'Session',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/auth-session/auth-session.component').then(m => m.AuthSessionComponent)
      },
      {
        path: 'auth-model', title: 'Model',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/auth-model/auth-model.component').then(m => m.AuthModelComponent)
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
        path: 'context', title: 'Context',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/context/context.component').then(m => m.ContextComponent)
      },
      {
        path: 'cli', title: 'CLI Support',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/cli/cli.component').then(m => m.CliComponent)
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
        path: 'schema', title: 'Schema',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/schema/schema.component').then(m => m.SchemaComponent)
      },
      {
        path: 'registry', title: 'Registry',
        loadComponent: (): Promise<Type<unknown>> => import('./gen/registry/registry.component').then(m => m.RegistryComponent)
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
