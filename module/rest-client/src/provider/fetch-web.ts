/* eslint-disable @typescript-eslint/quotes */

import { Class } from '@travetto/base';
import { ControllerConfig } from '@travetto/rest';

import { ClientGenerator, Imp, RenderContent } from './base';

import { BaseWebFetchService } from './shared/fetch-web-service';
import { BaseRemoteService } from './shared/types';
import { CommonUtil } from './shared/util';

const SVC = './shared/fetch-web-service.ts';

export class WebFetchClientGenerator extends ClientGenerator {

  get outputExt(): '.js' { return '.js'; }
  get subFolder(): string { return '.'; }
  get endpointResponseWrapper(): string[] { return ['Promise']; }
  get commonFiles(): [string, Class][] {
    return [
      [SVC, BaseWebFetchService],
      ['./shared/util.ts', CommonUtil],
      ['./shared/types.ts', BaseRemoteService],
    ];
  }

  writeContentFilter(text: string): string {
    return super.writeContentFilter(text).replaceAll(/^.*#NODE_FETCH.*/gm, '');
  }

  renderController(controller: ControllerConfig): RenderContent {
    const service = controller.externalName;
    const endpoints = controller.endpoints;
    const results = endpoints.map(x => this.renderEndpoint(x, controller));
    const baseFetchService: Imp = { name: BaseWebFetchService.name, file: SVC, classId: '_' };

    const contents = [
      `export class ${service}Api extends `, baseFetchService, ` {\n\n`,
      ...results.flatMap(f => f.config),
      `  routePath = '${controller.basePath}';\n\n`,
      ...results.flatMap(f => f.method),
      `}\n\n`
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