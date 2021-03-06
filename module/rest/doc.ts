// To ensure module loading
import '@travetto/model';
import '@travetto/model-query';

import { d, lib, mod } from '@travetto/doc';
import { Application } from '@travetto/app';
import { Field, Schema } from '@travetto/schema';

import { ModelRoutes } from './src/extension/model';
import { ModelQueryRoutes } from './src/extension/model-query';
import { RestApplication } from './src/application/rest';
import { Controller } from './src/decorator/controller';
import { Get, Post, Put, Delete, Patch, Head, Options } from './src/decorator/endpoint';
import { Path, Query, QuerySchema, Body, Context, Param, Header } from './src/decorator/param';
import { CorsInterceptor, RestCorsConfig } from './src/interceptor/cors';
import { GetCacheInterceptor } from './src/interceptor/get-cache';
import { LoggingInterceptor } from './src/interceptor/logging';
import { SerializeInterceptor } from './src/interceptor/serialize';
import { CookiesInterceptor, RestCookieConfig } from './src/interceptor/cookies';
import { RestConfig } from './src/application/config';

const Request = d.SnippetLink('TravettoRequest', 'src/types.d.ts', /interface TravettoRequest/);
const Response = d.SnippetLink('TravettoResponse', 'src/types.d.ts', /interface TravettoResponse/);
const ResourceManager = d.Ref('ResourceManager', '@travetto/base/src/resource.ts');

const RestInterceptor = d.SnippetLink('RestInterceptor', 'src/interceptor/types.ts', /interface RestInterceptor/);

export const text = d`
${d.Header()}

The module provides a declarative API for creating and describing an RESTful application.  Since the framework is declarative, decorators are used to configure almost everything. The module is framework agnostic (but resembles ${lib.Express} in the ${Request} and ${Response} objects). This module is built upon the ${mod.Schema} structure, and all controller method parameters follow the same rules/abilities as any ${Field} in a standard ${Schema} class.

${d.Section('Routes: Controller')}

To define a route, you must first declare a ${Controller} which is only allowed on classes. Controllers can be configured with:

${d.List(
  d`${d.Input('title')} - The definition of the controller`,
  d`${d.Input('description')} - High level description fo the controller`,
)}

Additionally, the module is predicated upon ${mod.Di}, and so all standard injection techniques (constructor, fields) work for registering dependencies.

${lib.JSDoc} comments can also be used to define the ${d.Input('title')} attribute.

${d.Code('Basic Controller Registration', 'doc/simple-controller.ts')}

${d.Section('Routes: Endpoints')}

Once the controller is declared, each method of the controller is a candidate for routing.  By design, everything is asynchronous, and so async/await is natively supported.  

The HTTP methods that are supported via:
${d.List(
  d`${Get}`,
  d`${Post}`,
  d`${Put}`,
  d`${Delete}`,
  d`${Patch}`,
  d`${Head}`,
  d`${Options}`,
)}


Each endpoint decorator handles the following config:
${d.List(
  d`${d.Input('title')} - The definition of the endpoint`,
  d`${d.Input('description')} - High level description fo the endpoint`,
  d`${d.Input('responseType?')} - Class describing the response type`,
  d`${d.Input('requestType?')} - Class describing the request body`,
)}

${lib.JSDoc} comments can also be used to define the ${d.Input('title')} attribute, as well as describing the parameters using ${d.Input('@param')} tags in the comment.

Additionally, the return type of the method will also be used to describe the ${d.Input('responseType')} if not specified manually.

${d.Code('Controller with Sample Route', 'doc/simple-route.ts')}

${d.Note(d`In development mode the module supports hot reloading of ${d.Input('class')}es.  Routes can be added/modified/removed at runtime.`)}

${d.SubSection('Parameters')}

Endpoints can be configured to describe and enforce parameter behavior.  Request parameters can be defined in five areas:
${d.List(
  d`${Path} - Path params`,
  d`${Query} - Query params`,
  d`${Body} - Request body (in it's entirety), with support for validation`,
  d`${QuerySchema()} - Allows for mapping the query parameters to a full object`,
  d`${Header} - Header values`,
  d`${Context} - Special values exposed (e.g. ${Request}, ${Response}, etc.)`,
)}

