/* eslint-disable @typescript-eslint/quotes */
import { Package, RuntimeContext } from '@travetto/manifest';
import { Class } from '@travetto/base';
import { ControllerConfig } from '@travetto/rest';

import { ClientGenerator, Imp, RenderContent } from './base';

import { BaseFetchService } from './shared/fetch-service';
import { CommonUtil } from './shared/util';
import { BaseRemoteService } from './shared/types';

const SVC = './shared/fetch-service.ts';

export class FetchClientGenerator extends ClientGenerator<{ node?: boolean }> {

  get outputExt(): '' | '.js' { return this.config.node ? '' : '.js'; }
  get subFolder(): string { return this.config.node ? 'src' : '.'; }
  get endpointResponseWrapper(): string[] { return ['Promise']; }
  get commonFiles(): [string, Class][] {
    return [
      [SVC, BaseFetchService],
      ['./shared/util.ts', CommonUtil],
      ['./shared/types.ts', BaseRemoteService],
    ];
  }

  get uploadType(): string | Imp {
    return this.config.node ? 'Blob' : super.uploadType;
  }

  async init(): Promise<void> {
    if (this.config.node) {
      const pkg = await import('@travetto/base/package.json');

      this.registerContent('_pkgId', {
        imports: [],
        classId: '',
        file: 'package.json',
        name: '',
        content: [JSON.stringify({
          name: this.moduleName,
          version: RuntimeContext.main.version,
          main: `${this.subFolder ?? '.'}/index.ts`,
          dependencies: this.config.node ? {
            '@types/node': pkg.dependencies['@types/node']
          } : {}
        } satisfies Package, null, 2)]
      });
    }
  }

  renderController(controller: ControllerConfig): RenderContent {
    const service = controller.externalName;
    const endpoints = controller.endpoints;
    const results = endpoints
      .sort((a, b) => a.handlerName.localeCompare(b.handlerName))
      .filter(v => v.documented !== false)
      .map(x => this.renderEndpoint(x, controller));
    const baseFetchService: Imp = { name: BaseFetchService.name, file: SVC, classId: '_' };

    const contents = [
      ...this.renderControllerDoc(controller),
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