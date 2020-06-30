
# Getting Started: A Todo App

The following tutorial wil walk you through setting up a [travetto](https://travetto.dev) application from scratch.  We'll be building a simple todo application. The entire source of the finished project can be found at [Todo App Source](https://www.github.com/travetto/todo-app).  Additionally, you can use the [Yeoman Generator](https://github.com/travetto/travetto/tree/1.0.0-docs-overhaul/module//generator-app "Yeoman app generator for the Travetto framework").

### Overview
   
   *  [Prerequisites](#prerequisites)
   *  [Project initialization](#project-initialization)
   *  [Establishing the model](#establishing-the-model)
   *  [Configuring the data source](#configuring-the-data-source)
   *  [Building the service layer](#building-the-service-layer)
   *  [Writing unit tests](#writing-unit-tests)
   *  [Creating the rest routes](#creating-the-rest-routes)
   *  [Creating the App Entry Point](#creating-the-app-entry-point)
   *  [Test the final product](#test-the-final-product)

## Prerequisites

Install
   
   *  [Node](https://nodejs.org/en/download/current/) v12.x + (required)
   *  [Mongodb](https://docs.mongodb.com/manual/administration/install-community/) 3.6+ (required)
   *  [vscode](https://code.visualstudio.com/download) (recommended)
   *  [VSCode plugin](https://marketplace.visualstudio.com/items?itemName=arcsine.travetto-plugin) (recommended)

## Project Initialization

**Terminal: Getting Ready**
```bash
$ mkdir todo-project
$ cd todo-project

$ git init .

$ npm init -f
$ npm i @travetto/{log,test,rest-express,model-mongo}
```

## Establishing The Model

Let's create the model for the todo application.  The fields we will need should be:

   
   *  `id` as a unique identifier
   *  `text` as the actual todo information
   *  `created` the date the todo was created
   *  `completed` whether or not the todo was completed

Create the file `src/model.ts`

**Code: Models**
```typescript
import { Model } from '@travetto/model';
import { Schema } from '@travetto/schema';

@Model()
export class Todo {
  id?: string;
  text: string;
  created?: Date;
  completed?: boolean;
  priority?: number;
  who?: string;
  color?: string;
}

@Schema()
export class TodoSearch {
  offset?: number;
  limit?: number;
}
```

as you can see, the model structure is simple.  Everything that uses the [@Model](https://github.com/travetto/travetto/tree/1.0.0-docs-overhaul/module//model/src/registry/decorator.ts#L12) services needs to implement [ModelCore](https://github.com/travetto/travetto/tree/1.0.0-docs-overhaul/module//model/src/model/core.ts).

## Building the Service Layer

Next we establish the functionality for the service layer. The operations we need are:
   
   *  Create a new todo
   *  Complete a todo
   *  Remove a todo
   *  Get all todos

Now we need to create `src/service.ts`

**Code: Service Definition**
```typescript
import { ModelService } from '@travetto/model';
import { Injectable, Inject } from '@travetto/di';
import { Todo, TodoSearch } from './model';

@Injectable()
export class TodoService {

  @Inject()
  private modelService: ModelService;

  async add(todo: Todo) {
    todo.created = new Date();
    const saved = await this.modelService.save(Todo, todo);
    return saved;
  }

  async get(id: string) {
    return this.modelService.getById(Todo, id);
  }

  async getAll(search: TodoSearch) {
    return this.modelService.getAllByQuery(Todo, search);
  }

  async complete(id: string, completed = true) {
    return this.modelService.updatePartial(Todo,
      Todo.from({ id, completed })
    );
  }

  async remove(id: string) {
    return this.modelService.deleteById(Todo, id);
  }
}
```

## Writing Unit tests

After we have established our service layer, we will now construct some simple tests to verify the service layer is running correctly. By default we set the database schema name under `test/resources/application.yml` to ensure we aren't writing to our dev database.

**Code: Test YAML**
```yaml
---
mongo.model.namespace: app-test
```

Now the tests should be defined at `test/service.ts`

**Code: Test bed**
```typescript
import * as assert from 'assert';

import { Suite, Test, BeforeAll, AfterAll } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';
import { DependencyRegistry } from '@travetto/di';
import { ModelSource } from '@travetto/model';
// import { BaseSQLModelTest } from '@travetto/model-sql/support/test.model-sql';

import { TodoService } from '../src/service';
import { Todo } from '../src/model';

@Suite()
export class TodoTest {

  @BeforeAll()
  async init() {
    await RootRegistry.init();
  }

  @AfterAll()
  async destroy() {
    const source = await DependencyRegistry.getInstance(ModelSource);
    return source.clearDatabase();
  }

  @Test('Create todo')
  async create() {
    const svc = await DependencyRegistry.getInstance(TodoService);

    const test = Todo.from({
      text: 'Sample Task'
    });

    const saved = await svc.add(test);

    assert.ok(saved.id);
  }

  @Test('Complete todo')
  async complete() {
    const svc = await DependencyRegistry.getInstance(TodoService);

    const test = Todo.from({
      text: 'Sample Task'
    });

    const saved = await svc.add(test);
    assert.ok(saved.id);

    let updated = await svc.complete(saved.id!);
    assert(updated.completed === true);

    updated = await svc.complete(saved.id!, false);
    assert(updated.completed === false);
  }

  @Test('Delete todo')
  async remove() {
    const svc = await DependencyRegistry.getInstance(TodoService);

    const test = Todo.from({
      text: 'Sample Task'
    });

    const saved = await svc.add(test);
    assert.ok(saved.id);
    assert(test.text === 'Sample Task');

    await svc.remove(saved.id!);

    try {
      await svc.get(saved.id!);
    } catch (e) {
      assert(e.message);
    }
  }
}
```

## Adding Rest Routes
Now we establish the routes, providing an interface to the service layer.

Finally, we establish the controller at `src/route.ts`

**Code: Controller contents**
```typescript
import { Controller, Get, Post, Put, Delete, Path, Query } from '@travetto/rest';
import { Inject } from '@travetto/di';
import { SchemaBody, SchemaQuery } from '@travetto/schema';

import { TodoService } from './service';
import { Todo, TodoSearch } from './model';

@Controller('/todo')
export class TodoController {

  @Inject()
  private svc: TodoService;

  /**
   * Get all todos
   */
  @Get('/')
  async getAll(@SchemaQuery() search: TodoSearch) {
    return this.svc.getAll(search);
  }

  /**
   * Get Todo by id
   * @param id Todo id
   */
  @Get('/:id')
  async getById(@Path() id: string) {
    return this.svc.get(id);
  }

  /**
   * Create a todo
   */
  @Post('/')
  async create(@SchemaBody() todo: Todo) {
    return await this.svc.add(todo);
  }

  /**
   * Complete a todo
   * @param id Todo id
   */
  @Put('/:id/complete')
  async complete(@Path() id: string, @Query() completed: boolean = true) {
    return await this.svc.complete(id, completed);
  }

  /**
   * Delete a todo
   * @param id Todo id
   */
  @Delete('/:id')
  async remove(@Path() id: string) {
    await this.svc.remove(id);
  }
}
```

## Running the App

First we must start the application:

**Terminal: Application Startup**
```bash
$ /bin/bash alt/docs/bin/startup.sh

2020-07-03T18:05:23.298Z info  [./node_modules/@travetto/app/src/registry.ts:32] Running application rest @travetto/rest/support/application.rest.ts
2020-07-03T18:05:23.302Z info  [./node_modules/@travetto/app/src/registry.ts:33] Configured {
  app: {
    watch: true,
    readonly: false,
    travetto: '1.0.0-rc.8',
    name: '@travetto/todo-app',
    version: undefined,
    license: 'ISC',
    description: '',
    author: '',
    env: 'dev',
    profiles: [ 'application', 'dev' ],
    roots: [ '.' ],
    resourceRoots: [ '.' ],
    debug: { status: false, value: undefined }
  },
  config: {
    rest: { cors: { active: true } },
    api: { spec: { output: './openapi.json' } },
    sql: {
      model: { namespace: 'todo', user: 'root', password: 'password' }
    }
  }
}
```
 

next, let's execute [curl](https://curl.haxx.se/) requests to interact with the new api

**Code: Creating Todo by curl**
```bash
curl -XPOST localhost:3000/todo -H 'Content-Type: application/json' -d '{ "text": "New Todo" }' | jq
```

**Terminal: Create Output**
```bash
$ sh alt/docs/bin/create.sh
```

**Code: Listing Todos by curl**
```bash
curl -XGET localhost:3000/todo -H 'Content-Type: application/json' | jq
```

**Terminal: Listing Output**
```bash
$ sh alt/docs/bin/list.sh
```

