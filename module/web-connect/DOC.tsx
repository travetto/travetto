/** @jsxImportSource @travetto/doc */
import { c, d } from '@travetto/doc';
import { WebRequest, WebResponse } from '@travetto/web';

export const text = <>
  <c.StdHeader />
  This module provides basic integration for calling {d.library('Connect')} related middleware with {d.mod('Web')}. This logic is not intended to be exhaustive, but intended to provide a quick bridge.  This only consumer of this is {d.mod('AuthWebPassport')} as it needs to bind the {WebRequest} and {WebResponse} to standard contracts for {d.library('Passport')}. <br />

  This module is already most likely compatible with quite a bit of middleware, but will fail under any of the following conditions:
  <ul>
    <li>The calling code expects the request or response to be a proper {d.library('NodeEventEmitter')}</li>
    <li>The calling code expects the request/response sockets to be live.</li>
    <li>The calling code modifies the shape of the objects (e.g. rewrites the close method on response).</li>
  </ul>

  Barring these exceptions, gaps will be filled in as more use cases arise.  The above exceptions are non-negotiable as they are are enforced by the invocation method defined by {d.mod('Web')}.

  <c.Code src='../auth-web-passport/src/authenticator.ts' startRe={/\sauthenticate\b/} title='Example of using the Connect Adaptor with Passport' />
</>;
