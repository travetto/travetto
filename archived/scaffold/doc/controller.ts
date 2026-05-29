import { Controller, Get, Put, Post, Delete } from '@travetto/web';
import { NotFoundError } from '@travetto/model';
import { Inject } from '@travetto/di';
import type { ModelQuery, ModelQueryCrudSupport } from '@travetto/model-query';
import { Schema } from '@travetto/schema';

import { Todo } from './model.ts';

@Schema()
class Query {
  q: object = {};
}

/**
 * Controller for managing all aspects of the Todo lifecycle
 */
@Controller('/todo')
export class TodoController {

  @Inject()
  source: ModelQueryCrudSupport;

  /**
   * Get all Todos
   */
  @Get('/')
  async getAll(query: Query): Promise<Todo[]> {
    query.q ??= {};
    return this.source.query(Todo, { where: query.q });
  }

  /**
   * Get Todo by id
   */
  @Get('/:id')
  async getOne(id: string): Promise<Todo> {
    const query: ModelQuery<Todo> = { where: { id } };
    if (typeof query.where !== 'string') {
    }
    return this.source.queryOne(Todo, query);
  }

  /**
   * Create a Todo
   */
  @Post('/')
  async save(todo: Todo): Promise<Todo> {
    return this.source.create(Todo, todo);
  }

  /**
   * Update a Todo
   */
  @Put('/:id')
  async update(todo: Todo): Promise<Todo> {
    return this.source.update(Todo, todo);
  }

  /**
   * Delete a Todo
   */
  @Delete('/:id')
  async remove(id: string): Promise<void> {
    const query: ModelQuery<Todo> = { where: { id } };
    if (typeof query.where !== 'string') {
    }
    if (await this.source.deleteByQuery(Todo, query) !== 1) {
      throw new NotFoundError(Todo, id);
    }
  }
}