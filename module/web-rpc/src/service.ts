import path from 'node:path';
import fs from 'node:fs/promises';

import { Inject, Injectable } from '@travetto/di';
import { ControllerRegistryIndex } from '@travetto/web';
import { Runtime, RuntimeIndex } from '@travetto/runtime';
import { ManifestModuleUtil } from '@travetto/manifest';
import { SchemaRegistryIndex } from '@travetto/schema';

import { clientFactory } from '../support/client/rpc.ts';
import { WebRpcClient, WebRpcConfig } from './config.ts';

@Injectable({ autoInject: !Runtime.production })
export class WebRpcClientGeneratorService {

  @Inject()
  config: WebRpcConfig;

  async postConstruct(): Promise<void> {
    this.render();

    if (!this.config.clients.length || !Runtime.dynamic) {
      return;
    }
  }

  async #getClasses(relativeTo: string): Promise<{ name: string, import: string }[]> {
    return ControllerRegistryIndex.getClasses()
      .filter(cls => {
        const entry = RuntimeIndex.getEntry(Runtime.getSourceFile(cls));
        return entry && entry.role === 'std';
      })
      .filter(cls => SchemaRegistryIndex.getConfig(cls).private !== true)
      .map(config => {
        const imp = ManifestModuleUtil.withOutputExtension(Runtime.getImport(config));
        const base = Runtime.workspaceRelative(RuntimeIndex.manifest.build.typesFolder);
        return {
          name: config.name,
          import: path.relative(relativeTo, `${base}/node_modules/${imp}`)
        };
      });
  }

  async renderProvider(config: WebRpcClient): Promise<void> {
    await fs.mkdir(config.output, { recursive: true });

    const classes = await this.#getClasses(config.output);

    const clientSourceFile = RuntimeIndex.getFromImport('@travetto/web-rpc/support/client/rpc.ts')!.sourceFile;
    const clientOutputFile = path.resolve(config.output, path.basename(clientSourceFile));
    const clientSourceContents = await fs.readFile(clientSourceFile, 'utf8');

    const flavorSourceFile = RuntimeIndex.getFromImport(`@travetto/web-rpc/support/client/rpc-${config.type}.ts`)?.sourceFile ?? '<unknown>';
    const flavorOutputFile = path.resolve(config.output, path.basename(flavorSourceFile));
    const flavorSourceContents = (await fs.readFile(flavorSourceFile, 'utf8').catch(() => ''))
      .replaceAll(/^\s*\/\/\s*@ts-ignore[^\n]*\n/gsm, '')
      .replaceAll(/^\/\/\s*#UNCOMMENT (.*)/gm, (_, line) => line);

    const factoryOutputFile = path.resolve(config.output, 'factory.ts');
    const factorySourceContents = [
      `import { ${clientFactory.name} } from './rpc';`,
      ...classes.map((cls) => `import type { ${cls.name} } from '${cls.import}';`),
      '',
      `export const factory = ${clientFactory.name}<{`,
      ...classes.map(cls => `  ${cls.name}: ${cls.name};`),
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
