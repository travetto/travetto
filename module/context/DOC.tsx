/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';

import { AsyncContext, WithAsyncContext } from '@travetto/context';

export const text = <>
  <c.StdHeader />
  This module provides a wrapper around node's {d.library('AsyncHooks')} to maintain context across async calls. This is generally used for retaining contextual user information at various levels of async flow. <br />

  The most common way of utilizing the context, is via the {WithAsyncContext} decorator.  The decorator requires the class it's being used in, to have a {AsyncContext} member, as it is the source of the contextual information. <br />

  The decorator will load the context on invocation, and will keep the context active during the entire asynchronous call chain. <br />

  <strong>NOTE:</strong> while access properties by string works, it is generally best practice to generate a symbol, and use that for isolated access into the shared storage.  This storage is common amongst the entire runtime (for a given async operation), and so the only way to guarantee proper isolation of data is via symbols.

  <c.Code title='Usage of context within a service' src='doc/usage.ts' />

  The decorator also allows for a priming of the contextual information.  This is generally useful for system generated operations that are not initiated by a user.

  <c.Code title='Usage of context within a service' src='doc/usage-primed.ts' />
</>;