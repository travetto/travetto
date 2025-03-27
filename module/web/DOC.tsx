/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { Field, Schema } from '@travetto/schema';
import { CliCommand } from '@travetto/cli';
import { RuntimeResources, toConcrete } from '@travetto/runtime';

import { HttpInterceptor } from './src/interceptor/types';
import { WebApplication } from './src/application/app';
import { Controller } from './src/decorator/controller';
import { Get, Post, Put, Delete, Patch, Head, Options } from './src/decorator/endpoint';
import { PathParam, QueryParam, Body, Param, HeaderParam, ContextParam } from './src/decorator/param';
import { BodyParseInterceptor, BodyParseConfig } from './src/interceptor/body-parse';
import { CorsInterceptor, CorsConfig } from './src/interceptor/cors';
import { GetCacheInterceptor } from './src/interceptor/get-cache';
import { LoggingInterceptor } from './src/interceptor/logging';
import { CookiesInterceptor, CookieConfig } from './src/interceptor/cookies';
import { WebConfig } from './src/application/config';
import { HttpRequest } from './src/types';
import { AsyncContextInterceptor } from './src/interceptor/context';
import { CacheControl } from './src/decorator/common';
import { WebContext } from './src/context';
import { RespondInterceptor } from './src/interceptor/respond';

const HttpRequestContract = toConcrete<HttpRequest>();
const HttpInterceptorContract = toConcrete<HttpInterceptor>();

