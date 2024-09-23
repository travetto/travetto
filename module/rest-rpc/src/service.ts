import path from 'node:path';
import fs from 'node:fs/promises';

import { AutoCreate, Inject, Injectable } from '@travetto/di';
import { ControllerRegistry } from '@travetto/rest';
import { Runtime, RuntimeIndex } from '@travetto/runtime';
import { ManifestModuleUtil } from '@travetto/manifest';

import { clientFactory } from '../support/client/rpc';
import { RestRpcClient, RestRpcConfig } from './config';

@Injectable()
export class RestRpcClientGeneratorService implements AutoCreate {

  @Inject()
  config: RestRpcConfig;

  async postConstruct(): Promise<void> {
    this.render();

    if (!this.config.clients.length || !Runtime.dynamic) {
      return;
    }

    ControllerRegistry.on(() => this.render());
  }

  async renderProvider(config: RestRpcClient) {
    await fs.mkdir(config.output, { recursive: true });

    const clientSourceFile = RuntimeIndex.getFromImport('@travetto/rest-rpc/support/client/rpc.ts')!.sourceFile;
    const clientSourceContents = await fs.readFile(clientSourceFile, 'utf8');
    const clientOutputFile = path.resolve(config.output, path.basename(clientSourceFile));

    const flavorSourceFile = RuntimeIndex.getFromImport(`@travetto/rest-rpc/support/client/rpc-${config.type}.ts`)!.sourceFile;
    const flavorOutputFile = path.resolve(config.output, path.basename(flavorSourceFile));
    const flavorSourceContents = (await fs.readFile(flavorSourceFile, 'utf8').catch(() => ''))
      .replaceAll(/^\s*\/\/\s*@ts-ignore[^\n]*\n/gsm, '')
      .replaceAll(/^\/\/\s*#UNCOMMENT (.*)/gm, (_, v) => v);

    const factoryOutputFile = path.resolve(config.output, 'factory.ts');
    const factorySourceContents = [
      ...ControllerRegistry.getClasses()
        .map((n) => `import type { ${n.name} } from '${ManifestModuleUtil.withoutSourceExtension(Runtime.getImport(n))}';`),
      `import { ${clientFactory.name} } from './rest-rpc';`,
      '',
      `export const factory = ${clientFactory.name}<{`,
      ...ControllerRegistry.getClasses().map(x => `  ${x.name}: ${x.name};`),
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
