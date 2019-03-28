import { Controller, Get, Put, Post, Delete, Request, TypedBody } from '@travetto/rest';
import { Inject } from '@travetto/di';
import { ModelService, ModelQuery } from '@travetto/model';
import { SchemaBody, SchemaQuery } from '@travetto/schema/extension/rest';
import { Schema } from '@travetto/schema';
// {{#modules.map.auth-rest}}
import { Authenticated } from '@travetto/auth-rest';
// {{/modules.map.auth-rest}}

import { Todo } from '../model/todo';

@Schema()
class Query {
  q: any = {};
}

/**
 * Controller for managing all aspects of the Todo lifecycle
 */
@Controller('/todo')
// {{#modules.map.auth-rest}}
@Authenticated()
// {{/modules.map.auth-rest}}
export class TodoController {

  @Inject()
  source: ModelService;

  /**
   * Get all Todos
   */
  @Get('/')
  @SchemaQuery(Query)
  async getAll(req: Request): Promise<Todo[]> {
    // {{#modules.map.auth-rest}}
    req.query.q = req.query.q || {};
    req.query.q.userId = req.auth.id;
    // {{/modules.map.auth-rest}}
    return this.source.getAllByQuery(Todo, req.query.q);
  }

  /**
   * Get Todo by id
   */
  @Get('/:id')
  async getOne(req: Request): Promise<Todo> {
    const q: ModelQuery<Todo> = { where: { id: req.params.id } };
    // {{#modules.map.auth-rest}}
    q.where!.userId = req.auth.id;
    // {{/modules.map.auth-rest}}
    return this.source.getByQuery(Todo, q);
  }

  /**
   * Create a Todo
   */
  @Post('/')
  @SchemaBody(Todo)
  async save(req: TypedBody<Todo>): Promise<Todo> {
    // {{#modules.map.auth-rest}}
    req.body.userId = req.auth.id;
    // {{/modules.map.auth-rest}}
    return this.source.save(Todo, req.body);
  }

  /**
   * Update a Todo
   */
  @Put('/:id')
  @SchemaBody(Todo)
  async update(req: TypedBody<Todo>): Promise<Todo> {
    // {{#modules.map.auth-rest}}
    req.body.userId = req.auth.id;
    // {{/modules.map.auth-rest}}
    return this.source.update(Todo, req.body);
  }

  /**
   * Delete a Todo
   */
  @Delete('/:id')
  async remove(req: Request): Promise<void> {
    const q: ModelQuery<Todo> = { where: { id: req.params.id } };
    // {{#modules.map.auth-rest}}
    q.where!.userId = req.auth.id;
    // {{/modules.map.auth-rest}}
    await this.source.deleteByQuery(Todo, q);
  }
}