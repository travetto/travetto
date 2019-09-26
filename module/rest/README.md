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
Endpoints can be configured to describe and enforce parameter behavior.  Request parameters can be defined in five areas:
* `@Path` - Path params
* `@Query` - Query params
* `@Body` - Request body (in it's entirety)
* `@Header` - Header values
* `@Context` - Special values exposed (e.g. Request, Response, Session, AuthContext, etc.)

Each `@Param` can be configured to indicate:
* `name` - Name of param, field name, defaults to handler parameter name if necessary
* `description` - Description of param, pulled from `JSdoc`, or defaults to name if empty
* `required?` - Is the field required?, defaults to whether or not the parameter itself is optional
* `type` - The class of the type to be enforced, pulled from parameter type

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
  async doIt(@Path() id: number): string {
    const user = await this.service.fetch(id);
    return `/simple/name => ${user.first.toLowerCase()}`;
  }


  @Post('/name')
  async doIt(@Body() person: { name: string }) {
    const user = await this.service.update({ name: req.body.name });
    return { success : true };
  }

  @Get(/\/img(.*)[.](jpg|png|gif)/)
  async getImage(@Context() req: Request, @Query('w') width?: number, @Query('h') height?:number) {
    const img =  await this.service.fetch(req.path, {width, height});
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
 
## Interceptors
[`Interceptor`](./src/interceptor/interceptor.ts)s are a key part of the rest framework, to allow for conditional functions to be added, sometimes to every route, and other times to a select few. Express/Koa/Fastify are all built around the concept of middleware, and interceptors are a way of representing that.

**Code: A Simple Timing Interceptor**
```typescript
@Injectable()
export class HelloWorldInterceptor extends RestInterceptor {
  intercept(req: Request, res: Response) {
    console.log('Hello world!');
  }
}
```

Out of the box, the rest framework comes with a few interceptors, and more are contributed by other modules as needed.  The default interceptor set is:

* ['CORS support'](./src/interceptor/cors.ts) - This interceptor allows cors functionality to be configured out of the box, by setting properties in your application.yml, specifically, `rest.cors.active: true`
* ['GET request cache control'](./src/interceptor/get-cache.ts) - This interceptor, by default, disables caching for all GET requests if the response does not include caching headers.  This can be disabled by setting `res.disableGetCache: true` in your config. 
* ['Logging'](./src/interceptor/logging.ts) - This interceptor allows for logging of all requests, and their response codes.  You can deny/allow specific routes, by setting config like so `rest.logRoutes.{deny|allow} = ['/path', /\/path\/.*/]`. 
* ['Serialization'](./src/interceptor/serialize.ts) - This is what actually sends the response to the requestor. Given the ability to prioritize interceptors, another interceptor can have higher priority and allow for complete customization of response handling.

## Creating and Running an App
To run a REST server, you will need to construct an entry point using the `@Application` decorator, as well as define a valid [`RestApp`](./src/types.ts) to provide initialization for the application.  This could look like:

**Code: Application entry point for Rest Applications**
```typescript
@Application('sample')
export class SampleApp {

  @Inject()
  contextInterceptor: AsyncContextInterceptor;

  constructor(private app: RestApp) { }

  run() {
    this.app.run();
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

A `next` parameter is also available to allow for controlling the flow of the request, either by stopping the flow of interceptors, or being able to determine when a request starts, and when it is ending.

**Code: Defining a fully controlled Interceptor**
```typescript
@Injectable()
export class LoggingInterceptor extends RestInterceptor {
  async intercept(req: Request, res: Response, next: () => Promise<any>) {
    let start = Date.now();
    try {
      await next();
    } finally {
      console.log(`Request took ${Date.now() - start}ms`);
    }
  }
}
```

Currently [`Asset-Rest`](https://github.com/travetto/travetto/tree/master/module/asset-rest) is implemented in this fashion, as well as [`Auth-Rest`](https://github.com/travetto/travetto/tree/master/module/auth-rest).

## Async Context Support
[`AsyncContext`](https://github.com/travetto/travetto/tree/master/module/context) provides support for automatically injecting an async context into every request. The context management is provided via an `Interceptor` and is transparent to the programmer.

**Code: Showing contextual support for Routes**
```typescript
 ...
  @Post('/preferences')
  async save(@Body() prefs: Preferences) {
    await this.service.update(prefs);
    return { success : true };
  }
 ...
 class PreferenceService {
   private context: AsyncContext;

   async update(prefs: Preferences) {
     const userId = this.context.get().userId;
     ... store preferences for user ...
     return;  
   }
 }
``` 

## Cookie Support
Express/Koa/Fastify all have their own cookie implementations that are common for each framework but are somewhat incompatible.  To that end, cookies are supported for every platform, by using [`cookies`](https://www.npmjs.com/package/cookies).  This functionality is exposed onto the request/response object following the pattern set forth by Koa (this is the library Koa uses).  This choice also enables better security support as we are able to rely upon standard behavior when it comes to cookies, and signing.

**Code: Sample Cookie Usage**
```typescript
req.cookies.get('name', options);
res.cookies.set('name', value, options);
```

## SSL Support
Additionally the framework supports SSL out of the box, by allowing you to specify your public and private keys for the cert.  In dev mode, the framework will also automatically generate a self-signed cert if SSL support is configured, but no keys provided.  This is useful for local development where you implicitly trust the cert.

SSL support can be enabled by setting `rest.ssl.active: true`. The key/cert can be specified as string directly in the config file/environment variables.  The key/cert can also be specified as a path to be picked up by the `ResourceManager`.

## Full Config
The entire [`config object`](./src/config.ts) which will show the full set of valid configuration parameters for the rest module.