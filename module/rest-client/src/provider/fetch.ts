/* eslint-disable @typescript-eslint/quotes */

import { Class } from '@travetto/base';
import { RootIndex } from '@travetto/manifest';
import { ControllerConfig, EndpointConfig } from '@travetto/rest';

import { ClientGenerator, Imp, RenderContent } from './generator';

import { BaseFetchService } from './fetch-template/base-service';
import { FetchRequestUtil } from './fetch-template/util';
import { placeholder } from './fetch-template/types';
import { CommonUtil } from './shared/common';

export class FetchClientGenerator extends ClientGenerator {

  subFolder = 'src';

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

  getUploadType(): string | Imp {
    return { name: 'UploadContent', file: './types.ts', classId: '_' };
  }

  renderEndpoint(endpoint: EndpointConfig, controller: ControllerConfig): RenderContent {
    const {
      imports, method, paramConfigField, paramConfig, paramInputs, paramNameArr, returnType, doc
    } = this.describeEndpoint(endpoint, controller);
    const classId = `${controller.class.Ⲑid}_${endpoint.handlerName}`;

    const util = { classId: FetchRequestUtil.Ⲑid, file: './utils.ts', name: FetchRequestUtil.name };
    imports.push(util);

    const content = [
      `  ${paramConfigField} = ${paramConfig} as const;\n\n`,
      doc,
      `  ${endpoint.handlerName} (\n`,
      ...paramInputs,
      `  ): Promise<`, ...returnType, `>{\n`,
      `    return `, util, '.', FetchRequestUtil.makeRequest.name, '<', ...returnType, `>({\n`,
      `      svc: this, method: '${method}', endpointPath: '${endpoint.path}',\n`,
      `      params: ${paramNameArr}, paramConfigs: this.${paramConfigField}\n`,
      `    });\n`,
      `  }\n\n`,
    ];

    return { imports, classId, name: endpoint.handlerName, file: '', content };
  }

  renderController(controller: ControllerConfig): RenderContent {
    const service = controller.class.name.replace(/(Controller|Rest|Service)$/, '');
    const endpoints = controller.endpoints;
    const results = endpoints.map(x => this.renderEndpoint(x, controller));
    const baseFetchService: Imp = { name: BaseFetchService.name, file: './base-service.ts', classId: '_' };

    const contents = [
      `export class ${service}Api extends `, baseFetchService, `{\n\n`,
      `  routePath = '${controller.basePath}';\n\n`,
      ...results.flatMap(f => f.content),
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