export const text = <>
  <c.StdHeader />
  The module provides a declarative API for creating and describing an Web application.  Since the framework is declarative, decorators are used to configure almost everything. This module is built upon the {d.mod('Schema')} structure, and all controller method parameters follow the same rules/abilities as any {Field} in a standard {Schema} class.

  <c.Section title='Controller'>
    To define an endpoint, you must first declare a {Controller} which is only allowed on classes. Controllers can be configured with:

    <ul>
      <li>{d.input('title')} - The definition of the controller</li>
      <li>{d.input('description')} - High level description fo the controller</li>
    </ul>

    Additionally, the module is predicated upon {d.mod('Di')}, and so all standard injection techniques (constructor, fields) work for registering dependencies. <br />

    {d.library('JSDoc')} comments can also be used to define the {d.input('title')} attribute.

    <c.Code title='Basic Controller Registration' src='doc/simple-controller.ts' />
  </c.Section>

  <c.Section title='Endpoints'>

    Once the controller is declared, each method of the controller is a candidate for routing.  By design, everything is asynchronous, and so async/await is natively supported. <br />

    The HTTP methods that are supported via:
    <ul>
      <li>{Get}</li>
      <li>{Post}</li>
      <li>{Put}</li>
      <li>{Delete}</li>
      <li>{Patch}</li>
      <li>{Head}</li>
      <li>{Options}</li>
    </ul>


    Each endpoint decorator handles the following config:
    <ul>
      <li>{d.input('title')} - The definition of the endpoint</li>
      <li>{d.input('description')} - High level description fo the endpoint</li>
      <li>{d.input('responseType?')} - Class describing the response type</li>
      <li>{d.input('requestType?')} - Class describing the request body</li>
    </ul>

    {d.library('JSDoc')} comments can also be used to define the {d.input('title')} attribute, as well as describing the parameters using {d.input('@param')} tags in the comment. <br />

    Additionally, the return type of the method will also be used to describe the {d.input('responseType')} if not specified manually.

    <c.Code title='Controller with Sample Endpoint' src='doc/simple-endpoint.ts' />

    <c.Note>In development mode the module supports hot reloading of {d.input('class')}es.  Endpoints can be added/modified/removed at runtime.</c.Note>

    <c.SubSection title='Parameters'>
      Endpoints can be configured to describe and enforce parameter behavior.  Request parameters can be defined in five areas:
      <ul>
        <li>{PathParam} - Path params</li>
        <li>{QueryParam} - Query params</li>
        <li>{Body} - Request body (in it's entirety), with support for validation</li>
        <li>{HeaderParam} - Header values</li>
      </ul>

      Each {Param} can be configured to indicate:
      <ul>
        <li>{d.input('name')} - Name of param, field name, defaults to handler parameter name if necessary</li>
        <li>{d.input('description')} - Description of param, pulled from {d.library('JSDoc')}, or defaults to name if empty</li>
        <li>{d.input('required?')} - Is the field required?, defaults to whether or not the parameter itself is optional</li>
        <li>{d.input('type')} - The class of the type to be enforced, pulled from parameter type</li>
      </ul>

      {d.library('JSDoc')} comments can also be used to describe parameters using {d.input('@param')} tags in the comment.

      <c.Code title='Full-fledged Controller with Endpoints' src='doc/simple-full.ts' />
    </c.SubSection>

    <c.SubSection title='ContextParam'>
      In addition to endpoint parameters (i.e. user-provided inputs), there may also be a desire to access indirect contextual information.  Specifically you may need access to the entire {HttpRequestContract}.  These are able to be injected using the {ContextParam} on a class-level field from the {WebContext}.  These are not exposed as endpoint parameters as they cannot be provided when making RPC invocations.

      <c.Code title='Example ContextParam usage' src='doc/context-param.ts'></c.Code>

      <c.Note>When referencing the {ContextParam} values, the contract for idempotency needs to be carefully inspected to ensure idempotency, if expected. You can see in the example above that the {CacheControl} decorator is used to ensure that the response is not cached.</c.Note>
    </c.SubSection>

    <c.SubSection title='Body and QuerySchema'>

      The module provides high level access for {d.mod('Schema')} support, via decorators, for validating and typing request bodies. <br />

      {Body} provides the ability to convert the inbound request body into a schema bound object, and provide validation before the controller even receives the request.

      <c.Code title='Using Body for POST requests' src='doc/schema-body.ts' />

      The framework provides the ability to convert the inbound request query into a schema bound object, and provide validation before the controller even receives the request.

      <c.Code title='Using Query + Schema for GET requests' src='doc/schema-query.ts' />

      Additionally, schema related inputs can also be used with {d.input('interface')}s and {d.input('type')} literals in lieu of classes. This is best suited for simple types:

      <c.Code title='Using QuerySchema with a type literal' src='doc/schema-query-type.ts' />
    </c.SubSection>
  </c.Section>

  <c.Section title='Input/Output'>

    The module provides standard structure for rendering content on the response.  This includes:
    <ul>
      <li>JSON</li>
      <li>String responses</li>
      <li>Files</li>
    </ul>

    Per the {d.mod('Runtime')} module, the following types automatically have web support as well:
    <ul>
      <li>{d.input('Error')} - Serializes to a standard object, with status, and the error message.</li>
      <li>{d.input('AppError')} - Serializes like {d.input('Error')} but translates the error category to an HTTP status</li>
    </ul>

    Additionally, the {d.mod('Schema')} module supports typing requests and request bodies for run-time validation of requests.
  </c.Section>

  <c.Section title='Running an App'>

    By default, the framework provides a default {CliCommand} for {WebApplication} that will follow default behaviors, and spin up the Web server.

    <c.Execution title='Standard application' cmd='trv' args={['run:web']} config={{
      cwd: './doc-exec'
    }} />

    <c.SubSection title='Creating a Custom CLI Entry Point'>

      To customize a Web server, you may need to construct an entry point using the {CliCommand} decorator. This could look like:

      <c.Code title='Application entry point for Web Applications' src='doc/cli.run_web_custom.ts' />

      And using the pattern established in the {d.mod('Cli')} module, you would run your program using {d.command('npx trv run:web:custom')}.

      <c.Execution title='Custom application' cmd='trv' args={['run:web:custom']} config={{ cwd: './doc-exec' }} />
    </c.SubSection>
  </c.Section>

  <c.Section title='Interceptors'>

    {HttpInterceptorContract}s  are a key part of the web framework, to allow for conditional functions to be added, sometimes to every endpoint, and other times to a select few. Express/Koa/Fastify are all built around the concept of middleware, and interceptors are a way of representing that.

    <c.Code title='A Trivial Interceptor' src='doc/interceptor-hello-world.ts' />

    <c.Note>The example above defines the interceptor to run after another interceptor class. The framework will automatically sort the interceptors by the before/after requirements to ensure the appropriate order of execution.</c.Note>

    Out of the box, the web framework comes with a few interceptors, and more are contributed by other modules as needed.  The default interceptor set is:

    <c.SubSection title={BodyParseInterceptor.name}>
      {BodyParseInterceptor} handles the inbound request, and converting the body payload into an appropriate format.Additionally it exposes the original request as the raw property on the request.

      <c.Code title='Body Parse Config' src={BodyParseConfig} />
    </c.SubSection>
    <c.SubSection title={RespondInterceptor.name}>
      {RespondInterceptor} is what actually sends the response to the requestor. Given the ability to prioritize interceptors, another interceptor can have higher priority and allow for complete customization of response handling.
    </c.SubSection>
    <c.SubSection title={CorsInterceptor.name}>
      {CorsInterceptor} allows cors functionality to be configured out of the box, by setting properties in your {d.path('application.yml')}, specifically, the {d.input('web.cors')} config space.

      <c.Code title='Cors Config' src={CorsConfig} />
    </c.SubSection>
    <c.SubSection title={CookiesInterceptor.name}>
      {CookiesInterceptor} is responsible for processing inbound cookie headers and populating the appropriate data on the request, as well as sending the appropriate response data

      <c.Code title='Cookies Config' src={CookieConfig} />
    </c.SubSection>
    <c.SubSection title={GetCacheInterceptor.name}>
      {GetCacheInterceptor} by default, disables caching for all GET requests if the response does not include caching headers.  This can be managed by setting {d.input('web.getCache.applies: <boolean>')} in your config.  This interceptor applies by default.
    </c.SubSection>
    <c.SubSection title={LoggingInterceptor.name}>
      {LoggingInterceptor} allows for logging of all requests, and their response codes.  You can deny/allow specific endpoints, by setting config like so

      <c.Code title='Control Logging' src='doc/log.yml' />
    </c.SubSection>
    <c.SubSection title={AsyncContextInterceptor.name}>
      {AsyncContextInterceptor} is responsible for sharing context across the various layers that may be touched by a request. This interceptor can be noisy, and so can easily be disabled as needed by setting {d.input('web.log.applies: false')} in your config.
    </c.SubSection>

    <c.SubSection title='Custom Interceptors'>
      Additionally it is sometimes necessary to register custom interceptors.  Interceptors can be registered with the {d.mod('Di')} by implementing the {HttpInterceptorContract} interface.  The interceptors are tied to the defined {HttpRequestContract} object of the framework, and not the underlying app framework.  This allows for Interceptors to be used across multiple frameworks as needed. A simple logging interceptor:

      <c.Code title='Defining a new Interceptor' src='doc/interceptor-logging.ts' />

      A {d.input('next')} parameter is also available to allow for controlling the flow of the request, either by stopping the flow of interceptors, or being able to determine when a request starts, and when it is ending.

      <c.Code title='Defining a fully controlled Interceptor' src='doc/interceptor-controlled.ts' />

      Currently {d.mod('WebUpload')} is implemented in this fashion, as well as {d.mod('AuthWeb')}.
    </c.SubSection>
    <c.SubSection title='Configuring Interceptors'>
      All framework-provided interceptors, follow the same patterns for general configuration.  This falls into three areas:
      <c.SubSubSection title='Enable/disable of individual interceptors via configuration'>
        <c.Code title='Sample interceptor disabling configuration' src='doc/disable.yml' />
      </c.SubSubSection>
      <c.SubSubSection title='Endpoint-enabled control via decorators'>
        <c.Code title='Sample controller with endpoint-level allow/deny' src='doc/controller-endpoint-deny.ts' />
      </c.SubSubSection>

      The resolution logic is as follows:
      <ul>
        <li>Determine if interceptor is disabled, this takes precedence.</li>
        <li>Check the endpoint against the path allow/deny list.  If matched (positive or negative), this wins.</li>
        <li>Finally check to see if the interceptor has custom applies logic.  If it does, match against the configuration for the endpoint.</li>
        <li>By default, if nothing else matched, assume the interceptor is valid.</li>
      </ul>
    </c.SubSection>
  </c.Section>
  <c.Section title='Cookie Support'>
    {d.library('Express')}/{d.library('Koa')}/{d.library('Fastify')} all have their own cookie implementations that are common for each framework but are somewhat incompatible.  To that end, cookies are supported for every platform, by using {d.library('Cookies')}.  This functionality is exposed onto the {HttpRequestContract} object following the pattern set forth by Koa (this is the library Koa uses).  This choice also enables better security support as we are able to rely upon standard behavior when it comes to cookies, and signing.

    <c.Code title='Sample Cookie Usage' src='doc/cookie-endpoints.ts' />
  </c.Section>

  <c.Section title='SSL Support'>
    Additionally the framework supports SSL out of the box, by allowing you to specify your public and private keys for the cert.  In dev mode, the framework will also automatically generate a self-signed cert if:

    <ul>
      <li>SSL support is configured</li>
      <li>{d.library('NodeForge')} is installed</li>
      <li>Not running in prod</li>
      <li>No keys provided</li>
    </ul>

    This is useful for local development where you implicitly trust the cert. <br />

    SSL support can be enabled by setting {d.input('web.ssl.active: true')} in your config. The key/cert can be specified as string directly in the config file/environment variables.  The key/cert can also be specified as a path to be picked up by {RuntimeResources}.
  </c.Section>

  <c.Section title='Full Config'>
    The entire {WebConfig} which will show the full set of valid configuration parameters for the web module.
  </c.Section>
</>;
