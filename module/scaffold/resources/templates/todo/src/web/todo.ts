import { Controller, Get, Put, Post, Delete } from '@travetto/web';
import { NotFoundError } from '@travetto/model';
import { Inject } from '@travetto/di';
import { ModelQuery } from '@travetto/model-query';
import { Schema } from '@travetto/schema';
// {{#modules.auth}}
import { AuthContext } from '@travetto/auth';
// {{/modules.auth}}
// {{#modules.auth_rest}}
import { Authenticated } from '@travetto/auth-web';
// {{/modules.auth_rest}}
// @ts-expect-error
import { $_modelService_$ } from '$_modelImport_$';

import { Todo } from '../model/todo';

@Schema()
class Query {
  q: {
    // {{#modules.auth_rest}}
    userId?: string;
    // {{/modules.auth_rest}}
  } = {};
}

/**
 * Controller for managing all aspects of the Todo lifecycle
 */
@Controller('/todo')
// {{#modules.auth_rest}}
@Authenticated()
// {{/modules.auth_rest}}
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
    // {{#modules.auth_rest}}
    query.q.userId = this.authContext.principal?.id;
    // {{/modules.auth_rest}}
    return this.source.query(Todo, { where: query.q });
  }

  /**
   * Get Todo by id
   */
  @Get('/:id')
  async getOne(id: string): Promise<Todo> {
    const q: ModelQuery<Todo> = { where: { id } };
    // {{#modules.auth_rest}}
    if (typeof q.where !== 'string') {
      q.where!.userId = this.authContext.principal?.id;
    }
    // {{/modules.auth_rest}}
    return this.source.queryOne(Todo, q);
  }

  /**
   * Create a Todo
   */
  @Post('/')
  async save(todo: Todo): Promise<Todo> {
    // {{#modules.auth_rest}}
    todo.userId = this.authContext.principal?.id;
    // {{/modules.auth_rest}}
    return this.source.create(Todo, todo);
  }

  /**
   * Update a Todo
   */
  @Put('/:id')
  async update(todo: Todo): Promise<Todo> {
    // {{#modules.auth_rest}}
    todo.userId = this.authContext.principal?.id;
    // {{/modules.auth_rest}}
    return this.source.update(Todo, todo);
  }

  /**
   * Delete a Todo
   */
  @Delete('/:id')
  async remove(id: string): Promise<void> {
    const q: ModelQuery<Todo> = { where: { id } };
    // {{#modules.auth_rest}}
    if (typeof q.where !== 'string') {
      q.where!.userId = this.authContext.principal?.id;
    }
    // {{/modules.auth_rest}}
    if (await this.source.deleteByQuery(Todo, q) !== 1) {
      throw new NotFoundError(Todo, id);
    }
  }
}