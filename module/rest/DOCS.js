const { doc: d, lib, SnippetLink, Section, List, inp, pth, Code, SubSection, Mod, Note, Ordered, Command, Ref, Snippet } = require('@travetto/doc');
const { Application } = require('@travetto/app');

const { Controller } = require('./src/decorator/controller');
const { Get, Post, Put, Delete, Patch, Head, Options } = require('./src/decorator/endpoint');
const { Path, Query, Body, Context, Param, Header } = require('./src/decorator/param');
const { RestInterceptor } = require('./src/interceptor/interceptor');
const { CorsInterceptor, RestCorsConfig } = require('./src/interceptor/cors');
const { GetCacheInterceptor } = require('./src/interceptor/get-cache');
const { LoggingInterceptor } = require('./src/interceptor/logging');
const { SerializeInterceptor } = require('./src/interceptor/serialize');
const { CookiesInterceptor, RestCookieConfig } = require('./src/interceptor/cookies');
const { DefaultRestApplication } = require('./support/application.rest');
const { RestConfig } = require('./src/server/config');


const Request = SnippetLink(`Request`, './src/types.d.ts', /interface Request/);
const Response = SnippetLink(`Response`, './src/types.d.ts', /interface Response/);
const ResourceManager = Ref('ResourceManager', `@travetto/base/src/resource.ts`);

exports.text = d`

The module provides a declarative API for creating and describing an RESTful application.  Since the framework is declarative, decorators are used to configure almost everything. The module is framework agnostic (but resembles ${lib.Express} in the ${Request} and ${Response} objects). 

${Section('Routes: Controller')}

To define a route, you must first declare a ${Controller} which is only allowed on classes. Controllers can be configured with:

${List(
  d`${inp`title`} - The definition of the controller`,
  d`${inp`description`} - High level description fo the controller`,
)}

Additionally, the module is predicated upon ${Mod('di')}, and so all standard injection techniques (constructor, fields) work for registering dependencies.

${lib.JSDoc} comments can also be used to define the ${inp`title`} attribute.

${Code('Basic Controller Registration', 'alt/docs/src/simple-controller.ts')}

${Section('Routes: Endpoints')}

Once the controller is declared, each method of the controller is a candidate for routing.  By design, everything is asynchronous, and so async/await is natively supported.  

The HTTP methods that are supported via:
${List(
  d`${Get}`,
  d`${Post}`,
  d`${Put}`,
  d`${Delete}`,
  d`${Patch}`,
  d`${Head}`,
  d`${Options}`,
)}


Each endpoint decorator handles the following config:
${List(
  d`${inp`title`} - The definition of the endpoint`,
  d`${inp`description`} - High level description fo the endpoint`,
  d`${inp`responseType?`} - Class describing the response type`,
  d`${inp`requestType?`} - Class describing the request body`,
)}

${lib.JSDoc} comments can also be used to define the ${inp`title`} attribute, as well as describing the parameters using ${inp`@param`} tags in the comment.

Additionally, the return type of the method will also be used to describe the ${inp`responseType`} if not specified manually.

${Code('Controller with Sample Route', 'alt/docs/src/simple-route.ts')}

${Note(d`In development mode the module supports hot reloading of ${inp`class`}es.  Routes can be added/modified/removed at runtime.`)}

${SubSection('Parameters')}

Endpoints can be configured to describe and enforce parameter behavior.  Request parameters can be defined in five areas:
${List(
  d`${Path} - Path params`,
  d`${Query} - Query params`,
  d`${Body} - Request body (in it's entirety)`,
  d`${Header} - Header values`,
  d`${Context} - Special values exposed (e.g. ${Request}, ${Response}, Session, AuthContext, etc.)`,
)}

Each ${Param} can be configured to indicate:
${List(
  d`${inp`name`} - Name of param, field name, defaults to handler parameter name if necessary`,
  d`${inp`description`} - Description of param, pulled from ${lib.JSDoc}, or defaults to name if empty`,
  d`${inp`required?`} - Is the field required?, defaults to whether or not the parameter itself is optional`,
  d`${inp`type`} - The class of the type to be enforced, pulled from parameter type`,
)}

${lib.JSDoc} comments can also be used to describe parameters using ${inp`@param`} tags in the comment.

${Code('Full-fledged Controller with Routes', 'alt/docs/src/simple-full.ts')}

${Section('Input/Output')}

The module provides standard structure for rendering content on the response.  This includes:
${List(
  `JSON`,
  `String responses`,
  `Files`
)}

Per the ${Mod('base')} module, the following types automatically have rest support as well:
${List(
  d`${inp`Map`} - Serializes as a JSON object`,
  d`${inp`Set`} - Serializes as an array`,
  d`${inp`Error`} - Serializes to a standard object, with status, and the error message.`,
  d`${inp`AppError`} - Serializes like ${inp`Error`} but translates the error category to an HTTP status`,
)}

Additionally, the ${Mod('schema')} module supports typing requests and request bodies for run-time validation of requests. 

