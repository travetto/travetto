import { CliComponent } from './gen/cli/cli.component';
import { VSCodePluginComponent } from './vscode-plugin/vscode-plugin.component';
import { GeneratorAppComponent } from './gen/generator-app/generator-app.component';
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
import { RestAwsLambdaComponent } from './gen/rest-aws-lambda/rest-aws-lambda.component';
import { BootComponent } from './gen/boot/boot.component';
import { BaseComponent } from './gen/base/base.component';
import { CompilerComponent } from './gen/compiler/compiler.component';
import { ContextComponent } from './gen/context/context.component';
import { RegistryComponent } from './gen/registry/registry.component';
import { LogComponent } from './gen/log/log.component';
import { CacheComponent } from './gen/cache/cache.component';
import { CommandComponent } from './gen/command/command.component';
import { WorkerComponent } from './gen/worker/worker.component';
import { NetComponent } from './gen/net/net.component';
import { WatchComponent } from './gen/watch/watch.component';
import { AssetMongoComponent } from './gen/asset-mongo/asset-mongo.component';
import { AssetS3Component } from './gen/asset-s3/asset-s3.component';
import { AssetRestComponent } from './gen/asset-rest/asset-rest.component';
import { AuthModelComponent } from './gen/auth-model/auth-model.component';
import { AuthRestComponent } from './gen/auth-rest/auth-rest.component';
import { AuthPassportComponent } from './gen/auth-passport/auth-passport.component';
import { JwtComponent } from './gen/jwt/jwt.component';
import { EmailTemplateComponent } from './gen/email-template/email-template.component';
import { CoreComponent } from './core/core.component';
import { UtilsComponent } from './utils/utils.component';
import { YamlComponent } from './gen/yaml/yaml.component';
import { TransformerComponent } from './gen/transformer/transformer.component';
import { ImageComponent } from './gen/image/image.component';

export const PAGES = [
  { path: 'cli', title: 'CLI Support', component: CliComponent, subs: [] },
  { path: 'vscode-plugin', title: 'VS Code Plugin', component: VSCodePluginComponent, subs: [] },
  { path: 'generator-app', title: 'Yeoman App Generator', component: GeneratorAppComponent, subs: [] },
  {
    path: 'config', title: 'Config ', component: ConfigComponent, subs: [
      { path: 'yaml', title: 'Simple YAML Parser', component: YamlComponent }
    ]
  },
  {
    path: 'app', title: 'Application', component: AppComponent, subs: [

    ]
  },
  {
    path: 'di', title: 'Dependency Injection  ', component: DiComponent, subs: [

    ]
  },
  {
    path: 'schema', title: 'Schema', component: SchemaComponent, subs: [

    ]
  },
  {
    path: 'model', title: 'Model', component: ModelComponent, subs: [
      { path: 'model-elasticsearch', title: 'Elasticsearch', component: ModelElasticsearchComponent },
      { path: 'model-mongo', title: 'Mongo', component: ModelMongoComponent },
      { path: 'model-sql', title: 'SQL', component: ModelSqlComponent }
    ]
  },
  {
    path: 'rest', title: 'Rest', component: RestComponent, subs: [
      { path: 'rest-express', title: 'Express', component: RestExpressComponent },
      { path: 'rest-koa', title: 'Koa', component: RestKoaComponent },
      { path: 'rest-fastify', title: 'Fastify', component: RestFastifyComponent },
      { path: 'rest-session', title: 'Session', component: RestSessionComponent },
      { path: 'openapi', title: 'OpenAPI', component: OpenapiComponent },
      { path: 'rest-aws-lambda', title: 'Aws-Lambda', component: RestAwsLambdaComponent }
    ]
  },
  { path: 'test', title: 'Test', component: TestComponent, subs: [] },
  {
    path: 'asset', title: 'Asset', component: AssetComponent, subs: [
      { path: 'asset-mongo', title: 'Mongo', component: AssetMongoComponent },
      { path: 'asset-s3', title: 'S3', component: AssetS3Component },
      { path: 'asset-rest', title: 'Rest', component: AssetRestComponent }
    ]
  },
  {
    path: 'auth', title: 'Auth', component: AuthComponent, subs: [
      { path: 'auth-model', title: 'Model', component: AuthModelComponent },
      { path: 'auth-rest', title: 'Rest', component: AuthRestComponent },
      { path: 'auth-passport', title: 'Passport', component: AuthPassportComponent },
      { path: 'jwt', title: 'JWT', component: JwtComponent }
    ]
  },
  {
    path: 'email', title: 'Email', component: EmailComponent, subs: [
      { path: 'email-template', title: 'Template', component: EmailTemplateComponent },
      { path: 'image', title: 'Image', component: ImageComponent }
    ]
  },
  {
    path: 'core', title: 'Core Components', component: CoreComponent, subs: [
      { path: 'boot', title: 'Boot', component: BootComponent },
      { path: 'base', title: 'Base', component: BaseComponent },
      { path: 'compiler', title: 'Compiler', component: CompilerComponent },
      { path: 'registry', title: 'Registry', component: RegistryComponent },
      { path: 'transformer', title: 'Transformer', component: TransformerComponent },
    ]
  },
  {
    path: 'utils', title: 'Common Utilities', component: UtilsComponent, subs: [
      { path: 'log', title: 'Log', component: LogComponent },
      { path: 'cache', title: 'Cache', component: CacheComponent },
      { path: 'command', title: 'Command', component: CommandComponent },
      { path: 'context', title: 'Context', component: ContextComponent },
      { path: 'worker', title: 'Worker', component: WorkerComponent },
      { path: 'net', title: 'Net', component: NetComponent },
      { path: 'watch', title: 'Watch', component: WatchComponent }
    ]
  },
];
