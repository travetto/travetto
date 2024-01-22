import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';

import { ExecUtil, Util } from '@travetto/base';
import { RuntimeContext, path } from '@travetto/manifest';
import { TestFixtures } from '@travetto/test';

import { RestClientGeneratorService } from '../../src/service';

const fixtures = new TestFixtures(['@travetto/rest-client']);

export class RestClientTestUtil {

  static get rootFolder(): string {
    return RuntimeContext.toolPath('rest-client-puppeteer');
  }

  static get clientFile(): string {
    return path.resolve(this.rootFolder, 'rest-client.mjs');
  }

  static async setupPuppeteer(): Promise<void> {
    const root = this.rootFolder;

    await fs.mkdir(root, { recursive: true });
    if (!await fs.stat(path.resolve(root, 'package.json')).catch(() => false)) {
      await ExecUtil.getResult(spawn('npm', ['init', '-y'], { cwd: root }));
      await ExecUtil.getResult(spawn('npm', ['install', 'puppeteer'], { cwd: root }));
      await ExecUtil.getResult(spawn('npm', ['install'], { cwd: root }));
    }
    await fs.writeFile(this.clientFile, await fixtures.read('puppeteer.mjs'), 'utf8');
  }

  static async compileTypescript(folder: string, mode: 'web' | 'node'): Promise<void> {
    await fs.copyFile(
      await fixtures.resolve(`tsconfig.${mode}.json`),
      path.resolve(folder, 'tsconfig.json'),
    );
    const tsc = path.resolve(RuntimeContext.workspace.path, 'node_modules', '.bin', 'tsc');
    await ExecUtil.getResult(spawn(tsc, ['-p', folder]));
  }


  static async cleanupFolder(dir: string): Promise<void> {
    if (process.env.KEEP_TEMP !== '1') {
      await fs.rm(dir, { recursive: true });
    }
  }

  static async runNodeClient(svc: RestClientGeneratorService, body: string): Promise<string> {
    const tmp = path.resolve(os.tmpdir(), `rest-client-fetch-node-${Util.uuid()}`);
    try {
      await svc.renderClient({ type: 'fetch-node', output: tmp, options: {} });

      await fs.writeFile(
        path.resolve(tmp, 'main.ts'),
        `${body}\ngo().then(console.log)`
      );
      await ExecUtil.getResult(spawn('npm', ['i'], { cwd: tmp }));
      await this.compileTypescript(tmp, 'node');

      const result = await ExecUtil.getResult(spawn('node', ['./main'], { cwd: tmp }));
      return result.stdout;
    } finally {
      await this.cleanupFolder(tmp);
    }
  }

  static async runWebClient(svc: RestClientGeneratorService, body: string): Promise<string> {
    const tmp = path.resolve(os.tmpdir(), `rest-client-fetch-web-${Util.uuid()}`);
    try {
      await svc.renderClient({ type: 'fetch-web', output: tmp });

      await fs.writeFile(
        path.resolve(tmp, 'main.ts'),
        body
      );

      await this.compileTypescript(tmp, 'web');

      const indexHtml = path.resolve(tmp, 'index.html');
      await fs.writeFile(indexHtml,
        (await fixtures.read('test.html'))
          .replace('<!-- CONTENT -->', await fs.readFile(path.resolve(tmp, 'main.js'), 'utf8'))
      );

      const result = await ExecUtil.getResult(spawn('node', [this.clientFile, indexHtml], { stdio: [0, 'pipe', 'pipe'] }));
      return result.stdout;
    } finally {
      await this.cleanupFolder(tmp);
    }
  }
}