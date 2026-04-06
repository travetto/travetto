import { Controller, Get, Post, Put, Delete } from '@travetto/web';
import { Inject } from '@travetto/di';

import type { TodoService } from './service.ts';
import type { Todo, TodoSearch } from './model.ts';

/**
 * Todo request
 */
type TodoRequest = Omit<Todo, 'id'>;

@Controller('/todo')
export class TodoController {

  _service: TodoService;

  @Inject()
  set service(service: TodoService) {
    this._service = service;
  }

  /**
   * Get all todos
   */
  @Get('/')
  async getAll(search: TodoSearch): Promise<Todo[]> {
    return this._service.getAll(search);
  }

  /**
   * Delete all todos
   */
  @Delete('/')
  async deleteAllCompleted(): Promise<void> {
    await this._service.deleteAllCompleted();
  }

  /**
   * Get Todo by id
   * @param id Todo id
   */
  @Get('/:id')
  async getById(id: string): Promise<Todo> {
    return this._service.get(id);
  }

  /**
   * Create a todo
   */
  @Post('/')
  async create(todo: TodoRequest): Promise<Todo> {
    return await this._service.add({ ...todo, id: undefined! });
  }

  /**
   * Update a todo
   * @param id Todo id
   * @param todo Todo to update
   */
  @Put('/:id')
  async update(id: string, todo: TodoRequest): Promise<Todo> {
    return await this._service.update({ ...todo, id });
  }

  /**
   * Complete a todo
   * @param id Todo id
   */
  @Put('/:id/complete')
  async complete(id: string, completed: boolean = true): Promise<Todo> {
    console.log('Completing', id, completed);
    return await this._service.complete(id, completed);
  }

  /**
   * Delete a todo
   * @param id Todo id
   */
  @Delete('/:id')
  async remove(id: string): Promise<void> {
    console.log('Hello');
    await this._service.remove(id);
  }
}