import assert from 'node:assert';

import { Controller, Delete, Get, Post, Put } from '@travetto/web';
import { Specifier } from '@travetto/schema';
import { Suite, Test } from '@travetto/test';
import { Util } from '@travetto/runtime';

import { BaseWebSuite } from '@travetto/web/support/test/suite/base.ts';
import { LocalRequestDispatcher } from '@travetto/web/support/test/dispatcher.ts';

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
  async uploadFun(@Specifier('file') user: Buffer): Promise<void> {
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
  async getRpc() {
    const { context: { httpStatusCode: createdStatus }, body: created } = await this.request<Todo>({
      context: {
        path: '/rpc/TodoController:createTodo',
        httpMethod: 'POST',
      },
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify([{
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
      body: JSON.stringify([])
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
      body: JSON.stringify([
        list[0].id
      ])
    });

    assert(removedStatusCode === 204);
    assert(Buffer.isBuffer(removed));
    assert(removed.byteLength === 0);
  }
}