import fs from 'fs/promises';
import os from 'os';
import assert from 'assert';
import { setTimeout } from 'timers/promises';

import { Controller, Get, Post, Put, Delete } from '@travetto/rest';
import { Suite, Test } from '@travetto/test';
import { InjectableSuite } from '@travetto/di/support/test/suite';
import { BaseRestSuite } from '@travetto/rest/support/test/base';
import { ExecUtil, Util } from '@travetto/base';
import { Specifier } from '@travetto/schema';
import { Inject } from '@travetto/di';
import { RootIndex, path } from '@travetto/manifest';

import { RestClientGeneratorService } from '../../src/service';

const TSC = path.resolve(RootIndex.manifest.workspacePath, 'node_modules', '.bin', 'tsc');

interface Todo {
  id: string;
  text: string;
  priority?: number;
  color?: `${'green' | 'blue'}-${number}${'-a' | '-b' | ''}`;
}

@Controller('rest/test/todo')
export class TodoController {
  @Post()
  async createTodo(todo: Todo): Promise<Todo> {
    return todo;
  }

  /** Get all the todos, yay! */
  @Get()
  async listTodo(limit?: number, offset?: number, categories?: string[], color?: Todo['color']): Promise<Todo[]> {
    return [{ text: `todo-${categories?.join('-') ?? 'none'}`, id: `${limit ?? 5}`, priority: offset, color }];
  }

  @Delete('/:id')
  async deleteTodo(id: string): Promise<number> {
    return 1;
  }

  @Put('/upload')
  async upload(@Specifier('file') data: Buffer): Promise<number> {
    return data.length;
  }

  @Get('/timeout')
  async getLong(): Promise<{ message: string }> {
    await setTimeout(200);
    return { message: 'LONG TIME' };
  }
}


@InjectableSuite()
@Suite()
export abstract class RestClientServerSuite extends BaseRestSuite {

  @Inject()
  svc: RestClientGeneratorService;

  fetchRequestBody(from: string, suffix: string): string {
    return `
import { TodoApi } from '${from}';
const api = new TodoApi({ baseUrl: 'http://localhost:${this.port!}', timeout: 100 });
    
async function go() {
  const items = [];
  const log = v => items.push(v);
  log(await api.listTodo(200, 50, ['a','b','c'], 'green-2'));
  log(await api.createTodo({id: '10', text:'todo', priority: 11}));
  try {
    log(await api.getLong());
  } catch (err) {
    log(err.message);
  }
  return JSON.stringify(items);
}
${suffix}
`;
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
        this.fetchRequestBody('./src', 'go().then(console.log)')
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
        this.fetchRequestBody('./api.js', 'window.onload = () => go().then(v => document.body.innerText = v)')
      );

      await fs.writeFile(indexHtml, `
        <html>
        <head><script type="module" src="./main.js"></script></head>
        <body></body>
        </html>`);
      await ExecUtil.spawn(TSC, ['-p', tmp]).result;

      const proc = ExecUtil.spawn(
        'google-chrome',
        [
          '--virtual-time-budget=10000',
          '--disable-gpu',
          '--allow-file-access-from-files',
          '--run-all-compositor-stages-before-draw',
          '--headless',
          '--dump-dom', `file://${indexHtml}`
        ],
        { cwd: tmp }
      );
      const result = await proc.result;
      this.validateFetchResponses(result.stdout.split(/<[/]?body>/)[1]);
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