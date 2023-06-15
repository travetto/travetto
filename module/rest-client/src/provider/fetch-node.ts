/* eslint-disable @typescript-eslint/quotes */

import { Class } from '@travetto/base';
import { RootIndex } from '@travetto/manifest';
import { ControllerConfig } from '@travetto/rest';

import { ClientGenerator, Imp, RenderContent } from './base';

import { BaseNodeFetchService } from './shared/fetch-node-service';
import { CommonUtil } from './shared/util';
import { BaseRemoteService } from './shared/types';

const SVC = './shared/fetch-node-service.ts';

export class NodeFetchClientGenerator extends ClientGenerator {

  get subFolder(): string { return 'src'; }
  get uploadType(): string | Imp { return { name: 'UploadContent', file: SVC, classId: '_' }; }
  get endpointResponseWrapper(): string[] { return ['Promise']; }
  get commonFiles(): [string, Class][] {
    return [
      [SVC, BaseNodeFetchService],
      ['./shared/types.ts', BaseRemoteService],
      ['./shared/util.ts', CommonUtil],
    ];
  }

  init(): void {
    this.registerContent('_pkgId', {
      imports: [],
      classId: '',
      file: 'package.json',
      name: '',
      content: [
        `{\n`,
        `  "name": "`, this.moduleName, `",\n`,
        `  "version": "${RootIndex.mainModule.version}",\n`,
        `  "main": "${this.subFolder ?? '.'}/index.ts",\n`,
        `  "dependencies": {\n`,
        `    "@types/node-fetch": "^2.6.2",\n`,
        `    "node-fetch": "^2.6.9"\n`,
        `  }\n`,
        `}\n`
      ]
    });
  }

  renderController(controller: ControllerConfig): RenderContent {
    const service = controller.class.name.replace(/(Controller|Rest|Service)$/, '');
    const endpoints = controller.endpoints;
    const results = endpoints.map(x => this.renderEndpoint(x, controller));
    const baseFetchService: Imp = { name: BaseNodeFetchService.name, file: SVC, classId: '_' };

    const contents = [
      `export class ${service}Api extends `, baseFetchService, `{\n\n`,
      ...results.flatMap(f => f.config),
      `  routePath = '${controller.basePath}';\n\n`,
      ...results.flatMap(f => f.method),
      `}\n`
    ];

    return {
      file: './api.ts',
      classId: controller.class.Ⲑid,
      name: service,
      content: contents,
      imports: [baseFetchService, ...results.flatMap(x => x.imports)]
    };
  }
}