${Section('Interceptors')}

${RestInterceptor}s  are a key part of the rest framework, to allow for conditional functions to be added, sometimes to every route, and other times to a select few. Express/Koa/Fastify are all built around the concept of middleware, and interceptors are a way of representing that.

${Code(`A Trivial Intereptor`, 'alt/docs/src/interceptor-hello-world.ts')}

${Note(`The example above defines the interceptor to run after another interceptor class. The framework will automatically sort the interceptors by the before/after reuirements to ensure the appropriate order of execution.`)}

Out of the box, the rest framework comes with a few interceptors, and more are contributed by other modules as needed.  The default interceptor set is:
${Ordered(
  d`${SerializeInterceptor} - This is what actually sends the response to the requestor. Given the ability to prioritize interceptors, another interceptor can have higher priority and allow for complete customization of response handling.`,
  d`${CorsInterceptor} - This interceptor allows cors functionality to be configured out of the box, by setting properties in your ${pth`application.yml`}, specifically, ${inp`rest.cors.active: true`}
  ${Snippet('Cors Config', RestCorsConfig.ᚕfile, /class.*Config/, /^\}/)}`,
  d`${CookiesInterceptor} - This interceptor is responsible for processing inbound cookie headers and populating the appropriate data on the request, as well as sending the appropriate response data
  ${Snippet('Cookies Config', RestCookieConfig.ᚕfile, /class.*Config/, /^\}/)}`,
  d`${GetCacheInterceptor} - This interceptor, by default, disables caching for all GET requests if the response does not include caching headers.  This can be disabled by setting ${inp`res.disableGetCache: true`} in your config.`,
  d`${LoggingInterceptor} - This interceptor allows for logging of all requests, and their response codes.  You can deny/allow specific routes, by setting config like so\n
  ${Code('Control Logging', 'alt/docs/resources/log.yml')}`,
)}

${Section('Creating and Running an App')}

By default, the framework provices a default ${Application} at ${DefaultRestApplication} that will follow default behaviors, and spin up the REST server.  To customize a REST server, you may need to construct an entry point using the ${Application} decorator. This could look like:

${Code('Application entry point for Rest Applications', 'alt/docs/src/custom-app.ts')}

And using the pattern established in the ${Mod('app')} module, you would run your program using ${Command(`npx travetto run custom`)}.

${Section('Custom Interceptors')}
Additionally it is sometimes necessary to register custom interceptors.  Interceptors can be registered with the ${Mod('di')} by extending the ${RestInterceptor} class.  The interceptors are tied to the defined ${Request} and ${Response} objects of the framework, and not the underlying app framework.  This allows for Interceptors to be used across multiple frameworks as needed. A simple logging interceptor:

${Code('Defining a new Interceptor', 'alt/docs/src/interceptor-logging.ts')}

A ${inp`next`} parameter is also available to allow for controlling the flow of the request, either by stopping the flow of interceptors, or being able to determine when a request starts, and when it is ending.

${Code('Defining a fully controlled Interceptor', 'alt/docs/src/interceptor-controlled.ts')}

Currently ${Mod('asset-rest')} is implemented in this fashion, as well as ${Mod('auth-rest')}.

${Section('Cookie Support')}
Express/Koa/Fastify all have their own cookie implementations that are common for each framework but are somewhat incompatible.  To that end, cookies are supported for every platform, by using ${lib.Cookies}.  This functionality is exposed onto the ${Request}/${Response} object following the pattern set forth by Koa (this is the library Koa uses).  This choice also enables better security support as we are able to rely upon standard behavior when it comes to cookies, and signing.

${Code('Sample Cookie Usage', 'alt/docs/src/cookie-routes.ts')}

${Section(`SSL Support`)}

Additionally the framework supports SSL out of the box, by allowing you to specify your public and private keys for the cert.  In dev mode, the framework will also automatically generate a self-signed cert if:
${List(
  `SSL support is configured`,
  d`${lib.NodeForge} is installed`,
  `No keys provided`
)}

This is useful for local development where you implicitly trust the cert.

SSL support can be enabled by setting ${inp`rest.ssl.active: true`} in your config. The key/cert can be specified as string directly in the config file/environment variables.  The key/cert can also be specified as a path to be picked up by the ${ResourceManager}.

${Section('Full Config')}
The entire ${RestConfig} which will show the full set of valid configuration parameters for the rest module.

${Section('Serverless')}
${SubSection('AWS Lambda')}

The module provides support basic support with AWS lambdas. When using one of the specific rest modules (e.g. ${Mod('rest-express')}), you can install the appropriate lambda-related dependencies installed (e.g. ${lib.AwsServerlessExpress}) to enable integration with AWS.  Nothing in the code needs to be modified to support the AWS integration, but there are some limitations of using AWS Lambdas as HTTP handlers. 

${Section('Packaging Lambdas')}

${Execute('Invoking a Package Build', 'travetto', ['pack', 'rest/lambda', '-h'])}
`;
