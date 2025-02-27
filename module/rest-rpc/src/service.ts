import path from 'node:path';
import fs from 'node:fs/promises';

import { Inject, Injectable } from '@travetto/di';
import { ControllerRegistry } from '@travetto/rest';
import { Runtime, RuntimeIndex } from '@travetto/runtime';
import { ManifestModuleUtil } from '@travetto/manifest';

import { clientFactory } from '../support/client/rpc';
import { RestRpcClient, RestRpcConfig } from './config';

@Injectable({ autoCreate: true })
export class RestRpcClientGeneratorService {

  @Inject()
  config: RestRpcConfig;

  async postConstruct(): Promise<void> {
    this.render();

    if (!this.config.clients.length || !Runtime.dynamic) {
      return;
    }
    ControllerRegistry.on(() => this.render());
  }

  async #getClasses(relativeTo: string): Promise<{ name: string, import: string }[]> {
    return ControllerRegistry.getClasses()
      .filter(x => {
        const entry = RuntimeIndex.getEntry(Runtime.getSourceFile(x));
        return entry && entry.role === 'std';
      })
      .map(x => {
        const imp = ManifestModuleUtil.withOutputExtension(Runtime.getImport(x));
        const base = Runtime.workspaceRelative(RuntimeIndex.manifest.build.typesFolder);
        return {
          name: x.name,
          import: path.relative(relativeTo, `${base}/node_modules/${imp}`)
        };
      });
  }

  async renderProvider(config: RestRpcClient): Promise<void> {
    await fs.mkdir(config.output, { recursive: true });

    const classes = await this.#getClasses(config.output);

    const clientSourceFile = RuntimeIndex.getFromImport('@travetto/rest-rpc/support/client/rpc.ts')!.sourceFile;
    const clientOutputFile = path.resolve(config.output, path.basename(clientSourceFile));
    const clientSourceContents = await fs.readFile(clientSourceFile, 'utf8');

    const flavorSourceFile = RuntimeIndex.getFromImport(`@travetto/rest-rpc/support/client/rpc-${config.type}.ts`)!.sourceFile;
    const flavorOutputFile = path.resolve(config.output, path.basename(flavorSourceFile));
    const flavorSourceContents = (await fs.readFile(flavorSourceFile, 'utf8').catch(() => ''))
      .replaceAll(/^\s*\/\/\s*@ts-ignore[^\n]*\n/gsm, '')
      .replaceAll(/^\/\/\s*#UNCOMMENT (.*)/gm, (_, v) => v);

    const factoryOutputFile = path.resolve(config.output, 'factory.ts');
    const factorySourceContents = [
      `import { ${clientFactory.name} } from './rpc';`,
      ...classes.map((n) => `import type { ${n.name} } from '${n.import}';`),
      '',
      `export const factory = ${clientFactory.name}<{`,
      ...classes.map(x => `  ${x.name}: ${x.name};`),
      '}>();',
    ].join('\n');

    await fs.writeFile(clientOutputFile, clientSourceContents, 'utf8');
    await fs.writeFile(factoryOutputFile, factorySourceContents, 'utf8');

    if (flavorSourceContents) {
      await fs.writeFile(flavorOutputFile, flavorSourceContents, 'utf8');
    }
  }

  async render(): Promise<void> {
    for (const config of this.config.clients) {
      this.renderProvider(config);
    }
  }
}
