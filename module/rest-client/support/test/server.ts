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
}

@Controller('rest/test/todo')
export class TodoController {
  @Post()
  async createTodo(todo: Todo): Promise<Todo> {
    return todo;
  }

  /** Get all the todos, yay! */
  @Get()
  async listTodo(limit?: number, offset?: number, categories?: string[]): Promise<Todo[]> {
    return [{ text: `todo-${categories?.join('-') ?? 'none'}`, id: `${limit ?? 5}`, priority: offset }];
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
  log(await api.listTodo(200, 50, ['a','b','c']));
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
    } finally {
      await fs.rm(tmp, { recursive: true });
    }
  }
}