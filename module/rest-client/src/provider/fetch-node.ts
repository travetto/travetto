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
  get uploadType(): string | Imp { return this.native ? super.uploadType : 'Blob'; }
  get endpointResponseWrapper(): string[] { return ['Promise']; }
  get commonFiles(): [string, Class | string][] {
    const extra: [string, string][] =
      !this.native ? [] : [['./fetch.d.ts', `${RootIndex.getModule('@travetto/base')?.sourcePath}/src/fetch.d.ts`]];
    return [
      [SVC, BaseNodeFetchService],
      ['./shared/types.ts', BaseRemoteService],
      ['./shared/util.ts', CommonUtil],
      ...extra
    ];
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
          '@types/node': '^20.0.0',
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
      .replaceAll(/^(.*)\s*\/\/\s*#NODE_FETCH\s*$/mg, (_, p) => this.native ? '' : p)
      .replaceAll(/^.*#NODE_FETCH_ENABLE:\s*(.*)$/mg, (_, p) => this.native ? '' : p);
  }

  renderController(controller: ControllerConfig): RenderContent {
    const service = controller.externalName;
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