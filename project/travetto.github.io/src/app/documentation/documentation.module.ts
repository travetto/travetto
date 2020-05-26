import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { DocumentationComponent } from './documentation.component';

import { PAGES } from './pages';
import { OverviewComponent } from './overview/overview.component';
import { VSCodePluginComponent } from './vscode-plugin/vscode-plugin.component';
import { CoreComponent } from './core/core.component';
import { UtilsComponent } from './utils/utils.component';
import { AssetComponent } from './gen/asset/asset.component';
import { AssetMongoComponent } from './gen/asset-mongo/asset-mongo.component';
import { AssetS3Component } from './gen/asset-s3/asset-s3.component';
import { AssetRestComponent } from './gen/asset-rest/asset-rest.component';
import { AuthComponent } from './gen/auth/auth.component';
import { AuthModelComponent } from './gen/auth-model/auth-model.component';
import { AuthRestComponent } from './gen/auth-rest/auth-rest.component';
import { AuthPassportComponent } from './gen/auth-passport/auth-passport.component';
import { BaseComponent } from './gen/base/base.component';
import { CompilerComponent } from './gen/compiler/compiler.component';
import { ConfigComponent } from './gen/config/config.component';
import { ContextComponent } from './gen/context/context.component';
import { LogComponent } from './gen/log/log.component';
import { RegistryComponent } from './gen/registry/registry.component';
import { DiComponent } from './gen/di/di.component';
import { EmailComponent } from './gen/email/email.component';
import { EmailTemplateComponent } from './gen/email-template/email-template.component';
import { SchemaComponent } from './gen/schema/schema.component';
import { ModelComponent } from './gen/model/model.component';
import { ModelElasticsearchComponent } from './gen/model-elasticsearch/model-elasticsearch.component';
import { ModelMongoComponent } from './gen/model-mongo/model-mongo.component';
import { RestComponent } from './gen/rest/rest.component';
import { RestExpressComponent } from './gen/rest-express/rest-express.component';
import { RestKoaComponent } from './gen/rest-koa/rest-koa.component';
import { RestFastifyComponent } from './gen/rest-fastify/rest-fastify.component';
import { RestAwsLambdaComponent } from './gen/rest-aws-lambda/rest-aws-lambda.component';
import { SwaggerComponent } from './gen/swagger/swagger.component';
import { TestComponent } from './gen/test/test.component';
import { CacheComponent } from './gen/cache/cache.component';
import { ExecComponent } from './gen/exec/exec.component';
import { ScheduleComponent } from './gen/schedule/schedule.component';
import { CliComponent } from './gen/cli/cli.component';
import { GeneratorAppComponent } from './gen/generator-app/generator-app.component';
import { NetComponent } from './gen/net/net.component';
import { ModuleChartComponent } from './module-chart/module-chart.component';
import { YamlComponent } from './gen/yaml/yaml.component';
import { JwtComponent } from './gen/jwt/jwt.component';
import { SharedModule } from '../shared/shared.module';
import { WorkerComponent } from './gen/worker/worker.component';
import { RestSessionComponent } from './gen/rest-session/rest-session.component';
import { BootComponent } from './gen/boot/boot.component';
import { ModelSqlComponent } from './gen/model-sql/model-sql.component';
import { AppComponent } from './gen/app/app.component';

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
          ...PAGES
        ]
      }
    ])
  ],
  declarations: [
    DocumentationComponent,
    OverviewComponent,
    VSCodePluginComponent,
    CoreComponent,
    UtilsComponent,
    AssetComponent,
    AssetMongoComponent,
    AssetS3Component,
    AssetRestComponent,
    AuthComponent,
    AuthModelComponent,
    AuthRestComponent,
    AuthPassportComponent,
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
    RestAwsLambdaComponent,
    SwaggerComponent,
    TestComponent,
    CacheComponent,
    ExecComponent,
    ScheduleComponent,
    CliComponent,
    GeneratorAppComponent,
    NetComponent,
    ModuleChartComponent,
    YamlComponent,
    JwtComponent,
    WorkerComponent,
    RestSessionComponent,
    BootComponent,
    ModelSqlComponent,
    AppComponent
  ]
})
export class DocumentationModule { }
