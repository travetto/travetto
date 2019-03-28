Getting Started: A Todo App
====

The following tutorial wil walk you through setting up a `travetto` application from scratch.  We'll be building a simple todo application. The entire source of the finished project can be found at [`github`](https://www.github.com/travetto/todo-app).  Additionally, you can use the [`Yeoman Generator`](https://github.com/travetto/travetto/tree/master/module/generator-app)

### Overview
* [Prerequisites](#prerequisites)
* [Project initialization](#project-initialization)
* [Establishing the model](#establishing-the-model)
* [Configuring the data source](#configuring-the-data-source)
* [Building the service layer](#building-the-service-layer)
* [Writing unit tests](#writing-unit-tests)
* [Creating the rest routes](#creating-the-rest-routes)
* [Creating the App Entry-point](#creating-the-app-entry-point)
* [Test the final product](#test-the-final-product)

## Prerequisites

Install

* [`Node`](https://nodejs.org/en/download/current/) v10.x + (required)
* [`Mongodb`](https://docs.mongodb.com/manual/administration/install-community/) 3.6+ (required)
* [`vscode`](https://code.visualstudio.com/download) (recommended)
* [`Travetto Test Plugin`](https://marketplace.visualstudio.com/items?itemName=arcsine.travetto-test-plugin) (recommended)

## Project initialization

**Install: Getting Ready**
```bash
$ mkdir todo-project
$ cd todo-project

$ git init .

$ npm init -f 
$ npm i @travetto/{log,test,rest-express,model-mongo}
```

Set `tsconfig.json` to the following:

**Config: Setting up tsconfig.json**
```json
{
    "extends": "./node_modules/@travetto/base/tsconfig.json"
}
```

And set `tslint.json` to the following:

**Config: Setting up tslint.json**
```json
{
  "extends": "@travetto/base/tslint.json"
}
```

## Establishing the model
Let's create the model for the todo application.  The fields we will need should be:
* `id` as a unique identifier
* `text` as the actual todo information
* `created` the date the todo was created
* `completed` whether or not the todo was completed

Create the file `src/model.ts`

**Code: Models, src/model.ts**
```typescript
import { Model, ModelCore } from '@travetto/model';

@Model()
export class Todo implements ModelCore {
  id?: string;
  text: string;
  created?: Date;
  completed?: boolean;
}

@Schema()
export class TodoSearch {
  offset?: number;
  limit?: number;
}
```
as you can see, the model structure is simple.  Everything that uses the `Model` services needs to implement `ModelCore`.

## Configuring the data source
Next we need to prepare the `MongoModelSource` to be used at runtime.

We need to create `src/config.ts`

**Code: Configuration, src/config.ts**
```typescript
import { InjectableFactory } from '@travetto/di';
import { MongoModelSource, MongoModelConfig } from '@travetto/model-mongo';
import { ModelSource } from '@travetto/model';

export class AppConfig {
  @InjectableFactory()
  static getDataSource(config: MongoModelConfig): ModelSource {
    return new MongoModelSource(config);
  }
}
```
The `@InjectableFactory` allows you to create injection candidates.  Note that the `MongoModelSource` has the return type 
specified as `ModelSource`.

## Building the service layer
Next we establish the functionality for the service layer. The operations we need are:
* Create a new todo
* Complete a todo
* Remove a todo
* Get all todos

Now we need to create `src/service.ts`

**Code: Service Definition, src/service.ts**
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

  async getAll(search: TodoSearch) {
    return this.modelService.getAllByQuery(Todo, search);
  }

  async complete(id: string, completed = true) {
    return this.modelService.updatePartialByQuery(Todo,
      { where: { id } },
      { completed }
    );
  }

  async remove(id: string) {
    return this.modelService.deleteById(Todo, id);
  }
}
```

## Writing unit tests
After we have established our service layer, we will now construct some simple tests to verify the service layer is running correctly. First we need to initialize the testing configuration as the config in the `src/` folder is not automatically scanned.

Create the new test config at `test/config.ts`

**Code: Test configuration, test/config.ts**
```typescript
import { InjectableFactory } from '@travetto/di';
import { ModelSource } from '@travetto/model';
import { MongoModelSource, MongoModelConfig } from '@travetto/model-mongo';

export class TestConfig {
  @InjectableFactory()
  static testSource(): ModelSource {
    return new MongoModelSource(MongoModelConfig.from({
      namespace: `test-${Math.trunc(Math.random() * 10000)}`
    }));
  }
}
```

The tests should be defined at `test/service.ts`

**Code: Test bed, test/service.ts**
```typescript
import * as assert from 'assert';

import { Suite, Test, BeforeAll } from '@travetto/test';
import { DependencyRegistry } from '@travetto/di';
import { ModelRegistry } from '@travetto/model';
import { SchemaRegistry } from '@travetto/schema';

import { TodoService } from '../src/service';
import { Todo } from '../src/model';

@Suite()
export class TodoTest {

  @BeforeAll()
  async init() {
    await import('./config');

    await DependencyRegistry.init();
    await ModelRegistry.init();
    await SchemaRegistry.init();
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

    await svc.remove(saved.id!);

    try {
      await svc.get(saved.id!);
    } catch (e) {
      assert(e.message);
    }
  }
}
```

## Creating the rest routes
Now we establish the routes, providing an interface to the service layer.

Finally, we establish the controller at `src/controller.ts`

**Code: Controller contents, src/controller.ts**
```typescript
import { Controller, Get, TypedBody, Post, Put, Delete, Request, TypedQuery } from '@travetto/rest';
import { Inject } from '@travetto/di';
import { SchemaBody, SchemaQuery } from '@travetto/schema/extension/rest';

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
  @SchemaQuery(TodoSearch)
  async getAll(req: TypedQuery<TodoSearch>): Promise<Todo[]> {
    return this.svc.getAll(req.query);
  }

  /**
   * Get Todo by id
   * @param id {String} Todo id
   */
  @Get('/:id')
  async getById(req: Request): Promise<Todo> {
    return this.svc.get(req.params.id);
  }

  /**
   * Create a todo
   */
  @Post('/')
  @SchemaBody(Todo)
  async create(req: TypedBody<Todo>): Promise<Todo> {
    return await this.svc.add(req.body);
  }

  /**
   * Complete a todod
   * @param id {String} Todo id
   */
  @Put('/:id/complete')
  async complete(req: Request) {
    return await this.svc.complete(req.params.id, req.query.completed);
  }

  /**
   * Delete a todo
   * @param id {String} Todo id
   */
  @Delete('/:id')
  async remove(req: Request) {
    await this.svc.remove(req.params.id);
  }
}
```

## Creating the App Entry-point
Finally, to pull all of this together, we need to launch the application entry point.  This requires us to use the `@Application` decorator to identify a class as an entry-point for the application.  Any application can have multiple entry-points.

The entry-point should be at `src/app.ts` as:

**Code: Application entry point, src/app.ts**
```typescript
import { Inject } from '@travetto/di';
import { Application, RestApp } from '@travetto/rest';

@Application('todo')
export class TodoApp {

  @Inject()
  app: RestApp;

  run() {
    this.app.run();
  }
}
```

## Test the final product
First we must start the application

**Terminal: Output of application startup**
```bash
$ npx travetto todo
2019-03-22T04:51:28 info  Env {
  "cwd": "/Users/tim/Code/travetto/sample/todo-app",
  "profiles": [
    "application",
    "dev"
  ],
  "dev": true,
  "appRoots": [
    "./"
  ],
  "debug": true,
  "watch": true
}
2019-03-22T04:51:28 debug [@trv:base/phase] Initializing Phase bootstrap [ 'base', 'log', 'config', 'compiler', 'registry', 'schema' ]
2019-03-22T04:51:28 debug [@trv:config/source] Found configurations for [ 'application' ]
2019-03-22T04:51:28 info  [@trv:config/source] Configured {
  "registry": {
    "injectable": {
      "@travetto/config": "Config",
      "@travetto/model": [
        "ModelController"
      ],
      "@travetto/rest": [
        "Controller",
        "Application"
      ]
    },
    "schema": {
      "@travetto/model": "Model"
    },
    "application": {
      "@travetto/rest": [
        "Application"
      ]
    }
  },
  "rest": {
    "cors": {
      "active": true
    }
  },
  "api": {
    "client": {
      "output": "./api-client",
      "format": "typescript-angular",
      "formatOptions": "supportsES6=true,ngVersion=6.1"
    }
  },
  "elasticsearch": {
    "model": {
      "namespace": "todo"
    }
  }
}
2019-03-22T04:51:28 debug [@trv:compiler/transformers] Configured Transformers before [ 'application',
  'test:line-numbers',
  'registry',
  'di',
  'log',
  'rest',
  'schema',
  'test:assert' ]
2019-03-22T04:51:28 debug [@trv:compiler/compiler] Initialized 0.002
2019-03-22T04:51:28 debug [@trv:registry/registry: 42] Initialized @trv:model/registry#$ModelRegistry
2019-03-22T04:51:28 debug [@trv:registry/registry: 42] Initialized @trv:rest/registry.registry#$ControllerRegistry
2019-03-22T04:51:28 debug [@trv:registry/registry: 42] Initialized @trv:schema/service.registry#$SchemaRegistry
2019-03-22T04:51:28 debug [@trv:registry/registry: 42] Initialized @trv:di/registry#$DependencyRegistry
2019-03-22T04:51:28 debug [@trv:registry/registry: 42] Initialized @trv:registry/service.root#$RootRegistry
body-parser deprecated undefined extended: provide extended option node_modules/@travetto/di/bin/lib.js:76:49
2019-03-22T04:51:28 debug [@trv:rest/interceptor.types: 51] Sorting interceptors 2 [ 'CorsInterceptor', 'GetCacheInterceptor', [length]: 2 ]
2019-03-22T04:51:28 debug [@trv:model-elasticsearch/config: 17] Constructed ElasticsearchModelConfig {
  hosts: [ '127.0.0.1', [length]: 1 ],
  port: 9200,
  options: {},
  namespace: 'todo',
  autoCreate: true,
  indexCreate: { number_of_replicas: 0, number_of_shards: 1 } }
2019-03-22T04:51:28 info  [@trv:swagger/client-generate: 33] Running code generator in watch mode ./api-client
2019-03-22T04:51:28 debug [@trv:rest/app: 87] Registering Controller Instance @trv:swagger/controller#SwaggerController / 1
2019-03-22T04:51:28 debug [@trv:rest/app: 87] Registering Controller Instance @app/src.route#TodoController /todo 5
2019-03-22T04:51:28 info  [@trv:rest/app:106] Listening on 3000
2019-03-22T04:51:29 debug [@trv:compiler/presence] Watching files 5
```

next, let's execute `curl` requests to interact with the new api

**Terminal: Creating todo by curl, and then fetching**
```bash
# Let's create a new todo
$ curl -XPOST localhost:3000/todo -H 'Content-Type: application/json' -d '{ "text": "New Todo" }' 

## returned data
{
  "text": "New Todo",
  "created": "2018-06-24T05:03:16.438Z",
  "id": "5b2f2614020fd21df02cd216"
}

# Now let's list all todos currently saved
$ curl -XGET localhost:3000/todo -H 'Content-Type: application/json' 

## returns
[
  {
    "id": "5b2f2614020fd21df02cd216",
    "text": "New Todo",
    "created": "2018-06-24T05:03:16.438Z"
  }
]

```
