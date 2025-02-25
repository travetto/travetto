import { Class } from '@travetto/runtime';
import { ControllerConfig } from '@travetto/rest';

import { BaseClientGenerator } from './base';
import type { Imp, RenderContent } from './types';

import { BaseAngularService, Configuration } from './shared/angular-service';
import { CommonUtil } from './shared/util';
import { BaseRemoteService } from './shared/types';

const SVC = './shared/angular-service.ts';

export class AngularClientGenerator extends BaseClientGenerator {

  flags = {};

  get outputExt(): '' { return ''; }
  get subFolder(): string { return '.'; }
  get commonFiles(): [string, Class][] {
    return [
      [SVC, BaseAngularService],
      ['./shared/util.ts', CommonUtil],
      ['./shared/types.ts', BaseRemoteService]
    ];
  }

  get endpointResponseWrapper(): (string | Imp)[] {
    return [{ classId: '_res', file: SVC, name: 'AngularResponse' }];
  }

  writeContentFilter(text: string): string {
    return super.writeContentFilter(text)
      .replaceAll(/^.*#NODE_FETCH.*/gm, '')
      .replaceAll(/^\s*\/\/\s*@ts-ignore[^\n]*\n/gsm, '')
      .replaceAll(/^\/\/ #UNCOMMENT (.*)/gm, (_, v) => v)
      .trimStart();
  }

  init(): void {
    const content = this.renderModule();
    this.registerContent(content.file, content);
  }

  renderModule(): RenderContent {
    const ngModule: Imp = { file: '@angular/core', name: 'NgModule', classId: '__ngModule' };
    const ngModWithProv: Imp = { file: '@angular/core', name: 'ModuleWithProviders', classId: '__ngModuleWithProv' };
    const skipSelf: Imp = { file: '@angular/core', name: 'SkipSelf', classId: '__ngSkipSelf' };
    const optional: Imp = { file: '@angular/core', name: 'Optional', classId: '__optional' };
    const httpClient: Imp = { file: '@angular/common/http', name: 'HttpClient', classId: '_http' };
    const config: Imp = { file: './shared/angular-service', name: 'Configuration.ts', classId: Configuration.Ⲑid };
    const self: Imp = { file: '', name: 'RestClientModule', classId: '_restClientMod' };

    return {
      ...self,
      file: './module.ts',
      imports: [ngModule, ngModWithProv, skipSelf, optional, httpClient, config],
      content: [
        '\n',
        '@', ngModule, '({ imports: [], declarations: [], exports: [], providers: [] })\n',
        'export class ', self, ' {\n',
        '  static forRoot(factory: () => ', config, '): ', ngModWithProv, '<', self, '> {\n',
        '    return {\n',
        '      ngModule: ', self, ',\n',
        '      providers: [{ provide: ', config, ', useFactory: factory }]\n',
        '    };\n',
        '  }\n\n',
        '  constructor(@', optional, '() @', skipSelf, '() parentModule: ', self, ', @', optional, '() http: ', httpClient, ') {\n',
        '    if(parentModule) {\n',
        `      throw new Error("${self.name} is already loaded.Import in your base AppModule only.");\n`,
        '    }\n',
        '    if(!http) {\n',
        '      throw new Error("You need to import the HttpClientModule in your AppModule!");\n',
        '    }\n',
        '  }\n',
        '}\n\n',
        'export const RestClientConfig = ', config, ';\n'
      ]
    };
  }

  renderController(controller: ControllerConfig): RenderContent {
    const service = controller.externalName;
    const endpoints = controller.endpoints;

    const results = endpoints
      .sort((a, b) => a.handlerName.localeCompare(b.handlerName))
      .filter(v => v.documented !== false)
      .map(x => this.renderEndpoint(x, controller));

    const base: Imp = { name: BaseAngularService.name, file: SVC, classId: BaseAngularService.Ⲑid };
    const options: Imp = { classId: '_opts', file: SVC, name: 'Configuration' };

    const httpClient: Imp = { classId: '_ngHttp', file: '@angular/common/http', name: 'HttpClient' };
    const injectable: Imp = { classId: '_ngCore', file: '@angular/core', name: 'Injectable' };
    const optional: Imp = { classId: '_ngCore', file: '@angular/core', name: 'Optional' };

    const imports = [base, httpClient, injectable, optional, options, ...results.flatMap(x => x.imports)];

    const contents = [
      '\n',
      ...this.renderControllerDoc(controller),
      '@', injectable, '({ providedIn: "root" })\n',
      `export class ${service}Service extends `, base, ' {\n\n',
      `  routePath = '${controller.basePath}';\n`,
      ...results.flatMap(f => f.config),
      '\n',
      '\n',
      '  client: ', httpClient, ';\n',
      '\n',
      '  constructor(client: ', httpClient, ', @', optional, '() options: ', options, ') {\n',
      '    super(client, options);\n',
      '    this.client = client;\n',
      '  }\n',
      '\n',
      ...results.flatMap(f => f.method),
      '}\n\n'
    ];

    return {
      file: './api.ts',
      classId: controller.class.Ⲑid,
      name: service,
      content: contents,
      imports
    };
  }
}