Each ${Param} can be configured to indicate:
${d.List(
  d`${d.Input('name')} - Name of param, field name, defaults to handler parameter name if necessary`,
  d`${d.Input('description')} - Description of param, pulled from ${lib.JSDoc}, or defaults to name if empty`,
  d`${d.Input('required?')} - Is the field required?, defaults to whether or not the parameter itself is optional`,
  d`${d.Input('type')} - The class of the type to be enforced, pulled from parameter type`,
)}

${lib.JSDoc} comments can also be used to describe parameters using ${d.Input('@param')} tags in the comment.

${d.Code('Full-fledged Controller with Routes', 'doc/simple-full.ts')}



${d.SubSection('Body and QuerySchema')}

The module provides high level access for ${mod.Schema} support, via decorators, for validating and typing request bodies.

${Body} provides the ability to convert the inbound request body into a schema bound object, and provide validation before the controller even receives the request.

${d.Code(d`Using ${Body.name} for POST requests`, 'doc/schema-body.ts')}

${QuerySchema} provides the ability to convert the inbound request query into a schema bound object, and provide validation before the controller even receives the request.

${d.Code(d`Using ${QuerySchema.name} for GET requests`, 'doc/schema-query.ts')}

Addtionally, ${QuerySchema} and ${Body} can also be used with ${d.Input('interface')}s and ${d.Input('type')} literals in lieu of classes. This is best suited for simple types:

${d.Code(d`Using ${QuerySchema.name} with a type literal`, 'doc/schema-query-type.ts')}

${d.Section('Input/Output')}

The module provides standard structure for rendering content on the response.  This includes:
${d.List(
  'JSON',
  'String responses',
  'Files'
)}

Per the ${mod.Base} module, the following types automatically have rest support as well:
${d.List(
  d`${d.Input('Map')} - Serializes as a JSON object`,
  d`${d.Input('Set')} - Serializes as an array`,
  d`${d.Input('Error')} - Serializes to a standard object, with status, and the error message.`,
  d`${d.Input('AppError')} - Serializes like ${d.Input('Error')} but translates the error category to an HTTP status`,
)}

Additionally, the ${mod.Schema} module supports typing requests and request bodies for run-time validation of requests. 

${d.Section('Running an App')}

By default, the framework provices a default ${Application} at ${RestApplication} that will follow default behaviors, and spin up the REST server.  You will need to install the ${mod.App} module to execute.  

${d.Install('Installing app support', '@travetto/app')}

${d.Execute('Standard application', 'trv', ['run'], { env: { TRV_SRC_LOCAL: 'src' } })}

${d.SubSection('Creating a Custom App')}
To customize a REST server, you may need to construct an entry point using the ${Application} decorator. This could look like:

${d.Code('Application entry point for Rest Applications', 'doc/custom-app.ts')}

And using the pattern established in the ${mod.App} module, you would run your program using ${d.Command('npx trv run custom')}.

${d.Execute('Custom application', 'trv', ['run'])}

${d.Section('Interceptors')}

${RestInterceptor}s  are a key part of the rest framework, to allow for conditional functions to be added, sometimes to every route, and other times to a select few. Express/Koa/Fastify are all built around the concept of middleware, and interceptors are a way of representing that.

${d.Code('A Trivial Intereptor', 'doc/interceptor-hello-world.ts')}

${d.Note('The example above defines the interceptor to run after another interceptor class. The framework will automatically sort the interceptors by the before/after reuirements to ensure the appropriate order of execution.')}

Out of the box, the rest framework comes with a few interceptors, and more are contributed by other modules as needed.  The default interceptor set is:
${d.Ordered(
  d`${SerializeInterceptor} - This is what actually sends the response to the requestor. Given the ability to prioritize interceptors, another interceptor can have higher priority and allow for complete customization of response handling.`,
  d`${CorsInterceptor} - This interceptor allows cors functionality to be configured out of the box, by setting properties in your ${d.Path('application.yml')}, specifically, ${d.Input('rest.cors.active: true')}
  ${d.Snippet('Cors Config', RestCorsConfig.ᚕfile, /class.*Config/, /^\}/)}`,
  d`${CookiesInterceptor} - This interceptor is responsible for processing inbound cookie headers and populating the appropriate data on the request, as well as sending the appropriate response data
  ${d.Snippet('Cookies Config', RestCookieConfig.ᚕfile, /class.*Config/, /^\}/)}`,
  d`${GetCacheInterceptor} - This interceptor, by default, disables caching for all GET requests if the response does not include caching headers.  This can be disabled by setting ${d.Input('rest.disableGetCache: true')} in your config.`,
  d`${LoggingInterceptor} - This interceptor allows for logging of all requests, and their response codes.  You can deny/allow specific routes, by setting config like so\n
  ${d.Code('Control Logging', 'doc/resources/log.yml')}`,
)}

