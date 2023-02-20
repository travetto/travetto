import { Controller, Get, Put, Post, Delete } from '@travetto/rest';
import { NotFoundError } from '@travetto/model';
import { Inject } from '@travetto/di';
import { ModelQuery } from '@travetto/model-query';
import { Schema } from '@travetto/schema';
// {{#modules.auth-rest}}
import { Authenticated } from '@travetto/auth-rest';
// {{/modules.auth-rest}}
// {{#modules.auth-rest-context}}
import { AuthContextService } from '@travetto/auth-rest-context';
// {{/modules.auth-rest-context}}
import { $_modelService_$ } from '$_modelImport_$';

import { Todo } from '../model/todo';

@Schema()
class Query {
  q: {
    // {{#modules.auth-rest-context}}
    userId?: string;
    // {{/modules.auth-rest-context}}
  } = {};
}

/**
 * Controller for managing all aspects of the Todo lifecycle
 */
@Controller('/todo')
// {{#modules.auth-rest}}
@Authenticated()
// {{/modules.auth-rest}}
export class TodoController {

  @Inject()
  source: $_modelService_$;

  // {{#modules.auth-rest-context}}
  @Inject()
  auth: AuthContextService;
  // {{/modules.auth-rest-context}}

  /**
   * Get all Todos
   */
  @Get('/')
  async getAll(query: Query): Promise<Todo[]> {
    query.q ??= {};
    // {{#modules.auth-rest-context}}
    query.q.userId = this.auth.get()?.id;
    // {{/modules.auth-rest-context}}
    return this.source.query(Todo, { where: query.q });
  }

  /**
   * Get Todo by id
   */
  @Get('/:id')
  async getOne(id: string): Promise<Todo> {
    const q: ModelQuery<Todo> = { where: { id } };
    // {{#modules.auth-rest-context}}
    if (typeof q.where !== 'string') {
      q.where!.userId = this.auth.get()?.id;
    }
    // {{/modules.auth-rest-context}}
    return this.source.queryOne(Todo, q);
  }

  /**
   * Create a Todo
   */
  @Post('/')
  async save(todo: Todo): Promise<Todo> {
    // {{#modules.auth-rest-context}}
    todo.userId = this.auth.get()?.id;
    // {{/modules.auth-rest-context}}
    return this.source.create(Todo, todo);
  }

  /**
   * Update a Todo
   */
  @Put('/:id')
  async update(todo: Todo): Promise<Todo> {
    // {{#modules.auth-rest-context}}
    todo.userId = this.auth.get()?.id;
    // {{/modules.auth-rest-context}}
    return this.source.update(Todo, todo);
  }

  /**
   * Delete a Todo
   */
  @Delete('/:id')
  async remove(id: string): Promise<void> {
    const q: ModelQuery<Todo> = { where: { id } };
    // {{#modules.auth-rest-context}}
    if (typeof q.where !== 'string') {
      q.where!.userId = this.auth.get()?.id;
    }
    // {{/modules.auth-rest-context}}
    if (await this.source.deleteByQuery(Todo, q) !== 1) {
      throw new NotFoundError(Todo, id);
    }
  }
}