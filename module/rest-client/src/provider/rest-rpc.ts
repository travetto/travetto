import fs from 'node:fs/promises';
import path from 'node:path';

import { ControllerConfig } from '@travetto/rest';
import { Class, Runtime } from '@travetto/runtime';

import type { ClientGenerator } from './types';
import { restRpcClientFactory } from './shared/rest-rpc.js';

export class RestRpcClientGenerator implements ClientGenerator {

  classes = new Map<string, string>();
  output: string;

  constructor(output: string) {
    this.output = output;
  }

  seenFile(file: string): boolean {
    return false;
  }

  onControllerStart(cfg: ControllerConfig): void {
    this.classes.set(cfg.class.name, Runtime.getSource(cfg.class));
  }

  onControllerAdd(cls: Class): void {
    this.classes.set(cls.name, Runtime.getSource(cls));
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
    const source = Runtime.getSource(this.constructor);
    const coreFile = path.resolve(path.dirname(source), 'shared/rest-rpc.js');
    const dtsFile = path.resolve(path.dirname(source), 'shared/rest-rpc.d.ts');
    const coreContents = await fs.readFile(coreFile, 'utf8');
    const dtsContents = await fs.readFile(dtsFile, 'utf8');
    await fs.writeFile(path.resolve(this.output, path.basename(dtsFile)), dtsContents, 'utf8');
    await fs.writeFile(path.resolve(this.output, 'factory.js'), `
${coreContents}

${[...this.classes.entries()].map(([n, s]) => `/** @typedef {import('${path.relative(this.output, s)}').${n}} ${n} */`).join('\n')}
/** @type {import('./rest-rpc.d.ts').RestRpcClientFactory<{${[...this.classes.keys()].map(x => `${x}: ${x}`).join(', ')}}>} */
export const factory = ${restRpcClientFactory.name}();
`.trim(), 'utf8');
  }
}