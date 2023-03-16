import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { DocumentationComponent } from './documentation.component';

import { PAGES } from './pages';
import { OverviewComponent } from './gen/overview/overview.component';
import { VSCodePluginComponent } from './gen/vscode-plugin/vscode-plugin.component';
import { AssetComponent } from './gen/asset/asset.component';
import { AssetRestComponent } from './gen/asset-rest/asset-rest.component';
import { AuthComponent } from './gen/auth/auth.component';
import { AuthRestComponent } from './gen/auth-rest/auth-rest.component';
import { BaseComponent } from './gen/base/base.component';
import { CompilerComponent } from './gen/compiler/compiler.component';
import { ConfigComponent } from './gen/config/config.component';
import { ContextComponent } from './gen/context/context.component';
import { LogComponent } from './gen/log/log.component';
import { RegistryComponent } from './gen/registry/registry.component';
import { DiComponent } from './gen/di/di.component';
import { EmailComponent } from './gen/email/email.component';
import { EmailTemplateComponent } from './gen/email-template/email-template.component';
import { ImageComponent } from './gen/image/image.component';
import { TransformerComponent } from './gen/transformer/transformer.component';
import { SchemaComponent } from './gen/schema/schema.component';
import { ModelComponent } from './gen/model/model.component';
import { ModelElasticsearchComponent } from './gen/model-elasticsearch/model-elasticsearch.component';
import { ModelMongoComponent } from './gen/model-mongo/model-mongo.component';
import { RestComponent } from './gen/rest/rest.component';
import { RestExpressComponent } from './gen/rest-express/rest-express.component';
import { RestKoaComponent } from './gen/rest-koa/rest-koa.component';
import { RestFastifyComponent } from './gen/rest-fastify/rest-fastify.component';
import { TestComponent } from './gen/test/test.component';
import { CacheComponent } from './gen/cache/cache.component';
import { CliComponent } from './gen/cli/cli.component';
import { ScaffoldComponent } from './gen/scaffold/scaffold.component';
import { ModuleChartComponent } from './module-chart/module-chart.component';
import { YamlComponent } from './gen/yaml/yaml.component';
import { JwtComponent } from './gen/jwt/jwt.component';
import { SharedModule } from '../shared/shared.module';
import { WorkerComponent } from './gen/worker/worker.component';
import { RestSessionComponent } from './gen/rest-session/rest-session.component';
import { ModelSqlComponent } from './gen/model-sql/model-sql.component';
import { OpenapiComponent } from './gen/openapi/openapi.component';
import { CommandComponent } from './gen/command/command.component';
import { PackComponent } from './gen/pack/pack.component';
import { ModelDynamodbComponent } from './gen/model-dynamodb/model-dynamodb.component';
import { ModelRedisComponent } from './gen/model-redis/model-redis.component';
import { ModelS3Component } from './gen/model-s3/model-s3.component';
import { ModelFirestoreComponent } from './gen/model-firestore/model-firestore.component';
import { ModelQueryComponent } from './gen/model-query/model-query.component';
import { AuthModelComponent } from './gen/auth-model/auth-model.component';
import { AuthRestSessionComponent } from './gen/auth-rest-session/auth-rest-session.component';
import { AuthRestPassportComponent } from './gen/auth-rest-passport/auth-rest-passport.component';
import { ModelMysqlComponent } from './gen/model-mysql/model-mysql.component';
import { ModelPostgresComponent } from './gen/model-postgres/model-postgres.component';
import { ModelSqliteComponent } from './gen/model-sqlite/model-sqlite.component';
import { RestModelComponent } from './gen/rest-model/rest-model.component';
import { RestModelQueryComponent } from './gen/rest-model-query/rest-model-query.component';
import { RestExpressLambdaComponent } from './gen/rest-express-lambda/rest-express-lambda.component';
import { RestFastifyLambdaComponent } from './gen/rest-fastify-lambda/rest-fastify-lambda.component';
import { RestKoaLambdaComponent } from './gen/rest-koa-lambda/rest-koa-lambda.component';
import { RestAwsLambdaComponent } from './gen/rest-aws-lambda/rest-aws-lambda.component';
import { EmailNodemailerComponent } from './gen/email-nodemailer/email-nodemailer.component';
import { AuthRestContextComponent } from './gen/auth-rest-context/auth-rest-context.component';
import { SchemaFakerComponent } from './gen/schema-faker/schema-faker.component';
import { TerminalComponent } from './gen/terminal/terminal.component';
import { ManifestComponent } from './gen/manifest/manifest.component';
import { AuthJwtComponent } from './gen/auth-jwt/auth-jwt.component';
import { EslintComponent } from './gen/eslint/eslint.component';
import { RepoComponent } from './gen/repo/repo.component';
import { AuthRestJwtComponent } from './gen/auth-rest-jwt/auth-rest-jwt.component';

@NgModule({
  imports: [
    CommonModule,
    SharedModule,
    RouterModule.forChild([
      {
        path: 'docs',
        component: DocumentationComponent,
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'overview' },
          { path: 'overview', component: OverviewComponent },
          ...PAGES.map(x => [x, ...(x.subs ?? [])]).reduce((a, b) => a.concat(b), []).filter(x => !!x.component)
        ]
      }
    ])
  ],
  declarations: [
    DocumentationComponent,
    OverviewComponent,
    VSCodePluginComponent,
    AssetComponent,
    AssetRestComponent,
    AuthComponent,
    AuthRestComponent,
    BaseComponent,
    CompilerComponent,
    ConfigComponent,
    ContextComponent,
    LogComponent,
    RegistryComponent,
    DiComponent,
    EmailComponent,
    EmailTemplateComponent,
    SchemaComponent,
    ModelComponent,
    ModelElasticsearchComponent,
    ModelMongoComponent,
    RestComponent,
    RestExpressComponent,
    RestKoaComponent,
    RestFastifyComponent,
    TestComponent,
    CacheComponent,
    CliComponent,
    ScaffoldComponent,
    ModuleChartComponent,
    YamlComponent,
    JwtComponent,
    WorkerComponent,
    RestSessionComponent,
    ModelSqlComponent,
    OpenapiComponent,
    CommandComponent,
    ImageComponent,
    TransformerComponent,
    PackComponent,
    ModelDynamodbComponent,
    ModelRedisComponent,
    ModelS3Component,
    ModelFirestoreComponent,
    ModelQueryComponent,
    AuthModelComponent,
    AuthRestSessionComponent,
    AuthRestPassportComponent,
    ModelMysqlComponent,
    ModelPostgresComponent,
    ModelSqliteComponent,
    RestModelComponent,
    RestModelQueryComponent,
    RestExpressLambdaComponent,
    RestFastifyLambdaComponent,
    RestKoaLambdaComponent,
    RestAwsLambdaComponent,
    EmailNodemailerComponent,
    AuthRestContextComponent,
    SchemaFakerComponent,
    TerminalComponent,
    ManifestComponent,
    AuthJwtComponent,
    EslintComponent,
    RepoComponent,
    AuthRestJwtComponent
  ]
})
export class DocumentationModule { }
