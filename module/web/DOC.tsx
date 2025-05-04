/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { toConcrete } from '@travetto/runtime';
import { Injectable } from '@travetto/di';

import { Controller } from './src/decorator/controller.ts';
import { Get, Post, Put, Delete, Patch, Head, Options, Endpoint } from './src/decorator/endpoint.ts';
import { PathParam, QueryParam, Body, Param, HeaderParam, ContextParam } from './src/decorator/param.ts';
import { BodyInterceptor, WebBodyConfig } from './src/interceptor/body.ts';
import { CorsInterceptor, CorsConfig } from './src/interceptor/cors.ts';
import { ResponseCacheInterceptor } from './src/interceptor/response-cache.ts';
import { LoggingInterceptor, WebLogConfig } from './src/interceptor/logging.ts';
import { CookieInterceptor, CookieConfig } from './src/interceptor/cookie.ts';
import { WebConfig } from './src/config.ts';
import { WebRequest } from './src/types/request.ts';
import { WebInterceptor } from './src/types/interceptor.ts';
import { AsyncContextInterceptor } from './src/interceptor/context.ts';
import { CacheControl } from './src/decorator/common.ts';
import { WebAsyncContext } from './src/context.ts';
import { RespondInterceptor } from './src/interceptor/respond.ts';
import { BaseWebMessage } from './src/types/message.ts';
import { WebResponse } from './src/types/response.ts';
import { CompressConfig, CompressInterceptor } from './src/interceptor/compress.ts';
import { AcceptConfig, AcceptInterceptor } from './src/interceptor/accept.ts';
import { DecompressConfig, DecompressInterceptor } from './src/interceptor/decompress.ts';
import { EtagConfig, EtagInterceptor } from './src/interceptor/etag.ts';
import { TrustProxyConfig, TrustProxyInterceptor } from './src/interceptor/trust-proxy.ts';


const WebInterceptorContract = toConcrete<WebInterceptor>();

