import fs from 'node:fs/promises';
import path from 'node:path';

import { ControllerConfig, ControllerVisitorOptions } from '@travetto/rest';
import { Class, Runtime } from '@travetto/runtime';
import { ManifestModuleUtil } from '@travetto/manifest';

import type { ClientGenerator } from './types';
import { clientFactory } from './shared/rest-rpc.js';

export class RestRpcClientGenerator implements ClientGenerator {

  classes = new Map<string, string>();
  output: string;
  flavor: 'node' | 'web' | 'angular';

  constructor(output: string, flavor: 'node' | 'web' | 'angular' = 'web') {
    this.output = output;
    this.flavor = flavor;
  }

  getOptions(): ControllerVisitorOptions {
    return { skipUndocumented: false };
  }

  seenImport(imp: string): boolean {
    return false;
  }

  onControllerStart(cfg: ControllerConfig): void {
    this.classes.set(cfg.class.name, Runtime.getImport(cfg.class));
  }

  onControllerAdd(cls: Class): void {
    this.classes.set(cls.name, Runtime.getImport(cls));
    this.flush();
  }

  onControllerRemove(cls: Class): void {
    this.classes.delete(cls.name);
    this.flush();
  }

  async onComplete(): Promise<void> {
    await this.flush();
  }

  async flush(): Promise<void> {
    await fs.mkdir(this.output, { recursive: true });
    const source = Runtime.getSourceFile(this.constructor);

    const clientSourceFile = path.resolve(path.dirname(source), 'shared/rest-rpc.ts');
    const clientSourceContents = await fs.readFile(clientSourceFile, 'utf8');
    const clientOutputFile = path.resolve(this.output, path.basename(clientSourceFile));

    const flavorSourceFile = path.resolve(path.dirname(source), `shared/rest-rpc-${this.flavor}.ts`);
    const flavorOutputFile = path.resolve(this.output, path.basename(flavorSourceFile));
    const flavorSourceContents = (await fs.readFile(flavorSourceFile, 'utf8').catch(() => ''))
      .replaceAll(/^\s*\/\/\s*@ts-ignore[^\n]*\n/gsm, '')
      .replaceAll(/^\/\/ #UNCOMMENT (.*)/gm, (_, v) => v);

    const factoryOutputFile = path.resolve(this.output, 'factory.ts');
    const factorySourceContents = [
      ...[...this.classes.entries()]
        .map(([n, s]) => `import type { ${n} } from '${ManifestModuleUtil.withoutSourceExtension(s)}';`),
      `import { ${clientFactory.name} } from './rest-rpc';`,
      '',
      `export const factory = ${clientFactory.name}<{`,
      ...[...this.classes.keys()].map(x => `  ${x}: ${x};`),
      '}>();',
    ].join('\n');

    await fs.writeFile(clientOutputFile, clientSourceContents, 'utf8');
    await fs.writeFile(factoryOutputFile, factorySourceContents, 'utf8');
    if (flavorSourceContents) {
      await fs.writeFile(flavorOutputFile, flavorSourceContents, 'utf8');
    }
  }
}