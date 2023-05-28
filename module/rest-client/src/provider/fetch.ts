/* eslint-disable @typescript-eslint/quotes */

import { Class } from '@travetto/base';
import { RootIndex } from '@travetto/manifest';
import { ControllerConfig } from '@travetto/rest';

import { ClientGenerator, Imp, RenderContent } from './generator';

import { BaseFetchService } from './fetch-template/base-service';
import { FetchRequestUtil } from './fetch-template/util';
import { placeholder } from './fetch-template/types';
import { CommonUtil } from './shared/common';

export class FetchClientGenerator extends ClientGenerator {

  get subFolder(): string { return 'src'; }
  get uploadType(): string | Imp { return { name: 'UploadContent', file: './types.ts', classId: '_' }; }
  get endpointResponseWrapper(): string[] { return ['Promise']; }
  get requestFunction(): (string | Imp)[] {
    const util = { classId: FetchRequestUtil.Ⲑid, file: './utils.ts', name: FetchRequestUtil.name };
    return [util, '.', FetchRequestUtil.makeRequest.name,];
  }
  get commonFiles(): [string, Class][] {
    return [
      ['./base-service.ts', BaseFetchService],
      ['./utils.ts', FetchRequestUtil],
      ['./types.ts', placeholder],
      ['./common.ts', CommonUtil],
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
    const baseFetchService: Imp = { name: BaseFetchService.name, file: './base-service.ts', classId: '_' };

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