export const text = <>
  <c.StdHeader />
  The module provides a declarative API for creating and describing a Web application.  Since the framework is declarative, decorators are used to configure almost everything. The general layout of an application is a collection of {Controller}s that employ some combination of {WebInterceptorContract}s to help manage which functionality is executed before the {Endpoint} code, within the {Controller}.

  This module will look at:
  <ul>
    <li>Request/Response Pattern</li>
    <li>Defining a {Controller}</li>
    <li>Defining an {Endpoint}s</li>
    <li>Using {WebInterceptorContract}s</li>
    <li>Creating a Custom {WebInterceptorContract}</li>
    <li>Cookies</li>
    <li>Error Handling</li>
  </ul>

  <c.Section title='Request/Response Pattern'>
    Unlike other frameworks (e.g. {d.library('Express')}, {d.library('Fastify')}), this module takes an approach that is similar to {d.library('AwsLambda')}'s model for requests and responses. What you can see here is that {WebRequest} and {WebResponse} are very simple objects, with the focus being on the {d.field('payload')} and {d.field('body')}.  This is intended to provide maximal compatibility with non-HTTP sources.  The driving goal is to support more than just standard HTTP servers but also allow for seamless integration with tools like event queues, web sockets, etc.

    <c.Code title='Base Shape' src={BaseWebMessage} outline />
    <c.Code title='Request Shape' src='./src/types/request.ts' />
    <c.Code title='Response Shape' src='./src/types/response.ts' />

    These objects do not represent the underlying sockets provided by various http servers, but in fact are simple wrappers that track the flow through the call stack of the various {WebInterceptorContract}s and the {Endpoint} handler.  One of the biggest departures here, is that the response is not an entity that is passed around from call-site to call-site, but is is solely a return-value.  This doesn't mean the return value has to be static and pre-allocated, on the contrary streams are still supported.  The difference here is that the streams/asynchronous values will be consumed until the response is sent back to the user. The {CompressInterceptor} is a good reference for transforming a {WebResponse} that can either be a stream or a fixed value.
  </c.Section>

  <c.Section title='Defining a Controller'>
    To start, we must define a {Controller}, which is only allowed on classes. Controllers can be configured with:

    <ul>
      <li>{d.input('path')} - The required context path the controller will operate atop</li>
      <li>{d.input('title')} - The definition of the controller</li>
      <li>{d.input('description')} - High level description fo the controller</li>
    </ul>

    Additionally, the module is predicated upon {d.mod('Di')}, and so all standard injection techniques (constructor, fields) work for registering dependencies. <br />

    {d.library('JSDoc')} comments can also be used to define the {d.input('title')} attribute.

    <c.Code title='Basic Controller Registration' src='doc/simple-controller.ts' />
  </c.Section>

  <c.Section title='Defining an Endpoint'>

    Once the controller is declared, each method of the controller is a candidate for being an endpoint.  By design, everything is asynchronous, and so async/await is natively supported. <br />

    The most common pattern is to register HTTP-driven endpoints.  The HTTP methods that are currently supported:
    <ul>
      <li>{Get}</li>
      <li>{Post}</li>
      <li>{Put}</li>
      <li>{Delete}</li>
      <li>{Patch}</li>
      <li>{Head}</li>
      <li>{Options}</li>
    </ul>

    Similar to the Controller, each endpoint decorator handles the following config:

    <ul>
      <li>{d.input('title')} - The definition of the endpoint</li>
      <li>{d.input('description')} - High level description fo the endpoint</li>
    </ul>

    {d.library('JSDoc')} comments can also be used to define the {d.input('title')} attribute, as well as describing the parameters using {d.input('@param')} tags in the comment. <br />

    The return type of the method will also be used to describe the {d.input('responseType')} if not specified manually.

    <c.Code title='Controller with Sample Endpoint' src='doc/simple-endpoint.ts' />

    <c.Note>In development mode the module supports hot reloading of {d.input('class')}es.  Endpoints can be added/modified/removed at runtime.</c.Note>

    <c.SubSection title='Parameters'>
      Endpoints can be configured to describe and enforce parameter behavior.  Request parameters can be defined in five areas:
      <ul>
        <li>{PathParam} - Path params</li>
        <li>{QueryParam} - Query params - can be either a single value or bind to a whole object</li>
        <li>{Body} - Request body</li>
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
      In addition to endpoint parameters (i.e. user-provided inputs), there may also be a desire to access indirect contextual information.  Specifically you may need access to the entire {WebRequest}.  These are able to be injected using the {ContextParam} on a class-level field from the {WebAsyncContext}.  These are not exposed as endpoint parameters as they cannot be provided when making RPC invocations.

      <c.Code title='Example ContextParam usage' src='doc/context-param.ts'></c.Code>

      <c.Note>When referencing the {ContextParam} values, the contract for idempotency needs to be carefully inspected, if expected. You can see in the example above that the {CacheControl} decorator is used to ensure that the response is not cached.</c.Note>
    </c.SubSection>

    <c.SubSection title='Validating Inputs'>

      The module provides high level access for {d.mod('Schema')} support, via decorators, for validating and typing request inputs. <br />

      By default, all endpoint parameters are validated for type, and any additional constraints added (required, vs optional, minlength, etc).  Each parameter location ({PathParam}, {Body}, {QueryParam}, {HeaderParam}) primarily provides a source to bind the endpoint arguments from.  Once bound, the module will validate that the provided arguments are in fact valid. All validation will occur before the endpoint is ever executed, ensuring a strong contract.

      <c.Code title='Using Body for POST requests' src='doc/schema-body.ts' />

      <c.Code title='Using Query + Schema for GET requests' src='doc/schema-query.ts' />

      Additionally, schema related inputs can also be used with {d.input('interface')}s and {d.input('type')} literals in lieu of classes. This is best suited for simple types:

      <c.Code title='Using QuerySchema with a type literal' src='doc/schema-query-type.ts' />
    </c.SubSection>
  </c.Section>

  <c.Section title='Using Interceptors'>

    {WebInterceptorContract}s are a key part of the web framework, to allow for conditional functionality to be added, across all endpoints.

    <c.SubSection title='Anatomy of an Interceptor'>
      <c.Code title='A Simple Interceptor' src='doc/interceptor-hello-world.ts' />

      In this example you can see the markers of a simple interceptor:

      <c.SubSubSection title='category'>
        {d.field('category')} - This represents the generally request lifecycle phase an interceptor will run in.  It can be customized further with {d.field('dependsOn')} and {d.field('runsBefore')} to control exact ordering within a category.  In this example {d.input('application')} represents the lowest priority, and will run right before the endpoint is executed.
      </c.SubSubSection>

      <c.SubSubSection title='applies'>
        {d.method('applies')} - This represents ability for the per-endpoint configuration to determine if an interceptor is applicable.  By default, all interceptors will auto-register on every endpoint. Some interceptors are opt-in, and control that by setting applies to constantly return {d.input('false')}.
      </c.SubSubSection>

      <c.SubSubSection title='filter'>
        {d.method('filter')} - This is the actual logic that will be invoked around the endpoint call, represented by {d.input('ctx.next()')}.  The next call passes control to the next interceptor all the way down to the endpoint, and then will pop back up the stack.  Code executed before {d.input('next()')} is generally used for request filtering, and code afterwards is generally used for response control.
      </c.SubSubSection>
    </c.SubSection>

    Out of the box, the web framework comes with a few interceptors, and more are contributed by other modules as needed.  The default interceptor set is (in order of execution):

    <c.SubSection title='Order of Execution'>
      <ol>
        <li>global - Intended to run outside of the request flow - {AsyncContextInterceptor}</li>
        <li>terminal - Handles once request and response are finished building - {LoggingInterceptor}, {RespondInterceptor}</li>
        <li>pre-request - Prepares the request for running - {TrustProxyInterceptor}</li>
        <li>request - Handles inbound request, validation, and body preparation - {DecompressInterceptor}, {AcceptInterceptor}, {BodyInterceptor}, {CookieInterceptor} </li>
        <li>response - Prepares outbound response - {CompressInterceptor}, {CorsInterceptor}, {EtagInterceptor}, {ResponseCacheInterceptor} </li>
        <li>application - Lives outside of the general request/response behavior, {d.mod('AuthWeb')} uses this for login and logout flows.</li>
      </ol>
    </c.SubSection>

    <c.SubSection title='Packaged Interceptors'>

      <c.SubSubSection title={AsyncContextInterceptor.name}>
        {AsyncContextInterceptor} is responsible for sharing context across the various layers that may be touched by a request.  This
      </c.SubSubSection>

      <c.SubSubSection title={LoggingInterceptor.name}>
        {LoggingInterceptor} is used for logging the request/response, handling any error logging as needed. This interceptor can be noisy, and so can easily be disabled as needed by setting {d.input('web.log.applies: false')} in your config.

        <c.Code title='Web Log Config' src={WebLogConfig} />
      </c.SubSubSection>

      <c.SubSubSection title={RespondInterceptor.name}>
        {RespondInterceptor} is a basic catch-all that forces errors and data alike into a consistent format for sending back to the user.
      </c.SubSubSection>

      <c.SubSubSection title={TrustProxyInterceptor.name}>
        {TrustProxyInterceptor} allows for overriding connection information (host, ip, protocol) using {d.input('X-Forwarded-*')} headers.  This allows for proxied requests to retain access to the "source" request information as necessary.

        <c.Code title='TrustProxy Config' src={TrustProxyConfig} />
      </c.SubSubSection>

      <c.SubSubSection title={AcceptInterceptor.name}>
        {AcceptInterceptor} handles verifying the inbound request matches the allowed content-types. This acts as a standard gate-keeper for spurious input.

        <c.Code title='Accept Config' src={AcceptConfig} />
      </c.SubSubSection>

      <c.SubSubSection title={DecompressInterceptor.name}>
        {DecompressInterceptor} handles decompressing the inbound request, if supported.  This relies upon HTTP standards for content encoding, and negotiating the appropriate decompression scheme.

        <c.Code title='Decompress Config' src={DecompressConfig} />
      </c.SubSubSection>

      <c.SubSubSection title={CookieInterceptor.name}>
        {CookieInterceptor} is responsible for processing inbound cookie headers and populating the appropriate data on the request, as well as sending the appropriate response data

        <c.Code title='Cookies Config' src={CookieConfig} />
      </c.SubSubSection>

      <c.SubSubSection title={BodyInterceptor.name}>
        {BodyInterceptor} handles the inbound request, and converting the body payload into an appropriate format.

        <c.Code title='Body Config' src={WebBodyConfig} />
      </c.SubSubSection>

      <c.SubSubSection title={CompressInterceptor.name}>
        {CompressInterceptor} by default, will compress all valid outbound responses over a certain size, or for streams will cache every response. This relies on Node's {d.library('NodeZlib')} support for compression.

        <c.Code title='Compress Config' src={CompressConfig} />
      </c.SubSubSection>

      <c.SubSubSection title={EtagInterceptor.name}>
        {EtagInterceptor} by default, will tag all cacheable HTTP responses, when the response value/length is known.  Streams, and other async data sources do not have a pre-defined length, and so are ineligible for etagging.
        <c.Code title='ETag Config' src={EtagConfig} />
      </c.SubSubSection>

      <c.SubSubSection title={CorsInterceptor.name}>
        {CorsInterceptor} allows cors functionality to be configured out of the box, by setting properties in your {d.path('application.yml')}, specifically, the {d.input('web.cors')} config space.

        <c.Code title='Cors Config' src={CorsConfig} />
      </c.SubSubSection>

      <c.SubSubSection title={ResponseCacheInterceptor.name}>
        {ResponseCacheInterceptor} by default, disables caching for all GET requests if the response does not include caching headers.  This can be managed by setting {d.input('web.getCache.applies: <boolean>')} in your config.  This interceptor applies by default.
      </c.SubSubSection>
    </c.SubSection>

    <c.SubSection title='Configuring Interceptors'>
      All framework-provided interceptors, follow the same patterns for general configuration.  This falls into three areas:
      <c.SubSubSection title='Enable/disable of individual interceptors via configuration'>
        This applies only to interceptors that have opted in, to exposing a config, and tying that configuration to the applies logic.
        <c.Code title='Sample interceptor disabling configuration' src='doc/disable.yml' />
        <c.Code title='Configurable Interceptor' src={TrustProxyConfig} />
      </c.SubSubSection>
      <c.SubSubSection title='Endpoint-enabled control via decorators'>
        <c.Code title='Sample controller with endpoint-level allow/deny' src='doc/controller-endpoint-deny.ts' />
      </c.SubSubSection>

      The resolution logic is as follows:
      <ul>
        <li>Check the resolved {Endpoint}/{Controller} overrides to see if an interceptor is explicitly allowed or disallowed</li>
        <li>Default to {d.method('applies()')} logic for all available interceptors</li>
      </ul>
    </c.SubSection>
  </c.Section>

  <c.Section title='Creating a Custom WebInterceptor'>
    Additionally it may be desirable to create a custom interceptor.  Interceptors can be registered with the {d.mod('Di')} by implementing the {WebInterceptorContract} interface and adding an {Injectable} decorator. A simple logging interceptor:

    <c.Code title='Defining a new Interceptor' src='doc/interceptor-logging.ts' />

    When running an interceptor, if you chose to skip calling {d.method('ctx.next()')}, you will bypass all the downstream interceptors and return a response directly.

    <c.Code title='Defining a fully controlled Interceptor' src='doc/interceptor-controlled.ts' />
  </c.Section>

  <c.Section title='Cookie Support'>
    {d.library('Express')}/{d.library('Koa')}/{d.library('Fastify')} all have their own cookie implementations that are common for each framework but are somewhat incompatible.  To that end, cookies are supported for every platform, by using {d.library('Cookies')}.  This functionality is exposed onto the {WebRequest} object following the pattern set forth by Koa (this is the library Koa uses).  This choice also enables better security support as we are able to rely upon standard behavior when it comes to cookies, and signing.

    <c.Code title='Sample Cookie Usage' src='doc/cookie-endpoints.ts' />
  </c.Section>

  <c.Section title='Full Config'>
    The entire {WebConfig} which will show the full set of valid configuration parameters for the web module.
  </c.Section>
</>;
