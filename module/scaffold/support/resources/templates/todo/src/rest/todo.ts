import { Controller, Get, Put, Post, Delete } from '@travetto/rest';
import { NotFoundError } from '@travetto/model';
import { Inject } from '@travetto/di';
import { ModelQuery, ModelQueryCrudSupport } from '@travetto/model-query';
import { Schema } from '@travetto/schema';
// {{#modules.auth-rest}} // @doc-exclude
import { Authenticated } from '@travetto/auth-rest'; // @doc-exclude
// {{/modules.auth-rest}} // @doc-exclude
// {{#modules.auth-rest-context}} // @doc-exclude
import { AuthContextService } from '@travetto/auth-rest-context';
// {{/modules.auth-rest-context}} // @doc-exclude

import { Todo } from '../model/todo';

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
  source: ModelQueryCrudSupport;

  // {{#modules.auth-rest-context}} // @doc-exclude
  @Inject() // @doc-exclude
  auth: AuthContextService; // @doc-exclude
  // {{/modules.auth-rest-context}} // @doc-exclude

  /**
   * Get all Todos
   */
  @Get('/')
  async getAll(query: Query): Promise<Todo[]> {
    query.q ??= {};
    // {{#modules.auth-rest-context}} // @doc-exclude
    query.q.userId = this.auth.get()?.id; // @doc-exclude
    // {{/modules.auth-rest-context}} // @doc-exclude
    return this.source.query(Todo, { where: query.q });
  }

  /**
   * Get Todo by id
   */
  @Get('/:id')
  async getOne(id: string): Promise<Todo> {
    const q: ModelQuery<Todo> = { where: { id } };
    // {{#modules.auth-rest-context}} // @doc-exclude
    if (typeof q.where !== 'string') {
      q.where!.userId = this.auth.get()?.id; // @doc-exclude
    }
    // {{/modules.auth-rest-context}} // @doc-exclude
    return this.source.queryOne(Todo, q);
  }

  /**
   * Create a Todo
   */
  @Post('/')
  async save(todo: Todo): Promise<Todo> {
    // {{#modules.auth-rest-context}} // @doc-exclude
    todo.userId = this.auth.get()?.id; // @doc-exclude
    // {{/modules.auth-rest-context}} // @doc-exclude
    return this.source.create(Todo, todo);
  }

  /**
   * Update a Todo
   */
  @Put('/:id')
  async update(todo: Todo): Promise<Todo> {
    // {{#modules.auth-rest-context}} // @doc-exclude
    todo.userId = this.auth.get()?.id; // @doc-exclude
    // {{/modules.auth-rest-context}} // @doc-exclude
    return this.source.update(Todo, todo);
  }

  /**
   * Delete a Todo
   */
  @Delete('/:id')
  async remove(id: string): Promise<void> {
    const q: ModelQuery<Todo> = { where: { id } };
    // {{#modules.auth-rest-context}} // @doc-exclude
    if (typeof q.where !== 'string') {
      q.where!.userId = this.auth.get()?.id; // @doc-exclude
    }
    // {{/modules.auth-rest-context}} // @doc-exclude
    if (await this.source.deleteByQuery(Todo, q) !== 1) {
      throw new NotFoundError(Todo, id);
    }
  }
}