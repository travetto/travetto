import assert from 'node:assert';

import { Body, Controller, Delete, Get, Post, Put } from '@travetto/web';
import { Specifier } from '@travetto/schema';
import { Suite, Test } from '@travetto/test';
import { AppError, BinaryUtil, CodecUtil, JSONUtil, Util, type BinaryArray } from '@travetto/runtime';

import { BaseWebSuite } from '@travetto/web/support/test/suite/base.ts';
import { LocalRequestDispatcher } from '@travetto/web/support/test/dispatcher.ts';

// QUESTION: Should we load all source for the module?
import '../src/controller.ts'; // Ensure we load the controller

interface User {
  id: string;
  name: string;
  age: number;
  email?: string;
  permissions?: string[];
}

interface Todo {
  id?: string;
  text: string;
  priority?: number;
  userId: string;
  color?: 'green' | 'blue' | 'red';

  settings?: unknown;
}

@Controller('user')
export class UserController {
  @Put()
  async updateUser(user: User): Promise<User> {
    return user;
  }

  @Put('/upload')
  async uploadFun(@Body() @Specifier('file') data: BinaryArray, multiplier = 1): Promise<number> {
    return data.byteLength * multiplier;
  }
}

@Controller('todo')
export class TodoController {

  store: Todo[] = [];

  @Post()
  async createTodo(todo: Todo): Promise<Todo> {
    todo.id ??= Util.uuid();
    this.store.push(todo);
    return todo;
  }

  /** Get all the todos, yay! */
  @Get()
  async listTodo(limit?: number, offset?: number, categories?: string[]): Promise<Todo[]> {
    return this.store.slice(0, limit ?? this.store.length);
  }

  @Delete('/:id')
  async deleteTodo(id: string): Promise<void> {
    const idx = this.store.findIndex(x => x.id === id);
    if (idx >= 0) {
      this.store.splice(idx, 1);
    }
  }

  @Post('/alt')
  async inline(shape: {
    id: string;
    text: string;
    priority?: number;
    userId: string;
    color?: 'green' | 'blue' | 'red';

    settings?: unknown;
  }): Promise<void> {

  }
}

@Suite()
class WebRpcSuite extends BaseWebSuite {

  dispatcherType = LocalRequestDispatcher;

  @Test()
  async basic() {
    const { context: { httpStatusCode: createdStatus }, body: created } = await this.request<Todo>({
      context: {
        path: '/rpc/TodoController:createTodo',
        httpMethod: 'POST',
      },
      headers: {
        'content-type': 'application/json'
      },
      body: JSONUtil.toUTF8([{
        text: 'A new item',
        userId: 'its a me'
      }])
    }, false);

    assert(createdStatus === 200);
    assert(created);
    assert(created.id);
    assert(created.text === 'A new item');

    const { body: list } = await this.request<Todo[]>({
      context: {
        path: '/rpc/TodoController:listTodo',
        httpMethod: 'POST',
      },
      headers: {
        'content-type': 'application/json'
      },
      body: JSONUtil.toUTF8([])
    });

    assert(Array.isArray(list));
    assert(list.length === 1);
    assert(list[0]);
    assert(list[0].id);
    assert(list[0].text === 'A new item');

    const { context: { httpStatusCode: removedStatusCode }, body: removed } = await this.request<Todo[]>({
      context: {
        path: '/rpc/TodoController:deleteTodo',
        httpMethod: 'POST',
      },
      headers: {
        'content-type': 'application/json'
      },
      body: JSONUtil.toUTF8([
        list[0].id
      ])
    });

    assert(removedStatusCode === 204);
    assert(BinaryUtil.isBinaryArray(removed));
    assert(removed.byteLength === 0);
  }

  @Test()
  async files() {
    const { context: { httpStatusCode: createdStatus }, body: created } = await this.request<number>({
      context: {
        path: '/rpc/UserController:uploadFun',
        httpMethod: 'POST',
      },
      headers: {
        'content-type': 'application/octet-stream',
        'X-TRV-RPC-INPUTS': JSONUtil.toBase64([null, 11])
      },
      body: CodecUtil.fromUTF8String('A'.repeat(100))
    });

    assert(createdStatus === 200);
    assert(created === 1100);
  }


  @Test()
  async verifySerialize() {
    const payload = {
      err: new AppError('Uh-oh'),
      count: 2000n
    };

    const plain = JSONUtil.cloneForTransmit(payload);
    assert(typeof plain === 'object');
    assert(plain);
    assert('err' in plain);
    assert(typeof plain.err === 'object');
    assert(plain.err);
    assert('$trv' in plain.err);
    assert('stack' in plain.err);
    assert(typeof plain.err.stack === 'string');

    const complex: typeof payload = JSONUtil.cloneFromTransmit(plain);

    assert(complex.err instanceof AppError);
    assert(complex.err.stack === payload.err.stack);
    assert(typeof complex.count === 'bigint');
  }
}