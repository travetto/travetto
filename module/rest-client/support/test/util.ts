import fs from 'fs/promises';
import os from 'os';

import { ExecUtil, Env, Util } from '@travetto/base';
import { RootIndex, path } from '@travetto/manifest';
import { TestFixtures } from '@travetto/test';

import { RestClientGeneratorService } from '../../src/service';

const fixtures = new TestFixtures(['@travetto/rest-client']);

export class RestClientTestUtil {

  static get rootFolder(): string {
    return path.resolve(RootIndex.manifest.workspacePath, RootIndex.manifest.toolFolder, 'rest-client-puppeteer');
  }

  static get clientFile(): string {
    return path.resolve(this.rootFolder, 'rest-client.mjs');
  }

  static async setupPuppeteer(): Promise<void> {
    const root = this.rootFolder;

    await fs.mkdir(root, { recursive: true });
    if (!await fs.stat(path.resolve(root, 'package.json')).catch(() => false)) {
      await ExecUtil.spawn('npm', ['init', '-y'], { cwd: root }).result;
      await ExecUtil.spawn('npm', ['install', 'puppeteer'], { cwd: root }).result;
      await ExecUtil.spawn('npm', ['install'], { cwd: root }).result;
    }
    await fs.writeFile(this.clientFile, await fixtures.read('puppeteer.mjs'), 'utf8');
  }

  static async compileTypescript(folder: string, web = false): Promise<void> {
    await fs.writeFile(path.resolve(folder, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        rootDir: '.',
        module: web ? 'es2022' : 'CommonJS',
        ...(!web ? { moduleResolution: 'node' } : {}),
        target: 'esnext',
        lib: web ? ['es2022', 'dom'] : ['es2022'],
        esModuleInterop: true,
      },
    }));
    const tsc = path.resolve(RootIndex.manifest.workspacePath, 'node_modules', '.bin', 'tsc');
    await ExecUtil.spawn(tsc, ['-p', folder]).result;
  }


  static async cleanupFolder(dir: string): Promise<void> {
    if (!Env.isTrue('KEEP_TEMP')) {
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
      await ExecUtil.spawn('npm', ['i'], { cwd: tmp }).result;
      await this.compileTypescript(tmp, false);

      const proc = ExecUtil.spawn('node', ['./main'], { cwd: tmp });
      return (await proc.result).stdout;
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

      await this.compileTypescript(tmp, true);

      const indexHtml = path.resolve(tmp, 'index.html');
      await fs.writeFile(indexHtml,
        (await fixtures.read('test.html'))
          .replace('<!-- CONTENT -->', await fs.readFile(path.resolve(tmp, 'main.js'), 'utf8'))
      );

      const result = await ExecUtil.spawn('node', [this.clientFile, indexHtml], { stdio: [0, 'pipe', 'pipe'] }).result;
      return result.stdout;
    } finally {
      await this.cleanupFolder(tmp);
    }
  }
}