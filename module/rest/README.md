travetto: Rest
===

**Install: primary**
```bash
$ npm install @travetto/rest
```

The module provides a declarative API for creating and describing an RESTful application.  Since the framework is declarative, decorators are used to configure almost everything. The module is framework agnostic (but resembles [`express`](https://expressjs.com) in the `Request` and `Response` objects). 

## Routes: Controller
To define a route, you must first declare a `@Controller` which is only allowed on classes. Controllers can be configured with:
* `title` - The definition of the controller
* `description` - High level description fo the controller

[`JSDoc`](http://usejsdoc.org/about-getting-started.html) comments can also be used to define the `title` attribute.

**Code: Example of Controller decorator**
```typescript
/**
 * Provides basic interface to our primary service
 */
@Controller('/simple-route')
class SimpleController {
  ...
}
```

## Routes: Endpoints
Once the controller is declared, each method of the controller is a candidate for routing.  By design, everything is asynchronous, and so async/await is natively supported.  

The HTTP methods that are supported via:
* `@Get`
* `@Post`
* `@Put`
* `@Delete`
* `@Patch`
* `@Head`
* `@Options`

Each endpoint decorator handles the following config:
* `title` - The definition of the endpoint
* `description` - High level description fo the endpoint
* `responseType?` - Class describing the response type
* `requestType?` - Class describing the request body

[`JSDoc`](http://usejsdoc.org/about-getting-started.html) comments can also be used to define the `title` attribute, as well as describing the parameters using `@param` tags in the comment.

Additionally, the annotated return type on the method will also be used to describe the `responseType` if specified.

**Code: Controller with Sample Route**
```typescript
/**
 * Provides basic interface to our primary service
 */
@Controller('/simple-route')
class SimpleController {

  /**
   * Gets the most basic of data
   */
  @Get('/')
  simpleGet():Promise<Data> {
    ...
    return data;
  }
}
```


### Parameters
Endpoints can be configured to describe and enforce parameter behavior.  Request parameters can be defined  in three areas:
* `@PathParam`
* `@QueryParam`
* `@BodyParam`

Each `@Param` can be configured to indicate:
* `name` - Name of param, field name
* `description` - Description of param
* `required?` - Is the field required?
* `type` - The class of the type to be enforced

[`JSDoc`](http://usejsdoc.org/about-getting-started.html) comments can also be used to describe parameters using `@param` tags in the comment.

### Example
A simple example could look like:

**Code: Full-fledged Controller with Routes**
```typescript
@Controller('/simple')
export class Simple {

  constructor(private service: MockService) {}

  /**
   * Get a random user by name
   */
  @Get('/name')
  async doIt(): string {
    const user = await this.service.fetch();
    return `/simple/name => ${user.first.toLowerCase()}`;
  }

  /**
   * Get a user by id
   */
  @Get('/:id')
  @PathParam({ name: 'id', type: Number })
  async doIt(req: Request): string {
    const user = await this.service.fetch(req.params.id);
    return `/simple/name => ${user.first.toLowerCase()}`;
  }


  @Post('/name')
  async doIt(req: Request) {
    const user = await this.service.update({ name: req.body.name });
    return { success : true };
  }

  @Get(/\/img(.*)[.](jpg|png|gif)/)
  @QueryParam({ name: 'w', type: Number })
  @QueryParam({ name: 'h', type: Number })
  async getImage(req: Request, res:Response) {
    const img =  await this.service.fetch(req.path, req.query);
    ... return image ...
  }
}
```

Additionally, the module is predicated upon [`Dependency Injection`](https://github.com/travetto/travetto/tree/master/module/di), and so all standard di techniques work on controllers.

**NOTE** in development mode the module supports hot reloading of `class`es.  Routes can be added/modified/removed at runtime.

## Input/Output
The module provides standard structure for rendering content on the response.  This includes:
* JSON
* String responses
* Files 

Additionally, there is support for typing requests and request bodies.  This can be utilized by other modules to handle special types of requests.
 
## Creating and Running an App
To run a REST server, you will need to construct an entry point using the `@Application` decorator, as well as define a valid [`RestApp`](./src/types.ts) to provide initialization for the application.  This could look like:

**Code: Application entry point for Rest Applications**
```typescript
@Application('sample')
export class SampleApp {

  @InjectableFactory()
  static getProvider(): RestApp {
    return new ExpressRestApp();
  }

  @Inject()
  contextInterceptor: ContextInterceptor;

  constructor(private server: RestServer) { }

  run() {
    this.server.run();
  }
}
```

And using the pattern established in the [`Dependency Injection`](https://github.com/travetto/travetto/tree/master/module/di) module, you would run your program using `npx travetto sample`.

## Custom Interceptors
Additionally it is sometimes necessary to register custom interceptors.  Interceptors can be registered with the [`Dependency Injection`](https://github.com/travetto/travetto/tree/master/module/di) by extending the [`RestInterceptor`](./src/interceptor) class.  The interceptors are tied to the defined `Request` and `Response` objects of the framework, and not the underlying app framework.  This allows for Interceptors to be used across multiple frameworks as needed. A simple logging interceptor:

**Code: Defining a new Interceptor**
```typescript
@Injectable()
export class LoggingInterceptor extends RestInterceptor {
  async intercept(req: Request, res: Response) {
    console.log(req.method, req.path, req.query);
  }
}
```

Currently [`Asset-Rest`](https://github.com/travetto/travetto/tree/master/module/asset-rest) is implemented in this fashion, as well as [`Auth-Rest`](https://github.com/travetto/travetto/tree/master/module/auth-rest).

## Context Support
[`Context`](https://github.com/travetto/travetto/tree/master/module/context) provides support for automatically injecting an async context into every request. The context management is provided via an `Interceptor` and is transparent to the programmer.

**Code: Showing contextual support for Routes**
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