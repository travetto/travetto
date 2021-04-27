import { Controller, Get, Post, Put, Delete, Path, Query, SchemaBody, SchemaQuery } from '@travetto/rest';
import { Inject } from '@travetto/di';

import { TodoService } from './service';
import { Todo, TodoSearch } from './model';

@Controller('/todo')
export class TodoController {

  @Inject()
  private svc: TodoService;

  /**
   * Get all todos
   */
  @Get('/')
  async getAll(@SchemaQuery() search: TodoSearch) {
    const itr = await this.svc.getAll(search);
    const out = [];
    for await (const item of itr) {
      out.push(item);
    }
    return out;
  }

  /**
   * Delete all todos
   */
  @Delete('/')
  async deleteAllCompleted() {
    await this.svc.deleteAllCompleted();
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
  @Put('/:id')
  async update(@Path() id: string, @SchemaBody() todo: Todo) {
    todo.id = id;
    return await this.svc.update(todo);
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
}