<!-- This file was generated by @travetto/doc and should not be modified directly -->
<!-- Please modify https://github.com/travetto/travetto/tree/main/module/scaffold/DOC.tsx and execute "npx trv doc" to rebuild -->
# App Scaffold

## App Scaffold for the Travetto framework

A simple tool for scaffolding a reference project.  To get started, you need to make sure:

**Terminal: Setting up the necessary config**
```bash
$ git config --global.username <Username> #Set your git username
```

Once the necessary configuration is setup, you can invoke the scaffolding by running

**Terminal: Running Generator**
```bash
$ npx @travetto/scaffold

# or

$ npx @travetto/scaffold@<version-or-tag>
```

The generator will ask about enabling the following features:

## Web Application
The [Web API](https://github.com/travetto/travetto/tree/main/module/web#readme "Declarative support for creating Web Applications") provides the necessary integration for exposing web apis.  When selecting the `web` feature, you will need to specify which backend you want to include with your application, the default being [express](https://expressjs.com).  Currently you can select from:
   *  [express](https://expressjs.com)
   *  [koa](https://koajs.com/)
   *  [fastify](https://www.fastify.io/)

The code will establish some basic endpoints, specifically, `GET / ` as the root endpoint.  This will return the contents of your `package.json` as an identification operation.

### Additional Web Features
In addition to the core functionality, the `web` feature has some useful sub-features.  Specifically:

[OpenAPI Specification](https://github.com/travetto/travetto/tree/main/module/openapi#readme "OpenAPI integration support for the Travetto framework") support for the web api.  This will automatically expose a `openapi.yml` endpoint, and provide the necessary plumbing to support client generation. 

[Logging](https://github.com/travetto/travetto/tree/main/module/log#readme "Logging framework that integrates at the console.log level.") support for better formatting, [debug](https://www.npmjs.com/package/debug) like support, and colorized output.  This is generally useful for server logs, especially during development.

## Authentication
Authentication is also supported on the Web endpoints by selecting [Web Auth](https://github.com/travetto/travetto/tree/main/module/auth-web#readme "Web authentication integration support for the Travetto framework") during setup.  This will support basic authentication running out of local memory.

## Testing
[Testing](https://github.com/travetto/travetto/tree/main/module/test#readme "Declarative test framework") can also be configured out of the box to provide simple test cases for the data model.

## Data Modelling and Storage
The [Data Modeling Support](https://github.com/travetto/travetto/tree/main/module/model#readme "Datastore abstraction for core operations.") allows for modeling of application data, and provides mechanisms for storage and retrieval.  When setting up your application, you will need to select which database backend you want to use:
   *  [elasticsearch](https://elastic.co)
   *  [mongodb](https://mongodb.com)
   *  [SQL](https://en.wikipedia.org/wiki/SQL)
   *  [DynamoDB](https://aws.amazon.com/dynamodb/)
   *  [Firestore](https://firebase.google.com/docs/firestore)

A default model is constructed, a [Todo](https://github.com/travetto/travetto/tree/main/module/scaffold/doc/model.ts#L4) class:

**Code: Todo Model**
```typescript
import { Model, ModelType } from '@travetto/model';

@Model()
export class Todo implements ModelType {
  id: string;
  text: string;
  completed?: boolean;
  userId?: string;
}
```

Basic tests are also included for the `model` to verify that database interaction and functionality is working properly.

## Web + Model
In the case both `web` and `model` features are enabled, the code will produce a controller that exposes the [Todo](https://github.com/travetto/travetto/tree/main/module/scaffold/doc/model.ts#L4) model via web patterns.

**Code: Todo controller**
```typescript
import { Controller, Get, Put, Post, Delete } from '@travetto/web';
import { NotFoundError } from '@travetto/model';
import { Inject } from '@travetto/di';
import { ModelQuery, ModelQueryCrudSupport } from '@travetto/model-query';
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
    const q: ModelQuery<Todo> = { where: { id } };
    if (typeof q.where !== 'string') {
    }
    return this.source.queryOne(Todo, q);
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
    const q: ModelQuery<Todo> = { where: { id } };
    if (typeof q.where !== 'string') {
    }
    if (await this.source.deleteByQuery(Todo, q) !== 1) {
      throw new NotFoundError(Todo, id);
    }
  }
}
```

## Running
Once finished the application will reflect the modules chosen, and will be ready for execution, if you have configured a runnable application.  Currently, this requires the `web` feature to be selected.

**Terminal: Starting the App**
```bash
npm start
```
