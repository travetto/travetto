import timers from 'node:timers/promises';

import { Controller, Post, Get, Delete, Put } from '@travetto/rest';
import { Specifier } from '@travetto/schema';

export interface Todo {
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

  @Get('/name')
  async getName(name: string = 'bob'): Promise<string> {
    return name;
  }

  @Delete('/:id')
  async deleteTodo(id: string): Promise<number> {
    return 1;
  }

  @Put('/upload')
  async upload(@Specifier('file') data: Buffer): Promise<number> {
    return data.length;
  }

  @Post('/timeouts')
  async getLong(value: string): Promise<{ message: string }> {
    const start = Date.now();
    await timers.setTimeout(200);
    return {
      message: [
        'LONG TIME',
        `serverStartTime=${new Date(start).toISOString().split('T')[1]}`,
        `serverEndTime=${new Date().toISOString().split('T')[1]}`,
        `value=${value} server=${Date.now() - start}`
      ].join(' ')
    };
  }
}
