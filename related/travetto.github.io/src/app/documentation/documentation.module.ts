import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { DocumentationComponent } from './documentation.component';

import { PAGES } from './pages';
import { OverviewComponent } from './overview/overview.component';
import { VSCodePluginComponent } from './vscode-plugin/vscode-plugin.component';
import { AssetComponent } from './gen/asset/asset.component';
import { AssetRestComponent } from './gen/asset-rest/asset-rest.component';
import { AuthComponent } from './gen/auth/auth.component';
import { AuthModelComponent } from './gen/auth-model/auth-model.component';
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
import { GeneratorAppComponent } from './gen/generator-app/generator-app.component';
import { ModuleChartComponent } from './module-chart/module-chart.component';
import { YamlComponent } from './gen/yaml/yaml.component';
import { JwtComponent } from './gen/jwt/jwt.component';
import { SharedModule } from '../shared/shared.module';
import { WorkerComponent } from './gen/worker/worker.component';
import { RestSessionComponent } from './gen/rest-session/rest-session.component';
import { BootComponent } from './gen/boot/boot.component';
import { ModelSqlComponent } from './gen/model-sql/model-sql.component';
import { AppComponent } from './gen/app/app.component';
import { OpenapiComponent } from './gen/openapi/openapi.component';
import { CommandComponent } from './gen/command/command.component';
import { WatchComponent } from './gen/watch/watch.component';
import { PackComponent } from './gen/pack/pack.component';
import { ModelDynamodbComponent } from './gen/model-dynamodb/model-dynamodb.component';
import { ModelRedisComponent } from './gen/model-redis/model-redis.component';
import { ModelS3Component } from './gen/model-s3/model-s3.component';
import { ModelFirestoreComponent } from './gen/model-firestore/model-firestore.component';
import { ModelQueryComponent } from './gen/model-query/model-query.component';

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
    AuthModelComponent,
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
    GeneratorAppComponent,
    ModuleChartComponent,
    YamlComponent,
    JwtComponent,
    WorkerComponent,
    RestSessionComponent,
    BootComponent,
    ModelSqlComponent,
    AppComponent,
    OpenapiComponent,
    CommandComponent,
    WatchComponent,
    ImageComponent,
    TransformerComponent,
    PackComponent,
    ModelDynamodbComponent,
    ModelRedisComponent,
    ModelS3Component,
    ModelFirestoreComponent,
    ModelQueryComponent
  ]
})
export class DocumentationModule { }
