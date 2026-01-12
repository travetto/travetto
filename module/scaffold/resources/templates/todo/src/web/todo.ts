import { Controller, Get, Put, Post, Delete } from '@travetto/web';
import { NotFoundError } from '@travetto/model';
import { Inject } from '@travetto/di';
import type { ModelQuery } from '@travetto/model-query';
import { Schema } from '@travetto/schema';
// {{#modules.auth}}
import type { AuthContext } from '@travetto/auth';
// {{/modules.auth}}
// {{#modules.auth_web}}
import { Authenticated } from '@travetto/auth-web';
// {{/modules.auth_web}}
// @ts-expect-error
import type { $_modelService_$ } from '$_modelImport_$';

import { Todo } from '../model/todo.ts';

@Schema()
class Query {
  q: {
    // {{#modules.auth_web}}
    userId?: string;
    // {{/modules.auth_web}}
  } = {};
}

/**
 * Controller for managing all aspects of the Todo lifecycle
 */
@Controller('/todo')
// {{#modules.auth_web}}
@Authenticated()
// {{/modules.auth_web}}
export class TodoController {

  @Inject()
  source: $_modelService_$;

  // {{#modules.auth}}
  @Inject()
  authContext: AuthContext;
  // {{/modules.auth}}

  /**
   * Get all Todos
   */
  @Get('/')
  async getAll(query: Query): Promise<Todo[]> {
    query.q ??= {};
    // {{#modules.auth_web}}
    query.q.userId = this.authContext.principal?.id;
    // {{/modules.auth_web}}
    return this.source.query(Todo, { where: query.q });
  }

  /**
   * Get Todo by id
   */
  @Get('/:id')
  async getOne(id: string): Promise<Todo> {
    const query: ModelQuery<Todo> = { where: { id } };
    // {{#modules.auth_web}}
    if (typeof query.where !== 'string') {
      query.where!.userId = this.authContext.principal?.id;
    }
    // {{/modules.auth_web}}
    return this.source.queryOne(Todo, query);
  }

  /**
   * Create a Todo
   */
  @Post('/')
  async save(todo: Todo): Promise<Todo> {
    // {{#modules.auth_web}}
    todo.userId = this.authContext.principal?.id;
    // {{/modules.auth_web}}
    return this.source.create(Todo, todo);
  }

  /**
   * Update a Todo
   */
  @Put('/:id')
  async update(todo: Todo): Promise<Todo> {
    // {{#modules.auth_web}}
    todo.userId = this.authContext.principal?.id;
    // {{/modules.auth_web}}
    return this.source.update(Todo, todo);
  }

  /**
   * Delete a Todo
   */
  @Delete('/:id')
  async remove(id: string): Promise<void> {
    const query: ModelQuery<Todo> = { where: { id } };
    // {{#modules.auth_web}}
    if (typeof query.where !== 'string') {
      query.where!.userId = this.authContext.principal?.id;
    }
    // {{/modules.auth_web}}
    if (await this.source.deleteByQuery(Todo, query) !== 1) {
      throw new NotFoundError(Todo, id);
    }
  }
}