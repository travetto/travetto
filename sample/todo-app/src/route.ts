import { Controller, Get, TypedBody, Post, Put, Delete, Request, TypedQuery } from '@travetto/rest';
import { Inject } from '@travetto/di';
import { SchemaBody, SchemaQuery } from '@travetto/schema/src/extension/rest.ext';

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
  @SchemaQuery(TodoSearch)
  async getAll(req: TypedQuery<TodoSearch>): Promise<Todo[]> {
    return this.svc.getAll(req.query);
  }

  /**
   * Get Todo by id
   * @param id {String} Todo id
   */
  @Get('/:id')
  async getById(req: Request): Promise<Todo> {
    return this.svc.get(req.params.id);
  }

  /**
   * Create a todo
   */
  @Post('/')
  @SchemaBody(Todo)
  async create(req: TypedBody<Todo>): Promise<Todo> {
    return await this.svc.add(req.body);
  }

  /**
   * Complete a todo
   * @param id {String} Todo id
   */
  @Put('/:id/complete')
  async complete(req: Request) {
    return await this.svc.complete(req.params.id, req.query.completed);
  }

  /**
   * Delete a todo
   * @param id {String} Todo id
   */
  @Delete('/:id')
  async remove(req: Request) {
    await this.svc.remove(req.params.id);
  }
}