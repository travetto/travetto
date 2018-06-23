travetto: Express
===
The module provides a declarative API for creating an [`express`](https://expressjs.com) application.  Since the 
framework is declarative, decorators are used to configure almost everything.

## Route management 
To define a route, you must first declare a `@Controller` which is only allowed on classes. Once declared
Each method of the controller is a candidate for routing.  By design, everything is asynchronous, and so
async/await is natively supported.  The HTTP methods that are supported via:
* `@Get`
* `@Post`
* `@Put`
* `@Delete`
* `@Patch`

A simple example is:

```typescript
@Controller('/simple')
export class Simple {

  constructor(private service: MockService) {}

  @Get('/name')
  async doIt() {
    const user = await this.service.fetch();
    return `/simple/name => ${user.first.toLowerCase()}`;
  }

  @Post('/name')
  async doIt(req: Request) {
    const user = await this.service.update({ name: req.body.name });
    return { success : true };
  }
}
```

Additionally, the module is predicated upon [`Dependency Injection`](https://github.com/travetto/di), and so all standard di techniques work on 
controllers.

**NOTE** in development mode the module supports hot reloading of `class`es.  Routes can be added/modified/removed at runtime.

## Input/Output
The module provides standard structure for rendering content on the response.  This includes:
* JSON
* String responses
* Files 

Additionally, there is support for typing requests and request bodies.  This can be utilized by other modules to handle special types of requests.


## Express initialization
When working with express applications, the module provides what is assumed to be a sufficient set of basic filters. Specifically:
* ```compression()```
* ```cookieParser()```
* ```bodyParser.json()```
* ```bodyParser.urlencoded()```
* ```bodyParser.raw({ type: 'image/*' })```
* ```session(this.config.session)```

Additionally it is sometimes necessary to register custom filters.  Additional filters can be registered with the [`Dependency Injection`](https://github.com/travetto/di) by extending the [`Operator`](./src/service/operator) class.  

```typescript
@Injectable({
  target: ExpressOperator,
  qualifier: AUTH
})
export class LoggingOperator extends ExpressOperator {
  operate(app: ExpressApp) {
    app.get().use(async (req, res, next) => {

      console.log(req.method, req.path, req.query);

      if (next) {
        next();
      }
    });
  }
}
```

## Extensions
Integration with other modules can be supported by extensions.  The dependencies are `peerDependencies` and must be installed directly if you 
want to use them:

### Schema
[`Schema`](https://github.com/travetto/schema) support for validating and typing request bodies

`@SchemaBody` provides the ability to convert the inbound request body into a schema bound object, and provide
 validation before the controller even receives the request.
 ```typescript
 class User {
   name: string;
   age: number;
 }
 ...
  @Post('/saveUser')
  @SchemaBody(User)
  async save(req: TypedBody<User>) {
    const user = await this.service.update(req.body);
    return { success : true };
  }
 ...
 ```
`@SchemaQuery` provides the ability to convert the inbound request query into a schema bound object, and provide
 validation before the controller even receives the request. 
```typescript
 class SearchParams {
   page: number = 0;
   pageSize: number = 100;
 }
 ...
  @Get('/search')
  @SchemaQuery(SearchParams)
  async search(req: TypedQuery<SearchParams>) {
    return await this.service.search(req.query);
  }
 ...
 ```

### Model
[`Model`](https://github.com/travetto/model) supports `@ModelController` for exposing common RESTful patterns for routes.

```typescript
@ModelController('/user', User) 
class UserController {
  source: ModelService;
}
```
is a shorthand that is equal to:

```typescript
@Controller('/user') 
class UserController {
  
  source: ModelService;

  @Get('')
  async getAllUser(req:Request) {
    return await this.source.getAllByQuery(User, JSON.parse(req.params.q));
  }

  @Get(':id')
  async getUser(req:Request) {
    return await this.source.getById(User, req.params.id);
  }

  @Delete(':id')
  async deleteUser(req:Request) {
    return await this.source.deleteById(User, req.params.id);
  }

  @Post('')
  @SchemaBody(User)
  async saveUser(req:TypedBody<User>) {
    return await this.source.save(User, req.body);
  }

  @Put('')
  @SchemaBody(User)
  async updateUser(req:TypedBody<User>) {
    return await this.source.update(User, req.body);
  }
}

```

### Context
[`Context`](https://github.com/travetto/context) provides support for automatically injecting an async context into every request. The context management is provided via an `Operator` and is transparent to the programmer.

```typescript
 ...
  @Post('/preferences')
  @SchemaBody(User)
  async save(req: TypedBody<Preferences>) {
    await this.service.update(req.body);
    return { success : true };
  }
 ...
 class PreferenceService {
   private context: Context;

   async update(prefs: Preferences) {
     const userId = this.context.get().userId;
     ... store preferences for user ...
     return;  
   }
 }
``` 