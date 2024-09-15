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

    // Basically copying files
    const clientSourceFile = path.resolve(path.dirname(source), 'shared/rest-rpc.ts');
    const clientSourceContents = await fs.readFile(clientSourceFile, 'utf8');

    await fs.writeFile(
      path.resolve(this.output, path.basename(clientSourceFile)),
      clientSourceContents.replace(/^[^\n]*\/\/\s*server-only\s*\n/gsm, x => this.flavor === 'node' ? x : ''),
      'utf8'
    );

    // Write out factory
    await fs.writeFile(path.resolve(this.output, 'factory.ts'), [
      ...[...this.classes.entries()]
        .map(([n, s]) => `import type { ${n} } from '${ManifestModuleUtil.withoutSourceExtension(s)}.d.ts';`),
      `import { ${clientFactory.name} } from './rest-rpc';`,
      '',
      `export const factory = ${clientFactory.name}<{`,
      ...[...this.classes.keys()].map(x => `  ${x}: ${x},`),
      '}>();',
    ].join('\n'), 'utf8');

    try {
      const angularSourceFile = path.resolve(path.dirname(source), `shared/rest-rpc-${this.flavor}.ts`);
      const angularSourceContents = (await fs.readFile(angularSourceFile, 'utf8'))
        .replaceAll(/^\s*\/\/\s*@ts-ignore[^\n]*\n/gsm, '')
        .replaceAll(/^\/\/ #UNCOMMENT (.*)/gm, (_, v) => v);
      await fs.writeFile(path.resolve(this.output, path.basename(angularSourceFile)), angularSourceContents, 'utf8');
    } catch {
      // Ignore
    }
  }
}