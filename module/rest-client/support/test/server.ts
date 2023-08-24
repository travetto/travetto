import fs from 'fs/promises';
import os from 'os';
import assert from 'assert';

import { BeforeAll, Suite, Test, TestFixtures } from '@travetto/test';
import { InjectableSuite } from '@travetto/di/support/test/suite';
import { BaseRestSuite } from '@travetto/rest/support/test/base';
import { ExecUtil, Util } from '@travetto/base';
import { Inject } from '@travetto/di';
import { RootIndex, path } from '@travetto/manifest';

import { RestClientGeneratorService } from '../../src/service';
import { Todo, fetchRequestBody } from './suite';

const TSC = path.resolve(RootIndex.manifest.workspacePath, 'node_modules', '.bin', 'tsc');

const PUPPETEER_ROOT = path.resolve(os.tmpdir(), 'trv-puppeteer');
const REST_CLIENT_PUPPET = path.resolve(PUPPETEER_ROOT, 'rest-client.mjs');
const fixtures = new TestFixtures(['@travetto/rest-client']);

@InjectableSuite()
@Suite()
export abstract class RestClientServerSuite extends BaseRestSuite {

  @Inject()
  svc: RestClientGeneratorService;

  @BeforeAll()
  async setupPuppeteer(): Promise<void> {
    await fs.mkdir(PUPPETEER_ROOT, { recursive: true });
    if (!await fs.stat(path.resolve(PUPPETEER_ROOT, 'package.json')).catch(() => false)) {
      await ExecUtil.spawn('npm', ['init', '-y'], { cwd: PUPPETEER_ROOT }).result;
      await ExecUtil.spawn('npm', ['install', 'puppeteer'], { cwd: PUPPETEER_ROOT }).result;
    }
    await fs.writeFile(REST_CLIENT_PUPPET, await fixtures.read('puppeteer.mjs'), 'utf8');
  }

  @Test({ skip: true })
  validateFetchResponses(text: string): void {
    assert(/^\[/.test(text.trim()));
    const items: [Todo[], Todo, string] = JSON.parse(text);
    assert(items.length === 3);

    const body0 = items[0][0];
    assert(body0.id === '200');
    assert(body0.priority === 50);
    assert(body0.text === 'todo-a-b-c');
    assert(body0.color === 'green-2');

    const body1 = items[1];
    assert(body1.id === '10');
    assert(body1.text === 'todo');
    assert(body1.priority === 11);

    assert(/abort/i.test(items[2]));
  }

  async fetchNodeClient(native: boolean) {
    const tmp = path.resolve(os.tmpdir(), `rest-client-fetch-node-${Util.uuid()}`);
    try {
      await this.svc.renderClient({ type: 'fetch-node', output: tmp, options: { native } });
      await fs.writeFile(path.resolve(tmp, 'tsconfig.json'), JSON.stringify({
        compilerOptions: {
          rootDir: '.',
          module: 'CommonJS',
          target: 'esnext',
          moduleResolution: 'node',
          lib: ['es2022'],
          esModuleInterop: true
        },
      }));
      await fs.writeFile(
        path.resolve(tmp, 'main.ts'),
        fetchRequestBody('./src', 'go().then(console.log)', this.port!)
      );
      await ExecUtil.spawn('npm', ['i'], { cwd: tmp }).result;
      await ExecUtil.spawn(TSC, ['-p', tmp]).result;
      const proc = ExecUtil.spawn('node', ['./main'], { cwd: tmp });
      return (await proc.result).stdout;

    } finally {
      await fs.rm(tmp, { recursive: true });
    }
  }

  @Test({ timeout: 10000 })
  async fetchNonNativeNodeClient() {
    const result = await this.fetchNodeClient(false);
    this.validateFetchResponses(result);
  }

  @Test({ timeout: 10000 })
  async fetchNativeNodeClient() {
    const result = await this.fetchNodeClient(true);
    this.validateFetchResponses(result);
  }

  @Test({ timeout: 10000 })
  async fetchWebClient() {
    const tmp = path.resolve(os.tmpdir(), `rest-client-fetch-web-${Util.uuid()}`);
    const srcFile = path.resolve(tmp, 'main.ts');
    const indexHtml = path.resolve(tmp, 'index.html');
    try {
      await this.svc.renderClient({ type: 'fetch-web', output: tmp });
      await fs.writeFile(path.resolve(tmp, 'tsconfig.json'), JSON.stringify({
        compilerOptions: {
          rootDir: '.',
          module: 'es2022',
          target: 'esnext',
          lib: ['es2022', 'dom'],
          esModuleInterop: true,
        },
      }));
      await fs.writeFile(
        srcFile,
        // eslint-disable-next-line no-template-curly-in-string
        fetchRequestBody('./api.js', 'window.onload = () => go().then(v => document.body.innerHTML = `<output>${v}</output>`);', this.port!)
      );

      await ExecUtil.spawn(TSC, ['-p', tmp]).result;

      await fs.writeFile(indexHtml,
        (await fixtures.read('test.html'))
          .replace('<!-- CONTENT -->', await fs.readFile(path.resolve(tmp, 'main.js'), 'utf8'))
      );

      const result = await ExecUtil.spawn('node', [REST_CLIENT_PUPPET, `file://${indexHtml}`], { stdio: [0, 'pipe', 'pipe'] }).result;
      this.validateFetchResponses(result.stdout);
    } finally {
      await fs.rm(tmp, { recursive: true });
    }
  }

  @Test({ timeout: 10000 })
  async angularClient() {
    const tmp = path.resolve(os.tmpdir(), `rest-client-angular-${Util.uuid()}`);
    try {
      await this.svc.renderClient({ type: 'angular', output: tmp });
    } finally {
      await fs.rm(tmp, { recursive: true });
    }
  }
}