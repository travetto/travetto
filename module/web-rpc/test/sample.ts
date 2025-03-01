import { Controller, Delete, Get, Post, Put } from '@travetto/web';
import { Specifier } from '@travetto/schema';

interface User {
  id: string;
  name: string;
  age: number;
  email?: string;
  permissions?: string[];
}

interface Todo {
  id: string;
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
  @Post()
  async createTodo(todo: Todo): Promise<Todo> {
    return todo;
  }

  /** Get all the todos, yay! */
  @Get()
  async listTodo(limit?: number, offset?: number, categories?: string[]): Promise<Todo[]> {
    return [];
  }

  @Delete('/:id')
  async deleteTodo(id: string): Promise<void> {

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