import fs from 'fs/promises';
import os from 'os';
import assert from 'assert';

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
}

@Suite()
@InjectableSuite()
export abstract class RestClientServerSuite extends BaseRestSuite {

  @Inject()
  svc: RestClientGeneratorService;

  @Test({ timeout: 10000 })
  async fetchNodeClient() {
    const tmp = path.resolve(os.tmpdir(), `rest-client-fetch-node-${Util.uuid()}`);
    try {
      await this.svc.renderClient({ type: 'fetch-node', output: tmp });
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
      await fs.writeFile(path.resolve(tmp, 'main.ts'), `
import { TodoApi } from './src';
const log = v => console.log(JSON.stringify(v));
const api = new TodoApi({ baseUrl: 'http://localhost:${this.port!}'});

async function go() {
  log(await api.listTodo(200, 50, ['a','b','c'], 'green-2'));
}

go()
`);
      await ExecUtil.spawn('npm', ['i'], { cwd: tmp }).result;
      await ExecUtil.spawn(TSC, ['-p', tmp]).result;

      const proc = ExecUtil.spawn('node', ['./main'], { cwd: tmp });
      const result = await proc.result;
      const items: Todo[] = JSON.parse(result.stdout);
      const body = items[0];
      assert(body.id === '200');
      assert(body.priority === 50);
      assert(body.text === 'todo-a-b-c');
      assert(body.color === 'green-2');
    } finally {
      // await fs.rm(tmp, { recursive: true });
    }
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
      await fs.writeFile(srcFile, `
import { TodoApi } from './api.js';
const output = [];
const log = v => output.push(v);
const api = new TodoApi({ baseUrl: 'http://localhost:${this.port!}' });

async function go() {
  log(await api.listTodo(200, 50, ['a','b','c'], 'green-2'));
  document.body.innerText = output.map(v => JSON.stringify(v)).join('\\n');
}


window.onload = go;
`);

      await fs.writeFile(indexHtml, `
<html>
<head><script type="module" src="./main.js"></script>
<body></body>
</html>
`);
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
      console.log(result);
      const items: Todo[] = JSON.parse(result.stdout.split(/<[/]?body>/)[1]);
      const body = items[0];
      assert(body.id === '200');
      assert(body.priority === 50);
      assert(body.text === 'todo-a-b-c');
      assert(body.color === 'green-2');
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