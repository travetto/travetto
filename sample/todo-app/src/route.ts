import { Controller, Get, Post, Put, Delete, Path, Query } from '@travetto/rest';
import { Inject } from '@travetto/di';
import { SchemaBody, SchemaQuery } from '@travetto/schema';

import { TodoService } from './service';
import { Todo, TodoSearch, Tree } from './model';

@Controller('/todo')
export class TodoController {

  @Inject()
  private svc: TodoService;

  /**
   * Get all todos
   */
  @Get('/')
  async getAll(@SchemaQuery() search: TodoSearch) {
    console.debug('howdy');
    return this.svc.getAll(search);
  }

  /**
   * Get Todo by id
   * @param id Todo id
   */
  @Get('/:id')
  async getById(@Path() id: string) {
    return this.svc.get(id);
  }

  /**
   * Create a todo
   */
  @Post('/')
  async create(@SchemaBody() todo: Todo) {
    return await this.svc.add(todo);
  }

  /**
   * Complete a todo
   * @param id Todo id
   */
  @Put('/:id/complete')
  async complete(@Path() id: string, @Query() completed: boolean = true) {
    return await this.svc.complete(id, completed);
  }

  /**
   * Delete a todo
   * @param id Todo id
   */
  @Delete('/:id')
  async remove(@Path() id: string) {
    await this.svc.remove(id);
  }

  @Get('/tree')
  async getTree() {
    return new Tree();
  }
}