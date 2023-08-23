/* eslint-disable @typescript-eslint/quotes */

import { Class } from '@travetto/base';
import { Package, RootIndex } from '@travetto/manifest';
import { ControllerConfig } from '@travetto/rest';

import { ClientGenerator, Imp, RenderContent } from './base';

import { BaseNodeFetchService } from './shared/fetch-node-service';
import { CommonUtil } from './shared/util';
import { BaseRemoteService } from './shared/types';

const SVC = './shared/fetch-node-service.ts';

export class NodeFetchClientGenerator extends ClientGenerator<{ native: boolean }> {

  get native(): boolean { return this.config.native !== false; }
  get outputExt(): '' { return ''; }
  get subFolder(): string { return 'src'; }
  get uploadType(): string | Imp { return this.native ? super.uploadType : { name: 'Blob', file: 'node-fetch', classId: '_blob' }; }
  get endpointResponseWrapper(): string[] { return ['Promise']; }
  get commonFiles(): [string, Class | string][] {
    return [
      [SVC, BaseNodeFetchService],
      ['./shared/types.ts', BaseRemoteService],
      ['./shared/util.ts', CommonUtil],
    ];
  }

  getCommonTypes(): string[] {
    return this.native ? ['@travetto/fetch-node-types'] : [];
  }

  init(): void {
    this.registerContent('_pkgId', {
      imports: [],
      classId: '',
      file: 'package.json',
      name: '',
      content: [JSON.stringify({
        name: this.moduleName,
        version: RootIndex.mainModule.version,
        main: `${this.subFolder ?? '.'}/index.ts`,
        dependencies: this.native ? {
          '@travetto/fetch-node-types': '^1.0.2',
        } : {
          '@types/node-fetch': '^2.6.2',
          'node-fetch': '^2.6.9',
          'fetch-blob': '^2.1.1',
          'form-data': '^2.3.3'
        }
      } satisfies Package, null, 2)]
    });
  }

  writeContentFilter(text: string): string {
    return super.writeContentFilter(text)
      .replaceAll(/^.*#NODE_FETCH_(TRUE|FALSE):\s*(.*)$/mg, (_, flag, p) => (flag === 'TRUE' && this.native) ? '' : p)
      .trimStart();
  }

  renderController(controller: ControllerConfig): RenderContent {
    const service = controller.externalName;
    const endpoints = controller.endpoints;
    const results = endpoints
      .sort((a, b) => a.handlerName.localeCompare(b.handlerName))
      .filter(v => v.documented !== false)
      .map(x => this.renderEndpoint(x, controller));
    const baseFetchService: Imp = { name: BaseNodeFetchService.name, file: SVC, classId: '_' };

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