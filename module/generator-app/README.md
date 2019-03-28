travetto: Yeoman App Generator
===
A simple [`yeoman`](http://yeoman.io) generator for scaffolding a reference project.  To get started, you need to make sure: 

**Install: Setting up yeoman and the generator**
```bash
$ npm i -g yo #Ensure yeoman is installed globally
$ npm i -g @travetto/generator-app #Ensure this yeoman generator is installed
$ git config --global.username <Username> #Set your git username
```

Once installed you can invoke the scaffolding by running

**Terminal: Running generator**
```bash
$ yo @travetto/app
```

Currently, the generator supports, two main features.

## Restful Architecture
The [`Rest`](https://github.com/travetto/travetto/tree/master/module/rest) provides the necessary integration for exposing restful apis.  When selecting the `rest` feature, you will need to specify which backend you want to include with your application, the default being `express`.  Currently you can select from:
* `express`
* `koa`
* `fastify`

The code will establish some basic routes, specifically, `GET /` as the root endpoint.  This will return the contents of your `package.json` as an identification operation.  

### Additional Rest Features
In addition to the core functionality, the `rest` feature has some useful sub-features.  Specifically:

[`Swagger`](https://github.com/travetto/travetto/tree/master/module/swagger) support for the restful api.  This will automatically expose a `swagger.json` endpoint, and provide the necessary plumbing to support client generation.

[`Log`](https://github.com/travetto/travetto/tree/master/module/log) support for better formatting and colorized output.  This is generally useful for server logs, especially during development.

## Authentication
Authentication is also supported on the Restful endpoints by selecting [`Auth-Rest`](https://github.com/travetto/travetto/tree/master/module/auth-rest) during setup.  This will support basic authentication running out of local memory, with user [`Session`](https://github.com/travetto/travetto/tree/master/module/rest-session)s. 

## Testing
[`Test`](https://github.com/travetto/travetto/tree/master/module/test)ing can also be configured out of the box to provide simple test cases for the data model.  

## Data Modelling and Storage
The [`Model`](https://github.com/travetto/travetto/tree/master/module/model) allows for modeling of application data, and provides mechanisms for storage and retrieval.  When setting up your application, you will need to select which database backend you want to use:
* `elasticsearch`
* `mongodb`
<!-- * ...more to come -->

A default model is constructed, a `Todo` class:

**Code: Todo model**
```typescript
@Model()
export class Todo implements ModelCore {
  id?: string;
  text: string;
  completed: boolean;
}
```

Basic tests are also included for the `model` to verify that database interaction and functionality is working properly.

## Rest + Model
In the case both `Rest` and `Model` features are enabled, the code will produce a controller that exposes the `Todo` model via restful patterns.

**Code: Todo controller**
```typescript 
@Controller('/todo')
export class TodoController {

  @Get('/')
  async getAll(req: Request): Promise<Todo[]>

  @Get('/:id')
  async getOne(req: Request): Promise<Todo>

  @Post('/')
  async save(req: TypedBody<Todo>): Promise<Todo>;

  @Put('/:id')
  async update(req: TypedBody<Todo>): Promise<Todo>;

  @Delete('/:id')
  async delete(req: Request): Promise<void>;
}
```  

## Executing

Once finished the application will reflect the modules chosen, and will be ready for execution, if you have configured a runnable application.  Currently, this requires the `rest` feature to be selected.

**Terminal: starting app**
```bash
$ npm start
```