import fs from 'node:fs/promises';
import path from 'node:path';

import { ControllerConfig, ControllerVisitorOptions } from '@travetto/rest';
import { Class, Runtime, RuntimeIndex } from '@travetto/runtime';

import type { ClientGenerator } from './types';
import { clientFactory } from './shared/rest-rpc.js';

export class RestRpcClientGenerator implements ClientGenerator {

  classes = new Map<string, string>();
  output: string;
  server: boolean;

  constructor(output: string, server = false) {
    this.output = output;
    this.server = server;
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
    const clientSourceFile = path.resolve(path.dirname(source), 'shared/rest-rpc.js');
    const clientDtsFile = path.resolve(path.dirname(source), 'shared/rest-rpc.d.ts');
    const clientSourceContents = await fs.readFile(clientSourceFile, 'utf8');
    const clientDtsContents = await fs.readFile(clientDtsFile, 'utf8');

    await fs.writeFile(path.resolve(this.output, path.basename(clientDtsFile)), clientDtsContents, 'utf8');

    await fs.writeFile(
      path.resolve(this.output, path.basename(clientSourceFile)),
      clientSourceContents.replace(/^[^\n]*\/\/\s*server-only\s*$/gsm, x => this.server ? x : ''),
      'utf8'
    );

    // Write out factory
    await fs.writeFile(path.resolve(this.output, 'factory.js'), [
      "import * as rpc from './rest-rpc';",
      `export const factory = rpc.${clientFactory.name}();`,
      'export const IGNORE = rpc.IGNORE;',
    ].join('\n'), 'utf8');

    // And typings
    await fs.writeFile(path.resolve(this.output, 'factory.d.ts'), [
      "import * as rpc from './rest-rpc';",
      ...[...this.classes.entries()]
        .map(([n, s]) => `import {${n}} from '${path.relative(this.output, RuntimeIndex.getFromImport(s)!.outputFile)}';`),
      'export function IGNORE<T>(): T',
      'export const factory: rpc.ClientFactory<{',
      ...[...this.classes.keys()].map(x => `  ${x}: ${x},`),
      '}>;'
    ].join('\n'), 'utf8');
  }
}