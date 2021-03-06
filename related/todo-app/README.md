<!-- This file was generated by @travetto/doc and should not be modified directly -->
<!-- Please modify https://github.com/travetto/travetto/tree/main/related/todo-app/doc.ts and execute "npx trv doc" to rebuild -->
# Getting Started: A Todo App

The following tutorial wil walk you through setting up a [Travetto](https://travetto.dev) application from scratch.  We'll be building a simple todo application. The entire source of the finished project can be found at [Todo App](https://github.com/travetto/travetto/tree/main).  Additionally, you can use the [App Scaffold](https://github.com/travetto/travetto/tree/main/module/scaffold#readme "App Scaffold for the Travetto framework").

### Overview   
   1. [Prerequisites](#prerequisites})
   1. [Project Initialization](#project-initialization})
   1. [Establishing The Model](#establishing-the-model})
   1. [Building the Service Layer](#building-the-service-layer})
   1. [Writing Unit tests](#writing-unit-tests})
   1. [Adding Rest Routes](#adding-rest-routes})
   1. [Running the App](#running-the-app})

## Prerequisites

Install
   
   *  [Node](https://nodejs.org/en/download/current/) v15.x+ (recommended, but v12.x+ supported)
   *  [Mongodb](https://docs.mongodb.com/manual/administration/install-community/) 3.6+ (required)
   *  [VSCode](https://code.visualstudio.com/download) (recommended)
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
  id: string;
  text: string;
  created?: Date;
  completed?: boolean;
  priority?: number;
  who?: string;
  color?: string;
}

@Schema()
export class TodoSearch {
  q?: string;
  offset?: number;
  limit?: number;
}
```

as you can see, the model structure is simple.  Everything that uses the [@Model](https://github.com/travetto/travetto/tree/main/module/model/src/registry/decorator.ts#L13) services needs to implement [ModelType](https://github.com/travetto/travetto/tree/main/module/model/src/types/model.ts#L1).

## Building the Service Layer

Next we establish the functionality for the service layer. The operations we need are:
   
   *  Create a new todo
   *  Complete a todo
   *  Remove a todo
   *  Get all todos

Now we need to create `src/service.ts`

**Code: Service Definition**
```typescript
import { MongoModelService } from '@travetto/model-mongo';
import { Injectable, Inject } from '@travetto/di';

import { Todo, TodoSearch } from './model';

@Injectable()
export class TodoService {

  @Inject()
  private modelService: MongoModelService;

  async add(todo: Todo) {
    todo.created = new Date();
    const saved = await this.modelService.create(Todo, todo);
    return saved;
  }

  async update(todo: Todo) {
    return await this.modelService.updatePartial(Todo, todo);
  }

  async get(id: string) {
    return this.modelService.get(Todo, id);
  }

  async getAll(search: TodoSearch) {
    return this.modelService.query(Todo, { where: { text: { $regex: search.q ?? '.*' } }, ...search, sort: [{ created: -1 }] });
  }

  async deleteAllCompleted() {
    return this.modelService.deleteByQuery(Todo, { where: { completed: true } });
  }

  async complete(id: string, completed = true) {
    return this.modelService.updatePartial(Todo, Todo.from({ id, completed }));
  }

  async remove(id: string) {
    return this.modelService.delete(Todo, id);
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

import { Suite, Test } from '@travetto/test';
import { Inject } from '@travetto/di';
import { MongoModelConfig, MongoModelService } from '@travetto/model-mongo';
import { InjectableSuite } from '@travetto/di/test-support/suite';
import { ModelSuite } from '@travetto/model/test-support/suite';

import { TodoService } from '../src/service';
import { Todo } from '../src/model';

@Suite()
@ModelSuite()
@InjectableSuite()
export class TodoTest {

  serviceClass = MongoModelService;
  configClass = MongoModelConfig;

  @Inject()
  svc: TodoService;

  @Test('Create todo')
  async create() {
    const test = Todo.from({
      text: 'Sample Task'
    });

    const saved = await this.svc.add(test);

    assert.ok(saved.id);
  }

  @Test('Complete todo')
  async complete() {
    const test = Todo.from({
      text: 'Sample Task'
    });

    const saved = await this.svc.add(test);
    assert.ok(saved.id);

    let updated = await this.svc.complete(saved.id);
    assert(updated.completed === true);

    updated = await this.svc.complete(saved.id, false);
    assert(updated.completed === false);
  }

  @Test('Delete todo')
  async remove() {
    const test = Todo.from({
      text: 'Sample Task'
    });

    const saved = await this.svc.add(test);
    assert.ok(saved.id);
    assert(test.text === 'Sample Task');

    await this.svc.remove(saved.id);

    try {
      await this.svc.get(saved.id);
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
import { Controller, Get, Post, Put, Delete } from '@travetto/rest';
import { Inject } from '@travetto/di';

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
  async getAll(search: TodoSearch) {
    return await this.svc.getAll(search);
  }

  /**
   * Delete all todos
   */
  @Delete('/')
  async deleteAllCompleted() {
    await this.svc.deleteAllCompleted();
  }

  /**
   * Get Todo by id
   * @param id Todo id
   */
  @Get('/:id')
  async getById(id: string) {
    return this.svc.get(id);
  }

  /**
   * Create a todo
   */
  @Post('/')
  async create(todo: Todo) {
    return await this.svc.add(todo);
  }

  /**
   * Update a todo
   * @param id Todo id
   * @param todo Todo to update
   */
  @Put('/:id')
  async update(id: string, todo: Todo) {
    todo.id = id;
    return await this.svc.update(todo);
  }

  /**
   * Complete a todo
   * @param id Todo id
   */
  @Put('/:id/complete')
  async complete(id: string, completed: boolean = true) {
    return await this.svc.complete(id, completed);
  }

  /**
   * Delete a todo
   * @param id Todo id
   */
  @Delete('/:id')
  async remove(id: string) {
    await this.svc.remove(id);
  }
}
```

## Running the App

First we must start the application:

**Terminal: Application Startup**
```bash
2021-03-14T05:00:00.618Z info  [@trv:app/registry:40] Running application { name: 'rest', filename: '@trv:rest/src/application/rest.ts' }
2021-03-14T05:00:00.837Z info  [@trv:app/registry:44] Manifest {
  info: {
    framework: '2.0.0',
    name: '@travetto/todo-app',
    description: '',
    version: '0.0.0',
    license: 'ISC',
    author: { email: 'travetto.framework@gmail.com', name: 'Travetto Framework' }
  },
  env: {
    name: 'dev',
    profiles: [ 'application', 'dev' ],
    prod: false,
    debug: { status: false, value: undefined },
    resources: [ 'resources', 'doc/resources' ],
    shutdownWait: 2000,
    cache: '.trv_cache',
    node: 'v15.14.0',
    dynamic: false,
    readonly: false
  },
  source: {
    common: [ 'src' ],
    local: [ 'doc' ],
    excludeModules: Set(3) { '@travetto/cli', '@travetto/doc', '@travetto/boot' },
    dynamicModules: {
      '@travetto/app': '@trv:app',
      '@travetto/auth': '@trv:auth',
      '@travetto/auth-rest': '@trv:auth-rest',
      '@travetto/base': '@trv:base',
      '@travetto/boot': '@trv:boot',
      '@travetto/cli': '@trv:cli',
      '@travetto/compiler': '@trv:compiler',
      '@travetto/config': '@trv:config',
      '@travetto/context': '@trv:context',
      '@travetto/di': '@trv:di',
      '@travetto/doc': '@trv:doc',
      '@travetto/log': '@trv:log',
      '@travetto/model': '@trv:model',
      '@travetto/model-mongo': '@trv:model-mongo',
      '@travetto/model-query': '@trv:model-query',
      '@travetto/openapi': '@trv:openapi',
      '@travetto/pack': '@trv:pack',
      '@travetto/registry': '@trv:registry',
      '@travetto/rest': '@trv:rest',
      '@travetto/rest-express': '@trv:rest-express',
      '@travetto/rest-session': '@trv:rest-session',
      '@travetto/schema': '@trv:schema',
      '@travetto/test': '@trv:test',
      '@travetto/transformer': '@trv:transformer',
      '@travetto/watch': '@trv:watch',
      '@travetto/worker': '@trv:worker',
      '@travetto/yaml': '@trv:yaml'
    }
  }
}
2021-03-14T05:00:01.510Z info  [@trv:app/registry:45] Config {
  rest: {
    serve: true,
    port: 3000,
    disableGetCache: true,
    trustProxy: false,
    hostname: 'localhost',
    defaultMessage: true,
    ssl: { active: false },
    logRoutes: { allow: [], deny: [ '*' ] },
    cors: { active: true },
    cookie: {
      active: true,
      signed: true,
      httpOnly: true,
      sameSite: 'lax',
      keys: [ 'default-insecure' ]
    },
    session: {
      autoCommit: true,
      maxAge: 1800000,
      renew: true,
      rolling: false,
      sign: true,
      keyName: 'trv_sid',
      transport: 'cookie'
    },
    context: { disabled: false }
  },
  model: {
    mongo: {
      hosts: [ 'localhost' ],
      namespace: 'app',
      username: '',
      password: '',
      port: 27017,
      connectionOptions: {},
      srvRecord: false,
      options: { useNewUrlParser: true, useUnifiedTopology: true }
    }
  }
}
2021-03-14T05:00:02.450Z info  [@trv:rest/application/rest:183] Listening { port: 3000 }
```

next, let's execute [fetch](https://www.npmjs.com/package/node-fetch) requests to interact with the new api:

**Code: Creating Todo by fetch**
```typescript
import * as fetch from 'node-fetch';

export async function main() {
  const res = await fetch('http://localhost:3000/todo', {
    method: 'POST',
    body: JSON.stringify({ text: 'New Todo' }),
    headers: {
      'Content-Type': 'application/json'
    }
  })
    .then(r => r.json());
  console.log!(res);
}
```

**Terminal: Create Output**
```bash
$ node @travetto/boot/bin/main ./doc/create-todo.ts 

{
  text: 'New Todo',
  created: '2021-03-14T05:00:02.762Z',
  id: '22e793aed76ee063d13feec2e5e95b45'
}
```

**Code: Listing Todos by fetch**
```typescript
import * as fetch from 'node-fetch';

export async function main() {
  const res = await fetch('http://localhost:3000/todo').then(r => r.json());
  console.log!(res);
}
```

**Terminal: Listing Output**
```bash
$ node @travetto/boot/bin/main ./doc/list-todo.ts 

[
  {
    id: '22e793aed76ee063d13feec2e5e95b45',
    text: 'New Todo',
    created: '2021-03-14T05:00:03.086Z'
  }
]
```
