/* eslint-disable @typescript-eslint/quotes */

import { Class } from '@travetto/base';
import { ControllerConfig, EndpointConfig } from '@travetto/rest';

import { ClientGenerator, Imp, RenderContent } from './generator';

import { BaseAngularService } from './angular-template/base-service';
import { AngularRequestUtil } from './angular-template/util';
import { Configuration } from './angular-template/types';

export class AngularClientGenerator extends ClientGenerator {

  get commonFiles(): [string, Class][] {
    return [
      ['./base-service.ts', BaseAngularService],
      ['./utils.ts', AngularRequestUtil],
      ['./types.ts', Configuration]
    ];
  }

  getUploadType(): string {
    return 'Blob';
  }

  renderEndpoint(endpoint: EndpointConfig, controller: ControllerConfig): RenderContent {
    const out: (string | Imp)[] = [];
    const httpEvent = { classId: '_ev', file: '@angular/common/http', name: 'HttpEvent' };
    const httpResponse = { classId: '_res', file: '@angular/common/http', name: 'HttpResponse' };
    const observable = { classId: '_obs', file: 'rxjs', name: 'Observable' };
    const util = { classId: AngularRequestUtil.Ⲑid, file: './utils.ts', name: AngularRequestUtil.name };

    const {
      imports, method, paramConfigField, paramConfig, paramInputs, paramNameArr, returnType, doc
    } = this.describeEndpoint(endpoint, controller);

    imports.push(util);

    const buildBody = (type: string): (string | Imp)[] => [
      `    return `, util, '.', AngularRequestUtil.makeRequest.name, `${type}<`, ...returnType, `>({\n`,
      `      svc: this, method: '${method}', endpointPath: '${endpoint.path}',\n`,
      `      params: ${paramNameArr}, paramConfig: this.${paramConfigField}\n`,
      `    });\n`,
    ];

    out.push(
      `  ${paramConfigField} = ${paramConfig} as const;\n\n`,
      doc,
      `  ${endpoint.handlerName} (\n`,
      ...paramInputs,
      `  ): `, observable, `<`, ...returnType, `>{\n`,
      ...buildBody('Body'),
      `  }\n\n`,
      doc,
      `  ${endpoint.handlerName}WithResponse (\n`,
      ...paramInputs, `
        ): `, observable, `<`, httpResponse, '<', ...returnType, `>>{\n`,
      ...buildBody('Response'),
      `  }\n\n`,
      doc,
      `  ${endpoint.handlerName}WithEvents (\n`,
      ...paramInputs,
      `  ): `, observable, `<`, httpEvent, '<', ...returnType, `>>{\n`,
      ...buildBody('Events'),
      `  }\n\n`,
    );

    return {
      imports,
      classId: '',
      name: endpoint.handlerName,
      file: '',
      content: out
    };
  }

  renderController(controller: ControllerConfig): RenderContent {
    const service = controller.class.name.replace(/(Controller|Rest|Service)$/, '');

    const endpoints = controller.endpoints;

    const results = endpoints.map(x => this.renderEndpoint(x, controller));

    const base: Imp = { name: BaseAngularService.name, file: './base-service.ts', classId: '_' };

    const httpClient = { classId: '_client', file: '@angular/common/http', name: 'HttpClient' };
    const injectable = { classId: '_inj', file: '@angular/core', name: 'Injectable' };
    const optional = { classId: '_inj', file: '@angular/core', name: 'Optional' };
    const options = { classId: '_opts', file: './types.ts', name: 'Configuration' };

    const contents = [
      `\n`,
      `@`, injectable, `({ providedIn: 'root' })\n`,
      `export class ${service}Service extends `, base, `{\n\n`,
      `  routePath = '${controller.basePath}';\n\n`,
      `  constructor(public client: `, httpClient, `, @`, optional, `() options: `, options, `) {\n`,
      `    super(options);\n`,
      `  }\n`,
      ...results.flatMap(f => f.content),
      `}\n`
    ];

    return {
      file: './api.ts',
      classId: controller.class.Ⲑid,
      name: service,
      content: contents,
      imports: [base, ...results.flatMap(x => x.imports)]
    };
  }

  renderModule(): RenderContent {
    const ngModule: Imp = { file: '@angular/core', name: 'NgModule', classId: '__ngModule' };
    const ngModWithProv: Imp = { file: '@angular/core', name: 'ModuleWithProviders', classId: '__ngModuleWithProv' };
    const skipSelf: Imp = { file: '@angular/core', name: 'SkipSelf', classId: '__ngSkipSelf' };
    const optional: Imp = { file: '@angular/core', name: 'Optional', classId: '__optional' };
    const httpClient: Imp = { file: '@angular/common/http', name: 'HttpClient', classId: '_http' };
    const config: Imp = { file: './types', name: 'Configuration', classId: Configuration.Ⲑid };
    const self: Imp = { file: '', name: 'RestClientModule', classId: '_restClientMod' };

    return {
      ...self,
      file: './module.ts',
      imports: [ngModule, ngModWithProv, skipSelf, optional, httpClient, config],
      content: [
        `\n`,
        `@`, ngModule, `({ imports: [], declarations: [], exports: [], providers: [] })\n`,
        `export class `, self, ` {\n`,
        `  public static forRoot(factory: () => `, config, `): `, ngModWithProv, `<`, self, `> {\n`,
        `    return {\n`,
        `      ngModule: `, self, `,\n`,
        `      providers: [{ provide: `, config, `, useFactory: factory }]\n`,
        `    };\n`,
        `  }\n\n`,
        `  constructor(@`, optional, `() @`, skipSelf, `() parentModule: `, self, `, @`, optional, `() http: `, httpClient, `) {\n`,
        `    if(parentModule) {\n`,
        `      throw new Error('${self.name} is already loaded.Import in your base AppModule only.');\n`,
        `    }\n`,
        `    if(!http) {\n`,
        `      throw new Error('You need to import the HttpClientModule in your AppModule!');\n`,
        `    }\n`,
        `  }\n`,
        `}\n\n`,
        `export const RestClientConfig = `, config, `;\n`
      ]
    };
  }

  init(): void {
    const content = this.renderModule();
    this.registerContent(content.file, content);
  }
}