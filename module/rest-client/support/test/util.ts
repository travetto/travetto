import fs from 'fs/promises';
import os from 'os';

import { ExecUtil, Env, Util } from '@travetto/base';
import { RootIndex, path } from '@travetto/manifest';
import { TestFixtures } from '@travetto/test';

import { RestClientGeneratorService } from '../../src/service';

const PUPPETEER_ROOT = path.resolve(os.tmpdir(), 'trv-puppeteer');
const REST_CLIENT_PUPPET = path.resolve(PUPPETEER_ROOT, 'rest-client.mjs');
const TSC = path.resolve(RootIndex.manifest.workspacePath, 'node_modules', '.bin', 'tsc');

const fixtures = new TestFixtures(['@travetto/rest-client']);

export class RestClientTestUtil {

  static async setupPuppeteer(): Promise<void> {
    await fs.mkdir(PUPPETEER_ROOT, { recursive: true });
    if (!await fs.stat(path.resolve(PUPPETEER_ROOT, 'package.json')).catch(() => false)) {
      await ExecUtil.spawn('npm', ['init', '-y'], { cwd: PUPPETEER_ROOT }).result;
      await ExecUtil.spawn('npm', ['install', 'puppeteer'], { cwd: PUPPETEER_ROOT }).result;
      await ExecUtil.spawn('npm', ['install'], { cwd: PUPPETEER_ROOT }).result;
    }
    await fs.writeFile(REST_CLIENT_PUPPET, await fixtures.read('puppeteer.mjs'), 'utf8');
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
    await ExecUtil.spawn(TSC, ['-p', folder]).result;
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

      const result = await ExecUtil.spawn('node', [REST_CLIENT_PUPPET, indexHtml], { stdio: [0, 'pipe', 'pipe'] }).result;
      return result.stdout;
    } finally {
      await this.cleanupFolder(tmp);
    }
  }
}