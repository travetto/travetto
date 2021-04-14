import { CliComponent } from './gen/cli/cli.component';
import { VSCodePluginComponent } from './vscode-plugin/vscode-plugin.component';
import { ScaffoldComponent } from './gen/scaffold/scaffold.component';
import { ConfigComponent } from './gen/config/config.component';
import { AppComponent } from './gen/app/app.component';
import { DiComponent } from './gen/di/di.component';
import { SchemaComponent } from './gen/schema/schema.component';
import { ModelComponent } from './gen/model/model.component';
import { RestComponent } from './gen/rest/rest.component';
import { TestComponent } from './gen/test/test.component';
import { AssetComponent } from './gen/asset/asset.component';
import { AuthComponent } from './gen/auth/auth.component';
import { EmailComponent } from './gen/email/email.component';
import { ModelElasticsearchComponent } from './gen/model-elasticsearch/model-elasticsearch.component';
import { ModelMongoComponent } from './gen/model-mongo/model-mongo.component';
import { ModelSqlComponent } from './gen/model-sql/model-sql.component';
import { OpenapiComponent } from './gen/openapi/openapi.component';
import { RestSessionComponent } from './gen/rest-session/rest-session.component';
import { RestExpressComponent } from './gen/rest-express/rest-express.component';
import { RestKoaComponent } from './gen/rest-koa/rest-koa.component';
import { RestFastifyComponent } from './gen/rest-fastify/rest-fastify.component';
import { BootComponent } from './gen/boot/boot.component';
import { BaseComponent } from './gen/base/base.component';
import { CompilerComponent } from './gen/compiler/compiler.component';
import { ContextComponent } from './gen/context/context.component';
import { RegistryComponent } from './gen/registry/registry.component';
import { LogComponent } from './gen/log/log.component';
import { CacheComponent } from './gen/cache/cache.component';
import { CommandComponent } from './gen/command/command.component';
import { WorkerComponent } from './gen/worker/worker.component';
import { WatchComponent } from './gen/watch/watch.component';
import { AssetRestComponent } from './gen/asset-rest/asset-rest.component';
import { AuthRestComponent } from './gen/auth-rest/auth-rest.component';
import { JwtComponent } from './gen/jwt/jwt.component';
import { EmailTemplateComponent } from './gen/email-template/email-template.component';
import { YamlComponent } from './gen/yaml/yaml.component';
import { TransformerComponent } from './gen/transformer/transformer.component';
import { ImageComponent } from './gen/image/image.component';
import { PackComponent } from './gen/pack/pack.component';
import { ModelQueryComponent } from './gen/model-query/model-query.component';
import { ModelDynamodbComponent } from './gen/model-dynamodb/model-dynamodb.component';
import { ModelFirestoreComponent } from './gen/model-firestore/model-firestore.component';
import { ModelRedisComponent } from './gen/model-redis/model-redis.component';
import { ModelS3Component } from './gen/model-s3/model-s3.component';

export const PAGES = [
  {
    path: 'app', title: 'Application', component: AppComponent, subs: [
      { path: 'command', title: 'Command', component: CommandComponent },
      { path: 'cache', title: 'Cache', component: CacheComponent },
      { path: 'pack', title: 'Pack', component: PackComponent },
      { path: 'image', title: 'Image', component: ImageComponent },
      { path: 'log', title: 'Log', component: LogComponent },
      { path: 'context', title: 'Context', component: ContextComponent }
    ]
  },
  {
    path: 'model', title: 'Model', component: ModelComponent, subs: [
      { path: 'model-query', title: 'Query', component: ModelQueryComponent },
      { path: 'model-dynamodb', title: 'DynamoDB', component: ModelDynamodbComponent },
      { path: 'model-elasticsearch', title: 'Elasticsearch', component: ModelElasticsearchComponent },
      { path: 'model-firestore', title: 'Firestore', component: ModelFirestoreComponent },
      { path: 'model-mongo', title: 'Mongo', component: ModelMongoComponent },
      { path: 'model-redis', title: 'Redis', component: ModelRedisComponent },
      { path: 'model-s3', title: 'S3', component: ModelS3Component },
      { path: 'model-sql', title: 'SQL', component: ModelSqlComponent }
    ]
  },
  {
    path: 'rest', title: 'Rest', component: RestComponent, subs: [
      { path: 'rest-express', title: 'Express', component: RestExpressComponent },
      { path: 'rest-koa', title: 'Koa', component: RestKoaComponent },
      { path: 'rest-fastify', title: 'Fastify', component: RestFastifyComponent },
      { path: 'rest-session', title: 'Session', component: RestSessionComponent },
      { path: 'openapi', title: 'OpenAPI', component: OpenapiComponent }
    ]
  },
  {
    path: 'asset', title: 'Asset', component: AssetComponent, subs: [
      { path: 'asset-rest', title: 'Rest', component: AssetRestComponent }
    ]
  },
  {
    path: 'auth', title: 'Auth', component: AuthComponent, subs: [
      { path: 'auth-rest', title: 'Rest', component: AuthRestComponent },
      { path: 'jwt', title: 'JWT', component: JwtComponent }
    ]
  },
  {
    path: 'email', title: 'Email', component: EmailComponent, subs: [
      { path: 'email-template', title: 'Template', component: EmailTemplateComponent }
    ]
  },
  {
    path: 'core', title: 'Core', subs: [
      { path: 'di', title: 'Dependency Injection  ', component: DiComponent },
      { path: 'config', title: 'Config ', component: ConfigComponent },
      { path: 'schema', title: 'Schema', component: SchemaComponent },
      { path: 'test', title: 'Test', component: TestComponent },
    ]
  },

  {
    path: 'compiler', title: 'Compiler', component: CompilerComponent, subs: [
      { path: 'transformer', title: 'Transformer', component: TransformerComponent },
    ]
  },
  { path: 'registry', title: 'Registry', component: RegistryComponent },
  {
    path: 'tools', title: 'Tooling', subs: [
      { path: 'vscode-plugin', title: 'VS Code Plugin', component: VSCodePluginComponent },
      { path: 'scaffold', title: 'App Scaffold', component: ScaffoldComponent },
    ]
  },
  { path: 'cli', title: 'CLI Support', component: CliComponent },
  {
    path: 'base', title: 'Base', component: BaseComponent, subs: [
      { path: 'boot', title: 'Boot', component: BootComponent },
      { path: 'yaml', title: 'YAML Parser', component: YamlComponent },
      { path: 'worker', title: 'Worker', component: WorkerComponent },
      { path: 'watch', title: 'Watch', component: WatchComponent }
    ]
  }
];
