import { AppError } from '@travetto/base';
import { Controller, Get, Put, Post, Delete, Path } from '@travetto/rest';
import { Inject } from '@travetto/di';
import { ModelService, ModelQuery } from '@travetto/model';
import { SchemaBody, SchemaQuery, Schema } from '@travetto/schema';
// {{#modules.auth-rest}}
import { Authenticated, AuthContextService } from '@travetto/auth-rest';
// {{/modules.auth-rest}}

import { Todo } from '../model/todo';

@Schema()
class Query {
  q: any = {};
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
  source: ModelService;

  // {{#modules.auth-rest}}
  @Inject()
  auth: AuthContextService;
  // {{/modules.auth-rest}}

  /**
   * Get all Todos
   */
  @Get('/')
  async getAll(@SchemaQuery() query: Query): Promise<Todo[]> {
    query.q = query.q || {};

    // {{#modules.auth-rest}}
    query.q.userId = this.auth.getId();
    // {{/modules.auth-rest}}
    return this.source.getAllByQuery(Todo, { where: query.q });
  }

  /**
   * Get Todo by id
   */
  @Get('/:id')
  async getOne(@Path() id: string): Promise<Todo> {
    const q: ModelQuery<Todo> = { where: { id } };
    // {{#modules.auth-rest}}
    q.where!.userId = this.auth.getId();
    // {{/modules.auth-rest}}
    return this.source.getByQuery(Todo, q);
  }

  /**
   * Create a Todo
   */
  @Post('/')
  async save(@SchemaBody() todo: Todo): Promise<Todo> {
    // {{#modules.auth-rest}}
    todo.userId = this.auth.getId();
    // {{/modules.auth-rest}}
    return this.source.save(Todo, todo);
  }

  /**
   * Update a Todo
   */
  @Put('/:id')
  async update(@SchemaBody() todo: Todo): Promise<Todo> {
    // {{#modules.auth-rest}}
    todo.userId = this.auth.getId();
    // {{/modules.auth-rest}}
    return this.source.update(Todo, todo);
  }

  /**
   * Delete a Todo
   */
  @Delete('/:id')
  async remove(@Path() id: string): Promise<void> {
    const q: ModelQuery<Todo> = { where: { id } };

    // {{#modules.auth-rest}}
    q.where!.userId = this.auth.getId();
    // {{/modules.auth-rest}}

    if (await this.source.deleteByQuery(Todo, q) !== 1) {
      throw new AppError('Not found by id', 'notfound');
    }
  }
}