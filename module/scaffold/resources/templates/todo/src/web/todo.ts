import { Controller, Get, Put, Post, Delete } from '@travetto/web';
import { NotFoundError } from '@travetto/model';
import { Inject } from '@travetto/di';
import { ModelQuery } from '@travetto/model-query';
import { Schema } from '@travetto/schema';
// {{#modules.auth}}
import { AuthContext } from '@travetto/auth';
// {{/modules.auth}}
// {{#modules.auth_web}}
import { Authenticated } from '@travetto/auth-web';
// {{/modules.auth_web}}
// @ts-expect-error
import { $_modelService_$ } from '$_modelImport_$';

import { Todo } from '../model/todo';

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
    const q: ModelQuery<Todo> = { where: { id } };
    // {{#modules.auth_web}}
    if (typeof q.where !== 'string') {
      q.where!.userId = this.authContext.principal?.id;
    }
    // {{/modules.auth_web}}
    return this.source.queryOne(Todo, q);
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
    const q: ModelQuery<Todo> = { where: { id } };
    // {{#modules.auth_web}}
    if (typeof q.where !== 'string') {
      q.where!.userId = this.authContext.principal?.id;
    }
    // {{/modules.auth_web}}
    if (await this.source.deleteByQuery(Todo, q) !== 1) {
      throw new NotFoundError(Todo, id);
    }
  }
}