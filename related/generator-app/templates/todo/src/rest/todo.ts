import { AppError } from '@travetto/base';
import { Controller, Get, Put, Post, Delete, Path, SchemaBody, SchemaQuery } from '@travetto/rest';
import { Inject } from '@travetto/di';
import { ModelQuery, ModelQueryCrudSupport } from '@travetto/model-query';
import { Schema } from '@travetto/schema';
// {{#modules.auth-rest}} // @doc-exclude
import { Authenticated, AuthContextService } from '@travetto/auth-rest'; // @doc-exclude
// {{/modules.auth-rest}} // @doc-exclude

import { Todo } from '../model/todo';
import { ModelCrudSupport } from '@travetto/model';

@Schema()
class Query {
  q: any = {};
}

/**
 * Controller for managing all aspects of the Todo lifecycle
 */
@Controller('/todo')
// {{#modules.auth-rest}} // @doc-exclude
@Authenticated() // @doc-exclude
// {{/modules.auth-rest}} // @doc-exclude
export class TodoController {

  @Inject()
  source: ModelCrudSupport
    // {{#modules.model-query}} // @doc-exclude
    & ModelQueryCrudSupport
    // {{/modules.model-query}} // @doc-exclude
    ;

  // {{#modules.auth-rest}} // @doc-exclude
  @Inject() // @doc-exclude
  auth: AuthContextService; // @doc-exclude
  // {{/modules.auth-rest}} // @doc-exclude

  /**
   * Get all Todos
   */
  @Get('/')
  async getAll(@SchemaQuery() query: Query): Promise<Todo[]> {
    query.q = query.q || {};
    // {{#modules.auth-rest}} // @doc-exclude
    query.q.userId = this.auth.getId(); // @doc-exclude
    // {{/modules.auth-rest}} // @doc-exclude
    return this.source.query(Todo, { where: query.q });
  }

  /**
   * Get Todo by id
   */
  @Get('/:id')
  async getOne(@Path() id: string): Promise<Todo> {
    const q: ModelQuery<Todo> = { where: { id } };
    // {{#modules.auth-rest}} // @doc-exclude
    if (typeof q.where !== 'string') {
      q.where!.userId = this.auth.getId(); // @doc-exclude
    }
    // {{/modules.auth-rest}} // @doc-exclude
    return this.source.queryOne(Todo, q);
  }

  /**
   * Create a Todo
   */
  @Post('/')
  async save(@SchemaBody() todo: Todo): Promise<Todo> {
    // {{#modules.auth-rest}} // @doc-exclude
    todo.userId = this.auth.getId(); // @doc-exclude
    // {{/modules.auth-rest}} // @doc-exclude
    return this.source.create(Todo, todo);
  }

  /**
   * Update a Todo
   */
  @Put('/:id')
  async update(@SchemaBody() todo: Todo): Promise<Todo> {
    // {{#modules.auth-rest}} // @doc-exclude
    todo.userId = this.auth.getId(); // @doc-exclude
    // {{/modules.auth-rest}} // @doc-exclude
    return this.source.update(Todo, todo);
  }

  /**
   * Delete a Todo
   */
  @Delete('/:id')
  async remove(@Path() id: string): Promise<void> {
    const q: ModelQuery<Todo> = { where: { id } };
    // {{#modules.auth-rest}} // @doc-exclude    
    if (typeof q.where !== 'string') {
      q.where!.userId = this.auth.getId(); // @doc-exclude
    }
    // {{/modules.auth-rest}} // @doc-exclude
    if (await this.source.deleteByQuery(Todo, q) !== 1) {
      throw new AppError('Not found by id', 'notfound');
    }
  }
}