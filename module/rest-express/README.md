travetto: Rest
===
The module provides a declarative API for creating and describing an RESTful application.  Since the framework is declarative, decorators are used to configure almost everything. The underlying framework is [`express`](https://expressjs.com)-compatible, and should be able to handle anything that conforms to the `express` model (e.g. [`restify`](http://restify.com) and [`fastify`](https://www.fastify.io/))

## Route management 

### Controller
To define a route, you must first declare a `@Controller` which is only allowed on classes. Controllers can be configured with:
* `title` - The definition of the controller
* `description` - High level description fo the controller

[`JSDoc`](http://usejsdoc.org/about-getting-started.html) comments can also be used to define the `title` attribute.

### Endpoints
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

### Parameters
Endpoints can be configured to describe and enforce parameter behavior.  Request parameters can be defined  in three areas:
* `@PathParam`
* `@QueryParam`
* `@BodyParam`

Each `@*Param` can be configured to indicate:
* `name` - Name of param, field name
* `description` - Description of param
* `required?` - Is the field required?
* `type` - The class of the type to be enforced

[`JSDoc`](http://usejsdoc.org/about-getting-started.html) comments can also be used to describe parameters using `@param` tags in the comment.

### Example
A simple example is:

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

Additionally, the module is predicated upon [`Dependency Injection`](https://github.com/travetto/di), and so all standard di techniques work on controllers.

**NOTE** in development mode the module supports hot reloading of `class`es.  Routes can be added/modified/removed at runtime.

## Input/Output
The module provides standard structure for rendering content on the response.  This includes:
* JSON
* String responses
* Files 

Additionally, there is support for typing requests and request bodies.  This can be utilized by other modules to handle special types of requests.
 
```typescript
@Injectable()
export class LoggingInterceptor extends ExpressInterceptor {
  intercept(req: Request, res: Response, next: Function) {
    console.log(req.method, req.path, req.query);

    if (next) {
      next();
    }
  }
}
```

## Documentation
As shown above, the controllers and endpoints can be described via decorators, comments, or typings. This only provides the general metadata internally. To generate a usable API doc, a separate module should be used. Currently [`Swagger`](https://github.com/travetto/swagger) is the only module that exists, but other implementations should be available in the future.

## Creating and Running an App
To run a REST server, you will need to construct an entry point using the `@Application` decorator, as well as define a valid [`RestAppProvider`](./src/types.ts) to provide initialization for the application.  This would look like:

```typescript
@Application('sample')
export class SampleApp {

  @InjectableFactory()
  static getProvider(): RestAppProvider {
    return new ExpressAppProvider();
  }

  @Inject()
  contextInterceptor: ContextInterceptor;

  constructor(private app: RestApp) { }

  run() {
    this.app.run();
  }
}
```

And using the pattern established in the [`Dependency Injection`](https://github.com/travetto/di) module, you would run your program using `npx travetto sample`.

## Extensions
Integration with other modules can be supported by extensions.  The dependencies are in `optionalExtensionDependencies` and must be installed directly if you want to use them:

### Express
When working with [`express`](https://expressjs.com) applications, the module provides what is assumed to be a sufficient set of basic filters. Specifically:
* ```compression()```
* ```cookieParser()```
* ```bodyParser.json()```
* ```bodyParser.urlencoded()```
* ```bodyParser.raw({ type: 'image/*' })```
* ```session(this.config.session)```

Additionally it is sometimes necessary to register custom filters.  Filters can be registered with the [`Dependency Injection`](https://github.com/travetto/di) by extending the [`RestInterceptor`](./src/interceptor) class.  

### Context
[`Context`](https://github.com/travetto/context) provides support for automatically injecting an async context into every request. The context management is provided via an `Interceptor` and is transparent to the programmer.

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