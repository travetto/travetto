import {
  doc as d, lib, Execute, SnippetLink, Section, List, inp, pth,
  Code, SubSection, mod, Note, Ordered, Command, Ref, Snippet, Install
} from '@travetto/doc';
import { Application } from '@travetto/app';

import { Controller } from './src/decorator/controller';
import { Get, Post, Put, Delete, Patch, Head, Options } from './src/decorator/endpoint';
import { Path, Query, Body, Context, Param, Header } from './src/decorator/param';
import { CorsInterceptor, RestCorsConfig } from './src/interceptor/cors';
import { GetCacheInterceptor } from './src/interceptor/get-cache';
import { LoggingInterceptor } from './src/interceptor/logging';
import { SerializeInterceptor } from './src/interceptor/serialize';
import { CookiesInterceptor, RestCookieConfig } from './src/interceptor/cookies';
import { DefaultRestApplication } from './src/internal/application.rest';
import { RestConfig } from './src/server/config';

const Request = SnippetLink('Request', 'src/types.d.ts', /interface Request/);
const Response = SnippetLink('Response', 'src/types.d.ts', /interface Response/);
const ResourceManager = Ref('ResourceManager', '@travetto/base/src/resource.ts');

const RestInterceptor = SnippetLink('RestInterceptor', 'src/interceptor/types.ts', /interface RestInterceptor/);

import { ModelController } from './src/extension/model';
import { SchemaBody, SchemaQuery } from './src/extension/schema';
// To ensure module loading
import '@travetto/schema';
import '@travetto/model';

