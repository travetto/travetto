/* eslint-disable @typescript-eslint/quotes */

import { Class } from '@travetto/base';
import { ControllerConfig, EndpointConfig } from '@travetto/rest';

import { ClientGenerator, Imp, RenderContent } from './generator';

import { BaseAngularService } from './angular-template/base-service';
import { AngularRequestUtil } from './angular-template/util';
import { Configuration } from './angular-template/types';
import { CommonUtil } from './shared/common';

export class AngularClientGenerator extends ClientGenerator {

  get commonFiles(): [string, Class][] {
    return [
      ['./base-service.ts', BaseAngularService],
      ['./utils.ts', AngularRequestUtil],
      ['./types.ts', Configuration],
      ['./common.ts', CommonUtil]
    ];
  }

  getUploadType(): string {
    return 'Blob';
  }

  renderEndpoint(endpoint: EndpointConfig, controller: ControllerConfig): RenderContent {
    const response = { classId: '_res', file: './types.ts', name: 'AngularResponse' };
    const util = { classId: AngularRequestUtil.Ⲑid, file: './utils.ts', name: AngularRequestUtil.name };

    const {
      imports, method, paramConfigField, paramConfig, paramInputs, paramNameArr, returnType, doc
    } = this.describeEndpoint(endpoint, controller);

    imports.push(util);

    const content = [
      `  ${paramConfigField} = ${paramConfig} as const;\n\n`,
      doc,
      `  ${endpoint.handlerName} (\n`,
      ...paramInputs,
      `  ): `, response, `<`, ...returnType, `> {\n`,
      `    return `, util, '.', AngularRequestUtil.makeRequest.name, `<`, ...returnType, `>({\n`,
      `      svc: this, method: '${method}', endpointPath: '${endpoint.path}',\n`,
      `      params: ${paramNameArr}, paramConfigs: this.${paramConfigField}\n`,
      `    });\n`,
      `  }\n\n`,
    ];

    return {
      imports,
      classId: '',
      name: endpoint.handlerName,
      file: '',
      content
    };
  }

  renderController(controller: ControllerConfig): RenderContent {
    const service = controller.class.name.replace(/(Controller|Rest|Service)$/, '');

    const endpoints = controller.endpoints;

    const results = endpoints.map(x => this.renderEndpoint(x, controller));

    const base: Imp = { name: BaseAngularService.name, file: './base-service.ts', classId: BaseAngularService.Ⲑid };
    const common: Imp = { name: CommonUtil.name, file: './common.ts', classId: CommonUtil.Ⲑid };

    const httpClient = { classId: '_client', file: '@angular/common/http', name: 'HttpClient' };
    const injectable = { classId: '_inj', file: '@angular/core', name: 'Injectable' };
    const optional = { classId: '_inj', file: '@angular/core', name: 'Optional' };
    const options = { classId: '_opts', file: './types.ts', name: 'Configuration' };
    const map = { classId: '_map', file: 'rxjs', name: 'map' };

    const imports = [base, httpClient, injectable, optional, options, ...results.flatMap(x => x.imports)];

    const contents = [
      `\n`,
      `@`, injectable, `({ providedIn: 'root' })\n`,
      `export class ${service}Service extends `, base, `{\n\n`,
      `  routePath = '${controller.basePath}';\n`,
      `  transform = <T>() => `, map, `(o => `, common, `.`, CommonUtil.parseJSON.name, `<T>(JSON.stringify(o)));\n`,
      `\n`,
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
      imports
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