${d.SubSection('Custom Interceptors')}
Additionally it is sometimes necessary to register custom interceptors.  Interceptors can be registered with the ${mod.Di} by extending the ${RestInterceptor} class.  The interceptors are tied to the defined ${Request} and ${Response} objects of the framework, and not the underlying app framework.  This allows for Interceptors to be used across multiple frameworks as needed. A simple logging interceptor:

${d.Code('Defining a new Interceptor', 'doc/interceptor-logging.ts')}

A ${d.Input('next')} parameter is also available to allow for controlling the flow of the request, either by stopping the flow of interceptors, or being able to determine when a request starts, and when it is ending.

${d.Code('Defining a fully controlled Interceptor', 'doc/interceptor-controlled.ts')}

Currently ${mod.AssetRest} is implemented in this fashion, as well as ${mod.AuthRest}.

${d.Section('Cookie Support')}
${lib.Express}/${lib.Koa}/${lib.Fastify} all have their own cookie implementations that are common for each framework but are somewhat incompatible.  To that end, cookies are supported for every platform, by using ${lib.Cookies}.  This functionality is exposed onto the ${Request}/${Response} object following the pattern set forth by Koa (this is the library Koa uses).  This choice also enables better security support as we are able to rely upon standard behavior when it comes to cookies, and signing.

${d.Code('Sample Cookie Usage', 'doc/cookie-routes.ts')}

${d.Section('SSL Support')}

Additionally the framework supports SSL out of the box, by allowing you to specify your public and private keys for the cert.  In dev mode, the framework will also automatically generate a self-signed cert if:
${d.List(
  'SSL support is configured',
  d`${lib.NodeForge} is installed`,
  'Not running in prod',
  'No keys provided'
)}

This is useful for local development where you implicitly trust the cert.

SSL support can be enabled by setting ${d.Input('rest.ssl.active: true')} in your config. The key/cert can be specified as string directly in the config file/environment variables.  The key/cert can also be specified as a path to be picked up by the ${ResourceManager}.

${d.Section('Full Config')}
The entire ${RestConfig} which will show the full set of valid configuration parameters for the rest module.

${d.Section('Serverless')}
${d.SubSection('AWS Lambda')}

The module provides support basic support with AWS lambdas. When using one of the specific rest modules (e.g. ${mod.RestExpress}), you can install the appropriate lambda-related dependencies installed (e.g. ${lib.ServerlessExpress}) to enable integration with AWS.  Nothing in the code needs to be modified to support the AWS integration, but there are some limitations of using AWS Lambdas as HTTP handlers. 

${d.Section('Packaging Lambdas')}

${d.Execute('Invoking a Package Build', 'trv', ['pack', 'rest/lambda', '-h'])}

${d.Section('Extension - Model')}

To facilitate common RESTful patterns, the module exposes  ${mod.Model} support in the form of ${ModelRoutes}.

${d.Code('ModelRoutes example', 'doc/controller-with-model.ts')}

is a shorthand that is equal to:

${d.Code('Comparable UserController, built manually', 'doc/controller-without-model.ts')}


${d.Section('Extension - Model Query')}

Additionally, ${mod.ModelQuery} support can also be added support in the form of ${ModelQueryRoutes}. This provides listing by query as well as an endpoint to facillitate suggestion behaviors.

${d.Code('ModelQueryRoutes example', 'doc/controller-with-model-query.ts')}

is a shorthand that is equal to:

${d.Code('Comparable UserController, built manually', 'doc/controller-without-model-query.ts')}

`;