exports.text = d`

The module provides a declarative API for creating and describing an RESTful application.  Since the framework is declarative, decorators are used to configure almost everything. The module is framework agnostic (but resembles ${lib.Express} in the ${Request} and ${Response} objects). 

${Section('Routes: Controller')}

To define a route, you must first declare a ${Controller} which is only allowed on classes. Controllers can be configured with:

${List(
  d`${inp`title`} - The definition of the controller`,
  d`${inp`description`} - High level description fo the controller`,
)}

Additionally, the module is predicated upon ${mod.Di}, and so all standard injection techniques (constructor, fields) work for registering dependencies.

${lib.JSDoc} comments can also be used to define the ${inp`title`} attribute.

${Code('Basic Controller Registration', 'doc/simple-controller.ts')}

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

${Code('Controller with Sample Route', 'doc/simple-route.ts')}

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

${Code('Full-fledged Controller with Routes', 'doc/simple-full.ts')}

${Section('Input/Output')}

The module provides standard structure for rendering content on the response.  This includes:
${List(
  'JSON',
  'String responses',
  'Files'
)}

Per the ${mod.Base} module, the following types automatically have rest support as well:
${List(
  d`${inp`Map`} - Serializes as a JSON object`,
  d`${inp`Set`} - Serializes as an array`,
  d`${inp`Error`} - Serializes to a standard object, with status, and the error message.`,
  d`${inp`AppError`} - Serializes like ${inp`Error`} but translates the error category to an HTTP status`,
)}

Additionally, the ${mod.Schema} module supports typing requests and request bodies for run-time validation of requests. 

${Section('Interceptors')}

${RestInterceptor}s  are a key part of the rest framework, to allow for conditional functions to be added, sometimes to every route, and other times to a select few. Express/Koa/Fastify are all built around the concept of middleware, and interceptors are a way of representing that.

${Code('A Trivial Intereptor', 'doc/interceptor-hello-world.ts')}

${Note('The example above defines the interceptor to run after another interceptor class. The framework will automatically sort the interceptors by the before/after reuirements to ensure the appropriate order of execution.')}

Out of the box, the rest framework comes with a few interceptors, and more are contributed by other modules as needed.  The default interceptor set is:
${Ordered(
  d`${SerializeInterceptor} - This is what actually sends the response to the requestor. Given the ability to prioritize interceptors, another interceptor can have higher priority and allow for complete customization of response handling.`,
  d`${CorsInterceptor} - This interceptor allows cors functionality to be configured out of the box, by setting properties in your ${pth`application.yml`}, specifically, ${inp`rest.cors.active: true`}
  ${Snippet('Cors Config', RestCorsConfig.ᚕfile, /class.*Config/, /^\}/)}`,
  d`${CookiesInterceptor} - This interceptor is responsible for processing inbound cookie headers and populating the appropriate data on the request, as well as sending the appropriate response data
  ${Snippet('Cookies Config', RestCookieConfig.ᚕfile, /class.*Config/, /^\}/)}`,
  d`${GetCacheInterceptor} - This interceptor, by default, disables caching for all GET requests if the response does not include caching headers.  This can be disabled by setting ${inp`res.disableGetCache: true`} in your config.`,
  d`${LoggingInterceptor} - This interceptor allows for logging of all requests, and their response codes.  You can deny/allow specific routes, by setting config like so\n
  ${Code('Control Logging', 'doc/resources/log.yml')}`,
)}

${Section('Creating and Running an App')}

By default, the framework provices a default ${Application} at ${DefaultRestApplication} that will follow default behaviors, and spin up the REST server.  You will need to install the ${mod.App} module to execute.  

${Install('Installing app support', '@travett/app')}

To customize a REST server, you may need to construct an entry point using the ${Application} decorator. This could look like:

${Code('Application entry point for Rest Applications', 'doc/custom-app.ts')}

And using the pattern established in the ${mod.App} module, you would run your program using ${Command('npx trv run custom')}.

${Section('Custom Interceptors')}
Additionally it is sometimes necessary to register custom interceptors.  Interceptors can be registered with the ${mod.Di} by extending the ${RestInterceptor} class.  The interceptors are tied to the defined ${Request} and ${Response} objects of the framework, and not the underlying app framework.  This allows for Interceptors to be used across multiple frameworks as needed. A simple logging interceptor:

${Code('Defining a new Interceptor', 'doc/interceptor-logging.ts')}

A ${inp`next`} parameter is also available to allow for controlling the flow of the request, either by stopping the flow of interceptors, or being able to determine when a request starts, and when it is ending.

${Code('Defining a fully controlled Interceptor', 'doc/interceptor-controlled.ts')}

Currently ${mod.AssetRest} is implemented in this fashion, as well as ${mod.AuthRest}.

${Section('Cookie Support')}
Express/Koa/Fastify all have their own cookie implementations that are common for each framework but are somewhat incompatible.  To that end, cookies are supported for every platform, by using ${lib.Cookies}.  This functionality is exposed onto the ${Request}/${Response} object following the pattern set forth by Koa (this is the library Koa uses).  This choice also enables better security support as we are able to rely upon standard behavior when it comes to cookies, and signing.

${Code('Sample Cookie Usage', 'doc/cookie-routes.ts')}

${Section('SSL Support')}

Additionally the framework supports SSL out of the box, by allowing you to specify your public and private keys for the cert.  In dev mode, the framework will also automatically generate a self-signed cert if:
${List(
  'SSL support is configured',
  d`${lib.NodeForge} is installed`,
  'No keys provided'
)}

This is useful for local development where you implicitly trust the cert.

SSL support can be enabled by setting ${inp`rest.ssl.active: true`} in your config. The key/cert can be specified as string directly in the config file/environment variables.  The key/cert can also be specified as a path to be picked up by the ${ResourceManager}.

${Section('Full Config')}
The entire ${RestConfig} which will show the full set of valid configuration parameters for the rest module.

${Section('Serverless')}
${SubSection('AWS Lambda')}

The module provides support basic support with AWS lambdas. When using one of the specific rest modules (e.g. ${mod.RestExpress}), you can install the appropriate lambda-related dependencies installed (e.g. ${lib.AwsServerlessExpress}) to enable integration with AWS.  Nothing in the code needs to be modified to support the AWS integration, but there are some limitations of using AWS Lambdas as HTTP handlers. 

${Section('Packaging Lambdas')}

${Execute('Invoking a Package Build', 'trv', ['pack', 'rest/lambda', '-h'])}


${Section('Extension - Schema')}

The module provides high level access for ${mod.Schema} support, via decorators, for validating and typing request bodies.

${SchemaBody} provides the ability to convert the inbound request body into a schema bound object, and provide validation before the controller even receives the request.

${Code(d`Using ${SchemaBody.name} for POST requests`, 'doc/schema-body.ts')}

${SchemaQuery} provides the ability to convert the inbound request query into a schema bound object, and provide validation before the controller even receives the request.

${Code(d`Using ${SchemaQuery.name} for GET requests`, 'doc/schema-query.ts')}

Addtionally, ${SchemaQuery} and ${SchemaBody} can also be used with ${inp`interface`}s and ${inp`type`} literals in lieu of classes. This is best suited for simple types:

${Code(d`Using ${SchemaQuery.name} with a type literal`, 'doc/schema-query-type.ts')}


${Section('Extension - Model')}

To facilitate common RESTful patterns, the module exposes  ${mod.Model} support in the form of ${ModelController}.

${Code('ModelController example', 'doc/controller-with-model.ts')}

is a shorthand that is equal to:

${Code('Comparable UserController, built manually', 'doc/controller-without-model.ts')}

`;
