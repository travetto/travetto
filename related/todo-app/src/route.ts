import { Controller, Get, Post, Put, Delete } from '@travetto/rest';
import { Inject } from '@travetto/di';

import { TodoService } from './service';
import { Todo, TodoSearch } from './model';

@Controller('/todo')
export class TodoController {

  _svc: TodoService;

  @Inject()
  set svc(v: TodoService) {
    this._svc = v;
  }

  /**
   * Get all todos
   */
  @Get('/')
  async getAll(search: TodoSearch) {
    return await this._svc.getAll(search);
  }

  /**
   * Delete all todos
   */
  @Delete('/')
  async deleteAllCompleted() {
    await this._svc.deleteAllCompleted();
  }

  /**
   * Get Todo by id
   * @param id Todo id
   */
  @Get('/:id')
  async getById(id: string) {
    return this._svc.get(id);
  }

  /**
   * Create a todo
   */
  @Post('/')
  async create(todo: Todo) {
    return await this._svc.add(todo);
  }

  /**
   * Update a todo
   * @param id Todo id
   * @param todo Todo to update
   */
  @Put('/:id')
  async update(id: string, todo: Todo) {
    todo.id = id;
    return await this._svc.update(todo);
  }


  /**
   * Complete a todo
   * @param id Todo id
   */
  @Put('/:id/complete')
  async complete(id: string, completed: boolean = true) {
    return await this._svc.complete(id, completed);
  }

  /**
   * Delete a todo
   * @param id Todo id
   */
  @Delete('/:id')
  async remove(id: string) {
    await this._svc.remove(id);
  }
}